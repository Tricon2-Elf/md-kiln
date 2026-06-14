(function () {
  let loading = false;

  function isModifiedClick(event) {
    return (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  function shouldNavigate(link, event) {
    if (!link || isModifiedClick(event)) return false;
    if (link.target === "_blank" || link.hasAttribute("download")) return false;

    let url;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return false;
    }

    if (url.origin !== location.origin) return false;
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return true;
  }

  const loadedScripts = new Set(
    Array.from(document.querySelectorAll("script[src]")).map((s) => s.src),
  );

  function runBodyScripts() {
    document.querySelectorAll("body script").forEach((old) => {
      if (old.src) {
        if (loadedScripts.has(old.src)) {
          if (old.src.includes("/js/status.js")) {
            window.initStatusWidget?.();
          }
          old.remove();
          return;
        }

        loadedScripts.add(old.src);
        const script = document.createElement("script");
        script.src = old.src;
        old.replaceWith(script);
        return;
      }

      const script = document.createElement("script");
      script.textContent = old.textContent;
      old.replaceWith(script);
    });
  }

  async function loadPage(url, push) {
    if (loading) return;
    loading = true;

    try {
      const res = await fetch(url, { headers: { Accept: "text/html" } });
      if (!res.ok) {
        location.href = url;
        return;
      }

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");

      document.title = doc.title;
      document.body.replaceWith(doc.body);
      if (push) history.pushState(null, "", url);

      runBodyScripts();
      window.scrollTo(0, 0);
    } catch {
      location.href = url;
    } finally {
      loading = false;
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!shouldNavigate(link, event)) return;

    const url = new URL(link.href, location.href);
    if (url.href === location.href) return;

    event.preventDefault();
    void loadPage(url.href, true);
  });

  window.addEventListener("popstate", () => {
    void loadPage(location.href, false);
  });
})();
