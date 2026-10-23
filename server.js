const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Today's date in Indian time, like 2026-10-23
function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// ---------- Hostel location (set on Render, or the fallback here) ----------
const HOSTEL = {
  lat: Number(process.env.HOSTEL_LAT) || 12.9716,
  lng: Number(process.env.HOSTEL_LNG) || 77.5946,
  radiusM: Number(process.env.HOSTEL_RADIUS_M) || 150
};

// Distance in metres between two points (haversine formula)
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

// ---------- Accounts ----------
const VALID_INVITES = ["HUB-4F7K"];
const AUTO_APPROVE = true;
const PROCTORS = ["proctor"];

const users = [];    // { username, realName, salt, pinHash, status }
const sessions = {}; // session token -> username

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

function isProctor(req) {
  const user = currentUser(req);
  return Boolean(user && PROCTORS.includes(user.username));
}

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

app.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ username: user.username });
});

// ---------- Daily attendance: one mark per student per day, date only ----------
const dailyAttendance = []; // { username, date }

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

// ---------- Going out and coming back: every movement, with the exact time ----------
const movements = []; // { username, kind: "out" | "in", at }

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
  movements.push({ username: req.user.username, kind, at: now });

  res.json({ message: kind === "out" ? "Checked out" : "Checked in" });
});

// ---------- Spreadsheets for proctors (real names included) ----------
function csvCell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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

// ---------- Chat and complaints: names come from the account, never shown ----------
// Set NAME_SECRET on Render to a long random value. The fallback is for local tests only.
const NAME_SECRET = process.env.NAME_SECRET || "local-test-secret";

const adjectives = ["Calm", "Brave", "Quiet", "Gentle", "Bright", "Swift", "Kind", "Wise", "Lucky", "Proud",
  "Happy", "Shy", "Witty", "Bold", "Sunny", "Misty", "Clever", "Mellow", "Steady", "Jolly"];
const animals = ["Panda", "Otter", "Heron", "Fox", "Owl", "Tiger", "Koala", "Hawk", "Deer", "Whale",
  "Lynx", "Rabbit", "Badger", "Falcon", "Dolphin", "Penguin", "Camel", "Gecko", "Moose", "Wolf"];
const categories = ["Food", "Clothes", "Washrooms", "Rules", "Other"];

// Same account and same day = same name. Different accounts get different names.
function nameFor(username, day) {
  const digest = crypto.createHmac("sha256", NAME_SECRET).update(username + "|" + day).digest();
  return adjectives[digest[0] % adjectives.length] + " " + animals[digest[1] % animals.length];
}

const posts = []; // { username, category, body, tagProctor }

app.get("/posts", requireUser, (req, res) => {
  const day = todayIST();
  res.json(posts.map(p => ({
    name: nameFor(p.username, day),
    category: p.category,
    body: p.body,
    tagProctor: p.tagProctor,
    mine: p.username === req.user.username
  })));
});

app.post("/post", requireUser, (req, res) => {
  const { category, body, tagProctor } = req.body;
  const text = typeof body === "string" ? body.trim() : "";

  if (text === "") return res.status(400).json({ error: "Write something first" });
  if (text.length > 300) return res.status(400).json({ error: "Keep it under 300 characters" });
  if (!categories.includes(category)) return res.status(400).json({ error: "Choose a category" });

  posts.push({ username: req.user.username, category, body: text, tagProctor: tagProctor === true });
  res.json({ message: "Posted anonymously" });
});

const messages = []; // { id, username, body }
let nextMessageId = 1;
const lastSentAt = {};

app.get("/messages", requireUser, (req, res) => {
  const after = Number(req.query.after) || 0;
  const day = todayIST();

  res.json(messages
    .filter(m => m.id > after)
    .slice(-100)
    .map(m => ({
      id: m.id,
      name: nameFor(m.username, day),
      body: m.body,
      mine: m.username === req.user.username
    })));
});

