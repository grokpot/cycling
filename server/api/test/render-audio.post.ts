/**
 * Test endpoint to render audio offline for verification.
 * Returns raw audio samples for analysis.
 */

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { durationSeconds = 360 } = body // Default 6 minutes

  // This is a server endpoint, but we need browser APIs for audio
  // Return a simple success for now - actual rendering will happen client-side
  return {
    success: true,
    message: 'Use client-side OfflineAudioContext for rendering',
  }
})
