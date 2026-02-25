import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const githubToken = import.meta.env.GITHUB_MODELS_TOKEN


if (!supabaseUrl || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, publishableKey)

export type Dialog = {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  dialog_id: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[] | null
  created_at: string
}

export type Source = {
  id: string
  content: string
  case_number?: string
  similarity?: number
}
