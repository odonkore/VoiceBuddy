export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const KHAYA_API_KEY = process.env.KHAYA_API_KEY

  // Parse multipart form data (audio blob + language)
  // Netlify passes body as base64 for binary
  let audioBuffer, language

  try {
    const body = JSON.parse(event.body)
    language = body.language
    // audio is sent as base64 string from frontend
    audioBuffer = Buffer.from(body.audioBase64, 'base64')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) }
  }

  if (!language || !audioBuffer) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing language or audio' }) }
  }

  // Map our codes to Khaya's language codes
  const KHAYA_LANG_MAP = { ak: 'tw', ee: 'ee' }
  const khayaLang = KHAYA_LANG_MAP[language] || language

  try {
    // Build FormData for Khaya API
    const { FormData, Blob } = await import('node-fetch').catch(() => ({ FormData: global.FormData, Blob: global.Blob }))
    const formData = new FormData()
    formData.append('audio', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm')
    formData.append('language', khayaLang)

    const headers = {}
    if (KHAYA_API_KEY) headers['Authorization'] = `Bearer ${KHAYA_API_KEY}`

    const response = await fetch('https://translation-api.ghananlp.org/asr/v1/transcribe', {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) throw new Error(`Khaya error: ${response.status}`)
    const data = await response.json()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcription: data.transcription || '', source: 'khaya' })
    }
  } catch (err) {
    // Return empty so frontend falls back gracefully
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcription: '', source: 'fallback', error: err.message })
    }
  }
}