app.post("/message", requireUser, (req, res) => {
  const username = req.user.username;
  const text = typeof req.body.body === "string" ? req.body.body.trim() : "";

  if (text === "") return res.status(400).json({ error: "Write a message first" });
  if (text.length > 500) return res.status(400).json({ error: "Keep messages under 500 characters" });

  const now = Date.now();
  if (lastSentAt[username] && now - lastSentAt[username] < 1000) {
    return res.status(429).json({ error: "Slow down a little" });
  }
  lastSentAt[username] = now;

  messages.push({ id: nextMessageId++, username, body: text });
  res.json({ message: "Sent" });
});

// ---------- Going home calendar ----------
const trips = []; // { leave, ret }

app.get("/trips", (req, res) => {
  res.json(trips);
});

app.post("/trip", (req, res) => {
  const { leave, ret } = req.body;

  if (!leave || !ret) {
    return res.status(400).json({ error: "Pick both a leave and a return date" });
  }
  if (ret < leave) {
    return res.status(400).json({ error: "Return date cannot be before leave date" });
  }

  trips.push({ leave, ret });
  res.json({ message: "Saved" });
});

// ---------- Food polls: students answer what they need, then submit once and the poll locks ----------
const foodPolls = []; // { id, type, title, questions, forDate, closesAt, responses }
let nextPollId = 1;

const POLL_TYPES = {
  meals: {
    title: "Meals",
    questions: [
      { key: "breakfast", label: "Breakfast", options: ["Eating", "Skip"] },
      { key: "lunch", label: "Lunch", options: ["Eating", "Skip"] },
      { key: "box", label: "Box (college)", options: ["Eating", "Skip"] },
      { key: "dinner", label: "Dinner", options: ["Eating", "Skip"] }
    ]
  },
  snack: {
    title: "Snack",
    questions: [{ key: "snack", label: "Snack tomorrow night?", options: ["Yes", "No"] }]
  },
  vegnonveg: {
    title: "Veg / Non-veg",
    questions: [{ key: "vegnonveg", label: "Wednesday dinner: veg or non-veg?", options: ["Veg", "Non-veg"] }]
  }
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

app.get("/food", requireUser, (req, res) => {
  const today = todayIST();
  const me = req.user.username;
  const now = Date.now();

  const polls = foodPolls
    .filter(p => p.forDate >= today)
    .sort((a, b) => a.forDate.localeCompare(b.forDate) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
    .map(p => {
      const responses = Object.values(p.responses);
      const submittedCount = responses.length;
      const mine = p.responses[me];

      return {
        id: p.id,
        title: p.title,
        forDate: p.forDate,
        closesAt: p.closesAt,
        open: now < p.closesAt,
        submitted: Boolean(mine),
        questions: p.questions.map(q => {
          const counts = {};
          q.options.forEach(o => { counts[o] = 0; });
          responses.forEach(r => {
            const choice = r.answers[q.key];
            if (choice !== undefined) counts[choice] += 1;
          });
          const answered = Object.values(counts).reduce((a, b) => a + b, 0);

          return {
            key: q.key,
            label: q.label,
            options: q.options,
            counts,
            noAnswer: submittedCount - answered,
            mine: mine ? (mine.answers[q.key] || null) : null
          };
        })
      };
    });

  res.json({ polls, isProctor: isProctor(req) });
});

app.post("/food/submit", requireUser, (req, res) => {
  const poll = foodPolls.find(p => p.id === Number(req.body.pollId));
  if (!poll) return res.status(400).json({ error: "This poll no longer exists" });
  if (Date.now() >= poll.closesAt) return res.status(403).json({ error: "This poll is closed" });

  const me = req.user.username;
  if (poll.responses[me]) return res.status(409).json({ error: "You have already submitted this poll" });

  const given = req.body.answers;
  if (!given || typeof given !== "object" || Array.isArray(given)) {
    return res.status(400).json({ error: "Answers are missing" });
  }

  const answers = {};
  for (const q of poll.questions) {
    const choice = given[q.key];
    if (choice === undefined || choice === null || choice === "") continue;
    if (!q.options.includes(choice)) {
      return res.status(400).json({ error: "Choose from the listed options for " + q.label });
    }
    answers[q.key] = choice;
  }

  poll.responses[me] = { answers, submittedAt: Date.now() };
  res.json({ message: "Submitted" });
});

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
    questions: t.questions,
    forDate,
    closesAt,
    responses: {}
  });
  res.json({ message: t.title + " poll added" });
});

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
