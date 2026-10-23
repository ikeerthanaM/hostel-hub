const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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


// Complaints board: temporary, in memory, like the other features
// ---------- Anonymous names: one per browser per day ----------
const crypto = require("crypto");

const adjectives = ["Calm", "Brave", "Quiet", "Gentle", "Bright", "Swift", "Kind", "Wise", "Lucky", "Proud",
  "Happy", "Shy", "Witty", "Bold", "Sunny", "Misty", "Clever", "Mellow", "Steady", "Jolly"];
const animals = ["Panda", "Otter", "Heron", "Fox", "Owl", "Tiger", "Koala", "Hawk", "Deer", "Whale",
  "Lynx", "Rabbit", "Badger", "Falcon", "Dolphin", "Penguin", "Camel", "Gecko", "Moose", "Wolf"];
const categories = ["Food", "Clothes", "Washrooms", "Rules", "Other"];

// Today's date in Indian time, like 2026-10-22
function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Same browser + same day = same name. A new day gives a new name.
function nameFor(visitorId, day) {
  const digest = crypto.createHash("sha256").update(visitorId + day).digest();
  const a = adjectives[digest[0] % adjectives.length];
  const b = animals[digest[1] % animals.length];
  return a + " " + b;
}

// ---------- Complaints ----------
const posts = [];

app.get("/posts", (req, res) => {
  const day = todayIST();
  // Show the daily name, never the visitor ID
  res.json(posts.slice().reverse().map(p => ({
    name: nameFor(p.visitorId, day),
    category: p.category,
    body: p.body,
    tagProctor: p.tagProctor
  })));
});

app.post("/post", (req, res) => {
  const visitorId = req.get("x-visitor-id");
  const { category, body, tagProctor } = req.body;
  const text = typeof body === "string" ? body.trim() : "";

  if (!visitorId) {
    return res.status(400).json({ error: "Missing visitor ID" });
  }
  if (text === "") {
    return res.status(400).json({ error: "Write something first" });
  }
  if (text.length > 300) {
    return res.status(400).json({ error: "Keep it under 300 characters" });
  }
  if (!categories.includes(category)) {
    return res.status(400).json({ error: "Choose a category" });
  }

  posts.push({ visitorId, category, body: text, tagProctor: tagProctor === true });
  res.json({ message: "Posted anonymously" });
});

// ---------- Chat ----------
const messages = [];
let nextMessageId = 1;
const lastSentAt = {}; // visitor ID -> time of last message, for the one-per-second limit

app.get("/messages", (req, res) => {
  const after = Number(req.query.after) || 0;
  const visitorId = req.get("x-visitor-id");
  const day = todayIST();

  const fresh = messages
    .filter(m => m.id > after)
    .slice(-100)
    .map(m => ({
      id: m.id,
      name: nameFor(m.visitorId, day),
      body: m.body,
      mine: m.visitorId === visitorId
    }));

  res.json(fresh);
});

app.post("/message", (req, res) => {
  const visitorId = req.get("x-visitor-id");
  const text = typeof req.body.body === "string" ? req.body.body.trim() : "";

  if (!visitorId) {
    return res.status(400).json({ error: "Missing visitor ID" });
  }
  if (text === "") {
    return res.status(400).json({ error: "Write a message first" });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: "Keep messages under 500 characters" });
  }

  const now = Date.now();
  if (lastSentAt[visitorId] && now - lastSentAt[visitorId] < 1000) {
    return res.status(429).json({ error: "Slow down a little" });
  }
  lastSentAt[visitorId] = now;

  messages.push({ id: nextMessageId++, visitorId, body: text });
  res.json({ message: "Sent" });
});

// ---------- Accounts: the real name is stored here and never shown in the app ----------
// `crypto` is already loaded in the anonymous-names section above.

const VALID_INVITES = ["HUB-4F7K"]; // later this becomes a database table, as in your deck
const AUTO_APPROVE = true;          // set to false once the proctor panel can approve students
const PROCTORS = ["proctor"];       // usernames allowed to download the spreadsheets

const users = [];    // { username, realName, salt, pinHash, status }
const sessions = {}; // session token -> username

const HOSTEL = { lat: 12.974444, lng: 77.586568, radiusM: 150 };
const dailyAttendance = []; // { username, date }
const movements = [];       // { username, kind: "out" | "in", at }

function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 32).toString("hex");
}

