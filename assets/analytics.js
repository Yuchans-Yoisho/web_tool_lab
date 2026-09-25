(() => {
  "use strict";
  const id = window.TOOL_LAB_GA_ID;
  if (typeof id !== "string" || !/^G-[A-Z0-9]{6,20}$/.test(id)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.append(script);
})();

window.trackToolEvent = function (tool, action) {
  if (typeof window.gtag !== "function") return;
  const allowed = ["roulette", "amidaku", "dice"];
  if (!allowed.includes(tool) || !["generate", "reveal"].includes(action)) return;
  // 入力内容や結果は送信しない。
  window.gtag("event", "tool_" + action, { tool_name: tool });
};
