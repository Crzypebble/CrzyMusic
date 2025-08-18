// ===== AUTH =====
function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "{}");
}
function setUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser"));
}
function setCurrentUser(user) {
  if (user) localStorage.setItem("currentUser", JSON.stringify(user));
  else localStorage.removeItem("currentUser");
}

// Signup
function signupUser() {
  const email = document.getElementById("signupEmail").value;
  const pass = document.getElementById("signupPassword").value;
  const users = getUsers();
  if (users[email]) return alert("User already exists");
  users[email] = { email, pass };
  setUsers(users);
  alert("Account created. Please login.");
  showLogin();
}

// Login
function loginUser() {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;
  const users = getUsers();
  if (users[email] && users[email].pass === pass) {
    setCurrentUser(users[email]);
    location.reload();
  } else alert("Invalid credentials");
}

// Fake Google Login
function fakeGoogleLogin() {
  if (confirm("Simulate Google login?")) {
    const email = "googleuser@example.com";
    const users = getUsers();
    if (!users[email]) users[email] = { email, pass: "" };
    setUsers(users);
    setCurrentUser(users[email]);
    location.reload();
  }
}

// Logout
function logoutUser() {
  setCurrentUser(null);
  location.href = "index.html";
}

// Toggle forms
function showSignup() {
  document.getElementById("signupForm").style.display = "block";
  document.getElementById("loginForm").style.display = "none";
}
function showLogin() {
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
}

// ===== INIT APP =====
document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  const authContainer = document.getElementById("authContainer");
  const app = document.getElementById("app");

  if (authContainer && app) {
    if (user) {
      authContainer.style.display = "none";
      app.style.display = "flex";
      loadProjects();
    } else {
      authContainer.style.display = "flex";
      app.style.display = "none";
    }
  }

  // Settings page profile
  if (document.getElementById("profileSettings")) {
    if (user) {
      document.getElementById("profileEmail").textContent = user.email;
    } else {
      document.getElementById("profileSettings").style.display = "none";
    }
  }

  // Albums
  if (document.getElementById("albumsGrid")) {
    loadAlbums();
  }

  // Project tabs
  if (document.getElementById("tabButtons")) {
    initProjectPage();
  }

  // Apply background
  applyBackground();
});

// ===== DASHBOARD =====
function loadProjects() {
  const list = document.getElementById("projectsList");
  list.innerHTML = "";
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  projects.forEach((p, i) => {
    const div = document.createElement("div");
    div.innerHTML = `<h3>${p.title}</h3>
      <button onclick="openProject(${i})">Open</button>
      <button onclick="deleteProject(${i})">Delete</button>`;
    list.appendChild(div);
  });
}
function createProject() {
  const title = prompt("Project name?");
  if (!title) return;
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  projects.push({ title, tabs: {} });
  localStorage.setItem("projects", JSON.stringify(projects));
  loadProjects();
}
function deleteProject(i) {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  projects.splice(i, 1);
  localStorage.setItem("projects", JSON.stringify(projects));
  loadProjects();
}
function openProject(i) {
  localStorage.setItem("currentProjectIndex", i);
  location.href = "project.html";
}

// ===== PROJECT PAGE =====
function initProjectPage() {
  const idx = localStorage.getItem("currentProjectIndex");
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const project = projects[idx];
  if (!project) return;

  document.getElementById("projectTitle").textContent = project.title;

  const tabs = ["Lyrics", "Guitar", "Bass", "Drums", "Notes"];
  const btns = document.getElementById("tabButtons");
  tabs.forEach(t => {
    const b = document.createElement("button");
    b.textContent = t;
    b.onclick = () => openTab(t, idx);
    btns.appendChild(b);
  });
  openTab(tabs[0], idx);
}

function openTab(tab, idx) {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const project = projects[idx];
  project.tabs[tab] = project.tabs[tab] || { text: "", files: [] };
  localStorage.setItem("projects", JSON.stringify(projects));

  const content = document.getElementById("tabContent");
  content.innerHTML = `
    <textarea oninput="saveText(${idx},'${tab}',this.value)">${project.tabs[tab].text}</textarea>
    <input type="file" multiple onchange="uploadFiles(event,${idx},'${tab}')">
    <div id="filesList"></div>`;
  renderFiles(project.tabs[tab].files);
}

function saveText(idx, tab, val) {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  projects[idx].tabs[tab].text = val;
  localStorage.setItem("projects", JSON.stringify(projects));
}

function uploadFiles(e, idx, tab) {
  const files = Array.from(e.target.files);
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = () => {
      projects[idx].tabs[tab].files.push({ name: f.name, data: reader.result, type: f.type });
      localStorage.setItem("projects", JSON.stringify(projects));
      renderFiles(projects[idx].tabs[tab].files);
    };
    reader.readAsDataURL(f);
  });
}

function renderFiles(files) {
  const list = document.getElementById("filesList");
  list.innerHTML = "";
  files.forEach(f => {
    const div = document.createElement("div");
    div.innerHTML = `<p>${f.name}</p>`;
    if (f.type.startsWith("image")) div.innerHTML += `<img src="${f.data}" width="100">`;
    else if (f.type.startsWith("audio")) div.innerHTML += `<audio controls src="${f.data}"></audio>`;
    else if (f.type.startsWith("video")) div.innerHTML += `<video controls width="200" src="${f.data}"></video>`;
    div.innerHTML += `<a download="${f.name}" href="${f.data}">Download</a>`;
    list.appendChild(div);
  });
}

function exportProject() {
  alert("ZIP export simulated – needs JSZip library for real packaging.");
}

// ===== ALBUMS =====
function loadAlbums() {
  const grid = document.getElementById("albumsGrid");
  grid.innerHTML = "";
  const albums = JSON.parse(localStorage.getItem("albums") || "[]");
  albums.forEach((a, i) => {
    const div = document.createElement("div");
    div.innerHTML = `<img src="${a.cover || "https://via.placeholder.com/150"}" width="100%">
    <h3>${a.title}</h3>
    <button onclick="deleteAlbum(${i})">Delete</button>`;
    grid.appendChild(div);
  });
}
function createAlbum() {
  const title = prompt("Album name?");
  if (!title) return;
  const cover = prompt("Enter cover image URL (or leave blank)");
  const albums = JSON.parse(localStorage.getItem("albums") || "[]");
  albums.push({ title, cover });
  localStorage.setItem("albums", JSON.stringify(albums));
  loadAlbums();
}
function deleteAlbum(i) {
  const albums = JSON.parse(localStorage.getItem("albums") || "[]");
  albums.splice(i, 1);
  localStorage.setItem("albums", JSON.stringify(albums));
  loadAlbums();
}

// ===== SETTINGS =====
function toggleTheme() {
  document.body.classList.toggle("light");
}

function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById("avatar").src = reader.result;
    localStorage.setItem("avatar", reader.result);
  };
  reader.readAsDataURL(file);
}

function uploadBackground(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem("background", reader.result);
    applyBackground();
  };
  reader.readAsDataURL(file);
}
function clearBackground() {
  localStorage.removeItem("background");
  applyBackground();
}
function applyBackground() {
  const bg = localStorage.getItem("background");
  if (bg) document.body.style.backgroundImage = `url(${bg})`;
  else document.body.style.backgroundImage = "";
}
