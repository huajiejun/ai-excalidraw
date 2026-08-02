export type Locale = 'zh-CN' | 'en'

const STORAGE_KEY = 'ai-excalidraw-locale'

const dict = {
  'zh-CN': {
    appTitle: 'AI 绘图助手',
    appSubtitle: '描述你想要绘制的图形，AI 会自动生成并渲染到画布上',
    tryThese: '试试这些：',
    example1: '「画一个简单的流程图：开始→处理→结束」',
    example2: '「画一个前后端架构图」',
    example3: '「用矩形和箭头画一个组织架构」',
    newChat: '新对话',
    clearCanvas: '清空画布',
    clearCanvasConfirm: '确定要清空画布吗？',
    settings: 'API 设置',
    apiKey: 'API Key',
    baseURL: 'Base URL',
    model: '模型',
    baseURLHint: '支持 OpenAI 兼容的 API，如智谱、阿里百炼等',
    cancel: '取消',
    save: '保存',
    saved: '已保存',
    thinking: '思考过程',
    thinkingNow: '正在思考...',
    generating: '正在生成...',
    generated: '图形已生成到画布',
    aiThinking: 'AI 正在思考...',
    aiDrawing: 'AI 正在绘图中...',
    stop: '停止',
    selectedCount: (n: number) => `已选中 ${n} 个元素将发送给 AI`,
    andMore: (n: number) => `...等 ${n} 个`,
    placeholder: '描述你想要绘制的图形...',
    configRequired: '请先配置 AI API',
    configRequiredAlert: '请先点击设置按钮配置 AI API',
    generateFailed: '生成失败，请重试',
    storageFull: '本地存储空间不足，部分数据可能无法保存',
    exportData: '导出备份',
    importData: '导入备份',
    importSuccess: '备份已导入',
    importFailed: '导入失败，请检查文件格式',
    language: '语言',
    confirm: '确认',
    openAIPanel: '打开 AI 面板',
    closeAIPanel: '关闭 AI 面板',
    elementsGenerated: '✨ 图形已生成到画布',
    errorPrefix: '抱歉，发生了错误：',
  },
  en: {
    appTitle: 'AI Drawing Assistant',
    appSubtitle: 'Describe the diagram you want, and AI will render it on the canvas',
    tryThese: 'Try these:',
    example1: '"Draw a simple flowchart: start → process → end"',
    example2: '"Draw a frontend/backend architecture diagram"',
    example3: '"Draw an org chart with rectangles and arrows"',
    newChat: 'New chat',
    clearCanvas: 'Clear canvas',
    clearCanvasConfirm: 'Clear the canvas?',
    settings: 'API Settings',
    apiKey: 'API Key',
    baseURL: 'Base URL',
    model: 'Model',
    baseURLHint: 'Any OpenAI-compatible API (Zhipu, DashScope, etc.)',
    cancel: 'Cancel',
    save: 'Save',
    saved: 'Saved',
    thinking: 'Thinking',
    thinkingNow: 'Thinking...',
    generating: 'Generating...',
    generated: 'Diagram added to canvas',
    aiThinking: 'AI is thinking...',
    aiDrawing: 'AI is drawing...',
    stop: 'Stop',
    selectedCount: (n: number) => `${n} selected element(s) will be sent to AI`,
    andMore: (n: number) => `...and ${n} total`,
    placeholder: 'Describe what you want to draw...',
    configRequired: 'Please configure the AI API first',
    configRequiredAlert: 'Please open Settings to configure the AI API',
    generateFailed: 'Generation failed, please retry',
    storageFull: 'Local storage is full; some data may not be saved',
    exportData: 'Export backup',
    importData: 'Import backup',
    importSuccess: 'Backup imported',
    importFailed: 'Import failed; check the file format',
    language: 'Language',
    confirm: 'Confirm',
    openAIPanel: 'Open AI panel',
    closeAIPanel: 'Close AI panel',
    elementsGenerated: '✨ Diagram added to canvas',
    errorPrefix: 'Sorry, an error occurred: ',
  },
}

type MessageKey = keyof typeof dict['zh-CN']

export type Messages = {
  [K in MessageKey]: (typeof dict)['zh-CN'][K] extends string
    ? string
    : (typeof dict)['zh-CN'][K]
}

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'en') return stored
  } catch {
    // ignore
  }
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('zh') ? 'zh-CN' : 'en'
}

let currentLocale: Locale = detectLocale()
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return currentLocale
}

export function setLocale(locale: Locale): void {
  currentLocale = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

export function t(): Messages {
  return dict[currentLocale] as Messages
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function excalidrawLangCode(locale: Locale = currentLocale): string {
  return locale === 'en' ? 'en' : 'zh-CN'
}
