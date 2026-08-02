import type { ChatSession } from '@/components/excalidraw/use-chat-history'
import { readStorage, writeStorage } from '@/lib/storage'

const CHAT_KEY = 'excalidraw-ai-chat-history'
const CONFIG_KEY = 'ai-excalidraw-config'
const CANVAS_PREFIX = 'excalidraw-canvas-data'
const SHARED_CANVAS_KEY = 'excalidraw-canvas-data'

export interface BackupPayload {
  version: 1
  exportedAt: number
  sessions: ChatSession[]
  config?: unknown
  canvases: Record<string, unknown>
}

function collectCanvasKeys(sessions: ChatSession[]): string[] {
  const keys = new Set<string>([SHARED_CANVAS_KEY])
  for (const session of sessions) {
    if (session.useIndependentCanvas) {
      keys.add(`${CANVAS_PREFIX}-${session.id}`)
    }
  }
  return Array.from(keys)
}

export function exportBackup(): BackupPayload {
  const sessions = readStorage<ChatSession[]>(CHAT_KEY, [])
  const config = readStorage<unknown>(CONFIG_KEY, null)
  const canvases: Record<string, unknown> = {}

  for (const key of collectCanvasKeys(sessions)) {
    const data = readStorage<unknown>(key, null)
    if (data !== null) canvases[key] = data
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    sessions,
    config: config ?? undefined,
    canvases,
  }
}

export function downloadBackup(): void {
  const payload = exportBackup()
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-excalidraw-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importBackup(payload: unknown): { ok: true } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'invalid' }
  }

  const data = payload as Partial<BackupPayload>
  if (data.version !== 1 || !Array.isArray(data.sessions)) {
    return { ok: false, error: 'invalid' }
  }

  writeStorage(CHAT_KEY, data.sessions)

  if (data.config && typeof data.config === 'object') {
    writeStorage(CONFIG_KEY, data.config)
  }

  if (data.canvases && typeof data.canvases === 'object') {
    for (const [key, value] of Object.entries(data.canvases)) {
      if (key.startsWith(CANVAS_PREFIX) || key === SHARED_CANVAS_KEY) {
        writeStorage(key, value)
      }
    }
  }

  return { ok: true }
}

export async function importBackupFromFile(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const text = await file.text()
    return importBackup(JSON.parse(text))
  } catch {
    return { ok: false, error: 'parse' }
  }
}
