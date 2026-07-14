<div align="center">
  <img src="assets/icons/icon-128.png" width="96" alt="TextPolish 图标">
  <h1>TextPolish</h1>
  <p>在任意网页输入框中快速优化或翻译文本。</p>
  <p><strong>中文</strong> · <a href="README.en.md">English</a></p>
</div>

## 特性

- 连按两次空格，优化中文表达。
- 连按三次空格，翻译到指定语言。
- AI 替换后按 `Ctrl+Z`（macOS 为 `⌘Z`）恢复原文。
- 支持 OpenAI Responses、Chat Completions、Anthropic Messages、Google Gemini 和 Ollama。
- 支持多条 API 线路、多个候选模型及自动故障切换。
- 可测试连接、调整线路顺序、导入或导出配置。
- 配置页支持浅色、深色和跟随系统主题。
- 提供请求超时、HTTP 状态和网络错误诊断。

## 安装

1. 下载或克隆本仓库。
2. 打开 Chrome 的 `chrome://extensions/`。
3. 开启右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库目录。

安装后点击工具栏中的 TextPolish 图标进入配置页。

## 配置 API

每条线路需要填写：

- 线路名称
- API URL
- API Key
- 模型名称；没有预设模型，请填写服务商实际提供的名称，多个模型使用逗号分隔
- 接口协议；不确定时选择“自动识别”

“OpenAI 兼容（保留完整 URL）”不会改写接口路径，适合使用自定义地址的兼容服务。Ollama 本地服务通常不需要 API Key。

常见 URL 格式：

```text
https://example.com/v1/responses
https://example.com/v1/chat/completions
https://example.com/v1/messages
```

线路会按照配置页中的顺序尝试。使用上下按钮调整顺序后，请点击“保存配置”。

## 使用

在网页的输入框、文本域或可编辑区域输入内容：

- 快速连按两次空格：优化中文。
- 快速连按三次空格：翻译文本。
- 处理完成后按 `Ctrl+Z`（macOS 为 `⌘Z`）：撤回 AI 结果并恢复原文。

处理结果会直接替换原内容。发生错误时会保留原文，并在页面右下角显示原因。

## 故障排查

### 无法连接扩展后台

扩展更新或重新加载后，旧页面中的扩展连接会失效。关闭旧配置页，并刷新需要使用 TextPolish 的网页。

### 网络请求未能发出

检查接口 URL、本机代理、DNS、HTTPS 证书以及服务端访问策略。配置页的线路测试会显示更具体的信息。

### HTTP 错误

- `401/403`：检查 API Key 和访问权限。
- `404/405`：检查 URL 和接口协议。
- `429`：检查额度或请求频率。
- `5xx`：服务端暂时不可用，TextPolish 会继续尝试下一条线路。

## 隐私与安全

- API Key 保存在 Chrome 扩展同步存储中，只由扩展后台读取。
- 配置导出文件包含明文 API Key，请勿公开分享或提交到版本库。
- 文本只会发送到你自行配置的 API 服务。

## 项目结构

```text
assets/icons/          扩展图标
src/background/       配置、协议适配和网络请求
src/content/          网页快捷操作和结果回填
src/options/          配置页面
manifest.json         Chrome 扩展清单
```

## 开发检查

```powershell
node --check src/background/index.js
node --check src/background/api-client.js
node --check src/options/options.js
node --check src/content/content.js
```
