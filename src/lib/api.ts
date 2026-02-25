import { supabase, } from './supabase'
import type { Source } from './supabase'

export async function ragChat(dialogId: string, userMessage: string): Promise<{ content: string; sources: Source[] }> {

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) throw new Error('Не авторизован')

  const { data, error } = await supabase.functions.invoke('rag-chat', {
    body: { dialogId: dialogId, message: userMessage }
  })

  if (error) {
    console.log(error)
    throw new Error("error");
  }

  return { content: data.content, sources: data.sources }
}
