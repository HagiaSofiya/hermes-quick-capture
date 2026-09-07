// Hermes Quick Capture relay — receives the extension's webhook POST and
// forwards it to a Telegram chat via the Bot API.
require("dotenv").config();
const express = require("express");

const REQUIRED_ENV = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RELAY_SHARED_SECRET"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key] || !process.env[key].trim());
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}.`);
  console.error("Copy relay/.env.example to relay/.env and fill in real values, then retry.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const DESTINATION_LABELS = { memory: "Memory", task: "Task", note: "Note" };

const app = express();

function requireToken(req, res, next) {
  if (req.query.token !== process.env.RELAY_SHARED_SECRET) {
    return res.status(401).json({ status: "error", message: "Invalid or missing token" });
  }
  next();
}

function validatePayload(body) {
  const errors = [];
  if (typeof body?.text !== "string" || !body.text.trim()) {
    errors.push("text is required and must be a non-empty string");
  }
  if (!DESTINATION_LABELS[body?.destination]) {
    errors.push(`destination must be one of: ${Object.keys(DESTINATION_LABELS).join(", ")}`);
  }
  return errors;
}

// Plain text, deliberately no parse_mode — captured text is arbitrary and may
// contain Markdown-special characters that would make Telegram reject the message.
function formatMessage({ text, destination, source_url, source_title }) {
  const lines = [`New ${DESTINATION_LABELS[destination]}`, "", text.trim()];
  if (source_title || source_url) {
    lines.push("", `From: ${source_title || "Untitled page"}`);
    if (source_url) lines.push(source_url);
  }
  return lines.join("\n");
}

async function handleCapture(req, res) {
  const errors = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ status: "error", message: "Invalid payload", errors });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: formatMessage(req.body),
      }),
    });
    const tgBody = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok || tgBody.ok === false) {
      return res.status(502).json({
        status: "error",
        message: "Telegram API error",
        detail: tgBody.description || `HTTP ${tgRes.status}`,
      });
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Unexpected error forwarding capture:", err);
    return res.status(500).json({ status: "error", message: "Unexpected server error" });
  }
}

app.post("/capture", requireToken, express.json(), handleCapture);

// express.json() throws a SyntaxError on malformed bodies before the route
// handler runs — catch it here so the client still gets a JSON error shape.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ status: "error", message: "Malformed JSON body" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ status: "error", message: "Unexpected server error" });
});

app.listen(PORT, () => {
  console.log(`Hermes Quick Capture relay listening on port ${PORT}`);
});
