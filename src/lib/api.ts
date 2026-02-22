import { supabase } from './supabase'
import type { Source } from './supabase'

const base = import.meta.env.VITE_SUPABASE_URL
const FUNCTIONS_URL = base ? `${base.replace(/\/$/, '')}/functions/v1` : ''

export async function ragChat(dialogId: string, userMessage: string): Promise<{ content: string; sources: Source[] }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Не авторизован')

  const res = await fetch(`${FUNCTIONS_URL}/rag-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ dialog_id: dialogId, message: userMessage }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || res.statusText || 'Ошибка RAG')
  }

  return res.json()
}
