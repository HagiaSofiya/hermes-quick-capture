const urlInput = document.getElementById("webhookUrl");
const statusEl = document.getElementById("status");

chrome.storage.sync.get("webhookUrl").then(({ webhookUrl }) => {
  if (webhookUrl) urlInput.value = webhookUrl;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({ webhookUrl: urlInput.value.trim() });
  statusEl.textContent = "Saved.";
  setTimeout(() => (statusEl.textContent = ""), 1800);
});

document.getElementById("test").addEventListener("click", async () => {
  statusEl.textContent = "Sending test capture…";
  const result = await sendHermesCapture({
    text: "Hermes Quick Capture is wired up correctly.",
    action: "research_note",
    instruction: "Verify that the relay is receiving and forwarding captures.",
    url: "https://example.com",
    title: "Settings test",
  });
  if (result?.ok) {
    statusEl.textContent = result.demo
      ? "No webhook set — this only logged locally (demo mode)."
      : "Test capture delivered.";
  } else {
    statusEl.textContent = result?.error || "Test capture failed.";
  }
});
