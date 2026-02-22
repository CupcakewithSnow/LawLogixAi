import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Dialog } from '@/lib/supabase'

const DEFAULT_TITLE = 'Новый диалог'

export function useDialogs() {
  const { user } = useAuth()
  const [dialogs, setDialogs] = useState<Dialog[]>([])
  const [currentDialogId, setCurrentDialogId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const fetchDialogs = async () => {
      const { data, error } = await supabase
        .from('dialogs')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (!error) setDialogs(data || [])
      if (data?.length && !currentDialogId) setCurrentDialogId(data[0].id)
    }
    fetchDialogs()
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('dialogs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dialogs', filter: `user_id=eq.${user.id}` },
        () => {
          supabase
            .from('dialogs')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .then(({ data }) => data && setDialogs(data))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const createDialog = async (): Promise<Dialog | null> => {
    if (!user) return null
    const { data, error } = await supabase
      .from('dialogs')
      .insert({ user_id: user.id, title: DEFAULT_TITLE })
      .select()
      .single()
    if (error) return null
    setDialogs((prev) => [data, ...prev])
    setCurrentDialogId(data.id)
    return data
  }

  const updateDialogTitle = async (id: string, title: string) => {
    await supabase.from('dialogs').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
  }

  return { dialogs, currentDialogId, setCurrentDialogId, createDialog, updateDialogTitle }
}
