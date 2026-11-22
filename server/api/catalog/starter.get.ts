import { defineEventHandler } from 'h3'

// Manifest is filled after redistribution rights are checked for starter tracks.
export default defineEventHandler(() => {
  return { songs: [] }
})