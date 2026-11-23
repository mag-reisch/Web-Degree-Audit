const API_BASE = "http://localhost:8002";

const STATUS_LABELS = {
  completed: "Completed",
  in_progress: "In Progress",
  planned: "Planned",
  needed: "Needed",
};

const STATUS_ICONS = {
  completed: "check_circle",
  in_progress: "schedule",
  planned: "edit_calendar",
  needed: "radio_button_unchecked",
};

function showPlanModeStatus() {
  const statusText = document.getElementById("plan-mode-status");
  if (planMode) {
    statusText.textContent = "On";
  } else {
    statusText.textContent = "Off";
  }
}

const openCategories = new Set();
let planMode = false;
const modeToggle = document.getElementById("plan-mode");
const searchBox = document.getElementById("course-search");
searchBox.addEventListener("input", filterCourses);

modeToggle.addEventListener("change", async () => {
  modeToggle.disabled = true;
  if (await apiPost("/mode", { plan_mode: modeToggle.checked })) {
    planMode = modeToggle.checked;
    document.body.classList.toggle("plan-mode", planMode);
    showPlanModeStatus();
    await renderAudit();
  } else {
    modeToggle.checked = planMode;
  }
  modeToggle.disabled = false;
  modeToggle.focus(); 
});

async function apiGet(path, fallback = {}) {
  try {
    const resp = await fetch(API_BASE + path);
    if (!resp.ok) throw new Error(resp.status + " " + resp.statusText);
    return await resp.json();
  } catch (e) {
    showError("Could not reach API: " + e.message);
    return fallback;
  }
}

async function apiPost(path, body) {
  try {
    const resp = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.json()).detail; } catch (_) {}
      showError(detail || "Request failed: " + resp.status);
      return false;
    }
    clearError();
    return true;
  } catch (e) {
    showError("Could not reach API: " + e.message);
    return false;
  }
}

function showError(msg) { document.getElementById("error").textContent = msg; }
function clearError() { document.getElementById("error").textContent = ""; }

function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function addToPlan(reqId, code) {
  if (await apiPost("/plan/add", { req_id: reqId, code })) {
    await renderAudit();                      
    window.focusPlanButton?.(code);           
    window.announce?.(`${code} added to plan`);
  }
}

async function removeFromPlan(reqId, code) {
  if (await apiPost("/plan/remove", { req_id: reqId, code })) {
    await renderAudit();                      
    window.focusPlanButton?.(code);           
    window.announce?.(`${code} removed from plan`);
  }
}

async function renderAudit() {
  const [program, progress, requirements] = await Promise.all([
    apiGet("/program"),
    apiGet("/progress"),
    apiGet("/requirements", []),
  ]);

  const header = document.getElementById("header");
  header.replaceChildren();
  header.appendChild(el("h1", program.major || ""));
  header.appendChild(el("div",
    `${program.student || ""} | Catalog ${program.catalog_year || ""} | Advisor: ${program.advisor || ""}`));

  const percentComplete = progress.percent_complete || 0;
  const percentProjected = progress.percent_projected || 0;

  const progressBox = document.getElementById("progress");
  progressBox.replaceChildren();
  progressBox.appendChild(el("div", `Completed: ${percentComplete}%`));
  const bar1 = el("progress");
  bar1.max = 100;
  bar1.value = percentComplete;
  progressBox.appendChild(bar1);

  if (planMode) {
    progressBox.appendChild(el("div", `Projected with plan: ${percentProjected}%`));
    const bar2 = el("progress");
    bar2.className = "projected";
    bar2.max = 100;
    bar2.value = percentProjected;
    progressBox.appendChild(bar2);
  }

  const container = document.getElementById("requirements");
  container.replaceChildren();

  for (const req of requirements) {
    const details = el("details");
    details.open = openCategories.has(req.id);
    details.addEventListener("toggle", () => {
      if (details.open) openCategories.add(req.id);
      else openCategories.delete(req.id);
    });

    const plannedNote = planMode && req.credits_planned ? ` (+${req.credits_planned} planned)` : "";
    details.appendChild(el("summary",
      `${req.name} (${req.credits_completed}/${req.credits_required} credits${plannedNote})`));

    renderCourses(details, req.id, req.courses);

    const closeButton = el('button', "Close");
    closeButton.className = "close-button";
    closeButton.addEventListener("click",()=> {
      openCategories.delete(req.id);
      details.open = false;
    });
    details.appendChild(closeButton);

    container.appendChild(details);
  }
  window.afterRender?.(percentComplete, percentProjected);
  filterCourses();
}

