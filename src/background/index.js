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

async function handleGenerateAndFill(fields) {
  const settings = await getSettings()

  if (settings.provider === 'openai') {
    return await callOpenAI(fields, settings)
  } else {
    return await callGemini(fields, settings)
  }
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

  const prompt = buildPrompt(fields, settings.userProfile)

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
          content: `You are a form-filling assistant. Given form fields and user profile data, generate appropriate values for each field. Return ONLY a valid JSON object where keys are field identifiers (use the "id" or "name" property) and values are the suggested form values. Do not include any explanation, markdown formatting, or code blocks.

IMPORTANT: Generate VARIED and REALISTIC data each time. For fields not in the user profile:
- Use different realistic names, emails, phone numbers, addresses each generation
- Vary product names, descriptions, prices, quantities realistically
- Make each generation feel like a different real-world entry
- Don't repeat the same placeholder values - be creative but realistic`
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

  const prompt = buildPrompt(fields, settings.userProfile)

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
                text: `You are a form-filling assistant. Given form fields and user profile data, generate appropriate values for each field. Return ONLY a valid JSON object where keys are field identifiers (use the "id" or "name" property) and values are the suggested form values. Do not include any explanation, markdown formatting, or code blocks.

IMPORTANT: Generate VARIED and REALISTIC data each time. For fields not in the user profile:
- Use different realistic names, emails, phone numbers, addresses each generation
- Vary product names, descriptions, prices, quantities realistically
- Make each generation feel like a different real-world entry
- Don't repeat the same placeholder values - be creative but realistic

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
    // Determine the best identifier for this field
    const identifier = field.id || field.name || field.label || `field_${index}`
    return {
      key: identifier,
      label: field.label,
      type: field.type,
      placeholder: field.placeholder,
      options: field.options // for select fields
    }
  }).filter(f => f.label) // Only include fields with labels

  // Generate random seed for variation
  const randomSeed = Math.random().toString(36).substring(2, 10)
  const timestamp = Date.now()

  return `
User Profile Data:
${JSON.stringify(userProfile || {}, null, 2)}

Form Fields to Fill:
${JSON.stringify(simplifiedFields, null, 2)}

RANDOMIZATION SEED: ${randomSeed}-${timestamp}
(Use this seed to ensure unique, varied data generation - pick different names, values, quantities each time)

INSTRUCTIONS:
1. For each form field, use the "key" value as the JSON key in your response
2. Match user profile data to appropriate fields based on the field's "label"
3. For fields not in user profile, generate UNIQUE realistic sample data - vary names, numbers, descriptions
4. For select fields, randomly choose from the available "options" (use the option value or text)
5. Skip search fields or fields that don't need filling
6. Return ONLY a valid JSON object, no markdown, no explanation
7. IMPORTANT: Generate different values each time - use varied realistic data, not repetitive placeholders

Example response format:
{"Product Name *": "Ibuprofen 200mg", "Generic Name": "Ibuprofen", "Category *": "Pain Relief"}
`
}

console.log('Smart Fill background service worker loaded')
