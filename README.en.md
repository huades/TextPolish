<div align="center">
  <img src="assets/icons/icon-128.png" width="96" alt="TextPolish icon">
  <h1>TextPolish</h1>
  <p>Polish or translate text directly in any web input field.</p>
  <p><a href="README.md">中文</a> · <strong>English</strong></p>
</div>

## Features

- Press Space twice to polish Chinese text.
- Press Space three times to translate text into your selected language.
- Press `Ctrl+Z` (`⌘Z` on macOS) after an AI replacement to restore the original text.
- Supports OpenAI Responses, Chat Completions, Anthropic Messages, Google Gemini, and Ollama.
- Supports multiple API endpoints, fallback models, and automatic failover.
- Test connections, reorder endpoints, and import or export settings.
- Light, dark, and system themes for the settings page.
- Clear diagnostics for timeouts, HTTP errors, and network failures.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.

Click the TextPolish toolbar icon to open the settings page.

## API Configuration

Each endpoint requires:

- A display name
- An API URL
- An API key
- One or more model names supplied by your provider, separated by commas; no model is preconfigured
- An API protocol; choose **Auto detect** if you are unsure

Use **OpenAI compatible (keep full URL)** for providers with a custom endpoint path. A local Ollama server normally does not require an API key.

Common URL formats:

```text
https://example.com/v1/responses
https://example.com/v1/chat/completions
https://example.com/v1/messages
```

Endpoints are tried in the displayed order. After moving an endpoint up or down, click **Save settings**.

## Usage

Type text in an input, textarea, or editable region on any web page:

- Press Space twice quickly to polish Chinese text.
- Press Space three times quickly to translate the text.
- Press `Ctrl+Z` (`⌘Z` on macOS) after processing to undo the AI result.

TextPolish replaces the original content with the result. If a request fails, the original text is preserved and an error appears in the bottom-right corner.

## Troubleshooting

### Cannot connect to the extension background

When the extension is updated or reloaded, existing tabs lose their extension connection. Close old settings tabs and refresh pages where you want to use TextPolish.

### The network request could not be sent

Check the API URL, proxy, DNS, HTTPS certificate, and server access policy. The endpoint test on the settings page provides more detail.

### HTTP errors

- `401/403`: verify the API key and permissions.
- `404/405`: verify the URL and selected protocol.
- `429`: check your quota or request rate.
- `5xx`: the server is temporarily unavailable; TextPolish will try the next endpoint.

## Privacy and Security

- API keys are stored in Chrome extension sync storage and read only by the extension background worker.
- Exported settings contain API keys in plain text. Do not publish or commit them.
- Text is sent only to API services that you configure.

## Project Structure

```text
assets/icons/          Extension icons
src/background/       Configuration, protocol adapters, and networking
src/content/          Keyboard shortcuts and input replacement
src/options/          Settings page
manifest.json         Chrome extension manifest
```

## Development Checks

```powershell
node --check src/background/index.js
node --check src/background/api-client.js
node --check src/options/options.js
node --check src/content/content.js
```
