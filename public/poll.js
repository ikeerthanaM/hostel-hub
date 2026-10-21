const questionEl = document.getElementById("question");
const yesBtn = document.getElementById("yes-btn");
const noBtn = document.getElementById("no-btn");
const resultsEl = document.getElementById("results");

function showResults(poll) {
  resultsEl.textContent = "Yes: " + poll.yes + "  ·  No: " + poll.no;
}

async function loadPoll() {
  const response = await fetch("/polls/snack");
  const poll = await response.json();
  questionEl.textContent = poll.question;
  function showResults(poll) {
  resultsEl.textContent = "Yes: " + poll.yes + "  ·  No: " + poll.no;

  // Restart the animation so it plays again on every tap
  resultsEl.classList.remove("pop");
  void resultsEl.offsetWidth;
  resultsEl.classList.add("pop");
}
}

async function vote(choice) {
  const response = await fetch("/polls/snack/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice })
  });
  const data = await response.json();

  if (response.ok) {
    showResults(data);
  } else {
    resultsEl.textContent = data.error;
  }
}

yesBtn.addEventListener("click", () => vote("yes"));
noBtn.addEventListener("click", () => vote("no"));

loadPoll();
