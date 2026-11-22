/** Worker wrapper types; decode runs on the main thread. */

export interface AnalyzeResult {
  bpm: number
  beatGrid: number[]
  downbeats: number[]
  phrases: number[]
  energy: number
  key: string | null
}