// Hermes Quick Capture — shared code
// Loaded before content.js / popup.js / options.js (via <script>/manifest
// ordering) and via importScripts() in background.js. Classic script, no
// build step — these become plain globals in whichever context loads it.

const HERMES_CAPTURE_TYPE = "hermes-capture";

const ACTIONS = [
  { key: "summarize", label: "Summarize" },
  { key: "explain", label: "Explain" },
  { key: "save_memory", label: "Save Memory" },
  { key: "create_task", label: "Create Task" },
  { key: "research_note", label: "Research Note" },
];

function findAction(key) {
  return ACTIONS.find((a) => a.key === key);
}

function actionLabel(key, fallback) {
  return findAction(key)?.label || fallback;
}

function renderActionChips(container, chipClass) {
  let selected = ACTIONS[0].key;
  ACTIONS.forEach((a, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = chipClass + (i === 0 ? " is-selected" : "");
    chip.textContent = a.label;
    chip.addEventListener("click", () => {
      selected = a.key;
      container.querySelectorAll("." + chipClass).forEach((c) => c.classList.remove("is-selected"));
      chip.classList.add("is-selected");
    });
    container.appendChild(chip);
  });
  return () => selected;
}

function resultMessage({ ok, demo, error, action }, { verb = "to" } = {}) {
  if (!ok) return error || "Couldn't send that.";
  const label = actionLabel(action, "Hermes");
  return demo ? `Saved (demo) — set a destination in Options to send for real` : `Sent ${verb} ${label}`;
}

function sendHermesCapture(payload) {
  return chrome.runtime.sendMessage({ type: HERMES_CAPTURE_TYPE, payload });
}
