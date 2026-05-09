// Background service worker for Smart Fill

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateAndFill') {
    handleGenerateAndFill(message.fields)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true // Keep channel open for async response
  }
})

const DEFAULT_PASSWORD = 'SmartFill@123'

async function handleGenerateAndFill(fields) {
  const settings = await getSettings()

  // Password fields are filled locally with the user's configured password
  // so the real password is never sent to OpenAI/Gemini.
  const passwordFields = fields.filter(f => f.type === 'password')
  const fieldsForAI = fields.filter(f => f.type !== 'password')

  let aiResult
  if (settings.provider === 'openai') {
    aiResult = await callOpenAI(fieldsForAI, settings)
  } else {
    aiResult = await callGemini(fieldsForAI, settings)
  }

  if (aiResult && aiResult.success) {
    aiResult.data = injectPasswordValues(aiResult.data || {}, passwordFields, settings)
  }
  return aiResult
}

function injectPasswordValues(data, passwordFields, settings) {
  if (!passwordFields.length) return data
  const customPassword = settings?.userProfile?.password
  const password = customPassword && customPassword.length > 0 ? customPassword : DEFAULT_PASSWORD

  passwordFields.forEach((field, index) => {
    const key = field.id || field.name || field.label || `field_${field.index ?? index}`
    data[key] = password
  })
  return data
}

function sanitizeProfileForAI(userProfile) {
  if (!userProfile) return {}
  const { password, ...rest } = userProfile
  return rest
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || {
        provider: 'openai',
        openaiKey: '',
        geminiKey: '',
        model: 'gpt-4o-mini',
        userProfile: {}
      })
    })
  })
}

async function callOpenAI(fields, settings) {
  if (!settings.openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const prompt = buildPrompt(fields, sanitizeProfileForAI(settings.userProfile))

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.openaiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a form-filling assistant. Given form fields and user profile data, generate appropriate values for each field. Return ONLY a valid JSON object where keys are field identifiers (use the "key" value provided for each field) and values are the suggested form values. Do not include any explanation, markdown formatting, or code blocks.

IMPORTANT: Generate VARIED and REALISTIC data each time. For fields not in the user profile:
- Use different realistic names, emails, phone numbers, addresses each generation
- Vary product names, descriptions, prices, quantities realistically
- Make each generation feel like a different real-world entry
- Don't repeat the same placeholder values - be creative but realistic

ALWAYS fill textarea fields (tagName="textarea" or type="textarea") with realistic multi-sentence content (2-4 sentences) appropriate to the field's label/placeholder (e.g. description, comments, bio, message, notes, address). Never omit a textarea from the response unless it is explicitly a search/filter/sort/pagination control.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'OpenAI API error')
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  try {
    return { success: true, data: JSON.parse(content) }
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return { success: true, data: JSON.parse(jsonMatch[0]) }
    }
    throw new Error('Failed to parse AI response')
  }
}

async function callGemini(fields, settings) {
  if (!settings.geminiKey) {
    throw new Error('Gemini API key not configured')
  }

  const prompt = buildPrompt(fields, sanitizeProfileForAI(settings.userProfile))

  // Use the selected Gemini model or default to gemini-2.0-flash
  const geminiModel = settings.geminiModel || 'gemini-2.0-flash-exp'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${settings.geminiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a form-filling assistant. Given form fields and user profile data, generate appropriate values for each field. Return ONLY a valid JSON object where keys are field identifiers (use the "key" value provided for each field) and values are the suggested form values. Do not include any explanation, markdown formatting, or code blocks.

IMPORTANT: Generate VARIED and REALISTIC data each time. For fields not in the user profile:
- Use different realistic names, emails, phone numbers, addresses each generation
- Vary product names, descriptions, prices, quantities realistically
- Make each generation feel like a different real-world entry
- Don't repeat the same placeholder values - be creative but realistic

ALWAYS fill textarea fields (tagName="textarea" or type="textarea") with realistic multi-sentence content (2-4 sentences) appropriate to the field's label/placeholder (e.g. description, comments, bio, message, notes, address). Never omit a textarea from the response unless it is explicitly a search/filter/sort/pagination control.

${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.9
        }
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Gemini API error')
  }

  const data = await response.json()
  const content = data.candidates[0].content.parts[0].text

  try {
    return { success: true, data: JSON.parse(content) }
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return { success: true, data: JSON.parse(jsonMatch[0]) }
    }
    throw new Error('Failed to parse AI response')
  }
}

function buildPrompt(fields, userProfile) {
  // Create a simplified field list with clear identifiers
  const simplifiedFields = fields.map((field, index) => {
    const identifier = field.id || field.name || field.label || `field_${index}`
    return {
      key: identifier,
      label: field.label,
      type: field.type,
      tagName: field.tagName,
      name: field.name,
      id: field.id,
      placeholder: field.placeholder,
      autocomplete: field.autocomplete,
      context: field.context,
      options: field.options
    }
  }).filter(f => f.label || f.placeholder || f.name || f.id)

  // Generate random seed for variation
  const randomSeed = Math.random().toString(36).substring(2, 10)
  const timestamp = Date.now()

  return `
User Profile Data:
${JSON.stringify(userProfile || {}, null, 2)}

Form Fields:
${JSON.stringify(simplifiedFields, null, 2)}

RANDOMIZATION SEED: ${randomSeed}-${timestamp}
(Use this seed to ensure unique, varied data generation - pick different names, values, quantities each time)

EXCLUSION RULES — DO NOT generate values for these (omit their keys entirely from the response):
- Search inputs: type="search", or label/placeholder/name/id containing words like "search", "find", "query", "lookup", or context/ancestorHint mentioning "search"
- Filter inputs and filter dropdowns: label/placeholder/name/id containing "filter", "filter by", "refine", or context/ancestorHint mentioning "filter"
- Sort dropdowns: label/placeholder/name/id containing "sort", "sort by", "order by"
- Pagination dropdowns: label/placeholder/name/id like "per page", "items per page", "rows per page", "page size", "show entries", or options that are only numeric counts (e.g. 10/25/50/100) used for paging
- Any control inside a toolbar/datatable/list-controls region (see context.ancestorHint) used to navigate or refine results rather than submit data

These controls operate the page UI; filling them would change the user's view, not submit data. Skip them.

INSTRUCTIONS:
1. For each remaining form field, use the "key" value as the JSON key in your response
2. Match user profile data to appropriate fields based on label/name/id/placeholder/autocomplete
3. For fields not in user profile, generate UNIQUE realistic sample data - vary names, numbers, descriptions
4. For select fields (excluding the pagination/filter/sort cases above), randomly choose from the available "options" (use the option value)
5. For textarea fields, ALWAYS produce 2-4 sentences of realistic content (e.g. product description, comments, bio, message, notes). Do NOT leave them blank, do NOT skip them, and do NOT use one-word answers
6. Return ONLY a valid JSON object, no markdown, no explanation
7. IMPORTANT: Generate different values each time - use varied realistic data, not repetitive placeholders

Example response format (note the textarea value is multi-sentence):
{"Product Name *": "Ibuprofen 200mg", "Generic Name": "Ibuprofen", "Category *": "Pain Relief", "description": "Fast-acting pain reliever suitable for headaches, muscle aches, and minor arthritis pain. Each tablet contains 200mg of ibuprofen. Take with food to reduce stomach upset."}
`
}

console.log('Smart Fill background service worker loaded')
