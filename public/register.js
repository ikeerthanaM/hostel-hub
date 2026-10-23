const inviteInput = document.getElementById("invite");
const realNameInput = document.getElementById("real-name");
const usernameInput = document.getElementById("username");
const pinInput = document.getElementById("pin");
const registerBtn = document.getElementById("register-btn");
const statusEl = document.getElementById("status");

registerBtn.addEventListener("click", async function () {
  registerBtn.disabled = true;
  statusEl.textContent = "Creating account...";

  const response = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invite: inviteInput.value,
      realName: realNameInput.value,
      username: usernameInput.value,
      pin: pinInput.value
    })
  });
  const data = await response.json();

  statusEl.textContent = data.message || data.error;
  registerBtn.disabled = Boolean(data.message) && response.ok;
});
