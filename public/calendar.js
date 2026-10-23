const grid = document.getElementById("grid");
const monthTitle = document.getElementById("month-title");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const leaveInput = document.getElementById("leave");
const backInput = document.getElementById("back");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");
const tripList = document.getElementById("trip-list");

// The month being viewed. It starts on the current month and moves with the arrows.
const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth();

// Turn year, month and day into text like "2026-10-05"
function toIso(y, m, d) {
  return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function changeMonth(step) {
  viewMonth += step;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  render();
}

// First tap picks the leaving day, second tap picks the returning day
function pickDay(key) {
  const leave = leaveInput.value;
  const back = backInput.value;

  if (!leave || back || key < leave) {
    leaveInput.value = key;
    backInput.value = "";
    statusEl.textContent = "Now tap your return day";
  } else {
    backInput.value = key;
    statusEl.textContent = "Now tap Save dates";
  }
  render();
}

async function render() {
  monthTitle.textContent = new Date(viewYear, viewMonth, 1)
    .toLocaleString("en", { month: "long", year: "numeric" });

  const response = await fetch("/trips");
  const saved = await response.json();
  // Build the list of saved trips
  tripList.innerHTML = "";
  if (saved.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No trips saved yet";
    tripList.appendChild(empty);
  }
  saved.forEach(function (t) {
    const li = document.createElement("li");
    li.textContent = "🏠 " + t.leave + "  →  🎒 " + t.ret;
    tripList.appendChild(li);
  });

  // Saved trips plus the dates being picked right now
  const trips = saved.slice();
  if (leaveInput.value) {
    trips.push({ leave: leaveInput.value, ret: backInput.value || null });
  }

  grid.innerHTML = "";

  // Weekday headings go in the same grid, so they always line up with the dates
  ["S", "M", "T", "W", "T", "F", "S"].forEach(function (name) {
    const head = document.createElement("div");
    head.className = "wd";
    head.textContent = name;
    grid.appendChild(head);
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = new Date(viewYear, viewMonth, 1).getDay();

  // Empty boxes so day 1 lines up under the right weekday
  for (let i = 0; i < startOffset; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = toIso(viewYear, viewMonth, day);

    const isLeave = trips.some(t => t.leave === key);
    const isBack = trips.some(t => t.ret === key);
    const inside = trips.some(t => t.ret && key > t.leave && key < t.ret);

    const cell = document.createElement("button");
    cell.className = "day";
    if (isLeave || isBack) cell.classList.add("edge");
    else if (inside) cell.classList.add("range");

    const num = document.createElement("span");
    num.textContent = day;
    cell.appendChild(num);

    if (isLeave || isBack) {
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = (isLeave ? "🏠" : "") + (isBack ? "🎒" : "");
      cell.appendChild(mark);
    }

    cell.addEventListener("click", () => pickDay(key));
    grid.appendChild(cell);
  }
}

prevBtn.addEventListener("click", () => changeMonth(-1));
nextBtn.addEventListener("click", () => changeMonth(1));

// If someone types a date into the boxes, the calendar follows
leaveInput.addEventListener("change", render);
backInput.addEventListener("change", render);

saveBtn.addEventListener("click", async function () {
  const leave = leaveInput.value;
  const ret = backInput.value;

  if (!leave || !ret) {
    statusEl.textContent = "Tap a leaving day, then a return day";
    return;
  }

  const response = await fetch("/trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leave, ret })
  });
  const data = await response.json();

  if (response.ok) {
    statusEl.textContent = data.message;
    leaveInput.value = "";
    backInput.value = "";
    render();
  } else {
    statusEl.textContent = data.error;
  }
});

render();
 
