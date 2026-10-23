const dateEl = document.getElementById("attendance-date");
const stateEl = document.getElementById("attendance-state");
const btn = document.getElementById("attendance-btn");
const statusEl = document.getElementById("attendance-status");

// Shows either the confirmation or the button, never both
async function loadAttendance() {
  const response = await fetch("/attendance/today");
  if (!response.ok) {
    window.location.href = "index.html";
    return;
  }

  const data = await response.json();
  dateEl.textContent = formatDate(data.date);

  if (data.marked) {
    stateEl.textContent = "✓ You are marked present";
    btn.hidden = true;
  } else {
    stateEl.textContent = "Not marked yet";
    btn.hidden = false;
  }
}

btn.addEventListener("click", async function () {
  btn.disabled = true;
  statusEl.textContent = "Getting your location...";

  try {
    const coords = await getLocation();
    statusEl.textContent = "Checking the hostel zone...";

    const response = await fetch("/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      })
    });
    const data = await response.json();

    // On success, clear the message: the confirmation already shows
    statusEl.textContent = response.ok ? "" : data.error;
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    await loadAttendance();
  }
});

loadAttendance();
