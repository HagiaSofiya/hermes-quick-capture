const DESTINATIONS = [
  { key: "memory", label: "Memory" },
  { key: "task", label: "Task" },
  { key: "note", label: "Note" },
];

let selectedDestination = DESTINATIONS[0].key;

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

const chipRow = document.getElementById("destinationChips");
DESTINATIONS.forEach((d, i) => {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip" + (i === 0 ? " is-selected" : "");
  chip.textContent = d.label;
  chip.addEventListener("click", () => {
    selectedDestination = d.key;
    chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-selected"));
    chip.classList.add("is-selected");
  });
  chipRow.appendChild(chip);
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  const textEl = document.getElementById("composeText");
  const statusEl = document.getElementById("status");
  const text = textEl.value.trim();
  if (!text) return;

  statusEl.textContent = "Sending…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({
    type: "hermes-capture",
    payload: {
      text,
      destination: selectedDestination,
      url: tab?.url || "",
      title: tab?.title || "",
    },
  });

  if (result?.ok) {
    statusEl.textContent = result.demo
      ? "Saved (demo) — set a destination in Options to send for real"
      : `Sent as ${DESTINATIONS.find((d) => d.key === selectedDestination).label}`;
    textEl.value = "";
    loadHistory();
  } else {
    statusEl.textContent = result?.error || "Couldn't send that.";
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
    const label = DESTINATIONS.find((d) => d.key === item.destination)?.label || item.destination;
    li.innerHTML = `
      <span class="status-dot ${item.status}"></span>
      <span class="history-body">
        <span class="history-text">${escapeHtml(truncate(item.text, 70))}</span>
        <span class="history-meta">
          <span>${label}</span>
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
