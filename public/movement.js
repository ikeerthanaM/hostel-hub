const stateEl = document.getElementById("movement-state");
const movementBtn = document.getElementById("movement-btn");
const statusEl = document.getElementById("movement-status");
const logEl = document.getElementById("movement-log");

async function loadMovements() {
  const response = await fetch("/movements");
  if (!response.ok) {
    window.location.href = "index.html";
    return;
  }

  const data = await response.json();
  stateEl.textContent = data.state === "in" ? "You are in the hostel" : "You are out of the hostel";
  movementBtn.textContent = data.state === "in" ? "Check out" : "Check in";
  movementBtn.disabled = false;

  logEl.innerHTML = "";
  if (data.entries.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No movements yet";
    logEl.appendChild(empty);
  }
  data.entries.forEach(function (entry) {
    const li = document.createElement("li");
    li.textContent = (entry.kind === "out" ? "Out  " : "In  ") + formatTime(entry.at);
    logEl.appendChild(li);
  });
}

movementBtn.addEventListener("click", async function () {
  movementBtn.disabled = true;
  statusEl.textContent = "Getting your location...";

  try {
    const coords = await getLocation();
    statusEl.textContent = "Checking the hostel zone...";

    const response = await fetch("/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      })
    });
    const data = await response.json();

    if (response.ok) {
      flashConfirm(statusEl, data.message);
    } else {
      statusEl.textContent = data.error;
    }
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    loadMovements();
  }
});

requireLogin().then(function (me) {
  if (me) loadMovements();
});
