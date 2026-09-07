# Hermes Quick Capture

A Chrome extension for your Hermes agent: select text or capture a page,
pick an action (Summarize, Explain, Save Memory, Create Task, Research Note),
optionally add an instruction, and send it straight to your agent. No
switching apps, no opening chat windows.

**Actions:**
- **Summarize** — get a concise summary
- **Explain** — simplify complex text
- **Save Memory** — store a durable fact
- **Create Task** — turn content into an action item
- **Research Note** — save a source for later synthesis

Hermes's pitch is "one agent, one memory, every surface." This is one more
surface: instead of that thought evaporating when you read something worth
acting on, you can capture it in two clicks.

## Load it

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**, and select this folder
4. Select some text on any webpage, click the toolbar icon, or press
   `Ctrl+Shift+H` (`Cmd+Shift+H` on Mac) to open the capture card

Out of the box it runs in **demo mode**: captures are logged locally (visible
in the popup's Recent list) but nothing leaves the machine. Go to the
extension's Options page and add a webhook URL to actually deliver captures.

## Wiring it to a real Hermes agent

The extension POSTs a small JSON payload to whatever webhook URL you set in
Options:

```json
{
  "request_id": "uuid",
  "action": "summarize | explain | save_memory | create_task | research_note",
  "instruction": "optional user-provided intent/question",
  "text": "selected text or page content",
  "source_url": "https://…",
  "source_title": "Page title",
  "captured_at": "2026-09-07T00:00:00.000Z"
}
```

Three ways to make that real, roughly in order of effort:

- **Fastest for a demo:** a free [Pipedream](https://pipedream.com) or
  [n8n](https://n8n.io) webhook that forwards the payload to a Telegram bot
  you've already paired with your Hermes gateway.
- **Included here:** [`relay/`](relay/) is a small Node/Express server that
  receives the POST and forwards it to a Telegram chat via the Bot API, so
  it lands in the same conversation your agent already reads. See
  [`relay/README.md`](relay/README.md) for setup — get a bot token, run it
  locally, expose it with ngrok, point the extension at it.
- **Most direct:** if your Hermes instance exposes an MCP server or an HTTP
  endpoint you control, point the webhook straight at it and skip the relay.

The extension's job is the capture experience; the delivery target is
deliberately a plain webhook so it can point at whatever you're running —
swapping the relay's one Telegram `fetch` call for a call to your own
gateway is enough to repoint it.

## How it's built

- **Manifest V3**, no build step, no dependencies — three small surfaces:
  - `content.js` — the floating pill that appears on text selection, and
    the mini card it expands into. Lives inside a Shadow DOM so it can't
    collide with (or be styled by) whatever page it's injected into.
  - `popup.html/js/css` — the toolbar popup: compose a fresh note about the
    current tab, and see the last few captures with their status.
  - `options.html/js/css` — where the webhook URL lives, plus a "send test
    capture" button.
  - `background.js` — the service worker that actually does the fetch,
    handles the right-click context menu ("Send to Hermes → Memory/Task/
    Note") and the `Ctrl+Shift+H` / `Cmd+Shift+H` shortcut, and keeps a
    capped local history in `chrome.storage.local`.
- Settings live in `chrome.storage.sync` so they follow you across a synced
  Chrome profile.
- [`relay/`](relay/) is an optional companion server (not part of the
  extension) that forwards captures to Telegram — see
  [`relay/README.md`](relay/README.md).
