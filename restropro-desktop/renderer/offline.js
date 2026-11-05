const params = new URLSearchParams(location.search);
const desktop = window.bongDesktop;
document.getElementById("detail").textContent = `${params.get("url") || ""}  ·  ${params.get("error") || ""}`;

let seconds = 10;
const countdown = document.getElementById("countdown");
function retry() {
  countdown.textContent = "Connecting...";
  desktop?.retry();
}
document.getElementById("retry").addEventListener("click", retry);
document.getElementById("settings").addEventListener("click", () => desktop?.openSettings());
window.addEventListener("online", retry);

setInterval(() => {
  seconds--;
  if (seconds <= 0) {
    seconds = 15;
    retry();
  } else {
    countdown.textContent = `Trying again in ${seconds}s`;
  }
}, 1000);
