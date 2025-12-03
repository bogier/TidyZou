/* 📦 Service Worker */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(() => console.log("✅ Service Worker enregistré"))
    .catch(err => console.error("❌ SW erreur:", err));
}

/* 📲 Installation PWA */
let deferredPrompt;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = "inline-block";
});

installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = "none";
});

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.style.display = "none";
});
