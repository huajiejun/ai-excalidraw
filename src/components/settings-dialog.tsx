import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Settings, X, Check, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getAIConfig, saveAIConfig, isConfigValid, type AIConfig } from '@/lib/ai'
import { useLocale } from '@/hooks/use-locale'
import { downloadBackup, importBackupFromFile } from '@/lib/backup'
import { useToast } from '@/components/ui/toast'
import type { Locale } from '@/lib/i18n'

interface SettingsDialogProps {
  onConfigChange?: (config: AIConfig) => void
}

export function SettingsDialog({ onConfigChange }: SettingsDialogProps) {
  const { t, locale, setLocale } = useLocale()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [config, setConfig] = useState<AIConfig>(() => getAIConfig())
  const [open, setOpen] = useState(() => !isConfigValid(getAIConfig()))
  const [saved, setSaved] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (next) setConfig(getAIConfig())
    setOpen(next)
  }

  const handleSave = () => {
    saveAIConfig(config)
    onConfigChange?.(config)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setOpen(false)
    }, 1000)
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    const result = await importBackupFromFile(file)
    if (result.ok) {
      showToast(t.importSuccess, 2000)
      setTimeout(() => window.location.reload(), 500)
    } else {
      showToast(t.importFailed, 3000)
    }
  }

  const isValid = isConfigValid(config)

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8" title={t.settings}>
          <Settings className="w-4 h-4" />
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl bg-card border border-border shadow-xl p-6 animate-in fade-in max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold">{t.settings}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <X className="w-4 h-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.apiKey}</label>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.baseURL}</label>
              <Input
                value={config.baseURL}
                onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-xs text-muted-foreground">{t.baseURLHint}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.model}</label>
              <Input
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                placeholder="gpt-4o"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.language}</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                <option value="zh-CN">中文</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => downloadBackup()}
                >
                  <Download className="w-4 h-4" />
                  {t.exportData}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {t.importData}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    void handleImport(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="outline">{t.cancel}</Button>
            </Dialog.Close>
            <Button
              onClick={handleSave}
              disabled={!isValid}
              className={cn(saved && 'bg-green-600 hover:bg-green-600')}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  {t.saved}
                </>
              ) : (
                t.save
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
