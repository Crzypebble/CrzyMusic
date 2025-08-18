/* ============================================================
   MusicCollab – Single-file JS for Dashboard, Albums, Project,
   Settings, Auth (placeholder), LocalStorage, Modals, Uploads.
   Plain JS, no frameworks. Designed for GitHub Pages.
   ============================================================ */

/* -------------------- Storage Helpers -------------------- */
const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : (fallback ?? null); }
    catch { return fallback ?? null; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  del(key) { localStorage.removeItem(key); },
};

// Keys
const K = {
  user: "mc_user",
  projects: "mc_projects",
  albums: "mc_albums",
  bg: "mc_bg",
  theme: "mc_theme",
  avatar: "mc_avatar",
};

/* -------------------- Models & Defaults -------------------- */
function ensureDefaults() {
  // Basic user object (placeholder auth)
  if (!LS.get(K.user)) {
    LS.set(K.user, {
      id: "u1",
      displayName: "You",
      email: "you@example.com",
      googleLinked: false,
    });
  }
  if (!LS.get(K.projects)) LS.set(K.projects, []);
  if (!LS.get(K.albums)) LS.set(K.albums, []);
}
ensureDefaults();

/* -------------------- DOM Utils -------------------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const el = (tag, attrs={}, children=[]) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  });
  children.forEach(c => e.appendChild(c));
  return e;
};
function bytesToDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}
function setHidden(node, hidden) { node.classList.toggle("hidden", !!hidden); }

/* -------------------- Global UI (sidebar, theme, bg) -------------------- */
function applyTheme() {
  const t = LS.get(K.theme, "dark");
  document.documentElement.classList.toggle("light", t === "light");
}
function toggleTheme() {
  const t = LS.get(K.theme, "dark") === "dark" ? "light" : "dark";
  LS.set(K.theme, t); applyTheme();
}
function applyBackground() {
  const bg = LS.get(K.bg, "");
  const layer = $("#bgLayer");
  if (!layer) return;
  if (bg) layer.style.backgroundImage = `url(${bg})`;
  else layer.style.backgroundImage = "";
}
function paintSidebarUser() {
  const u = LS.get(K.user);
  const avatar = LS.get(K.avatar, "");
  const name = $("#sidebarUsername");
  const email = $("#sidebarEmail");
  const img = $("#sidebarAvatar");
  if (name) name.textContent = u?.displayName || "User";
  if (email) email.textContent = u?.email || "";
  if (img) img.src = avatar || "https://via.placeholder.com/72x72.png?text=U";
}
function globalButtons() {
  const logout = $("#logoutBtn");
  if (logout) logout.addEventListener("click", () => {
    // Placeholder logout (clears local user but leaves data)
    LS.set(K.user, { id:"u1", displayName:"You", email:"you@example.com", googleLinked:false });
    location.href = "index.html";
  });
}

/* -------------------- Data Access -------------------- */
const Data = {
  allProjects() { return LS.get(K.projects, []); },
  allAlbums() { return LS.get(K.albums, []); },
  saveProjects(list) { LS.set(K.projects, list); },
  saveAlbums(list) { LS.set(K.albums, list); },
  byId(list, id) { return list.find(x => x.id === id); },
};

/* -------------------- Dashboard -------------------- */
function mountDashboard() {
  const recentList = $("#recentList");
  if (!recentList) return; // not on dashboard
  const activeSection = $("#activeSection");
  const activeList = $("#activeList");
  const collabList = $("#collabList");
  const recentEmpty = $("#recentEmpty");
  const collabEmpty = $("#collabEmpty");

  const projects = Data.allProjects().sort((a,b)=>b.updatedAt - a.updatedAt);

  // Active projects (with active=true)
  const active = projects.filter(p => p.active);
  setHidden(activeSection, active.length === 0);
  if (activeList) {
    activeList.innerHTML = "";
    active.forEach(p => activeList.appendChild(ProjectCard(p, {showAlbum:true})));
  }

  // Recent (owned by current user)
  const me = LS.get(K.user);
  const mine = projects.filter(p => (p.ownerId ?? "u1") === me.id);
  recentList.innerHTML = "";
  mine.forEach(p => recentList.appendChild(ProjectCard(p, {showAlbum:true})));
  setHidden(recentEmpty, mine.length !== 0);

  // Collab (not owner but in collaborators list)
  const collab = projects.filter(p => (p.ownerId ?? "u1") !== me.id && (p.collaborators||[]).includes(me.displayName || "You"));
  collabList.innerHTML = "";
  collab.forEach(p => collabList.appendChild(ProjectCard(p, {showAlbum:true})));
  setHidden(collabEmpty, collab.length !== 0);
}

