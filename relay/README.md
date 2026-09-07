# Hermes Quick Capture relay

A minimal Node + Express server that receives the extension's webhook POST and
forwards it to a Telegram chat, so a capture actually lands somewhere instead of
just being a webhook shape.

## 1. Get a Telegram bot token

1. Open a chat with [`@BotFather`](https://t.me/BotFather) on Telegram.
2. Send `/newbot` and follow the prompts (name, username).
3. BotFather replies with a token that looks like `123456789:AAExampleTokenText`.
   That's your `TELEGRAM_BOT_TOKEN`.

## 2. Find your chat ID

1. Send any message to your new bot (search for its username and say hi).
2. In a browser, open:
   `https://api.telegram.org/bot<your-token>/getUpdates`
3. Look for `"chat":{"id": ...}` in the response — that number is your
   `TELEGRAM_CHAT_ID`.

(Alternative: message a helper bot like `@userinfobot` or `@getidsbot` and it'll
tell you your numeric ID directly.)

## 3. Run the relay locally

```bash
cd relay
npm install
cp .env.example .env
```

Edit `.env` and fill in:

- `TELEGRAM_BOT_TOKEN` — from step 1
- `TELEGRAM_CHAT_ID` — from step 2
- `RELAY_SHARED_SECRET` — make up any random string; this is a simple token the
  relay requires on every request so a stranger who stumbles on your ngrok URL
  can't spam your Telegram chat
- `PORT` — leave as `3000` unless it's taken

Then start it:

```bash
npm start
```

You should see `Hermes Quick Capture relay listening on port 3000`. If a
required env var is missing, the server logs exactly which one and exits
instead of running half-configured.

## 4. Expose it with ngrok, using a free static domain

The extension runs in your browser and the relay runs on your machine, so you
need a public URL pointing at your local port. [ngrok](https://ngrok.com) does
this — but `ngrok http 3000` on its own hands you a random subdomain every
time you start it, meaning a new webhook URL to paste into Options every
session. Skip that with ngrok's free static domain instead (every account,
including the free tier, gets one — permanently, at no cost):

1. Log in at [dashboard.ngrok.com](https://dashboard.ngrok.com), go to
   **Universal Edge → Domains**, and claim your static domain — something
   like `your-name.ngrok-free.dev`. This is a one-time setup; the domain is
   yours for as long as your account exists.
2. From then on, always tunnel with that domain:

   ```bash
   ngrok http 3000 --domain=your-name.ngrok-free.dev
   ```

Same command, same URL, every time you start the relay.

## 5. Point the extension at it

In the extension's Options page, set the webhook URL to:

```
https://your-name.ngrok-free.dev/capture?token=<your RELAY_SHARED_SECRET>
```

Save once — since the domain never changes, you won't need to touch Options
again, even after restarting the relay or ngrok. Use Options' "send test
capture" button or select text on any page and send it — it should show up
in your Telegram chat within a second or two.

## Error responses

| Status | Meaning |
| --- | --- |
| `401` | Missing or wrong `token` query param |
| `400` | Payload missing `text` / invalid `destination` / malformed JSON |
| `502` | Telegram's API rejected the message (bad token, bad chat ID, etc.) |
| `500` | Unexpected server error |

## Pointing this at a real Hermes gateway instead

This relay's only Hermes-specific logic is the `fetch` call in `handleCapture`
that hits `api.telegram.org/bot<token>/sendMessage`. To go further later, swap
that call for a `fetch` to your Hermes gateway's own HTTP endpoint (passing
whatever shape it expects) — the payload arriving at this relay from the
extension is:

The extension POSTs this JSON payload:

```json
{
  "request_id": "uuid",
  "action": "summarize | explain | save_memory | create_task | research_note",
  "instruction": "optional user-provided intent/question",
  "text": "the captured text or page content",
  "source_url": "https://…",
  "source_title": "Page title",
  "captured_at": "2026-09-07T00:00:00.000Z"
}
```

The relay formats this into a Telegram message showing:
- Action (Summarize / Explain / Save Memory / Create Task / Research Note)
- Instruction (if provided)
- Context (the captured text)
- Source page title + URL
- Request ID (for correlation)
