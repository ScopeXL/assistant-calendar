/*
 * The appearance this browser last showed (lib/theme.ts, rememberAppearance), put on <html>
 * before anything paints, so a refresh never shows another theme first and fades to its own
 * (ADR 0032). A classic script loaded from <head>: the page's CSP runs same-origin scripts, never
 * inline ones. It sets only what lib/theme.ts's showAppearance would.
 */
(function () {
  try {
    var shown = JSON.parse(localStorage.getItem("sunroom.appearance") || "null");
    if (!shown || shown.v !== 1) return;
    var data = document.documentElement.dataset;
    if (shown.theme === "light" || shown.theme === "dark") data.theme = shown.theme;
    if (/^(dawn|midday|afternoon|dusk|evening|night)$/.test(shown.daypart)) {
      data.daypart = shown.daypart;
    }
    if (shown.textSize === "small" || shown.textSize === "large" || shown.textSize === "xl") {
      data.textSize = shown.textSize;
    }
    if (shown.reduceMotion === true) data.reduceMotion = "";
  } catch {
    // No storage here (a private window): the device's own light or dark decides, as before.
  }
})();
