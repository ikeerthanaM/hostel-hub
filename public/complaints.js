const messagesEl = document.getElementById("messages");
const categoryInput = document.getElementById("category");
const tagInput = document.getElementById("tag");
const messageInput = document.getElementById("message");
const postBtn = document.getElementById("post-btn");
const statusEl = document.getElementById("status");
const chatCard = document.querySelector(".chat-card");

const NAME_COLOURS = ["#f28b82", "#81c995", "#fdd663", "#c58af9", "#78d9ec", "#ffb4a2"];

function colourFor(name) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return NAME_COLOURS[sum % NAME_COLOURS.length];
}

let lastSnapshot = "";
let firstLoad = true;

// One complaint as a bubble. textContent keeps what was typed as plain text.
function addPost(post) {
  const row = document.createElement("div");
  row.className = post.mine ? "bubble mine" : "bubble";

  const who = document.createElement("p");
  who.className = "bubble-name";
  who.textContent = post.name + " · " + post.category;
  if (!post.mine) who.style.color = colourFor(post.name);

  if (post.tagProctor) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Proctor tagged";
    who.appendChild(badge);
  }

  const text = document.createElement("p");
  text.className = "bubble-text";
  text.textContent = post.body;

  row.appendChild(who);
  row.appendChild(text);
  messagesEl.appendChild(row);
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function fitChatToScreen() {
  const vv = window.visualViewport;
  const visibleHeight = vv ? vv.height : window.innerHeight;
  const top = chatCard.getBoundingClientRect().top;
  chatCard.style.height = (visibleHeight - top) + "px";
  scrollToBottom();
}

// Reloads only when something changed, and keeps the reader's place
async function loadPosts() {
  const response = await fetch("/posts");
  if (!response.ok) return;
  const posts = await response.json();

  const snapshot = JSON.stringify(posts);
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;

  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

  messagesEl.innerHTML = "";
  if (posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No complaints yet. Post one below.";
    messagesEl.appendChild(empty);
  }
  posts.forEach(addPost);

  if (firstLoad || nearBottom) scrollToBottom();
  firstLoad = false;
}

postBtn.addEventListener("pointerdown", e => e.preventDefault());
postBtn.addEventListener("mousedown", e => e.preventDefault());

postBtn.addEventListener("click", async function () {
  const body = messageInput.value.trim();
  if (body === "") {
    statusEl.textContent = "Write something first";
    messageInput.focus();
    return;
  }

  const response = await fetch("/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: categoryInput.value,
      body: body,
      tagProctor: tagInput.checked
    })
  });
  const data = await response.json();

  if (response.ok) {
    messageInput.value = "";
    tagInput.checked = false;
    statusEl.textContent = "";
    messageInput.focus();
    await loadPosts();
    scrollToBottom();
  } else {
    statusEl.textContent = data.error;
    messageInput.focus();
  }
});

window.addEventListener("resize", fitChatToScreen);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitChatToScreen);
}
messageInput.addEventListener("focus", () => setTimeout(fitChatToScreen, 300));

requireLogin().then(function (me) {
  if (!me) return;
  fitChatToScreen();
  loadPosts();
  setInterval(loadPosts, 5000);
});
