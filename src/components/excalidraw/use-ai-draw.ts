import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { streamChat, isConfigValid, getAIConfig, type ToolExecutor } from '@/lib/ai'
import { parseExcalidrawElements } from './element-parser'
import type { ExcalidrawWrapperRef, ElementSummary } from './wrapper'
import type { useChatHistory } from './use-chat-history'
import { useLocale } from '@/hooks/use-locale'
import { useToast } from '@/components/ui/toast'
import { onStorageError } from '@/lib/storage'

type ChatHistoryApi = ReturnType<typeof useChatHistory>

interface UseAiDrawOptions {
  excalidrawRef: RefObject<ExcalidrawWrapperRef | null>
  chatHistory: ChatHistoryApi
  selectedElements: ElementSummary[]
}

export function useAiDraw({
  excalidrawRef,
  chatHistory,
  selectedElements,
}: UseAiDrawOptions) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    currentSession,
    currentSessionId,
    isLoaded,
    createSession,
    addMessage,
    updateMessage,
  } = chatHistory

  useEffect(() => {
    return onStorageError(() => {
      showToast(t.storageFull, 4000)
    })
  }, [showToast, t.storageFull])

  // 同步画布与当前会话
  useEffect(() => {
    if (!isLoaded || !currentSessionId) return

    const syncCanvas = () => {
      if (!excalidrawRef.current?.isReady()) return false
      const canvasSessionId = excalidrawRef.current.getCurrentSessionId()
      if (canvasSessionId !== currentSessionId) {
        excalidrawRef.current.switchToSession(
          currentSessionId,
          currentSession?.useIndependentCanvas ?? false
        )
      }
      return true
    }

    if (syncCanvas()) return

    const interval = setInterval(() => {
      if (syncCanvas()) clearInterval(interval)
    }, 100)

    return () => clearInterval(interval)
  }, [
    isLoaded,
    currentSessionId,
    currentSession?.useIndependentCanvas,
    excalidrawRef,
  ])

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const send = useCallback(
    async (rawInput: string) => {
      if (!rawInput.trim() || isLoading) return false

      if (!isConfigValid(getAIConfig())) {
        showToast(t.configRequiredAlert, 3000)
        return false
      }

      const userMessage = rawInput.trim()
      setIsLoading(true)

      let sessionId = currentSessionId
      let historyBefore = currentSession?.messages ?? []
      if (!sessionId) {
        sessionId = createSession()
        historyBefore = []
      }

      addMessage(sessionId, 'user', userMessage)
      const assistantMessageId = addMessage(sessionId, 'assistant', '')

      let fullText = ''
      let processedLength = 0
      let hasGeneratedElements = false
      const generatedIds = new Set<string>()

      const toolExecutor: ToolExecutor = {
        getCanvasElements: () => excalidrawRef.current?.getCanvasState() || [],
        deleteElements: (ids) =>
          excalidrawRef.current?.deleteElements(ids) || {
            deleted: [],
            notFound: ids,
          },
        updateElements: (elements) =>
          excalidrawRef.current?.updateElements(elements) || {
            updated: [],
            notFound: elements.map((e) => e.id),
          },
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        await streamChat({
          userMessage,
          onChunk: (chunk) => {
            fullText += chunk
            updateMessage(sessionId!, assistantMessageId, fullText)

            const { elements, remainingBuffer } = parseExcalidrawElements(
              fullText,
              processedLength
            )
            if (elements.length > 0) {
              excalidrawRef.current?.addElements(elements)
              elements.forEach((el) => generatedIds.add(el.id))
              processedLength = fullText.length - remainingBuffer.length
              hasGeneratedElements = true
            }
          },
          onError: (error) => {
            console.error('Chat error:', error)
            updateMessage(
              sessionId!,
              assistantMessageId,
              `${t.errorPrefix}${error.message}`
            )
            showToast(t.generateFailed, 2000)
          },
          selectedElements,
          toolExecutor,
          signal: abortController.signal,
          history: historyBefore.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          canvasBounds: excalidrawRef.current?.getCanvasBounds() ?? null,
        })

        if (!abortController.signal.aborted) {
          const { elements } = parseExcalidrawElements(fullText, processedLength)
          if (elements.length > 0) {
            excalidrawRef.current?.addElements(elements)
            elements.forEach((el) => generatedIds.add(el.id))
            hasGeneratedElements = true
          }

          if (hasGeneratedElements) {
            excalidrawRef.current?.scrollToElements(Array.from(generatedIds))
            showToast(t.elementsGenerated, 2000)
          }
        }
      } finally {
        abortControllerRef.current = null
        setIsLoading(false)
      }

      return true
    },
    [
      isLoading,
      currentSessionId,
      currentSession?.messages,
      createSession,
      addMessage,
      updateMessage,
      selectedElements,
      excalidrawRef,
      showToast,
      t,
    ]
  )

  return {
    isLoading,
    send,
    abort,
  }
}
