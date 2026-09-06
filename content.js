// Hermes Quick Capture — content script
// Shows a small pill next to any text selection. Click it, pick a
// destination, done. Everything lives inside a shadow root so the host
// page's CSS can't touch it (and vice versa).

const DESTINATIONS = [
  { key: "memory", label: "Memory" },
  { key: "task", label: "Task" },
  { key: "note", label: "Note" },
];

let shadowHost, shadowRoot, pillEl, cardEl, hideTimer;

init();

function init() {
  shadowHost = document.createElement("div");
  shadowHost.id = "hermes-capture-host";
  shadowHost.style.cssText = "all: initial; position: fixed; z-index: 2147483647;";
  document.documentElement.appendChild(shadowHost);
  shadowRoot = shadowHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  shadowRoot.appendChild(style);

  pillEl = buildPill();
  cardEl = buildCard();
  shadowRoot.appendChild(pillEl);
  shadowRoot.appendChild(cardEl);

  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousedown", onDocMouseDown);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") reset();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "hermes-capture-result") {
      toast(resultMessage(message));
    }
    if (message?.type === "hermes-open-card") {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";
      openCardAtFixedPosition(text);
    }
  });
}

function onMouseUp(e) {
  if (shadowHost.contains(e.target)) return;
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  if (!text || text.length < 2) {
    reset();
    return;
  }
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  showPill(rect, text);
}

function onDocMouseDown(e) {
  if (!shadowHost.contains(e.target)) reset();
}

function showPill(rect, text) {
  pillEl.dataset.text = text;
  pillEl.style.top = `${Math.max(8, rect.top - 40)}px`;
  pillEl.style.left = `${Math.min(window.innerWidth - 160, Math.max(8, rect.left))}px`;
  pillEl.classList.add("is-visible");
  cardEl.classList.remove("is-visible");
}

function reset() {
  pillEl.classList.remove("is-visible");
  cardEl.classList.remove("is-visible");
}

function buildPill() {
  const el = document.createElement("button");
  el.className = "hqc-pill";
  el.type = "button";
  el.innerHTML = `${WING_SVG}<span>Send to Hermes</span>`;
  el.addEventListener("click", () => openCard(pillEl.dataset.text || ""));
  return el;
}

function buildCard() {
  const el = document.createElement("div");
  el.className = "hqc-card";
  el.innerHTML = `
    <div class="hqc-card-header">
      ${WING_SVG}
      <span>Send to Hermes</span>
      <button class="hqc-close" type="button" aria-label="Close">&times;</button>
    </div>
    <textarea class="hqc-text" rows="3"></textarea>
    <div class="hqc-chips" role="group" aria-label="Destination"></div>
    <div class="hqc-actions">
      <button class="hqc-send" type="button">Send</button>
    </div>
    <div class="hqc-status" aria-live="polite"></div>
  `;

  const chipRow = el.querySelector(".hqc-chips");
  let selected = DESTINATIONS[0].key;
  DESTINATIONS.forEach((d, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "hqc-chip" + (i === 0 ? " is-selected" : "");
    chip.textContent = d.label;
    chip.addEventListener("click", () => {
      selected = d.key;
      chipRow.querySelectorAll(".hqc-chip").forEach((c) => c.classList.remove("is-selected"));
      chip.classList.add("is-selected");
    });
    chipRow.appendChild(chip);
  });

  el.querySelector(".hqc-close").addEventListener("click", reset);
  el.querySelector(".hqc-send").addEventListener("click", async () => {
    const text = el.querySelector(".hqc-text").value.trim();
    const statusEl = el.querySelector(".hqc-status");
    if (!text) return;
    statusEl.textContent = "Sending…";
    const result = await chrome.runtime.sendMessage({
      type: "hermes-capture",
      payload: { text, destination: selected, url: location.href, title: document.title },
    });
    statusEl.textContent = resultMessage({ ...result, destination: selected });
    if (result?.ok) {
      hideTimer = setTimeout(reset, 1400);
    }
  });

  return el;
}

