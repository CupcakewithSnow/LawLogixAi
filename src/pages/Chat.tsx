import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { ragChat } from '@/lib/api'
import type { Source } from '@/lib/supabase'
import './Chat.css'
import { useDialogs } from '@/hooks/useDialogs'
import { useMessages } from '@/hooks/useMessages'

const DEFAULT_TITLE = 'Новый диалог'

export default function Chat() {
  const { signOut } = useAuth()
  const { dialogs, createDialog, setCurrentDialogId, currentDialogId, updateDialogTitle } = useDialogs()
  const { messages, addUserMessage, addAssistantMessage, loading } = useMessages(currentDialogId)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const text = input.trim()
    if (!text) return

    let dialogId = currentDialogId
    if (!dialogId) {
      const created = await createDialog()
      if (created) {
        dialogId = created.id
        setCurrentDialogId(dialogId)
      }
    }
    if (!dialogId) return

    setInput('')
    setSending(true)
    const isNewDialog = dialogs.find((d) => d.id === dialogId)?.title === DEFAULT_TITLE
    await addUserMessage(text, dialogId)
    try {
      const { content, sources } = await ragChat(dialogId, text)
      await addAssistantMessage(content, sources, dialogId)
      if (isNewDialog) updateDialogTitle(dialogId, text.slice(0, 50) || DEFAULT_TITLE)
    } catch (err) {
      console.error(err)
      await addAssistantMessage('Не удалось получить ответ. Попробуйте позже.', null, dialogId)
      if (isNewDialog) updateDialogTitle(dialogId, text.slice(0, 50) || DEFAULT_TITLE)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">LawLogix AI</span>
          <button type="button" className="btn-new-dialog" onClick={() => createDialog().then((d) => d && setCurrentDialogId(d.id))}>
            Новый диалог
          </button>
        </div>
        <ul className="dialog-list">
          {dialogs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={`dialog-item ${d.id === currentDialogId ? 'active' : ''}`}
                onClick={() => setCurrentDialogId(d.id)}
              >
                <span className="dialog-title">{d.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <button type="button" className="btn-logout" onClick={() => signOut()}>
            Выйти
          </button>
        </div>
      </aside>

      <main className="chat-main">
        {!currentDialogId ? (
          <div className="chat-empty">Выберите диалог или создайте новый.</div>
        ) : (
          <>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`message message-${m.role}`}>
                  <div className="message-content">{m.content}</div>
                  {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                    <SourcesBlock sources={m.sources} />
                  )}
                </div>
              ))}
              {(loading || sending) && (
                <div className="message message-assistant">
                  <div className="message-content typing">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                  </div>
                </div>
              )}
            </div>
            <form
              className="chat-input-row"
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            >
              <input
                type="text"
                className="chat-input"
                placeholder="Задайте вопрос по судебной практике..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending || loading}
              />
              <button type="submit" className="chat-send" disabled={!input.trim() || sending || loading}>
                Отправить
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

function SourcesBlock({ sources }: { sources: Source[] }) {
  return (
    <div className="sources-block">
      <div className="sources-title">Источники</div>
      <ul className="sources-list">
        {sources.slice(0, 8).map((s, i) => (
          <li key={s.id || i} className="source-item">
            {s.case_number && <span className="source-case">{s.case_number}</span>}
            <p className="source-content">{s.content}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
