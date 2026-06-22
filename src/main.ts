import "./style.css";

// Phase 0 scaffold entry point. Real wiring is added in later phases.
// For now we just confirm the three layout regions are present so the
// dev server + single-file build can be validated end to end.
function boot(): void {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("#app root not found");
  }

  // Minimal tab switching so the shell is interactive while we build out
  // the real panels in later phases.
  const tabs = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.left-panel__tabs [role="tab"]'),
  );
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tab-panel]"),
  );

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      for (const t of tabs) {
        t.setAttribute("aria-selected", String(t === tab));
      }
      for (const panel of panels) {
        panel.hidden = panel.dataset.tabPanel !== name;
      }
    });
  }
}

boot();
