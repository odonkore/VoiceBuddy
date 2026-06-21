export const handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured. Add GEMINI_API_KEY to your environment variables.' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { text, sourceLang } = body
  if (!text || !sourceLang) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing text or sourceLang' }) }
  }

  const LANG_NAMES = {
    hi: 'Hindi', ha: 'Hausa', ak: 'Twi (Akan)', ee: 'Ewe'
  }
  const langName = LANG_NAMES[sourceLang] || sourceLang

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate the following ${langName} text to English. Return ONLY the English translation, no explanation, no quotes:\n\n${text}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Gemini API error' })
      }
    }

    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translation })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Translation request failed: ' + err.message })
    }
  }
}
