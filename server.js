const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Let the server read JSON sent from the browser
app.use(express.json());

// Serve everything in the public folder (index.html, style.css, app.js)
app.use(express.static(path.join(__dirname, "public")));

// Temporary storage: lives in memory and is lost when the server stops.
// The database layer will replace this.
const joinRequests = [];

app.post("/join", (req, res) => {
  const { invite, username, pin } = req.body;

  if (!invite || !username || !pin) {
    return res.status(400).json({ error: "Please fill in all three boxes" });
  }

  if (!/^[0-9]{4,6}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
  }

  // The PIN is checked but not saved yet. It will be scrambled (hashed) before storage in Phase 1.
  joinRequests.push({ invite, username, status: "pending" });
  console.log("New join request:", username);

  res.json({ message: "Request received. Waiting for the proctor to approve." });
});

// Snack poll: the server keeps the count, not the phone
const snackPoll = { question: "Banana tomorrow?", yes: 0, no: 0 };

app.get("/polls/snack", (req, res) => {
  res.json(snackPoll);
});

app.post("/polls/snack/vote", (req, res) => {
  const { choice } = req.body;

  if (choice !== "yes" && choice !== "no") {
    return res.status(400).json({ error: "Choose yes or no" });
  }

  snackPoll[choice] += 1;
  res.json(snackPoll);
});

// Going-home trips: temporary, in memory, like the poll
const trips = [];

app.get("/trips", (req, res) => {
  res.json(trips);
});

app.post("/trip", (req, res) => {
  const { leave, ret } = req.body;

  if (!leave || !ret) {
    return res.status(400).json({ error: "Pick both a leave and a return date" });
  }

  // Dates look like 2026-10-25, so text comparison puts them in the right order
  if (ret < leave) {
    return res.status(400).json({ error: "Return date cannot be before leave date" });
  }

  trips.push({ leave, ret });
  res.json({ message: "Saved" });
});

app.listen(PORT, () => {
  console.log(`Hostel Hub running at http://localhost:${PORT}`);
});