/* -------------------- Albums Page -------------------- */
function mountAlbums() {
  const grid = $("#albumsGrid");
  if (!grid) return; // not on albums page

  const albums = Data.allAlbums().sort((a,b)=> (b.updatedAt||b.createdAt) - (a.updatedAt||a.createdAt));
  grid.innerHTML = "";
  if (albums.length === 0) setHidden($("#albumsEmpty"), false);
  else setHidden($("#albumsEmpty"), true);

  albums.forEach(a => {
    const card = el("div", {class:"card clickable"});
    const img = el("img", {class:"cover", src: a.cover || "https://via.placeholder.com/600x300.png?text=Album"});
    const pad = el("div", {class:"pad"});
    pad.appendChild(el("div", {class:"title", html: a.title}));
    pad.appendChild(el("div", {class:"sub", html: a.description || ""}));
    const tagWrap = el("div", {class:"tags"});
    tagWrap.appendChild(el("span", {class:"tag", html:`${(a.projectIds||[]).length} projects`}));
    pad.appendChild(tagWrap);
    card.append(img, pad);
    card.addEventListener("click", ()=> openAlbumSheet(a.id));
    grid.appendChild(card);
  });

  // Buttons & modals
  const openCreateAlbum = $("#openCreateAlbum");
  const openCreateAlbum2 = $("#openCreateAlbum2");
  const openCreateProject = $("#openCreateProject");
  const albumModal = $("#albumModal");
  const projectModal = $("#projectModal");

  [openCreateAlbum, openCreateAlbum2].forEach(btn=>{
    if (btn) btn.addEventListener("click", ()=> showModal("albumModal", true));
  });
  if (openCreateProject) openCreateProject.addEventListener("click", ()=> {
    populateAlbumSelect(); showModal("projectModal", true);
  });
  $$("[data-close]").forEach(btn=>{
    btn.addEventListener("click", ()=> showModal(btn.getAttribute("data-close"), false));
  });

  $("#saveAlbumBtn")?.addEventListener("click", async ()=>{
    const title = $("#albumTitle").value.trim();
    if (!title) return alert("Album needs a title.");
    const description = $("#albumDesc").value.trim();
    const file = $("#albumCover").files[0];
    const cover = file ? await bytesToDataURL(file) : "";
    const now = Date.now();

    const albums = Data.allAlbums();
    albums.push({
      id: crypto.randomUUID(),
      title, description, cover,
      projectIds: [],
      createdAt: now, updatedAt: now
    });
    Data.saveAlbums(albums);
    showModal("albumModal", false);
    mountAlbums();
  });

  $("#saveProjectBtn")?.addEventListener("click", async ()=>{
    const title = $("#projName").value.trim();
    if (!title) return alert("Project needs a title.");
    const description = $("#projDesc").value.trim();
    const collabStr = $("#projCollabs").value;
    const collaborators = collabStr ? collabStr.split(",").map(s=>s.trim()).filter(Boolean) : [];
    const file = $("#projCover").files[0];
    const cover = file ? await bytesToDataURL(file) : "";
    const albumId = $("#projAlbumSelect").value || null;
    const active = $("#projActive").checked;
    const now = Date.now();
    const me = LS.get(K.user);

    const projects = Data.allProjects();
    const pId = crypto.randomUUID();
    projects.push({
      id: pId, title, description, cover,
      ownerId: me.id, ownerName: me.displayName || "You",
      collaborators, albumId, active,
      tabs: {}, files: {}, createdAt: now, updatedAt: now
    });
    Data.saveProjects(projects);

    if (albumId) {
      const albums = Data.allAlbums();
      const a = Data.byId(albums, albumId);
      if (a) {
        a.projectIds = Array.from(new Set([...(a.projectIds||[]), pId]));
        a.updatedAt = now;
        Data.saveAlbums(albums);
      }
    }
    showModal("projectModal", false);
    mountAlbums();
  });
}

