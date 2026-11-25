// Run only at document startup, before the page can receive an answer or edit.
// A normal refresh can use a waiting release without interrupting another tab.
export async function openReadyRelease(): Promise<boolean> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;
  try {
    const workers = navigator.serviceWorker;
    if (!workers.controller) return false;
    const registration = await workers.getRegistration();
    if (!registration?.waiting) return false;
    const waiting: ServiceWorker = registration.waiting;
    return await new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      let timer = window.setTimeout(() => finish(false), 2000);
      function finish(reload: boolean) {
        window.clearTimeout(timer);
        workers.removeEventListener("controllerchange", activated);
        waiting.removeEventListener("statechange", activated);
        channel.port1.close();
        if (reload) window.location.reload();
        resolve(reload);
      }
      function activated() {
        if (workers.controller === waiting && waiting.state === "activated")
          finish(true);
        else if (waiting.state === "redundant") finish(false);
      }
      workers.addEventListener("controllerchange", activated);
      waiting.addEventListener("statechange", activated);
      channel.port1.onmessage = ({ data }) => {
        if (data !== "activating") return finish(false);
        // Installation is complete. Allow time for the worker to activate its cache.
        window.clearTimeout(timer);
        timer = window.setTimeout(() => finish(false), 12_000);
      };
      try {
        waiting.postMessage({ type: "APPLY_COURSE_UPDATE" }, [channel.port2]);
      } catch {
        finish(false);
      }
    });
  } catch {
    return false;
  }
}

export async function registerOfflineCourse() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(
      import.meta.env.BASE_URL + "sw.js",
      {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      },
    );
    let lastCheck = 0;
    function check() {
      if (
        document.hidden ||
        !navigator.onLine ||
        registration.installing ||
        !registration.active
      )
        return;
      if (Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      void registration.update().catch(() => {});
    }
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    check();
  } catch {
    // The online course also works when the browser disallows service workers.
  }
}
