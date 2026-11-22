/** Supabase client placeholder until env vars are configured. */

export function getSupabase(): never {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured')
  }
  throw new Error('Supabase is not configured')
}