function renderCourses(parent, reqId, courses) {
  const wrapper = el("div");
  wrapper.className = "courses-scroll";
  const table = el("table");
  table.className = "courses";
  const head = el("thead");
  const headings = el("tr");
  const columns = ["Course", "Credits", "Status"];
  if (planMode) columns.push("Plan");
  for (const heading of columns) {
    const cell = el("th", heading);
    cell.scope = "col";
    headings.appendChild(cell);
  }
  head.appendChild(headings);
  table.appendChild(head);
  const body = el("tbody");

  for (const c of courses) {
    const status = c.status === "planned" && !planMode ? "needed" : c.status;
    const row = el("tr");
    row.className = "status-" + status;
    const course = el("td");
    course.appendChild(el("strong", c.code));
    course.appendChild(el("div", c.title));
    row.appendChild(course);
    row.appendChild(el("td", c.credits));
    const statusCell = el("td");
    const statusIcon = el("span", STATUS_ICONS[status]);
    statusIcon.className = "material-symbols-outlined";
    statusIcon.setAttribute("aria-hidden", "true");
    statusCell.appendChild(statusIcon);
    statusCell.appendChild(el("span", STATUS_LABELS[status]));
    row.appendChild(statusCell);    const actions = el("td");

    if (planMode && c.status === "needed") {
      const btn = el("button", "+ Add to Plan");
      btn.onclick = () => addToPlan(reqId, c.code);
      actions.appendChild(btn);
    } else if (planMode && c.status === "planned") {
      const btn = el("button", "- Remove from Plan");
      btn.onclick = () => removeFromPlan(reqId, c.code);
      actions.appendChild(btn);
    }
    if (planMode) row.appendChild(actions);
    body.appendChild(row);
  }
  table.appendChild(body);
  wrapper.appendChild(table);
  parent.appendChild(wrapper);
}


function filterCourses() {
  const searchText = searchBox.value.trim().toLowerCase();
  const rows = document.querySelectorAll("#requirements tbody tr");
  let matchCount = 0;

  for (const row of rows) {
    const courseText = row.cells[0].textContent.toLowerCase();
    if (courseText.includes(searchText)) {
      row.hidden = false;
      matchCount = matchCount + 1;
    } else {
      row.hidden = true;
    }
  }

  const sections = document.querySelectorAll("#requirements details");
  for (const section of sections) {
    const visibleRows = section.querySelectorAll("tbody tr:not([hidden])");
    if (searchText === "") {
      section.hidden = false;
    } else if (visibleRows.length > 0) {
      section.hidden = false;
      section.open = true;
    } else {
      section.hidden = true;
    }
  }

  const resultsText = document.getElementById("search-results");
  if (searchText === "") {
    resultsText.textContent = "";
  } else if (matchCount === 0) {
    resultsText.textContent = "No courses match \"" + searchBox.value + "\"";
  } else {
    resultsText.textContent = matchCount + " courses found";
  }
}

async function initPage() {
  const mode = await apiGet("/mode");
  planMode = Boolean(mode.plan_mode);
  modeToggle.checked = planMode;
  document.body.classList.toggle("plan-mode", planMode);
  showPlanModeStatus();
  await renderAudit();
}

initPage();
