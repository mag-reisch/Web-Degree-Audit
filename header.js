/* persistent header + keyboard accessibility for DS3.
    */
(function () {
  const appHeader = document.getElementById("app-header");

  // keep scroll padding equal to the real header height 
  new ResizeObserver(() =>
    document.documentElement.style.setProperty("--header-h", appHeader.offsetHeight + "px")
  ).observe(appHeader);

  // screen readers announce plan changes 
  const liveRegion = document.createElement("div");
  liveRegion.className = "sr-only";
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  document.body.appendChild(liveRegion);

  function announce(message) {
    liveRegion.textContent = "";
    setTimeout(() => { liveRegion.textContent = message; }, 50);
  }

  function makeStat(label, value, extraClass) {
    const box = document.createElement("div");
    box.className = "stat" + (extraClass ? " " + extraClass : "");
    const name = document.createElement("span");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    box.append(name, number);
    return box;
  }

  // Projected is hidden by CSS unless body has the plan mode toggled
  function updateHeaderSummary(completed, projected) {
    document.getElementById("header-summary").replaceChildren(
      makeStat("Completed", completed + "%"),
      makeStat("Projected", projected + "%", "header-projected")
    );
  }


  function enhancePlanButtons() {
    document.querySelectorAll("#requirements tbody tr").forEach((row) => {
      const button = row.querySelector("button");
      const code = row.querySelector("td strong")?.textContent;
      if (!button || !code) return;
      const visible = button.textContent.replace(/^[+-]\s*/, "").trim();
      button.setAttribute("aria-label", visible + ": " + code);
      button.dataset.code = code;
    });
  }

  
  function focusPlanButton(code) {
    document.querySelector('#requirements button[data-code="' + code + '"]')?.focus();
  }


  function markScrollable() {
    document.querySelectorAll(".courses-scroll").forEach((box) => {
      if (box.scrollWidth > box.clientWidth) {
        const title = box.parentElement.querySelector("summary")?.textContent || "Courses";
        box.tabIndex = 0;
        box.setAttribute("role", "region");
        box.setAttribute("aria-label", title + " table");
      } else {
        box.removeAttribute("tabindex");
        box.removeAttribute("role");
        box.removeAttribute("aria-label");
      }
    });
  }
  document.addEventListener("toggle", markScrollable, true); // details open/close
  window.addEventListener("resize", markScrollable);

  window.afterRender = function (completed, projected) {
    updateHeaderSummary(completed, projected);
    enhancePlanButtons();
    markScrollable();
  };
  window.focusPlanButton = focusPlanButton;
  window.announce = announce;
})();