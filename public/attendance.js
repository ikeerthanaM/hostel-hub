const stateEl = document.getElementById("attendance-state");
const attendanceBtn = document.getElementById("attendance-btn");
const statusEl = document.getElementById("attendance-status");

async function loadAttendance() {
  const response = await fetch("/attendance/today");
  if (!response.ok) {
    stateEl.textContent = "Please log in again";
    attendanceBtn.disabled = true;
    return;
  }

  const data = await response.json();
  stateEl.textContent = data.marked
    ? "Marked present for " + formatDate(data.date)
    : "Not marked yet for " + formatDate(data.date);
  attendanceBtn.textContent = data.marked ? "Already marked" : "Mark attendance";
  attendanceBtn.disabled = data.marked;
}

attendanceBtn.addEventListener("click", async function () {
  attendanceBtn.disabled = true;
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
    statusEl.textContent = response.ok ? data.message : data.error;
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    loadAttendance();
  }
});

requireLogin().then(function (me) {
  if (me) loadAttendance();
});
