const tb = window.titlebar;
const $ = (id) => document.getElementById(id);

$("menu").addEventListener("click", () => {
  const r = $("menu").getBoundingClientRect();
  tb.openMenu(r.left, r.bottom);
});
$("settings").addEventListener("click", () => tb.action("settings"));
$("agent").addEventListener("click", () => tb.action("printer-tools"));
$("update").addEventListener("click", () => tb.action("install-update"));

tb.onState((s) => {
  const agent = $("agent");
  agent.hidden = s.agent === "off";
  agent.className = `chip agent ${s.agent}`;
  $("agentText").textContent = s.agent === "connected" ? "Printer online" : "Printer offline";
  agent.title = s.agent === "offline" && s.agentError ? `Print agent: ${s.agentError}` : "Printer Tools";

  const update = $("update");
  update.hidden = s.update?.status !== "ready";
  if (s.update?.version) update.textContent = `Restart to update (${s.update.version})`;
});
