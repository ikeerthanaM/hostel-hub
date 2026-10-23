const pollsEl = document.getElementById("polls");
const proctorPanel = document.getElementById("proctor-panel");
const statusEl = document.getElementById("food-status");
const pDate = document.getElementById("p-date");
const pClose = document.getElementById("p-close");
const pStatus = document.getElementById("p-status");

let isProctorUser = false;

// Creates an element with an optional class and text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Deadline in Indian time, like "Thu, 22 Oct, 9:00 PM"
function formatClose(ms) {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

// Tapping an option. Meals adds or removes that meal. Snack and Veg/Non-veg replace the choice.
function toggle(poll, option) {
  let next;
  if (poll.multi) {
    next = poll.mine.includes(option)
      ? poll.mine.filter(o => o !== option)
      : [...poll.mine, option];
  } else {
    next = [option];
  }
  vote(poll.id, next);
}

function makePoll(poll) {
  const box = el("div", "poll");
  box.appendChild(el("p", "poll-title", poll.title));
  box.appendChild(el("p", "meta", (poll.open ? "Closes " : "Closed ") + formatClose(poll.closesAt)));

  if (poll.multi) {
    box.appendChild(el("p", "meta", "Tick every meal you will eat. Tap again to untick."));
  }

  const row = el("div", "poll-options");
  poll.options.forEach(function (option) {
    const chosen = poll.mine.includes(option);
    const btn = el("button", "opt" + (chosen ? " chosen" : ""), option);
    btn.disabled = !poll.open;
    btn.addEventListener("click", () => toggle(poll, option));
    row.appendChild(btn);
  });
  box.appendChild(row);

  const summary = poll.options.map(o => o + " " + poll.counts[o]).join("  ·  ");
  box.appendChild(el("p", "poll-counts", summary));

  if (isProctorUser) {
    const remove = el("button", "delete", "Remove poll");
    remove.addEventListener("click", () => removePoll(poll.id));
    box.appendChild(remove);
  }
  return box;
}

// Groups polls under one heading per date
function render(polls) {
  pollsEl.innerHTML = "";
  if (polls.length === 0) {
    pollsEl.appendChild(el("p", "meta", "No food polls yet."));
    return;
  }

  let currentDay = null;
  let section = null;
  polls.forEach(function (poll) {
    if (poll.forDate !== currentDay) {
      currentDay = poll.forDate;
      section = el("section", "card");
      section.appendChild(el("h2", "", "Food for " + formatDate(poll.forDate)));
      pollsEl.appendChild(section);
    }
    section.appendChild(makePoll(poll));
  });
}

async function loadPolls() {
  const response = await fetch("/food");
  if (!response.ok) {
    window.location.href = "index.html";
    return;
  }
  const data = await response.json();
  isProctorUser = data.isProctor;
  proctorPanel.hidden = !data.isProctor;
  render(data.polls);
}

async function vote(pollId, choices) {
  statusEl.textContent = "Saving...";
  const { ok, data } = await postJson("/food/vote", { pollId, choices });
  statusEl.textContent = ok ? "Saved" : data.error;
  loadPolls();
}

async function removePoll(pollId) {
  if (!confirm("Remove this poll?")) return;
  const { ok, data } = await postJson("/food/delete", { pollId });
  statusEl.textContent = ok ? data.message : data.error;
  loadPolls();
}

async function addPoll(type) {
  pStatus.textContent = "Adding...";
  const { ok, data } = await postJson("/food/poll", {
    type,
    forDate: pDate.value,
    closesLocal: pClose.value
  });
  pStatus.textContent = ok ? data.message : data.error;
  if (ok) loadPolls();
}

document.getElementById("p-meals").addEventListener("click", () => addPoll("meals"));
document.getElementById("p-snack").addEventListener("click", () => addPoll("snack"));
document.getElementById("p-veg").addEventListener("click", () => addPoll("vegnonveg"));

loadPolls();
setInterval(loadPolls, 30000);
