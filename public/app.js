const joinBtn = document.getElementById("join-btn");
const inviteInput = document.getElementById("invite");
const usernameInput = document.getElementById("username");
const pinInput = document.getElementById("pin");
const statusText = document.getElementById("status");

joinBtn.addEventListener("click", async function () {
  const invite = inviteInput.value.trim();
  const username = usernameInput.value.trim();
  const pin = pinInput.value.trim();

  if (invite === "" || username === "" || pin === "") {
    statusText.textContent = "Status: please fill in all three boxes";
    return;
  }

  statusText.textContent = "Status: sending...";

  try {
    const response = await fetch("/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite, username, pin })
    });

    const data = await response.json();

    if (response.ok) {
      statusText.textContent = "Status: " + data.message;
    } else {
      statusText.textContent = "Status: " + data.error;
    }
  } catch (err) {
    statusText.textContent = "Status: could not reach the server";
  }
});
