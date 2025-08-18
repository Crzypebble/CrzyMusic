/* ===========================================================
   Music Notebook — Plain JS (no frameworks), single directory.
   - Auth placeholder (localStorage)
   - Projects & Albums metadata in localStorage
   - Files in IndexedDB (so previews work without downloading)
   - Project tabs with editors & file uploads
   - Export ZIP (store-only) built here — no external libs
   =========================================================== */

(() => {
  const PAGE = document.documentElement.getAttribute('data-page');
  const THEME_KEY = 'mn.theme';
  const AUTH_KEY = 'mn.authed';
  const PROFILE_KEY = 'mn.profile';
  const PROJECTS_KEY = 'mn.projects';
  const ALBUMS_KEY = 'mn.albums';

  // Ensure dark-by-default, and sync theme attribute
  const initialTheme = localStorage.getItem(THEME_KEY) || 'dark';
  document.body.classList.toggle('theme-dark', initialTheme === 'dark');
  document.documentElement.dataset.theme = initialTheme === 'dark' ? 'dark' : 'light';

  // --- IndexedDB setup for files (blobs)
  const DB_NAME = 'mn_files_db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) {
          const store = db.createObjectStore('files', { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbPut(fileRecord) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(fileRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGetByProject(projectId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const idx = tx.objectStore('files').index('projectId');
      const req = idx.getAll(projectId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Utilities
  const uid = (prefix='id') => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  const nowISO = () => new Date().toISOString();
  const fmtDate = (iso) => new Date(iso).toLocaleString();

  const readJSON = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function ensureAuthed() {
    const authed = localStorage.getItem(AUTH_KEY) === '1';
    return authed;
  }

  function setAuthed(val) {
    localStorage.setItem(AUTH_KEY, val ? '1' : '0');
  }

  function getProjects() { return readJSON(PROJECTS_KEY, []); }
  function setProjects(list) { writeJSON(PROJECTS_KEY, list); }

  function getAlbums() { return readJSON(ALBUMS_KEY, []); }
  function setAlbums(list) { writeJSON(ALBUMS_KEY, list); }

  function getProfile() { return readJSON(PROFILE_KEY, { name: '', tagline: '' }); }
  function setProfile(p) { writeJSON(PROFILE_KEY, p); }

  function upsertProject(p) {
    const list = getProjects();
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list[idx] = p; else list.unshift(p);
    setProjects(list);
  }

  // --- ZIP (store-only) builder (no compression, valid ZIP)
  // Minimal implementation: computes CRC32, writes local headers, central directory, end record.
  const ZipBuilder = (() => {
    // CRC32 table
    const table = (() => {
      let c, table = new Uint32Array(256);
      for (let n=0; n<256; n++) {
        c = n;
        for (let k=0; k<8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      return table;
    })();
    function crc32(buf) {
      let crc = 0 ^ (-1);
      for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
      }
      return (crc ^ (-1)) >>> 0;
    }
    function strToBytes(str) {
      return new TextEncoder().encode(str);
    }
    function dateToDos(dt = new Date()) {
      const time = ((dt.getHours() & 0x1f) << 11) | ((dt.getMinutes() & 0x3f) << 5) | ((Math.floor(dt.getSeconds()/2)) & 0x1f);
      const date = (((dt.getFullYear()-1980) & 0x7f) << 9) | (((dt.getMonth()+1) & 0xf) << 5) | ((dt.getDate()) & 0x1f);
      return { time, date };
    }
    function writeUint32LE(view, offset, val) { view.setUint32(offset, val >>> 0, true); }
    function writeUint16LE(view, offset, val) { view.setUint16(offset, val & 0xffff, true); }

    return class {
      constructor() { this.files = []; }
      async addFile(path, blob) {
        const nameBytes = strToBytes(path);
        const buf = new Uint8Array(await blob.arrayBuffer());
        const crc = crc32(buf);
        const { time, date } = dateToDos();
        this.files.push({ nameBytes, buf, crc, time, date });
      }
      build() {
        let fileData = [];
        let central = [];
        let offset = 0;

        for (const f of this.files) {
          // Local file header
          const LH = new ArrayBuffer(30); // fixed part
          const lhv = new DataView(LH);
          writeUint32LE(lhv, 0, 0x04034b50);         // signature
          writeUint16LE(lhv, 4, 20);                 // version needed
          writeUint16LE(lhv, 6, 0);                  // flags
          writeUint16LE(lhv, 8, 0);                  // compression (0 = store)
          writeUint16LE(lhv,10, f.time);
          writeUint16LE(lhv,12, f.date);
          writeUint32LE(lhv,14, f.crc);
          writeUint32LE(lhv,18, f.buf.length);       // comp size
          writeUint32LE(lhv,22, f.buf.length);       // uncomp size
          writeUint16LE(lhv,26, f.nameBytes.length); // name len
          writeUint16LE(lhv,28, 0);                  // extra len

          const localHeader = new Uint8Array(LH);
          fileData.push(localHeader, f.nameBytes, f.buf);

          // Central directory header
          const CH = new ArrayBuffer(46);
          const chv = new DataView(CH);
          writeUint32LE(chv, 0, 0x02014b50);         // central sig
          writeUint16LE(chv, 4, 20);                 // version made by
          writeUint16LE(chv, 6, 20);                 // version needed
          writeUint16LE(chv, 8, 0);                  // flags
          writeUint16LE(chv,10, 0);                  // compression
          writeUint16LE(chv,12, f.time);
          writeUint16LE(chv,14, f.date);
          writeUint32LE(chv,16, f.crc);
          writeUint32LE(chv,20, f.buf.length);
          writeUint32LE(chv,24, f.buf.length);
          writeUint16LE(chv,28, f.nameBytes.length);
          writeUint16LE(chv,30, 0);                  // extra len
          writeUint16LE(chv,32, 0);                  // comment len
          writeUint16LE(chv,34, 0);                  // disk number
          writeUint16LE(chv,36, 0);                  // internal attrs
          writeUint32LE(chv,38, 0);                  // external attrs
          writeUint32LE(chv,42, offset);             // local header offset

          central.push(new Uint8Array(CH), f.nameBytes);

          // update running offset
          offset += localHeader.length + f.nameBytes.length + f.buf.length;
        }

        // Concatenate fileData
        const fileDataBlob = new Blob(fileData, { type: 'application/octet-stream' });

        // Central directory blob
        const centralBlob = new Blob(central, { type: 'application/octet-stream' });
        const centralSizePromise = centralBlob.arrayBuffer().then(b => b.byteLength);

        // End of central directory
        return centralSizePromise.then(centralSize => {
          const totalEntries = this.files.length;
          const end = new ArrayBuffer(22);
          const ev = new DataView(end);
          writeUint32LE(ev, 0, 0x06054b50);         // end sig
          writeUint16LE(ev, 4, 0);                  // disk number
          writeUint16LE(ev, 6, 0);                  // disk start
          writeUint16LE(ev, 8, totalEntries);
          writeUint16LE(ev,10, totalEntries);
          writeUint32LE(ev,12, centralSize);
          writeUint32LE(ev,16, fileDataBlob.size);
          writeUint16LE(ev,20, 0);                  // comment len

          return new Blob([fileDataBlob, centralBlob, new Uint8Array(end)], { type: 'application/zip' });
        });
      }
    };
  })();

  // --- Page initializers
  const pages = {
    index: initIndex,
    project: initProject,
    albums: initAlbums,
    settings: initSettings
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Route to page init
    const init = pages[PAGE];
    if (init) init();
  });

  /* =========================
     INDEX (login + dashboard)
     ========================= */
  function initIndex() {
    const login = document.getElementById('login-screen');
    const dash = document.getElementById('dashboard');
    const authed = ensureAuthed();

    if (authed) {
      login?.remove();
      dash?.classList.remove('hidden');
      renderDashboard();
    } else {
      dash?.remove();
      // Buttons
      document.getElementById('google-login')?.addEventListener('click', () => {
        setAuthed(true);
        location.reload();
      });
      document.getElementById('guest-login')?.addEventListener('click', () => {
        setAuthed(true);
        location.reload();
      });
    }

    document.getElementById('new-project')?.addEventListener('click', () => {
      const p = {
        id: uid('proj'),
        title: 'Untitled Project',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        albumId: '',
        tabs: {
          Lyrics: { text: '' },
          Guitar: { text: '' },
          Bass: { text: '' },
          Drums: { text: '' },
          Notes: { text: '' }
        },
        customTabs: []
      };
      upsertProject(p);
      location.href = `project.html?id=${encodeURIComponent(p.id)}`;
    });
  }

  function renderDashboard() {
    const grid = document.getElementById('project-grid');
    const tpl = document.getElementById('project-card-tpl');
    if (!grid || !tpl) return;

    grid.innerHTML = '';
    const projects = getProjects();
    if (projects.length === 0) {
      grid.innerHTML = `<div class="card"><div class="card-body"><p class="muted">No projects yet — click <strong>New Project</strong> to start.</p></div></div>`;
      return;
    }
    projects.sort((a,b)=>new Date(b.updatedAt) - new Date(a.updatedAt));
    for (const p of projects) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.href = `project.html?id=${encodeURIComponent(p.id)}`;
      node.querySelector('[data-title]').textContent = p.title || 'Untitled';
      node.querySelector('[data-updated]').textContent = `Updated ${fmtDate(p.updatedAt)}`;
      grid.appendChild(node);
    }
  }

  /* ===============
     PROJECT PAGE
     =============== */
  async function initProject() {
    if (!ensureAuthed()) { location.href = 'index.html'; return; }

    // Get projectId from query
    const params = new URLSearchParams(location.search);
    const projectId = params.get('id');
    if (!projectId) { location.href = 'index.html'; return; }

    let p = getProjects().find(x => x.id === projectId);
    if (!p) { alert('Project not found'); location.href = 'index.html'; return; }

    // Populate UI
    const titleInput = document.getElementById('project-title');
    const albumSelect = document.getElementById('project-album');
    titleInput.value = p.title || '';
    document.getElementById('crumb-title').textContent = p.title || 'Project';

    // Albums dropdown
    renderAlbumSelect(albumSelect, p.albumId);

    // Build default panels content
    const panels = document.querySelectorAll('.tab-panel');
    const panelTpl = document.getElementById('panel-template');
    const editors = {}; // tabName -> textarea
    const fileSections = {}; // tabName -> { input, list }

    function mountPanel(panelEl, tabName) {
      panelEl.innerHTML = '';
      const node = panelTpl.content.firstElementChild.cloneNode(true);
      const textarea = node.querySelector('.editor');
      textarea.value = (p.tabs[tabName]?.text) || '';
      editors[tabName] = textarea;

      const fileInput = node.querySelector('.file-input');
      const fileList = node.querySelector('.file-list');
      fileSections[tabName] = { fileInput, fileList };

      // Upload handler
      fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files || []);
        for (const f of files) {
          const rec = {
            id: uid('file'),
            projectId,
            tab: tabName,
            name: f.name,
            type: f.type || 'application/octet-stream',
            size: f.size,
            createdAt: nowISO(),
            blob: f
          };
          await idbPut(rec);
        }
        await renderFileList(tabName);
        fileInput.value = '';
        touchProject(); // mark updated
      });

      panelEl.appendChild(node);
      // Initial render of files for this tab
      renderFileList(tabName);
    }

    // Mount default tabs
    for (const panel of panels) {
      const tabName = panel.getAttribute('data-panel');
      if (!(tabName in p.tabs)) p.tabs[tabName] = { text: '' };
      mountPanel(panel, tabName);
    }

    // Add existing custom tabs to tab bar
    const tabBar = document.getElementById('tab-bar');
    for (const ct of (p.customTabs || [])) {
      addTabButton(tabBar, ct);
      // Create a panel for it
      const newPanel = document.createElement('div');
      newPanel.className = 'tab-panel';
      newPanel.setAttribute('data-panel', ct);
      newPanel.innerHTML = '';
      newPanel.appendChild(document.getElementById('panel-template').content.firstElementChild.cloneNode(true));
      // Replace with mounted version
      newPanel.innerHTML = '';
      document.querySelector('.tab-panels').appendChild(newPanel);
      if (!(ct in p.tabs)) p.tabs[ct] = { text: '' };
      mountPanel(newPanel, ct);
    }

    // Tab switching
    tabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn || btn.classList.contains('add-tab')) return;
      switchTab(btn.dataset.tab);
    });

    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      document.querySelectorAll('.tab-panel').forEach(pn => pn.classList.toggle('active', pn.getAttribute('data-panel') === name));
    }

    // Add custom tab
    document.getElementById('add-tab-btn').addEventListener('click', () => {
      const name = (document.getElementById('new-tab-name').value || '').trim();
      if (!name) return;
      if (p.tabs[name]) { alert('Tab already exists.'); return; }
      p.customTabs = p.customTabs || [];
      p.customTabs.push(name);
      p.tabs[name] = { text: '' };
      addTabButton(tabBar, name);

      const panel = document.createElement('div');
      panel.className = 'tab-panel';
      panel.setAttribute('data-panel', name);
      document.querySelector('.tab-panels').appendChild(panel);
      mountPanel(panel, name);

      document.getElementById('new-tab-name').value = '';
      touchProject();
      switchTab(name);
    });

    function addTabButton(tabBar, name) {
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.dataset.tab = name;
      btn.textContent = name;
      tabBar.insertBefore(btn, tabBar.querySelector('.add-tab'));
    }

    // Save project (title, album, all editors)
    document.getElementById('save-project').addEventListener('click', () => {
      p.title = titleInput.value.trim() || 'Untitled Project';
      p.albumId = albumSelect.value || '';
      // Collect editor content
      for (const [tabName, ta] of Object.entries(editors)) {
        p.tabs[tabName] = p.tabs[tabName] || {};
        p.tabs[tabName].text = ta.value;
      }
      p.updatedAt = nowISO();
      upsertProject(p);
      document.getElementById('crumb-title').textContent = p.title;
      alert('Saved ✅');
    });

    function touchProject() {
      p.updatedAt = nowISO();
      upsertProject(p);
    }

    // Export ZIP (all files + project.json)
    document.getElementById('export-zip').addEventListener('click', async () => {
      const zb = new ZipBuilder();
      // Build JSON
      const projectForExport = JSON.parse(JSON.stringify(p));
      // Attach file references
      const files = await idbGetByProject(projectId);
      projectForExport.files = files.map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size, tab: f.tab, createdAt: f.createdAt }));

      await zb.addFile(`${sanitize(p.title) || 'project'}/project.json`, new Blob([JSON.stringify(projectForExport, null, 2)], { type: 'application/json' }));
      // Add each file
      for (const f of files) {
        const path = `${sanitize(p.title) || 'project'}/files/${sanitize(f.tab)}/${f.name}`;
        await zb.addFile(path, f.blob);
      }
      const zipBlob = await zb.build();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${sanitize(p.title) || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });

    function sanitize(s='') { return s.replace(/[^\w\-\. ]+/g, '_'); }

    async function renderFileList(tabName) {
      const { fileList } = fileSections[tabName];
      if (!fileList) return;
      fileList.innerHTML = '';
      const files = (await idbGetByProject(projectId)).filter(f =>
