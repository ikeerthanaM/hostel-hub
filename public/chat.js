const messagesEl = document.getElementById("messages");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const statusEl = document.getElementById("status");
const chatCard = document.querySelector(".chat-card");

// Each sender keeps the same colour, like WhatsApp group names
const NAME_COLOURS = ["#f28b82", "#81c995", "#fdd663", "#c58af9", "#78d9ec", "#ffb4a2"];

function colourFor(name) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return NAME_COLOURS[sum % NAME_COLOURS.length];
}

let lastId = 0;

// One chat bubble. Your messages are orange on the right. Others are blue-grey on the left.
function addBubble(msg) {
  const row = document.createElement("div");
  row.className = msg.mine ? "bubble mine" : "bubble";

  const who = document.createElement("p");
  who.className = "bubble-name";
  who.textContent = msg.name;
  if (!msg.mine) who.style.color = colourFor(msg.name);

  const text = document.createElement("p");
  text.className = "bubble-text";
  text.textContent = msg.body;

  row.appendChild(who);
  row.appendChild(text);
  messagesEl.appendChild(row);
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Sizes the chat to the space the phone shows, so the keyboard never covers it
function fitChatToScreen() {
  const vv = window.visualViewport;
  const visibleHeight = vv ? vv.height : window.innerHeight;
  const top = chatCard.getBoundingClientRect().top;
  chatCard.style.height = (visibleHeight - top) + "px";
  scrollToBottom();
}

async function fetchNew() {
  const response = await fetch("/messages?after=" + lastId);
  if (!response.ok) return;
  const newMessages = await response.json();
  if (newMessages.length === 0) return;

  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

  newMessages.forEach(function (msg) {
    addBubble(msg);
    lastId = msg.id;
  });

  if (nearBottom) scrollToBottom();
}

// Keep the keyboard open when Send is tapped
sendBtn.addEventListener("pointerdown", e => e.preventDefault());
sendBtn.addEventListener("mousedown", e => e.preventDefault());

sendBtn.addEventListener("click", async function () {
  const text = chatInput.value.trim();
  if (text === "") {
    statusEl.textContent = "Type something first";
    chatInput.focus();
    return;
  }

  const response = await fetch("/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: text })
  });
  const data = await response.json();

  if (response.ok) {
    chatInput.value = "";
    statusEl.textContent = "";
    chatInput.focus();
    await fetchNew();
    scrollToBottom();
  } else {
    statusEl.textContent = data.error;
    chatInput.focus();
  }
});

chatInput.addEventListener("focus", () => setTimeout(fitChatToScreen, 300));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitChatToScreen);
}
window.addEventListener("resize", fitChatToScreen);

// Chat needs a login. Logged-out visitors go to the login page.
requireLogin().then(function (me) {
  if (!me) return;
  fitChatToScreen();
  fetchNew();
  setInterval(fetchNew, 4000);
});
