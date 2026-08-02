# Contributing

感谢你对 AI Excalidraw 的关注。

## 开发

```bash
bun install
bun run dev
```

常用命令：

```bash
bun run lint
bun run test
bun run build
```

## 约定

- 使用 Bun 安装与运行脚本
- 路径别名：`@/` → `src/`
- AI 元素 `id` 已存在表示局部更新，不存在表示新建
- 形状内文字必须同时维护 `boundElements` 与 `containerId`
- 修改生成链路时请同时检查桌面端 `chat-panel.tsx` 与移动端 `mobile-input.tsx`
- 不要随意修改提示词输出格式或 `localStorage` key；如必须修改，保留兼容迁移
- 不要提交真实 API Key 或 `.env` 本地密钥

## Pull Request

1. Fork 并创建分支
2. 完成修改后确保 lint / test / build 通过
3. 按 PR 模板填写说明与测试计划
