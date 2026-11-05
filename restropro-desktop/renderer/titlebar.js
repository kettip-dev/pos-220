const tb = window.titlebar;
const $ = (id) => document.getElementById(id);

$("menu").addEventListener("click", () => {
  const r = $("menu").getBoundingClientRect();
  tb.openMenu(r.left, r.bottom);
});
$("settings").addEventListener("click", () => tb.action("settings"));
$("agent").addEventListener("click", () => tb.action("printer-tools"));
$("update").addEventListener("click", () => tb.action("install-update"));
$("fullscreen").addEventListener("click", () => tb.action("fullscreen"));

// Full screen: the handle brings the bar back; it hides again a few seconds
// after the pointer leaves it (or after a tap on a touch screen).
let fullScreen = false;
let hideTimer = null;
function scheduleHide(ms = 3000) {
  clearTimeout(hideTimer);
  if (fullScreen) hideTimer = setTimeout(() => tb.reveal(false), ms);
}
function reveal() {
  if (!fullScreen) return;
  tb.reveal(true);
  scheduleHide(4000);
}
$("handle").addEventListener("pointerenter", reveal);
$("handle").addEventListener("pointerdown", reveal);
document.addEventListener("pointermove", () => fullScreen && document.body.classList.contains("revealed") && scheduleHide(3000));
document.documentElement.addEventListener("pointerleave", () => scheduleHide(1200));

tb.onState((s) => {
  fullScreen = Boolean(s.fullScreen);
  document.body.classList.toggle("fs", fullScreen);
  document.body.classList.toggle("revealed", fullScreen && Boolean(s.revealed));
  if (!fullScreen) clearTimeout(hideTimer);
  $("fullscreen").title = fullScreen ? "Exit full screen (F11)" : "Full screen (F11)";

  const agent = $("agent");
  agent.hidden = s.agent === "off";
  agent.className = `chip agent ${s.agent}`;
  $("agentText").textContent = s.agent === "connected" ? "Printer online" : "Printer offline";
  agent.title = s.agent === "offline" && s.agentError ? `Print agent: ${s.agentError}` : "Printer Tools";

  const update = $("update");
  update.hidden = s.update?.status !== "ready";
  if (s.update?.version) update.textContent = `Restart to update (${s.update.version})`;
});
