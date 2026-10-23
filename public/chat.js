const messagesEl = document.getElementById("messages");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const statusEl = document.getElementById("status");
const chatCard = document.querySelector(".chat-card");

let lastId = 0;

// Build one chat bubble. textContent keeps what was typed as plain text.
function addBubble(msg) {
  const row = document.createElement("div");
  row.className = msg.mine ? "bubble mine" : "bubble";

  const who = document.createElement("p");
  who.className = "bubble-name";
  who.textContent = msg.name;

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

// Make the chat fill only the space the phone actually shows, so the
// keyboard never covers the composer.
function fitChatToScreen() {
  const vv = window.visualViewport;
  const visibleHeight = vv ? vv.height : window.innerHeight;
  const top = chatCard.getBoundingClientRect().top;
  chatCard.style.height = (visibleHeight - top) + "px";
  scrollToBottom();
}

// Ask the server only for messages we haven't shown yet
async function fetchNew() {
  const response = await fetch("/messages?after=" + lastId, {
    headers: { "x-visitor-id": getVisitorId() }
  });
  const newMessages = await response.json();
  if (newMessages.length === 0) return;

  // Only auto-scroll if the reader is already near the bottom,
  // so people reading older messages aren't pulled away
  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

  newMessages.forEach(function (msg) {
    addBubble(msg);
    lastId = msg.id;
  });

  if (nearBottom) scrollToBottom();
}

// Keep the keyboard open: stop the Send button from taking focus away from the text box
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
    headers: { "Content-Type": "application/json", "x-visitor-id": getVisitorId() },
    body: JSON.stringify({ body: text })
  });
  const data = await response.json();

  if (response.ok) {
    chatInput.value = "";
    statusEl.textContent = "";
    chatInput.focus();          // keyboard stays up for the next message
    await fetchNew();
    scrollToBottom();           // show your own message right away
  } else {
    statusEl.textContent = data.error;
    chatInput.focus();
  }
});

// When the keyboard opens or closes, resize the chat to fit the space left
chatInput.addEventListener("focus", () => setTimeout(fitChatToScreen, 300));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitChatToScreen);
}
window.addEventListener("resize", fitChatToScreen);

fitChatToScreen();
fetchNew();
setInterval(fetchNew, 4000);
