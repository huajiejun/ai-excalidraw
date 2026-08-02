import { useSyncExternalStore } from 'react'
import { getLocale, setLocale, subscribeLocale, t, type Locale, type Messages } from '@/lib/i18n'

export function useLocale(): {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
} {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, () => 'zh-CN' as Locale)
  return {
    locale,
    setLocale,
    t: t(),
  }
}
