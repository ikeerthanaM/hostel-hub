const dateEl = document.getElementById("date");
const summaryEl = document.getElementById("summary");
const listEl = document.getElementById("list");

document.getElementById("refresh").addEventListener("click", loadAlerts);

async function loadAlerts() {
  summaryEl.textContent = "Checking...";
  const response = await fetch("/proctor/alerts");

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    summaryEl.textContent = data.error || "Could not load (error " + response.status + ")";
    listEl.innerHTML = "";
    return;
  }

  const data = await response.json();
  dateEl.textContent = "Today: " + formatDate(data.date);
  listEl.innerHTML = "";

  if (data.problems.length === 0) {
    summaryEl.textContent = "No problems today ✓";
    return;
  }

  summaryEl.textContent = data.problems.length + " student(s) to check";
  data.problems.forEach(function (item) {
    const card = document.createElement("section");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = item.name + " (" + item.username + ")";
    card.appendChild(title);

    item.notes.forEach(function (note) {
      const line = document.createElement("p");
      line.className = "meta";
      line.textContent = "• " + note;
      card.appendChild(line);
    });

    listEl.appendChild(card);
  });
}

loadAlerts();
