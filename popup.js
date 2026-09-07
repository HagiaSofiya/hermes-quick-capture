document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

const chipRow = document.getElementById("destinationChips");
const getSelectedAction = renderActionChips(chipRow, "chip");

document.getElementById("sendBtn").addEventListener("click", async () => {
  const textEl = document.getElementById("composeText");
  const instructionEl = document.getElementById("composeInstruction");
  const statusEl = document.getElementById("status");
  const text = textEl.value.trim();
  const instruction = instructionEl.value.trim();
  if (!text) return;

  statusEl.textContent = "Sending…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const action = getSelectedAction();
  const result = await sendHermesCapture({ text, action, instruction, url: tab?.url || "", title: tab?.title || "" });

  statusEl.textContent = resultMessage({ ...result, action }, { verb: "as" });
  if (result?.ok) {
    textEl.value = "";
    instructionEl.value = "";
    loadHistory();
  }
});

document.getElementById("capturePageBtn").addEventListener("click", async () => {
  const instructionEl = document.getElementById("composeInstruction");
  const statusEl = document.getElementById("status");
  const instruction = instructionEl.value.trim();

  statusEl.textContent = "Capturing page…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    });

    const action = getSelectedAction();
    const result = await sendHermesCapture({
      text: pageText.slice(0, 5000), // cap at 5k chars
      action,
      instruction,
      url: tab?.url || "",
      title: tab?.title || "",
    });

    statusEl.textContent = resultMessage({ ...result, action }, { verb: "as" });
    if (result?.ok) {
      instructionEl.value = "";
      loadHistory();
    }
  } catch (err) {
    statusEl.textContent = "Couldn't capture this page.";
  }
});

async function loadHistory() {
  const history = await chrome.runtime.sendMessage({ type: "hermes-get-history" });
  const list = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  list.innerHTML = "";

  if (!history || history.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const item of history) {
    const li = document.createElement("li");
    li.className = "history-item";
    const label = actionLabel(item.action, item.action);
    const instructionSnippet = item.instruction ? ` — ${escapeHtml(truncate(item.instruction, 40))}` : "";
    li.innerHTML = `
      <span class="status-dot ${item.status}"></span>
      <span class="history-body">
        <span class="history-text">${escapeHtml(truncate(item.text, 70))}</span>
        <span class="history-meta">
          <span>${label}${instructionSnippet}</span>
          <span>·</span>
          <span>${relativeTime(item.ts)}</span>
          <span>·</span>
          <span class="history-status status-${item.status}">${statusLabel(item.status)}</span>
        </span>
      </span>
    `;
    list.appendChild(li);
  }
}

function statusLabel(status) {
  if (status === "sent") return "Sent";
  if (status === "demo") return "Demo";
  return "Failed";
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

loadHistory();
