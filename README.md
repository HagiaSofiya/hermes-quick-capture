# Hermes Quick Capture

A tiny Chrome extension: select text on any page, pick "Memory," "Task," or
"Note," and it's on its way to your Hermes agent. No opening a chat window,
no switching apps.

Hermes's pitch is "one agent, one memory, every surface." This is one more
surface: the moment you're reading something and think "the agent should
know this," instead of that thought evaporating, you can act on it in two
clicks, from wherever you already are.

## Load it

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**, and select this folder
4. Select some text on any webpage, or click the toolbar icon

Out of the box it runs in **demo mode**: captures are logged locally (visible
in the popup's Recent list) but nothing leaves the machine. Go to the
extension's Options page and add a webhook URL to actually deliver captures.

## Wiring it to a real Hermes agent

The extension POSTs a small JSON payload to whatever webhook URL you set in
Options:

```json
{
  "text": "the captured text",
  "destination": "memory | task | note",
  "source_url": "https://…",
  "source_title": "Page title",
  "captured_at": "2026-09-06T21:04:00.000Z"
}
```

Three ways to make that real, roughly in order of effort:

- **Fastest for a demo:** a free [Pipedream](https://pipedream.com) or
  [n8n](https://n8n.io) webhook that forwards the payload to a Telegram bot
  you've already paired with your Hermes gateway.
- **Closer to the real thing:** a small local relay that receives the POST
  and calls Hermes's messaging gateway directly (Telegram/Discord/Slack),
  so it lands in the same conversation your agent already remembers.
- **Most direct:** if your Hermes instance exposes an MCP server or an HTTP
  endpoint you control, point the webhook straight at it and skip the relay.

None of that is built here. The extension's job is the capture experience;
the delivery target is deliberately a plain webhook so it can point at
whatever you're running.

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
    Note"), and keeps a capped local history in `chrome.storage.local`.
- Settings live in `chrome.storage.sync` so they follow you across a synced
  Chrome profile.

## What I'd build next

- A real relay into a Hermes Telegram bot, so this is end-to-end for the demo
  rather than webhook-shaped.
- Keyboard shortcut to open the capture card without touching the mouse.
- Firefox/Safari manifest variants — the core logic doesn't use anything
  Chrome-specific except the `chrome.*` APIs, which map closely to
  `browser.*` in Firefox.
