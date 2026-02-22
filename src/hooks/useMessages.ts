import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message, Source } from '@/lib/supabase'

export function useMessages(dialogId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dialogId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('dialog_id', dialogId)
        .order('created_at', { ascending: true })
      if (!error) setMessages(data || [])
      setLoading(false)
    }
    fetchMessages()
  }, [dialogId])

  useEffect(() => {
    if (!dialogId) return
    const channel = supabase
      .channel(`messages:${dialogId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `dialog_id=eq.${dialogId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [dialogId])

  const addUserMessage = async (content: string, overrideDialogId?: string | null): Promise<void> => {
    const targetId = overrideDialogId ?? dialogId
    if (!targetId) return
    await supabase.from('messages').insert({ dialog_id: targetId, role: 'user', content, sources: null })
  }

  const addAssistantMessage = async (content: string, sources: Source[] | null, overrideDialogId?: string | null): Promise<void> => {
    const targetId = overrideDialogId ?? dialogId
    if (!targetId) return
    await supabase.from('messages').insert({ dialog_id: targetId, role: 'assistant', content, sources })
  }

  const sendMessage = async (userContent: string, assistantContent: string, sources: Source[] | null) => {
    await addUserMessage(userContent)
    await addAssistantMessage(assistantContent, sources)
  }

  return { messages, loading, sendMessage, setMessages, addUserMessage, addAssistantMessage }
}
