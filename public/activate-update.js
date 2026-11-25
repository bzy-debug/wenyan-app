// Only replace the cached release when the page requesting it is the sole client.
// Other GitHub Pages projects on this origin have their own scope.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "APPLY_COURSE_UPDATE") return;
  const reply = event.ports[0];
  const page = event.source;
  if (
    !reply ||
    page?.type !== "window" ||
    !page.url.startsWith(self.registration.scope)
  )
    return;
  event.waitUntil(
    (async () => {
      try {
        const pages = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (
          pages.some(
            (other) =>
              other.id !== page.id &&
              other.url.startsWith(self.registration.scope),
          )
        ) {
          reply.postMessage("other-pages");
          return;
        }
        reply.postMessage("activating");
        await self.skipWaiting();
      } catch {
        reply.postMessage("failed");
      }
    })(),
  );
});
