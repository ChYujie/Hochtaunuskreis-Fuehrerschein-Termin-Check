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

  const registration = await navigator.serviceWorker.register("/sw.js");
  const { publicKey } = await fetch("/api/push-key").then((response) => response.json());
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
  const result = state.lastResult;
  checkedAt.textContent = state.lastCheckAt ? new Date(state.lastCheckAt).toLocaleString() : "Never";
  count.textContent = String(result?.appointments?.length || 0);
  list.innerHTML = "";

  if (state.error) {
    setStatus("Error", "error");
    message.textContent = state.error.message;
    return;
  }

  setStatus("Watching", "ok");
  if (!result?.earliest) {
    earliest.textContent = "None found";
    message.textContent = "No appointment is currently available.";
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
  const state = await fetch("/api/status").then((response) => response.json());
  renderState(state);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Starting");
  message.textContent = "Registering notifications and checking Terminland now...";
  const pushSubscription = await registerPush();
  const response = await fetch("/api/subscribe", {
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
  setStatus("Checking");
  const state = await fetch("/api/check-now", { method: "POST" }).then((response) => response.json());
  renderState(state);
});

unsubscribeButton.addEventListener("click", async () => {
  await fetch("/api/unsubscribe", {
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
