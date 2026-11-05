const $ = (id) => document.getElementById(id);
const api = window.settingsApi;

function describeAgent(s) {
  if (!s.agentEnabled) return { text: "Off", cls: "off" };
  if (!s.hasToken) return { text: "Needs a token", cls: "warn" };
  const st = s.agentStatus;
  if (!st) return { text: s.agentRunning ? "Starting..." : "Not running", cls: "warn" };
  if (st.connected) return { text: `Connected to ${st.serverUrl}  ·  ${st.printed} printed, ${st.failed} failed`, cls: "ok" };
  return { text: `Not connected${st.lastError ? `: ${st.lastError}` : ""}`, cls: "bad" };
}

// Form fields: only on open and after saving, so the 5-second status refresh
// never overwrites what someone is typing.
function render(s) {
  $("version").textContent = `Version ${s.version}${s.packaged ? "" : " (development)"}`;
  $("posUrl").value = s.posUrl || "";
  const override = $("posUrlOverride");
  override.hidden = !s.posUrlOverride;
  override.textContent = s.posUrlOverride ? `This run uses ${s.posUrlOverride} (from --pos-url).` : "";
  $("agentEnabled").checked = Boolean(s.agentEnabled);
  $("autoStart").checked = Boolean(s.autoStart);
  $("kiosk").checked = Boolean(s.kiosk);
  $("keepAwake").checked = Boolean(s.keepAwake);
  renderStatus(s);
}

function renderStatus(s) {
  $("token").placeholder = s.hasToken ? "Saved (paste a new token to replace it)" : "rpa_...";
  $("removeToken").hidden = !s.hasToken;
  $("printerTools").disabled = !s.agentRunning;
  const agent = describeAgent(s);
  const status = $("agentStatus");
  status.textContent = agent.text;
  status.className = `status ${agent.cls}`;
  $("updateStatus").textContent = s.update?.message || (s.packaged ? "Updates are checked automatically every few hours." : "Updates are off in development runs.");
}

function showResult(el, ok, message) {
  el.hidden = false;
  el.textContent = message;
  el.className = `${el.id === "saveError" ? "error" : "result"} ${ok ? "ok" : "bad"}`;
}

async function refresh({ full = false } = {}) {
  const s = await api.get();
  if (s) (full ? render : renderStatus)(s);
}

async function save(extra = {}) {
  $("saveError").hidden = true;
  const patch = {
    posUrl: $("posUrl").value,
    agentEnabled: $("agentEnabled").checked,
    autoStart: $("autoStart").checked,
    kiosk: $("kiosk").checked,
    keepAwake: $("keepAwake").checked,
    token: $("token").value,
    ...extra,
  };
  const btn = $("save");
  btn.disabled = true;
  try {
    const res = await api.save(patch);
    if (!res?.ok) return showResult($("saveError"), false, res?.error || "Could not save.");
    $("token").value = "";
    render(res.settings);
    showResult($("saveError"), true, "Saved.");
    setTimeout(refresh, 3000);
  } finally {
    btn.disabled = false;
  }
}

$("save").addEventListener("click", () => save());
$("cancel").addEventListener("click", () => window.close());
$("removeToken").addEventListener("click", () => {
  if (confirm("Remove the print agent token from this computer? Printing through this computer stops.")) {
    save({ removeToken: true, agentEnabled: false, token: "" });
  }
});
$("testAgent").addEventListener("click", async () => {
  const btn = $("testAgent");
  btn.disabled = true;
  showResult($("testResult"), true, "Testing...");
  try {
    const res = await api.testAgent($("token").value);
    showResult($("testResult"), res.ok, res.message);
  } finally {
    btn.disabled = false;
  }
});
$("printerTools").addEventListener("click", () => api.action("printer-tools"));
$("checkUpdates").addEventListener("click", () => api.action("check-updates"));
$("openLogs").addEventListener("click", () => api.action("open-logs"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.close();
});

refresh({ full: true });
setInterval(refresh, 5000);
