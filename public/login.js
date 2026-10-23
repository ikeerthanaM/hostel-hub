const usernameInput = document.getElementById("username");
const pinInput = document.getElementById("pin");
const loginBtn = document.getElementById("login-btn");
const statusEl = document.getElementById("status");

loginBtn.addEventListener("click", async function () {
  loginBtn.disabled = true;
  statusEl.textContent = "Logging in...";

  const response = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: usernameInput.value,
      pin: pinInput.value
    })
  });
  const data = await response.json();

  if (response.ok) {
    window.location.href = "attendance.html";
  } else {
    statusEl.textContent = data.error;
    loginBtn.disabled = false;
  }
});
