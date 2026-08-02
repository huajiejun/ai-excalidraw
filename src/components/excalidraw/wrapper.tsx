import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { Excalidraw, getCommonBounds, THEME } from '@excalidraw/excalidraw'
import type {
  ExcalidrawImperativeAPI,
  AppState,
  LibraryItem,
} from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  getDefaultElementProps,
  getTypeSpecificProps,
  type ParsedElement,
} from './element-parser'
import { createDebouncedWriter, removeStorage, readStorage } from '@/lib/storage'
import { excalidrawLangCode, getLocale } from '@/lib/i18n'
import '@excalidraw/excalidraw/index.css'

/**
 * 从 URL hash 解析 addLibrary 参数
 * 格式：#addLibrary=<encodedURL>&token=<token>
 */
function parseAddLibraryFromHash(): { libraryUrl: string; token: string } | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const libraryUrl = params.get('addLibrary')
  const token = params.get('token') || ''

  if (!libraryUrl) return null

  try {
    const url = new URL(libraryUrl)
    if (url.protocol !== 'https:') return null
  } catch {
    return null
  }

  return { libraryUrl, token }
}

async function fetchLibraryItems(url: string): Promise<LibraryItem[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch library: ${res.status}`)

  const data = await res.json()
  if (data.type !== 'excalidrawlib' || !Array.isArray(data.library)) {
    throw new Error('Invalid excalidrawlib format')
  }

  return data.library.map((elements: ExcalidrawElement[], index: number) => ({
    status: 'unpublished' as const,
    id: crypto.randomUUID ? crypto.randomUUID() : `lib-${Date.now()}-${index}`,
    created: Date.now(),
    elements,
  }))
}

export interface ElementSummary {
  id: string
  type: string
  text?: string
  x: number
  y: number
  width: number
  height: number
  strokeColor?: string
  backgroundColor?: string
  containerId?: string
}

export interface CanvasBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ExcalidrawWrapperRef {
  addElements: (elements: ParsedElement[]) => void
  clearCanvas: () => void
  getElements: () => readonly ExcalidrawElement[]
  getCanvasState: () => ElementSummary[]
  getSelectedElementsSummary: () => ElementSummary[]
  getCanvasBounds: () => CanvasBounds | null
  updateElements: (
    elements: ParsedElement[]
  ) => { updated: string[]; notFound: string[] }
  deleteElements: (ids: string[]) => { deleted: string[]; notFound: string[] }
  scrollToElements: (ids?: string[]) => void
  switchToSession: (sessionId: string | null, useIndependentCanvas?: boolean) => void
  getCurrentSessionId: () => string | null
  isReady: () => boolean
}

interface ExcalidrawWrapperProps {
  className?: string
  onElementsChange?: (elements: readonly ExcalidrawElement[]) => void
  onSelectionChange?: (selectedElements: ElementSummary[]) => void
  onThemeChange?: (theme: 'light' | 'dark') => void
  zenModeEnabled?: boolean
  initialSessionId?: string | null
  langCode?: string
}

const STORAGE_KEY_BASE = 'excalidraw-canvas-data'
const SHARED_STORAGE_KEY = 'excalidraw-canvas-data'

function getStorageKey(sessionId: string | null, useIndependentCanvas: boolean): string {
  if (!useIndependentCanvas || !sessionId) return SHARED_STORAGE_KEY
  return `${STORAGE_KEY_BASE}-${sessionId}`
}

function loadCanvasData(
  sessionId: string | null,
  useIndependentCanvas: boolean
): { elements: ExcalidrawElement[] } | null {
  if (typeof window === 'undefined') return null

  const storageKey = getStorageKey(sessionId, useIndependentCanvas)
  const parsed = readStorage<{ elements?: ExcalidrawElement[] } | null>(storageKey, null)

  if (!parsed || !Array.isArray(parsed.elements)) {
    if (parsed) removeStorage(storageKey)
    return null
  }

  const validElements = parsed.elements.filter(
    (el) => el && el.id && el.type && typeof el.x === 'number' && typeof el.y === 'number'
  )
  return { elements: validElements }
}

function summarizeElement(
  el: ExcalidrawElement,
  allElements?: readonly ExcalidrawElement[]
): ElementSummary {
  let text = 'text' in el ? (el.text as string | undefined) : undefined

  if (!text && el.boundElements && Array.isArray(el.boundElements) && allElements) {
    const boundTextElement = el.boundElements.find(
      (bound: { type: string; id: string }) => bound.type === 'text'
    )
    if (boundTextElement) {
      const textElement = allElements.find((e) => e.id === boundTextElement.id)
      if (textElement && 'text' in textElement && textElement.text) {
        text = textElement.text
      }
    }
  }

  return {
    id: el.id,
    type: el.type,
    text,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    containerId: 'containerId' in el ? (el.containerId ?? undefined) : undefined,
  }
}

export const ExcalidrawWrapper = forwardRef<ExcalidrawWrapperRef, ExcalidrawWrapperProps>(
  function ExcalidrawWrapper(
    {
      className,
      onElementsChange,
      onSelectionChange,
      onThemeChange,
      zenModeEnabled = false,
      initialSessionId = null,
      langCode,
    },
    ref
  ) {
    const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const lastSelectedIdsRef = useRef<string>('')
    const currentSessionIdRef = useRef<string | null>(initialSessionId)
    const currentUseIndependentCanvasRef = useRef<boolean>(false)
    const writerRef = useRef(
      createDebouncedWriter(getStorageKey(initialSessionId, false), 500)
    )
    const [initialData] = useState(() => loadCanvasData(initialSessionId, false))
    const resolvedLang = langCode ?? excalidrawLangCode(getLocale())

    const resetWriter = useCallback((sessionId: string | null, independent: boolean) => {
      writerRef.current.flush()
      writerRef.current = createDebouncedWriter(getStorageKey(sessionId, independent), 500)
    }, [])

    useEffect(() => {
      const libraryParams = parseAddLibraryFromHash()
      if (!libraryParams) return

      const checkAndLoad = () => {
        const api = excalidrawAPIRef.current
        if (!api) {
          setTimeout(checkAndLoad, 200)
          return
        }

        api
          .updateLibrary({
            libraryItems: fetchLibraryItems(libraryParams.libraryUrl),
            merge: true,
            prompt: true,
            openLibraryMenu: true,
            defaultStatus: 'unpublished',
          })
          .then(() => {
            history.replaceState(null, '', window.location.pathname + window.location.search)
          })
          .catch((err: unknown) => {
            console.warn('Failed to load library from URL:', err)
          })
      }

      checkAndLoad()
    }, [])

    useEffect(() => {
      const flush = () => writerRef.current.flush()
      window.addEventListener('beforeunload', flush)
      return () => {
        flush()
        window.removeEventListener('beforeunload', flush)
      }
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        addElements: (newElements: ParsedElement[]) => {
          const api = excalidrawAPIRef.current
          if (!api || !newElements || newElements.length === 0) return

          const currentElements = api.getSceneElements()
          const existingElementsMap = new Map(currentElements.map((el) => [el.id, el]))

          const elementsToUpdate: ParsedElement[] = []
          const elementsToAdd: ParsedElement[] = []
          const validTypes = ['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line']

          newElements.forEach((el) => {
            if (existingElementsMap.has(el.id)) {
              elementsToUpdate.push(el)
            } else if (
              el.type &&
              validTypes.includes(el.type as string) &&
              typeof el.x === 'number' &&
              typeof el.y === 'number'
            ) {
              elementsToAdd.push(el)
            }
          })

          let updatedElements = [...currentElements] as ExcalidrawElement[]

          if (elementsToUpdate.length > 0) {
            updatedElements = updatedElements.map((existingEl) => {
              const update = elementsToUpdate.find((el) => el.id === existingEl.id)
              if (!update) return existingEl
              return { ...existingEl, ...update } as ExcalidrawElement
            })
          }

          if (elementsToAdd.length > 0) {
            const newElementsWithDefaults = elementsToAdd.map(
              (el) =>
                ({
                  ...getDefaultElementProps(),
                  ...getTypeSpecificProps(el.type as string, el),
                  ...el,
                }) as ExcalidrawElement
            )
            updatedElements = [...updatedElements, ...newElementsWithDefaults]
          }

          api.updateScene({ elements: updatedElements })
        },
        clearCanvas: () => {
          const api = excalidrawAPIRef.current
          if (!api) return
          api.updateScene({ elements: [] })
          const storageKey = getStorageKey(
            currentSessionIdRef.current,
            currentUseIndependentCanvasRef.current
          )
          removeStorage(storageKey)
          writerRef.current.cancel()
        },
        deleteElements: (ids: string[]) => {
          const api = excalidrawAPIRef.current
          if (!api) return { deleted: [], notFound: ids }

          const currentElements = api.getSceneElements()
          const existingIds = new Set(currentElements.map((el) => el.id))

          const toDelete = new Set<string>()
          const notFound: string[] = []

          for (const id of ids) {
            if (existingIds.has(id)) toDelete.add(id)
            else notFound.push(id)
          }

          for (const el of currentElements) {
            if (toDelete.has(el.id) && el.boundElements && Array.isArray(el.boundElements)) {
              for (const bound of el.boundElements) {
                if (existingIds.has(bound.id)) toDelete.add(bound.id)
              }
            }
          }

          const remainingElements = currentElements.filter((el) => !toDelete.has(el.id))
          api.updateScene({ elements: remainingElements })

          return { deleted: Array.from(toDelete), notFound }
        },
        updateElements: (elements: ParsedElement[]) => {
          const api = excalidrawAPIRef.current
          if (!api) {
            return { updated: [], notFound: elements.map((e) => e.id) }
          }

          const currentElements = api.getSceneElements()
          const existingIds = new Set(currentElements.map((el) => el.id))
          const updates = new Map(elements.map((el) => [el.id, el]))
          const updated: string[] = []
          const notFound: string[] = []

          for (const el of elements) {
            if (existingIds.has(el.id)) updated.push(el.id)
            else notFound.push(el.id)
          }

          if (updated.length === 0) return { updated, notFound }

          const next = currentElements.map((existingEl) => {
            const update = updates.get(existingEl.id)
            if (!update) return existingEl
            return { ...existingEl, ...update } as ExcalidrawElement
          })

          api.updateScene({ elements: next })
          return { updated, notFound }
        },
        getElements: () => {
          const api = excalidrawAPIRef.current
          return api ? api.getSceneElements() : []
        },
        getCanvasState: () => {
          const api = excalidrawAPIRef.current
          if (!api) return []
          const allElements = api.getSceneElements()
          return allElements.map((el) => summarizeElement(el, allElements))
        },
        getSelectedElementsSummary: () => {
          const api = excalidrawAPIRef.current
          if (!api) return []
          try {
            const appState = api.getAppState()
            const selectedElementIds = appState?.selectedElementIds || {}
            const allElements = api.getSceneElements()
            const allElementsMap = new Map(allElements.map((el) => [el.id, el]))

            const selectedElements = allElements.filter(
              (el) => selectedElementIds[el.id] === true
            )

            const resultIds = new Set<string>()
            const result: ElementSummary[] = []

            for (const el of selectedElements) {
              if (!resultIds.has(el.id)) {
                resultIds.add(el.id)
                result.push(summarizeElement(el, allElements))
              }

              if (el.boundElements && Array.isArray(el.boundElements)) {
                for (const bound of el.boundElements) {
                  if (!resultIds.has(bound.id)) {
                    const boundEl = allElementsMap.get(bound.id)
                    if (boundEl) {
                      resultIds.add(bound.id)
                      result.push(summarizeElement(boundEl, allElements))
                    }
                  }
                }
              }
            }

            return result
          } catch {
            return []
          }
        },
        getCanvasBounds: () => {
          const api = excalidrawAPIRef.current
          if (!api) return null
          const elements = api.getSceneElements().filter((el) => !el.isDeleted)
          if (elements.length === 0) return null
          try {
            const [minX, minY, maxX, maxY] = getCommonBounds(elements)
            return { minX, minY, maxX, maxY }
          } catch {
            return null
          }
        },
        scrollToElements: (ids?: string[]) => {
          const api = excalidrawAPIRef.current
          if (!api) return
          const all = api.getSceneElements()
          const target =
            ids && ids.length > 0 ? all.filter((el) => ids.includes(el.id)) : all
          if (target.length === 0) return
          api.scrollToContent(target, { fitToContent: true, animate: true })
        },
        switchToSession: (sessionId: string | null, useIndependentCanvas = false) => {
          const api = excalidrawAPIRef.current
          if (!api) return

          const currentElements = api.getSceneElements()
          const activeElements = currentElements.filter((el) => !el.isDeleted)
          writerRef.current.write({ elements: activeElements })
          writerRef.current.flush()

          currentSessionIdRef.current = sessionId
          currentUseIndependentCanvasRef.current = useIndependentCanvas
          resetWriter(sessionId, useIndependentCanvas)

          const newData = loadCanvasData(sessionId, useIndependentCanvas)

          if (newData) {
            api.updateScene({ elements: newData.elements })
          } else if (useIndependentCanvas) {
            api.updateScene({ elements: [] })
          }
        },
        getCurrentSessionId: () => currentSessionIdRef.current,
        isReady: () => excalidrawAPIRef.current !== null,
      }),
      [resetWriter]
    )

    const handleChange = useCallback(
      (elements: readonly ExcalidrawElement[], appState: AppState) => {
        const activeElements = elements.filter((el) => !el.isDeleted)
        writerRef.current.write({ elements: activeElements })
        onElementsChange?.(activeElements)

        if (appState?.theme) {
          onThemeChange?.(appState.theme === THEME.DARK ? 'dark' : 'light')
        }

        if (appState?.selectedElementIds) {
          try {
            const currentKeys = Object.keys(appState.selectedElementIds).sort().join(',')
            if (currentKeys !== lastSelectedIdsRef.current) {
              lastSelectedIdsRef.current = currentKeys
              const api = excalidrawAPIRef.current
              if (api) {
                onSelectionChange?.(
                  // use the same summary path
                  (() => {
                    const allElements = elements
                    const allElementsMap = new Map(allElements.map((el) => [el.id, el]))
                    const selectedElements = allElements.filter(
                      (el) => appState.selectedElementIds[el.id] === true
                    )
                    const resultIds = new Set<string>()
                    const result: ElementSummary[] = []
                    for (const el of selectedElements) {
                      if (!resultIds.has(el.id)) {
                        resultIds.add(el.id)
                        result.push(summarizeElement(el, allElements))
                      }
                      if (el.boundElements && Array.isArray(el.boundElements)) {
                        for (const bound of el.boundElements) {
                          if (!resultIds.has(bound.id)) {
                            const boundEl = allElementsMap.get(bound.id)
                            if (boundEl) {
                              resultIds.add(bound.id)
                              result.push(summarizeElement(boundEl, allElements))
                            }
                          }
                        }
                      }
                    }
                    return result
                  })()
                )
              }
            }
          } catch {
            // ignore
          }
        }
      },
      [onElementsChange, onSelectionChange, onThemeChange]
    )

    return (
      <div className={className}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api
          }}
          initialData={initialData || undefined}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              loadScene: !zenModeEnabled,
              saveToActiveFile: false,
              toggleTheme: true,
              clearCanvas: false,
              export: zenModeEnabled
                ? false
                : {
                    saveFileToDisk: true,
                  },
            },
          }}
          zenModeEnabled={zenModeEnabled}
          viewModeEnabled={false}
          langCode={resolvedLang}
        />
      </div>
    )
  }
)
