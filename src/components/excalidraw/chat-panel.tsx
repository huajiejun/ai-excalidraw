import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Send,
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckSquare,
  Brain,
  ChevronDown,
  ChevronUp,
  Square,
} from 'lucide-react'
import type { ChatMessage, useChatHistory } from './use-chat-history'
import type { ExcalidrawWrapperRef, ElementSummary } from './wrapper'
import { removeJsonObjects, parseThinkingContent } from '@/lib/message-content'
import { useLocale } from '@/hooks/use-locale'
import type { useAiDraw } from './use-ai-draw'

type ChatHistoryApi = ReturnType<typeof useChatHistory>
type AiDrawApi = ReturnType<typeof useAiDraw>

interface ChatPanelProps {
  className?: string
  excalidrawRef?: React.RefObject<ExcalidrawWrapperRef | null>
  chatHistory: ChatHistoryApi
  aiDraw: AiDrawApi
  selectedElements: ElementSummary[]
}

export function ChatPanel({
  className,
  excalidrawRef,
  chatHistory,
  aiDraw,
  selectedElements,
}: ChatPanelProps) {
  const { t } = useLocale()
  const [input, setInput] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    sessions,
    currentSession,
    currentSessionId,
    isLoaded,
    createSession,
    deleteSession,
    switchSession,
  } = chatHistory

  const { isLoading, send, abort } = aiDraw

  const scrollToBottom = useCallback(() => {
    const container = messagesEndRef.current?.parentElement
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages, scrollToBottom])

  const handleSend = async () => {
    const value = input
    setInput('')
    const ok = await send(value)
    if (!ok) setInput(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleNewChat = () => {
    const newSessionId = createSession()
    excalidrawRef?.current?.switchToSession(newSessionId, true)
    setIsSidebarOpen(false)
  }

  if (!isLoaded) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className={cn('flex h-full', className)}>
      <div
        className={cn(
          'absolute md:relative z-10 h-full bg-card border-r border-border transition-all duration-300',
          isSidebarOpen ? 'w-64' : 'w-0 md:w-0'
        )}
      >
        {isSidebarOpen && (
          <div className="flex flex-col h-full p-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="w-full mb-3 gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.newChat}
            </Button>

            <div className="flex-1 overflow-y-auto space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    session.id === currentSessionId
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary/50'
                  )}
                  onClick={() => {
                    switchSession(session.id)
                    excalidrawRef?.current?.switchToSession(
                      session.id,
                      session.useIndependentCanvas ?? false
                    )
                    setIsSidebarOpen(false)
                  }}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm">{session.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/5">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>{t.appTitle}</span>
          </div>

          {excalidrawRef && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={handleNewChat}
            >
              <Plus className="w-3.5 h-3.5" />
              {t.newChat}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(!currentSession || currentSession.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center text-foreground/50">
              <Sparkles className="w-12 h-12 mb-4 text-primary/30" />
              <p className="text-lg font-medium mb-2">{t.appTitle}</p>
              <p className="text-sm max-w-xs">{t.appSubtitle}</p>
              <div className="mt-6 space-y-2 text-xs text-foreground/40">
                <p>{t.tryThese}</p>
                <p>{t.example1}</p>
                <p>{t.example2}</p>
                <p>{t.example3}</p>
              </div>
            </div>
          )}

          {currentSession?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-foreground/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t.aiThinking}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-foreground/50 hover:text-foreground"
                onClick={abort}
              >
                <Square className="w-3 h-3 fill-current" />
                {t.stop}
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {selectedElements.length > 0 && (
          <div className="px-3 py-2 bg-primary/10 border-b border-border">
            <div className="flex items-center gap-2 text-xs">
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-primary">
                {t.selectedCount(selectedElements.length)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selectedElements.slice(0, 10).map((el) => (
                <span
                  key={el.id}
                  className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-foreground/70"
                >
                  {el.id.slice(0, 8)}
                </span>
              ))}
              {selectedElements.length > 10 && (
                <span className="px-1.5 py-0.5 text-[10px] text-foreground/50">
                  {t.andMore(selectedElements.length)}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-border bg-card">
          <Card className="flex items-end gap-2 p-2 bg-secondary/5 border-border/50">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={t.placeholder}
              className="min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 p-2"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => {
                if (isLoading) abort()
                else void handleSend()
              }}
              disabled={!isLoading && !input.trim()}
              className="shrink-0 w-9 h-9"
            >
              {isLoading ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-secondary/50 text-foreground rounded-bl-md'
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {isUser ? message.content : <AssistantMessage content={message.content} />}
        </div>
      </div>
    </div>
  )
}

function ThinkingBlock({ content }: { content: string }) {
  const { t } = useLocale()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!content) return null

  return (
    <div className="mb-2 rounded-lg bg-primary/5 border border-primary/20 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary/70 hover:bg-primary/10 transition-colors"
        type="button"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">{t.thinking}</span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 py-2 text-xs text-foreground/60 border-t border-primary/10 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  )
}

function AssistantMessage({ content }: { content: string }) {
  const { t } = useLocale()
  const { thinking, main } = parseThinkingContent(content)
  const displayContent = removeJsonObjects(main)
  const isThinking = content.includes('<think>') && !content.includes('</think>')

  if (!displayContent && !thinking) {
    const hasElements =
      /"type"\s*:\s*"(rectangle|ellipse|diamond|text|arrow|line)"/.test(content)
    if (hasElements) {
      return <span className="text-foreground/50 italic">{t.generated}</span>
    }
    if (isThinking) {
      return (
        <div className="flex items-center gap-2 text-foreground/50 italic">
          <Brain className="w-4 h-4 animate-pulse" />
          <span>{t.thinkingNow}</span>
        </div>
      )
    }
    return <span className="text-foreground/50 italic">{t.generating}</span>
  }

  return (
    <>
      {thinking && <ThinkingBlock content={thinking} />}
      {displayContent || (
        <span className="text-foreground/50 italic">{t.generated}</span>
      )}
    </>
  )
}
