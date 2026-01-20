// AI API utilities for OpenAI and Gemini
import { storage } from './storage.js'

export async function generateFormData(formFields, userProfile) {
  const settings = await storage.getSettings()

  if (settings.provider === 'openai') {
    return await callOpenAI(formFields, userProfile, settings)
  } else {
    return await callGemini(formFields, userProfile, settings)
  }
}

async function callOpenAI(formFields, userProfile, settings) {
  if (!settings.openaiKey) {
    throw new Error('OpenAI API key not configured. Please add it in settings.')
  }

  const prompt = buildPrompt(formFields, userProfile)

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
          content: `You are a form-filling assistant. Given form fields and user profile data, generate appropriate values for each field. Return ONLY a valid JSON object where keys are field identifiers and values are the suggested form values. Do not include any explanation or markdown formatting.

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
    return JSON.parse(content)
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('Failed to parse AI response')
  }
}

async function callGemini(formFields, userProfile, settings) {
  if (!settings.geminiKey) {
    throw new Error('Gemini API key not configured. Please add it in settings.')
  }

  const prompt = buildPrompt(formFields, userProfile)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiKey}`,
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
                text: `You are a form-filling assistant. Given form fields and user profile data, generate appropriate values for each field. Return ONLY a valid JSON object where keys are field identifiers and values are the suggested form values. Do not include any explanation or markdown formatting.

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
    return JSON.parse(content)
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('Failed to parse AI response')
  }
}

function buildPrompt(formFields, userProfile) {
  // Generate random seed for variation
  const randomSeed = Math.random().toString(36).substring(2, 10)
  const timestamp = Date.now()

  return `
User Profile:
${JSON.stringify(userProfile, null, 2)}

Form Fields to fill:
${JSON.stringify(formFields, null, 2)}

RANDOMIZATION SEED: ${randomSeed}-${timestamp}
(Use this seed to ensure unique, varied data generation)

Generate appropriate values for each form field based on the user profile. For fields not covered by the profile, generate UNIQUE and VARIED realistic values each time - use different names, numbers, descriptions. Never repeat the same placeholder data.
`
}
