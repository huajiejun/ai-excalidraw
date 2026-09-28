import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // 解决浏览器直连第三方 API 的 CORS 限制：
      // 页面设置中 Base URL 填 /sub2api/v1 即同源转发到 sub2api（仅 dev 生效）
      '/sub2api': {
        target: 'http://124.222.71.121:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sub2api/, ''),
      },
    },
  },
})
