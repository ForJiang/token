# Token

把一句话拆成一个个 Token 的可视化小工具。

作者：**ForJiang** · [github.com/ForJiang](https://github.com/ForJiang)

## 功能

- **真实 GPT 词表**（浏览器本地切分，文本不上传）：
  - o200k_base · GPT-4o
  - o200k_harmony · GPT-5 / gpt-oss
  - cl100k_base · GPT-4 / 3.5
  - p50k_base · GPT-3.5 / Codex
  - r50k_base · GPT-2 / GPT-3
- **本地基线**：字符级（每字符 1 Token，显示 Unicode 码点）、UTF-8 字节级（每字节 1 Token）
- 悬停任意色块查看序号、Token ID 与字节内容；字节 Token 标出具体 UTF-8 字节
- 统计 Token 数 / 字符数 / 压缩比，一键切换中英文、混合、代码示例
- **界面多语言**：简体中文 / 繁體中文 / English / 日本語，右上角胶囊切换器原地切换，选择自动记住
- 黑底字符波浪背景（Glyph Swell 风格），指针划过泛起波纹，尊重系统减少动效设置

## 使用

在线：<https://forjiang.github.io/token/>

本地：直接打开 `index.html`。词表与图标通过 CDN 加载，离线时自动退化为内置的近似切分。

## 技术

纯静态单页（无构建、无后端）。切分基于 [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer)，
逐 Token 文本通过 `decodeNativeGenerator` + 流式 `TextDecoder` 还原，正确处理跨 Token 的 UTF-8 字节序列。
