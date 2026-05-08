const form = document.querySelector("#subscribeForm");
const emailInput = document.querySelector("#email");
const pushToggle = document.querySelector("#pushToggle");
const statusPill = document.querySelector("#statusPill");
const earliest = document.querySelector("#earliest");
const checkedAt = document.querySelector("#checkedAt");
const count = document.querySelector("#count");
const list = document.querySelector("#appointments");
const message = document.querySelector("#message");
const checkNow = document.querySelector("#checkNow");
const unsubscribeButton = document.querySelector("#unsubscribe");
let staticMode = false;

const savedEmail = localStorage.getItem("appointmentWatchEmail");
if (savedEmail) emailInput.value = savedEmail;

function base64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function registerPush() {
  if (!pushToggle.checked || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("./sw.js");
  const { publicKey } = await fetch("./api/push-key").then((response) => response.json());
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToUint8Array(publicKey)
  });
}

function setStatus(text, kind = "") {
  statusPill.textContent = text;
  statusPill.className = `pill ${kind}`.trim();
}

function renderState(state) {
  const result = state.lastResult || state.result;
  const lastCheck = state.lastCheckAt || result?.checkedAt || state.updatedAt;
  checkedAt.textContent = lastCheck ? new Date(lastCheck).toLocaleString() : "Never";
  count.textContent = String(result?.appointments?.length || 0);
  list.innerHTML = "";

  if (state.error) {
    setStatus("Error", "error");
    message.textContent = state.error.message;
    return;
  }

  setStatus(staticMode ? "GitHub" : "Watching", "ok");
  if (!result?.earliest) {
    earliest.textContent = "None found";
    message.textContent = staticMode
      ? "GitHub Actions has not published an appointment result yet."
      : "No appointment is currently available.";
    return;
  }

  earliest.textContent = result.earliest.label;
  message.textContent = "";
  for (const appointment of result.appointments.slice(0, 30)) {
    const item = document.createElement("li");
    item.textContent = appointment.label;
    list.append(item);
  }
}

async function refresh() {
  let state;
  try {
    const response = await fetch("./api/status");
    if (!response.ok) throw new Error("No backend API");
    state = await response.json();
    staticMode = false;
  } catch {
    const response = await fetch(`./status.json?ts=${Date.now()}`);
    state = await response.json();
    staticMode = true;
  }
  renderState(state);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (staticMode) {
    localStorage.setItem("appointmentWatchEmail", emailInput.value);
    setStatus("GitHub", "ok");
    message.textContent =
      "For the free GitHub Pages version, add this address as the ALERT_EMAIL repository secret. The static page cannot save subscribers by itself.";
    return;
  }
  setStatus("Starting");
  message.textContent = "Registering notifications and checking Terminland now...";
  const pushSubscription = await registerPush();
  const response = await fetch("./api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailInput.value,
      pushSubscription
    })
  });
  const data = await response.json();
  if (!response.ok) {
    setStatus("Error", "error");
    message.textContent = data.error || "Subscription failed.";
    return;
  }
  localStorage.setItem("appointmentWatchEmail", emailInput.value);
  renderState(data.state);
});

checkNow.addEventListener("click", async () => {
  if (staticMode) {
    message.textContent = "Manual checks run from the repository Actions tab. The page updates after the workflow deploys.";
    return;
  }
  setStatus("Checking");
  const state = await fetch("./api/check-now", { method: "POST" }).then((response) => response.json());
  renderState(state);
});

unsubscribeButton.addEventListener("click", async () => {
  if (staticMode) {
    localStorage.removeItem("appointmentWatchEmail");
    emailInput.value = "";
    message.textContent = "Local email field cleared. Remove ALERT_EMAIL in GitHub Secrets to stop hosted email alerts.";
    return;
  }
  await fetch("./api/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailInput.value })
  });
  localStorage.removeItem("appointmentWatchEmail");
  setStatus("Stopped");
  message.textContent = "Alerts stopped for this email address.";
});

await refresh();
setInterval(refresh, 15_000);
