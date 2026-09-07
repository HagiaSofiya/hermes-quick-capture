// Hermes Quick Capture — shared code
// Loaded before content.js / popup.js / options.js (via <script>/manifest
// ordering) and via importScripts() in background.js. Classic script, no
// build step — these become plain globals in whichever context loads it.

const HERMES_CAPTURE_TYPE = "hermes-capture";

const DESTINATIONS = [
  { key: "memory", label: "Memory" },
  { key: "task", label: "Task" },
  { key: "note", label: "Note" },
];

function findDestination(key) {
  return DESTINATIONS.find((d) => d.key === key);
}

function destinationLabel(key, fallback) {
  return findDestination(key)?.label || fallback;
}

function renderDestinationChips(container, chipClass) {
  let selected = DESTINATIONS[0].key;
  DESTINATIONS.forEach((d, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = chipClass + (i === 0 ? " is-selected" : "");
    chip.textContent = d.label;
    chip.addEventListener("click", () => {
      selected = d.key;
      container.querySelectorAll("." + chipClass).forEach((c) => c.classList.remove("is-selected"));
      chip.classList.add("is-selected");
    });
    container.appendChild(chip);
  });
  return () => selected;
}

function resultMessage({ ok, demo, error, destination }, { verb = "to" } = {}) {
  if (!ok) return error || "Couldn't send that.";
  const label = destinationLabel(destination, "Hermes");
  return demo ? `Saved (demo) — set a destination in Options to send for real` : `Sent ${verb} ${label}`;
}

function sendHermesCapture(payload) {
  return chrome.runtime.sendMessage({ type: HERMES_CAPTURE_TYPE, payload });
}