function populateAlbumSelect() {
  const sel = $("#projAlbumSelect");
  if (!sel) return;
  const albums = Data.allAlbums();
  sel.innerHTML = `<option value="">— No album —</option>`;
  albums.forEach(a=>{
    const o = el("option", {value:a.id});
    o.textContent = a.title;
    sel.appendChild(o);
  });
}

/* Album Manage Sheet */
let currentSheetAlbumId = null;
function openAlbumSheet(albumId) {
  currentSheetAlbumId = albumId;
  const a = Data.byId(Data.allAlbums(), albumId);
  if (!a) return;
  $("#sheetTitle").textContent = a.title;
  $("#sheetDesc").textContent = a.description || "";
  $("#sheetCover").src = a.cover || "https://via.placeholder.com/300x300.png?text=Album";
  // Pills
  const list = $("#sheetProjectList");
  list.innerHTML = "";
  const all = Data.allProjects();
  (a.projectIds||[]).forEach(pid=>{
    const p = Data.byId(all, pid);
    if (p) list.appendChild(el("span",{class:"pill", html:p.title}));
  });
  // Checklist
  const pick = $("#sheetProjectPicker");
  pick.innerHTML = "";
  all.forEach(p=>{
    const wrap = el("label");
    wrap.innerHTML = `<input type="checkbox" value="${p.id}" ${ (a.projectIds||[]).includes(p.id) ? "checked":"" }> ${p.title}`;
    pick.appendChild(wrap);
  });
  // Buttons
  $("#deleteAlbumBtn").onclick = ()=>{
    if (!confirm("Delete this album?")) return;
    const al = Data.allAlbums().filter(x=>x.id!==albumId);
    Data.saveAlbums(al);
    showModal("albumSheet", false);
    mountAlbums();
  };
  $("#saveAlbumProjectsBtn").onclick = ()=>{
    const checked = $$("#sheetProjectPicker input:checked").map(i=>i.value);
    const albums = Data.allAlbums();
    const a2 = Data.byId(albums, albumId);
    if (a2) {
      a2.projectIds = checked;
      a2.updatedAt = Date.now();
      Data.saveAlbums(albums);
      openAlbumSheet(albumId); // refresh
      mountAlbums();
    }
  };

  showModal("albumSheet", true);
}

