const categoryInput = document.getElementById("category");
const messageInput = document.getElementById("message");
const tagInput = document.getElementById("tag");
const postBtn = document.getElementById("post-btn");
const statusEl = document.getElementById("status");
const postsEl = document.getElementById("posts");

// Build one post card. textContent keeps whatever was typed as plain text.
function makePostCard(post) {
  const card = document.createElement("div");
  card.className = "card post";

  const meta = document.createElement("p");
  meta.className = "post-meta";
  meta.textContent = post.name + " · " + post.category;
  if (post.tagProctor) {
    const tag = document.createElement("span");
    tag.className = "badge";
    tag.textContent = "Proctor tagged";
    meta.appendChild(tag);
  }

  const body = document.createElement("p");
  body.className = "post-body";
  body.textContent = post.body;

  card.appendChild(meta);
  card.appendChild(body);
  return card;
}

async function loadPosts() {
  const response = await fetch("/posts");
  const posts = await response.json();

  postsEl.innerHTML = "";
  if (posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "post-meta";
    empty.textContent = "No posts yet";
    postsEl.appendChild(empty);
    return;
  }
  posts.forEach(function (post) {
    postsEl.appendChild(makePostCard(post));
  });
}

postBtn.addEventListener("click", async function () {
  const response = await fetch("/post", {
    method: "POST",
        headers: { "Content-Type": "application/json", "x-visitor-id": getVisitorId() },
    body: JSON.stringify({
      category: categoryInput.value,
      body: messageInput.value,
      tagProctor: tagInput.checked
    })
  });
  const data = await response.json();

  if (response.ok) {
    statusEl.textContent = data.message;
    messageInput.value = "";
    tagInput.checked = false;
    loadPosts();
  } else {
    statusEl.textContent = data.error;
  }
});

loadPosts();
