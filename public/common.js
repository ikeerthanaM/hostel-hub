// ---------- Shared helpers (used by several pages) ----------

// Anonymous browser ID for chat and complaints. Not a login.
function getVisitorId() {
  let id = null;
  try {
    id = localStorage.getItem("hubVisitorId");
  } catch (e) {}

  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem("hubVisitorId", id);
    } catch (e) {}
  }
  return id;
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00+05:30").toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium"
  });
}

function formatTime(ms) {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  });
}

// Asks the phone for its location once
function getLocation() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot read location"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      () => reject(new Error("Location permission was denied")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// Pages that need a login call this. If the visitor isn't logged in, they go to the login page.
async function requireLogin() {
  const response = await fetch("/me");
  if (!response.ok) {
    window.location.href = "index.html";
    return null;
  }
  return response.json();
}

// ---------- Navigation: top bar and left drawer ----------

const NAV_SECTIONS = [
  {
    title: "Hostel",
    items: [
      { label: "Attendance", href: "attendance.html" },
      { label: "Check out / in", href: "movement.html" },
      { label: "Going home", href: "calendar.html" }
    ]
  },
  {
    title: "Food",
    items: [{ label: "Food poll", href: "poll.html" }]
  },
  {
    title: "Community",
    items: [
      { label: "Chat", href: "chat.html" },
      { label: "Complaints", href: "complaints.html" }
    ]
  }
];

// Pages without the menu: the login page and the register page
const NO_NAV_PAGES = ["", "index.html", "register.html"];

function buildNav() {
  const here = window.location.pathname.split("/").pop();
  if (NO_NAV_PAGES.includes(here)) return;

  document.body.classList.add("has-nav");

  let pageTitle = "Hostel Hub";
  NAV_SECTIONS.forEach(function (section) {
    section.items.forEach(function (item) {
      if (item.href === here) pageTitle = item.label;
    });
  });

  // Top bar: menu button, page name, and a generic avatar. No username is shown.
  const bar = document.createElement("div");
  bar.className = "hub-nav";

  const menuBtn = document.createElement("button");
  menuBtn.className = "menu-btn";
  menuBtn.textContent = "☰";
  menuBtn.setAttribute("aria-label", "Open menu");

  const title = document.createElement("span");
  title.className = "hub-title";
  title.textContent = pageTitle;

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = "👤";

  bar.appendChild(menuBtn);
  bar.appendChild(title);
  bar.appendChild(avatar);

  // The dim layer behind the open drawer
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";

  // The left drawer with every page
  const drawer = document.createElement("nav");
  drawer.className = "drawer";

  const brand = document.createElement("p");
  brand.className = "drawer-brand";
  brand.textContent = "Hostel Hub";
  drawer.appendChild(brand);

  NAV_SECTIONS.forEach(function (section) {
    const heading = document.createElement("h3");
    heading.textContent = section.title;
    drawer.appendChild(heading);

    section.items.forEach(function (item) {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      if (item.href === here) link.classList.add("active");
      drawer.appendChild(link);
    });
  });

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "logout";
  logoutBtn.textContent = "Log out";
  logoutBtn.addEventListener("click", async function () {
    await fetch("/logout", { method: "POST" });
    window.location.href = "index.html";
  });
  drawer.appendChild(logoutBtn);

  function setDrawer(open) {
    drawer.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
  }

  menuBtn.addEventListener("click", () => setDrawer(true));
  backdrop.addEventListener("click", () => setDrawer(false));

  document.body.prepend(bar, backdrop, drawer);
}

buildNav();

// Shows a short confirmation that pops in, then clears itself after 2.5 seconds
function flashConfirm(node, text) {
  node.classList.remove("flash");
  node.textContent = "✓ " + text;
  void node.offsetWidth; // restarts the animation
  node.classList.add("flash");

  clearTimeout(node._hideTimer);
  node._hideTimer = setTimeout(function () {
    node.classList.remove("flash");
    node.textContent = "";
  }, 2500);
}

