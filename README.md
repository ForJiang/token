# Token

> 把一句话拆成一个个 Token 的可视化工具：真实 GPT 词表本地切分，文本不上传
>
> Visualize how text is split into tokens with real GPT vocabularies — text never leaves your browser

English intro at the bottom: [English](#english)

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
- **Token 关系图谱**（可折叠面板）：支持序列弧线图、Causal Attention 近似热力矩阵（教学启发式示意，非真实模型权重）与相邻转移邻接矩阵，支持色块与节点双向悬停/点击锁定联动
- **界面多语言**：简体中文 / 繁體中文 / English / 日本語，右上角胶囊切换器原地切换，选择自动记住
- 黑底字符波浪背景（Glyph Swell 风格），指针划过泛起波纹，尊重系统减少动效设置

## 使用

在线：<https://forjiang.github.io/token/>

本地：直接打开 `index.html`。词表通过 CDN 加载，离线时自动退化为内置的近似切分。

## 技术

纯静态单页（无构建、无后端）。切分基于 [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer)，
逐 Token 文本通过 `decodeNativeGenerator` + 流式 `TextDecoder` 还原，正确处理跨 Token 的 UTF-8 字节序列。

## License

本项目以 [GPL-3.0](LICENSE) 许可发布 © 2026 ForJiang / Released under the [GPL-3.0](LICENSE).

---

## English

**Token** — a tiny visualizer that shows how a sentence is split into tokens, one colored block at a time.

Author: **ForJiang** · [github.com/ForJiang](https://github.com/ForJiang)

### Features

- **Real GPT vocabularies** (split locally in the browser, text never uploaded): o200k_base (GPT-4o), o200k_harmony (GPT-5 / gpt-oss), cl100k_base (GPT-4 / 3.5), p50k_base (GPT-3.5 / Codex), r50k_base (GPT-2 / GPT-3)
- **Local baselines**: character-level (1 token per character, with Unicode code points) and UTF-8 byte-level (1 token per byte)
- Hover any block for its index, token ID and byte content; byte tokens show the exact UTF-8 bytes
- Token / character counts and compression ratio; one-click sample presets for Chinese, English, mixed and code text
- **Token relationship graphs** (collapsible panel): sequence arc diagram, causal-attention approximate heatmap (teaching heuristic, not real model weights) and adjacent-transition matrix, with two-way hover / click-lock linking between blocks and nodes
- **4-language UI**: 简体中文 / 繁體中文 / English / 日本語, switched in place from the top-right pill, choice remembered
- Black character-wave background (Glyph Swell style) rippling under the pointer, respects the system reduced-motion setting

### Usage

Online: <https://forjiang.github.io/token/>

Local: open `index.html` directly. Vocabularies load from a CDN and degrade to a built-in approximate splitter when offline.

### Tech

Pure static single page (no build, no backend). Splitting is based on [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer); per-token text is reconstructed with `decodeNativeGenerator` + streaming `TextDecoder`, correctly handling UTF-8 byte sequences that span tokens.

License: [GPL-3.0](LICENSE) © 2026 ForJiang