function openCard(text) {
  pillEl.classList.remove("is-visible");
  clearTimeout(hideTimer);
  cardEl.querySelector(".hqc-text").value = text;
  cardEl.querySelector(".hqc-status").textContent = "";
  cardEl.style.top = pillEl.style.top;
  cardEl.style.left = pillEl.style.left;
  cardEl.classList.add("is-visible");
  cardEl.querySelector(".hqc-text").focus();
}

function openCardAtFixedPosition(text) {
  pillEl.classList.remove("is-visible");
  clearTimeout(hideTimer);
  cardEl.style.top = "16px";
  cardEl.style.left = `${Math.max(8, window.innerWidth - 284)}px`;
  cardEl.querySelector(".hqc-text").value = text;
  cardEl.querySelector(".hqc-status").textContent = "";
  cardEl.classList.add("is-visible");
  cardEl.querySelector(".hqc-text").focus();
}

function resultMessage({ ok, demo, error, destination }) {
  if (!ok) return error || "Couldn't send that.";
  const label = DESTINATIONS.find((d) => d.key === destination)?.label || "Hermes";
  return demo ? `Saved (demo) — set a destination in Options to send for real` : `Sent to ${label}`;
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "hqc-toast";
  el.textContent = message;
  shadowRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));
  setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 200);
  }, 2200);
}

const WING_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="hqc-wing">
  <path d="M3 15L14 6L11 13L21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

.hqc-pill {
  all: unset;
  position: fixed;
  display: none;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 10px;
  background: #14141C;
  color: #F7F6F2;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(20, 20, 28, 0.28);
  transition: transform 0.12s ease;
}
.hqc-pill.is-visible { display: inline-flex; }
.hqc-pill:hover { transform: translateY(-1px); }
.hqc-pill .hqc-wing { color: #6C86FF; flex-shrink: 0; }

.hqc-card {
  all: unset;
  position: fixed;
  display: none;
  flex-direction: column;
  width: 260px;
  padding: 12px;
  background: #F7F6F2;
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(20, 20, 28, 0.32);
  gap: 8px;
}
.hqc-card.is-visible { display: flex; }
.hqc-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #14141C;
}
.hqc-card-header .hqc-wing { color: #3454D1; }
.hqc-close {
  all: unset;
  margin-left: auto;
  cursor: pointer;
  color: #8A8A93;
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
}
.hqc-close:hover { color: #14141C; }
.hqc-text {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  padding: 8px;
  background: #FFFFFF;
  border: 1px solid #E3E1DA;
  border-radius: 8px;
  font-size: 13px;
  color: #14141C;
  line-height: 1.4;
  resize: none;
}
.hqc-text:focus { border-color: #3454D1; }
.hqc-chips { display: flex; gap: 6px; }
.hqc-chip {
  all: unset;
  padding: 5px 10px;
  border-radius: 999px;
  background: #EDEBE4;
  color: #4A4A52;
  font-size: 12px;
  cursor: pointer;
}
.hqc-chip.is-selected { background: #14141C; color: #F7F6F2; }
.hqc-actions { display: flex; justify-content: flex-end; }
.hqc-send {
  all: unset;
  padding: 7px 16px;
  border-radius: 8px;
  background: #3454D1;
  color: #F7F6F2;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.hqc-send:hover { background: #2C46B3; }
.hqc-status { font-size: 11.5px; color: #6E6E76; min-height: 14px; }

.hqc-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  background: #14141C;
  color: #F7F6F2;
  padding: 9px 16px;
  border-radius: 999px;
  font-size: 12.5px;
  opacity: 0;
  transition: opacity 0.18s ease, transform 0.18s ease;
  box-shadow: 0 10px 30px rgba(20,20,28,0.3);
}
.hqc-toast.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