/* -------------------- Project Page -------------------- */
function mountProject() {
  const panel = $("#tabPanel");
  if (!panel) return; // not on project page

  // identify project by query ?id=
  const url = new URL(location.href);
  const pid = url.searchParams.get("id");
  const projects = Data.allProjects();
  const p = pid ? Data.byId(projects, pid) : null;
  if (!p) {
    // If no id, and there are projects, send to first
    if (projects[0]) { location.replace(`project.html?id=${projects[0].id}`); return; }
    // otherwise redirect to albums to create one
    location.replace("albums.html");
    return;
  }

  $("#projTitle").textContent = p.title;
  $("#projMeta").textContent = `${p.ownerName || "You"} • ${fmtDate(p.updatedAt)}`;
  const toggleBtn = $("#toggleActiveBtn");
  toggleBtn.textContent = p.active ? "Mark Inactive" : "Mark Active";
  toggleBtn.onclick = ()=>{
    p.active = !p.active;
    p.updatedAt = Date.now();
    Data.saveProjects(projects);
    toggleBtn.textContent = p.active ? "Mark Inactive" : "Mark Active";
  };

  $("#deleteProjectBtn").onclick = ()=>{
    if (!confirm("Delete this project?")) return;
    // remove from albums
    const albums = Data.allAlbums();
    albums.forEach(a => a.projectIds = (a.projectIds||[]).filter(id=>id!==p.id));
    Data.saveAlbums(albums);
    // remove project
    Data.saveProjects(projects.filter(x=>x.id!==p.id));
    location.href = "index.html";
  };

  // Tabs
  const defaultTabs = ["Lyrics","Guitar","Bass","Drums","Notes"];
  if (!p.tabs || Object.keys(p.tabs).length===0) {
    p.tabs = {};
    defaultTabs.forEach(t => p.tabs[t] = { text:"", files:[] });
    p.updatedAt = Date.now();
    Data.saveProjects(projects);
  }
  const tabsEl = $("#projTabs");
  tabsEl.innerHTML = "";
  const addBtn = el("button",{class:"tab-btn", html:"+ Add Tab"});
  Object.keys(p.tabs).forEach((name, i)=>{
    const b = el("button",{class:"tab-btn", html:name});
    b.addEventListener("click", ()=> openTab(name));
    if (i===0) b.classList.add("active");
    tabsEl.appendChild(b);
  });
  tabsEl.appendChild(addBtn);
  addBtn.addEventListener("click", async ()=>{
    const name = prompt("New tab name?");
    if (!name) return;
    if (p.tabs[name]) return alert("Tab already exists");
    p.tabs[name] = { text:"", files:[] };
    p.updatedAt = Date.now();
    Data.saveProjects(projects);
    mountProject(); // rebuild tabs
  });

  function openTab(name) {
    $$(".tab-btn", tabsEl).forEach(x=>x.classList.remove("active"));
    const btn = Array.from(tabsEl.children).find(b=>b.textContent===name);
    if (btn) btn.classList.add("active");

    const state = p.tabs[name] || { text:"", files:[] };
    panel.innerHTML = "";

    // Editor
    const editor = el("textarea",{class:"editor"});
    editor.value = state.text || "";
    editor.addEventListener("input", ()=>{
      state.text = editor.value;
      p.tabs[name] = state;
      p.updatedAt = Date.now();
      Data.saveProjects(projects);
    });
    panel.appendChild(editor);

    // Upload
    const up = el("div",{class:"row gap",});
    const fileInput = el("input",{type:"file", multiple:true});
    const uploadBtn = el("button",{class:"btn ghost", html:"Upload Files"});
    uploadBtn.addEventListener("click", ()=> fileInput.click());
    fileInput.addEventListener("change", async (e)=>{
      const list = Array.from(e.target.files);
      for (const f of list) {
        const data = await bytesToDataURL(f);
        state.files.push({name: f.name, type: f.type, data, size: f.size, ts: Date.now()});
      }
      p.tabs[name] = state;
      p.updatedAt = Date.now();
      Data.saveProjects(projects);
      renderFiles();
    });
    up.append(uploadBtn, fileInput);
    panel.appendChild(up);

    // Files list
    const filesWrap = el("div",{class:"uploads", id:"uploadsWrap"});
    panel.appendChild(filesWrap);
    renderFiles();

    function renderFiles() {
      filesWrap.innerHTML = "";
      if (!state.files || state.files.length===0) {
        filesWrap.appendChild(el("div",{class:"empty", html:"No files yet."}));
        return;
      }
      state.files.forEach((f, idx)=>{
        const card = el("div",{class:"filecard"});
        const prev = previewFor(f);
        if (prev) card.appendChild(prev);
        const meta = el("div",{class:"pad"});
        meta.appendChild(el("div",{class:"title", html:f.name}));
        meta.appendChild(el("div",{class:"sub", html:`${f.type || "file"} • ${Math.round((f.size||0)/1024)} KB`}));
        const row = el("div",{class:"row gap"});
        const dl = el("a",{class:"btn primary", href:f.data, download:f.name}); dl.textContent="Download";
        const rm = el("button",{class:"btn danger", html:"Delete"});
        rm.addEventListener("click", ()=>{
          state.files.splice(idx,1);
          p.tabs[name] = state;
          p.updatedAt = Date.now();
          Data.saveProjects(projects);
          renderFiles();
        });
        row.append(dl, rm);
        meta.appendChild(row);
        card.appendChild(meta);
        filesWrap.appendChild(card);
      });
    }
  }

  function previewFor(f) {
    if (!f || !f.type) return null;
    if (f.type.startsWith("image/")) return el("img",{class:"file-preview", src:f.data, alt:f.name});
    if (f.type.startsWith("audio/")) {
      const a = el("audio",{controls:true}); a.src = f.data; a.className="file-preview"; return a;
    }
    if (f.type.startsWith("video/")) {
      const v = el("video",{controls:true}); v.src = f.data; v.className="file-preview"; v.style.maxHeight="220px"; return v;
    }
    return null;
  }

  // Open first tab by default
  const first = Object.keys(p.tabs)[0];
  if (first) {
    setTimeout(()=> {
      const b = Array.from($("#projTabs").children).find(x=>x.textContent===first);
      if (b) b.click();
    }, 0);
  }

  // Export (NOTE: simple folder-less export via JSON download for now)
  $("#exportBtn").onclick = ()=>{
    const blob = new Blob([JSON.stringify(p, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(p.title||"project").replace(/\s+/g,"_")}.json`;
    a.click();
  };
}

/* -------------------- Reusable Components -------------------- */
function ProjectCard(p, opts={}) {
  const card = el("div",{class:"card clickable"});
  const img = el("img",{class:"cover", src: p.cover || "https://via.placeholder.com/640x360.png?text=Project"});
  const pad = el("div",{class:"pad"});
  pad.appendChild(el("div",{class:"title", html:p.title}));
  if (p.description) pad.appendChild(el("div",{class:"sub", html:p.description}));
  const tags = el("div",{class:"tags"});
  if (opts.showAlbum) {
    const albumName = (()=>{
      const a = Data.byId(Data.allAlbums(), p.albumId);
      return a ? a.title : "No album";
    })();
    tags.appendChild(el("span",{class:"tag", html: albumName }));
  }
  if (p.active) tags.appendChild(el("span",{class:"tag", html:"Active"}));
  if ((p.collaborators||[]).length) tags.appendChild(el("span",{class:"tag", html:`+${p.collaborators.length} collab`}));
  pad.appendChild(tags);
  card.append(img, pad);
  card.addEventListener("click", ()=> location.href = `project.html?id=${p.id}`);
  return card;
}

/* -------------------- Modal / Sheet control -------------------- */
function showModal(id, open) {
  const node = document.getElementById(id);
  if (!node) return;
  node.style.display = open ? "flex" : "none";
}

/* -------------------- Settings Page -------------------- */
function mountSettings() {
  const toggle = $("#themeToggle");
  const switcher = $("#themeSwitch");
  if (!toggle && !switcher) return; // not on settings page

  const u = LS.get(K.user);
  $("#displayName").value = u.displayName || "";
  $("#emailField").value = u.email || "";
  const avStored = LS.get(K.avatar, "");
  $("#profileAvatar").src = avStored || "https://via.placeholder.com/128.png?text=U";

  const theme = LS.get(K.theme, "dark");
  switcher.checked = theme === "light";
  toggle.addEventListener("click", toggleTheme);
  switcher.addEventListener("change", toggleTheme);

  $("#avatarUpload").addEventListener("change", async (e)=>{
    const f = e.target.files[0]; if (!f) return;
    const data = await bytesToDataURL(f);
    LS.set(K.avatar, data);
    $("#profileAvatar").src = data;
    paintSidebarUser();
  });

  $("#saveProfileBtn").addEventListener("click", ()=>{
    const user = LS.get(K.user);
    user.displayName = $("#displayName").value || "You";
    user.email = $("#emailField").value || user.email;
    LS.set(K.user, user);
    paintSidebarUser();
    alert("Profile saved");
  });

  $("#bgUpload").addEventListener("change", async (e)=>{
    const f = e.target.files[0]; if (!f) return;
    const data = await bytesToDataURL(f);
    LS.set(K.bg, data);
  });
  $("#saveBgBtn").addEventListener("click", ()=> applyBackground());
  $("#clearBgBtn").addEventListener("click", ()=> { LS.del(K.bg); applyBackground(); });

  $("#unlinkGoogleBtn").addEventListener("click", ()=>{
    const user = LS.get(K.user);
    user.googleLinked = !user.googleLinked;
    LS.set(K.user, user);
    alert((user.googleLinked?"Linked":"Unlinked") + " Google (placeholder)");
  });
}

/* -------------------- Bootstrap -------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  applyTheme();
  applyBackground();
  paintSidebarUser();
  globalButtons();

  mountDashboard();
  mountAlbums();
  mountProject();
  mountSettings();
});
