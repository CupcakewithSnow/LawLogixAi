import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey)

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