function getCookie(req, name) {
  const pair = (req.headers.cookie || "")
    .split(";")
    .map(s => s.trim())
    .find(s => s.startsWith(name + "="));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

// The logged-in account, or null
function currentUser(req) {
  const token = getCookie(req, "hub_session");
  const username = token && sessions[token];
  return users.find(u => u.username === username && u.status === "active") || null;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Please log in first" });
  req.user = user;
  next();
}

// Distance in metres between two points on Earth (the haversine formula)
function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Returns an error message, or null if the location is acceptable
function checkZone(lat, lng, accuracy) {
  if (typeof lat !== "number" || typeof lng !== "number" || typeof accuracy !== "number") {
    return "Location is missing";
  }
  if (accuracy > 100) {
    return "Location is too weak. Step outside and try again.";
  }
  if (distanceMetres(lat, lng, HOSTEL.lat, HOSTEL.lng) > HOSTEL.radiusM) {
    return "You are outside the hostel zone";
  }
  return null;
}

// ----- Register: the real name is typed once, here -----
app.post("/register", (req, res) => {
  const invite = String(req.body.invite || "").trim().toUpperCase();
  const username = String(req.body.username || "").trim();
  const realName = String(req.body.realName || "").trim();
  const pin = String(req.body.pin || "").trim();

  if (!VALID_INVITES.includes(invite)) {
    return res.status(400).json({ error: "Invite code is not valid" });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username: 3 to 20 letters, numbers or _" });
  }
  if (realName.length < 2 || realName.length > 50) {
    return res.status(400).json({ error: "Enter your real name" });
  }
  if (!/^[0-9]{4,6}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
  }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "That username is taken" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  users.push({
    username,
    realName,
    salt,
    pinHash: hashPin(pin, salt),
    status: AUTO_APPROVE ? "active" : "pending"
  });

  res.json({
    message: AUTO_APPROVE
      ? "Account created. You can log in now."
      : "Request sent. Waiting for the proctor to approve."
  });
});

// ----- Login and logout -----
app.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const pin = String(req.body.pin || "").trim();

  const user = users.find(u => u.username.toLowerCase() === username);
  if (!user) return res.status(401).json({ error: "Wrong username or PIN" });

  const given = Buffer.from(hashPin(pin, user.salt), "hex");
  const stored = Buffer.from(user.pinHash, "hex");
  if (!crypto.timingSafeEqual(given, stored)) {
    return res.status(401).json({ error: "Wrong username or PIN" });
  }
  if (user.status !== "active") {
    return res.status(403).json({ error: "Waiting for the proctor to approve" });
  }

  const token = crypto.randomBytes(24).toString("hex");
  sessions[token] = user.username;
  res.setHeader("Set-Cookie", `hub_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
  res.json({ message: "Logged in" });
});

app.post("/logout", (req, res) => {
  const token = getCookie(req, "hub_session");
  if (token) delete sessions[token];
  res.setHeader("Set-Cookie", "hub_session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ message: "Logged out" });
});

// Only the username and avatar info. The real name is never sent to the browser.
app.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ username: user.username });
});

// ----- Daily attendance: one mark per student per day, date only -----
app.get("/attendance/today", requireUser, (req, res) => {
  const date = todayIST();
  res.json({
    date,
    marked: dailyAttendance.some(a => a.username === req.user.username && a.date === date)
  });
});

app.post("/attendance/mark", requireUser, (req, res) => {
  const zoneError = checkZone(req.body.lat, req.body.lng, req.body.accuracy);
  if (zoneError) return res.status(403).json({ error: zoneError });

  const date = todayIST();
  if (dailyAttendance.some(a => a.username === req.user.username && a.date === date)) {
    return res.status(409).json({ error: "Attendance is already marked for today" });
  }

  dailyAttendance.push({ username: req.user.username, date });
  res.json({ message: "Attendance marked" });
});

// ----- Going out and coming back: every movement, with the exact time -----
app.get("/movements", requireUser, (req, res) => {
  const mine = movements.filter(m => m.username === req.user.username);
  const last = mine[mine.length - 1];

  res.json({
    state: last && last.kind === "out" ? "out" : "in",
    entries: mine.slice(-10).reverse().map(m => ({ kind: m.kind, at: m.at }))
  });
});

app.post("/movement", requireUser, (req, res) => {
  const zoneError = checkZone(req.body.lat, req.body.lng, req.body.accuracy);
  if (zoneError) return res.status(403).json({ error: zoneError });

  const mine = movements.filter(m => m.username === req.user.username);
  const last = mine[mine.length - 1];
  const now = Date.now();

  if (last && now - last.at < 60000) {
    return res.status(429).json({ error: "Already recorded a moment ago" });
  }

  const kind = last && last.kind === "out" ? "in" : "out";
  movements.push({ username: req.user.username, kind, at: now }); // the server's clock

  res.json({ message: kind === "out" ? "Checked out" : "Checked in" });
});

// ----- Spreadsheets for proctors (real names included) -----
function csvCell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function isProctor(req) {
  const user = currentUser(req);
  return Boolean(user && PROCTORS.includes(user.username));
}

app.get("/export/attendance.csv", (req, res) => {
  if (!isProctor(req)) return res.status(403).send("Proctors only");

  const lines = ["Real name,Username,Date"];
  dailyAttendance.forEach(a => {
    const u = users.find(x => x.username === a.username);
    lines.push([u.realName, u.username, a.date].map(csvCell).join(","));
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="attendance.csv"');
  res.send(lines.join("\n"));
});

app.get("/export/movements.csv", (req, res) => {
  if (!isProctor(req)) return res.status(403).send("Proctors only");

  const lines = ["Real name,Username,Movement,Time (IST)"];
  movements.forEach(m => {
    const u = users.find(x => x.username === m.username);
    const time = new Date(m.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    lines.push([u.realName, u.username, m.kind === "out" ? "Out" : "In", time].map(csvCell).join(","));
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="movements.csv"');
  res.send(lines.join("\n"));
});
// -
//fuck
// ---------- Food polls: one Meals, one Snack, one Veg/Non-veg per date ----------
const foodPolls = []; // { id, type, title, options, multi, forDate, closesAt, votes }
let nextPollId = 1;

const POLL_TYPES = {
  meals: { title: "Meals", options: ["Breakfast", "Lunch", "Box (college)", "Dinner"], multi: true },
  snack: { title: "Snack", options: ["Yes", "No"], multi: false },
  vegnonveg: { title: "Veg / Non-veg", options: ["Veg", "Non-veg"], multi: false }
};
const TYPE_ORDER = { meals: 0, snack: 1, vegnonveg: 2 };

function isDateText(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Turns "2026-10-23T21:00" (Indian time) into milliseconds. Returns null if invalid.
function closeTimeFromIST(local) {
  if (typeof local !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const t = new Date(local + "+05:30").getTime();
  return Number.isNaN(t) ? null : t;
}

// Everyone: upcoming polls, grouped by date, with counts and this student's choices
app.get("/food", requireUser, (req, res) => {
  const today = todayIST();
  const me = req.user.username;
  const now = Date.now();

  const polls = foodPolls
    .filter(p => p.forDate >= today)
    .sort((a, b) => a.forDate.localeCompare(b.forDate) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
    .map(p => {
      const counts = {};
      p.options.forEach(o => { counts[o] = 0; });
      Object.values(p.votes).forEach(choices => {
        choices.forEach(c => { if (counts[c] !== undefined) counts[c] += 1; });
      });
      return {
        id: p.id,
        title: p.title,
        options: p.options,
        multi: p.multi,
        forDate: p.forDate,
        closesAt: p.closesAt,
        open: now < p.closesAt,
        counts,
        mine: p.votes[me] || []
      };
    });

  res.json({ polls, isProctor: isProctor(req) });
});

// Students: save their choices. Meals can have several; Snack and Veg/Non-veg have one.
app.post("/food/vote", requireUser, (req, res) => {
  const poll = foodPolls.find(p => p.id === Number(req.body.pollId));
  if (!poll) return res.status(400).json({ error: "This poll no longer exists" });
  if (Date.now() >= poll.closesAt) return res.status(403).json({ error: "This poll is closed" });

  if (!Array.isArray(req.body.choices)) return res.status(400).json({ error: "Choose an option" });
  const choices = [...new Set(req.body.choices)];

  if (!choices.every(c => poll.options.includes(c))) {
    return res.status(400).json({ error: "Choose from the listed options" });
  }
  if (!poll.multi && choices.length !== 1) {
    return res.status(400).json({ error: "Choose exactly one option" });
  }

  poll.votes[req.user.username] = choices;
  res.json({ message: "Saved" });
});

// Proctor: add a Meals, Snack or Veg/Non-veg poll for one date
app.post("/food/poll", requireUser, (req, res) => {
  if (!isProctor(req)) return res.status(403).json({ error: "Proctors only" });

  const type = req.body.type;
  const forDate = req.body.forDate;
  const closesAt = closeTimeFromIST(req.body.closesLocal);

  if (!POLL_TYPES[type]) return res.status(400).json({ error: "Choose a poll type" });
  if (!isDateText(forDate)) return res.status(400).json({ error: "Pick the date the food is for" });
  if (!closesAt) return res.status(400).json({ error: "Pick the closing date and time" });
  if (closesAt <= Date.now()) return res.status(400).json({ error: "That closing time has already passed" });
  if (foodPolls.some(p => p.type === type && p.forDate === forDate)) {
    return res.status(409).json({ error: POLL_TYPES[type].title + " poll already exists for that date" });
  }

  const t = POLL_TYPES[type];
  foodPolls.push({
    id: nextPollId++,
    type,
    title: t.title,
    options: t.options,
    multi: t.multi,
    forDate,
    closesAt,
    votes: {}
  });
  res.json({ message: t.title + " poll added" });
});

// Proctor: remove a poll added by mistake
app.post("/food/delete", requireUser, (req, res) => {
  if (!isProctor(req)) return res.status(403).json({ error: "Proctors only" });

  const index = foodPolls.findIndex(p => p.id === Number(req.body.pollId));
  if (index === -1) return res.status(400).json({ error: "Poll not found" });

  foodPolls.splice(index, 1);
  res.json({ message: "Poll removed" });
}); 
app.listen(PORT, () => {
  console.log(`Hostel Hub running at http://localhost:${PORT}`);
});

