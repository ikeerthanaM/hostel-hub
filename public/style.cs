/* Design tokens: the only place colors, spacing and radius are set */
:root {
  --bg: #0f0f10;
  --surface: #171719;
  --border: #2a2a2e;
  --text: #ececee;
  --muted: #8b8b93;
  --accent: #e8a45c;
  --accent-text: #0f0f10;
  --radius: 10px;
  --font: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0 auto;
  padding: 24px 16px 40px;
  max-width: 480px;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.5;
}

h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 4px; }
h2 { font-size: 1.1rem; font-weight: 600; margin: 0 0 16px; }
header { margin-bottom: 24px; }
header p, footer p { color: var(--muted); font-size: 0.9rem; margin: 0; }
footer { margin-top: 32px; }
footer a { color: var(--accent); }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
}

label {
  display: block;
  margin: 16px 0 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

input {
  width: 100%;
  padding: 12px;
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

input:focus { outline: none; border-color: var(--accent); }

button {
  font: inherit;
  font-weight: 600;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-text);
  cursor: pointer;
  transition: transform 0.1s ease;
}

button:active { transform: scale(0.97); }

.card button { width: 100%; margin-top: 20px; }

#status, #results {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 16px 0 0;
}

/* Pop animation for changing numbers */
@keyframes pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); color: var(--accent); }
  100% { transform: scale(1); }
}

.pop { animation: pop 0.4s ease; display: inline-block; }

/* Calendar */
.weekdays,
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  text-align: center;
}

.weekdays {
  color: var(--muted);
  font-size: 0.75rem;
  margin-bottom: 6px;
}

.day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg);
  font-size: 0.9rem;
}

.day.home {
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
}

/* Calendar days are buttons now, so reset the button look for them */
.card .day {
  width: auto;
  margin: 0;
  padding: 6px 0;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.85rem;
  font-weight: 400;
  background: var(--bg);
  color: var(--text);
  border-radius: 8px;
}

.card .day.range { background: rgba(232, 164, 92, 0.22); }
.card .day.edge { background: var(--accent); color: var(--accent-text); font-weight: 600; }
.card .day .mark { font-size: 0.7rem; line-height: 1; }

/* Month arrows and title on one row */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.month-nav h2 { margin: 0; }

.card .nav {
  width: auto;
  margin: 0;
  padding: 6px 14px;
  font-size: 1.1rem;
  background: var(--border);
  color: var(--text);
}
/* Seven equal columns that can shrink, even with emoji inside */
.weekdays,
.calendar {
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

/* Fixed-height day boxes, so emoji cannot make them taller */
.card .day {
  aspect-ratio: auto;
  height: 52px;
  min-width: 0;
  overflow: hidden;
  padding: 0;
}

.card .day .mark {
  font-size: 0.65rem;
}

/* Space between the calendar grid and the legend below it */
.calendar + p {
  margin-top: 16px;
  font-size: 0.85rem;
  color: var(--muted);
}
