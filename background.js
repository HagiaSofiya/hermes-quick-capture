// Hermes Quick Capture — background service worker
// Owns the one thing that matters: getting a piece of text out of the
// browser and into wherever the user's Hermes agent listens.

importScripts("shared.js");

const MENU_PARENT = "hermes-capture-parent";
const HISTORY_LIMIT = 20;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_PARENT,
    title: "Send to Hermes",
    contexts: ["selection"],
  });
  ACTIONS.forEach((a) => {
    chrome.contextMenus.create({
      id: `hermes-capture-${a.key}`,
      parentId: MENU_PARENT,
      title: a.label,
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = info.menuItemId.replace("hermes-capture-", "");
  if (!findAction(action)) return;
  const result = await sendCapture({
    text: info.selectionText || "",
    action,
    url: tab?.url || "",
    title: tab?.title || "",
  });
  chrome.tabs.sendMessage(tab.id, { type: "hermes-capture-result", ...result });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-quick-capture") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "hermes-open-card" });
  } catch (err) {
    // No content script on this tab (chrome://, Web Store, PDF viewer, etc.) — no-op.
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === HERMES_CAPTURE_TYPE) {
    sendCapture(message.payload).then(sendResponse);
    return true; // keep the channel open for the async response
  }
  if (message?.type === "hermes-get-history") {
    chrome.storage.local.get("history").then(({ history }) => {
      sendResponse(history || []);
    });
    return true;
  }
});

async function sendCapture({ text, action, instruction, url, title }) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: false, error: "Nothing to send." };

  const { webhookUrl } = await chrome.storage.sync.get("webhookUrl");
  const record = {
    id: crypto.randomUUID(),
    text: trimmed,
    action,
    instruction: instruction || "",
    url,
    title,
    ts: Date.now(),
  };

  if (!webhookUrl) {
    // No destination configured yet — this is demo mode. Log it locally
    // so the popup's Recent list still has something to show, but be
    // honest with the user that nothing left the machine.
    record.status = "demo";
    await appendHistory(record);
    return { ok: true, demo: true, action };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: record.id,
        action,
        instruction: instruction || "",
        text: trimmed,
        source_url: url,
        source_title: title,
        captured_at: new Date(record.ts).toISOString(),
      }),
    });
    record.status = res.ok ? "sent" : "error";
    await appendHistory(record);
    if (!res.ok) return { ok: false, error: `Hermes replied with ${res.status}.` };
    return { ok: true, demo: false, action };
  } catch (err) {
    record.status = "error";
    await appendHistory(record);
    return { ok: false, error: "Couldn't reach your Hermes destination." };
  }
}

async function appendHistory(record) {
  const { history = [] } = await chrome.storage.local.get("history");
  const next = [record, ...history].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ history: next });
}
