// Selectors
const projectModal = document.getElementById("projectModal");
const albumModal = document.getElementById("albumModal");
const openProjectModal = document.getElementById("openProjectModal");
const openAlbumModal = document.getElementById("openAlbumModal");
const closes = document.querySelectorAll(".close");

const projectForm = document.getElementById("projectForm");
const albumForm = document.getElementById("albumForm");
const projectGrid = document.getElementById("projectGrid");
const albumProjectSelect = document.getElementById("albumProjectSelect");

let projects = [];
let albums = [];

// --- Modal Handling ---
openProjectModal.onclick = () => projectModal.style.display = "flex";
openAlbumModal.onclick = () => {
  refreshProjectCheckboxes();
  albumModal.style.display = "flex";
};
closes.forEach(c => c.onclick = () => {
  projectModal.style.display = "none";
  albumModal.style.display = "none";
});
window.onclick = e => {
  if (e.target === projectModal) projectModal.style.display = "none";
  if (e.target === albumModal) albumModal.style.display = "none";
};

// --- Project Form ---
projectForm.onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById("projectName").value;
  const desc = document.getElementById("projectDesc").value;
  const collabs = document.getElementById("projectCollabs").value.split(",").map(c => c.trim()).filter(c => c);
  const imageFile = document.getElementById("projectImage").files[0];

  let imgURL = "https://via.placeholder.com/400x200/1f1f1f/ffffff?text=No+Image";
  if (imageFile) imgURL = URL.createObjectURL(imageFile);

  const project = {
    id: Date.now(),
    name,
    desc,
    collabs,
    image: imgURL,
    owner: "You"
  };

  projects.push(project);
  renderProjects();
  projectForm.reset();
  projectModal.style.display = "none";
};

// --- Album Form ---
albumForm.onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById("albumName").value;
  const desc = document.getElementById("albumDesc").value;
  const imageFile = document.getElementById("albumImage").files[0];

  let imgURL = "https://via.placeholder.com/400x200/1f1f1f/ffffff?text=No+Image";
  if (imageFile) imgURL = URL.createObjectURL(imageFile);

  const selectedProjects = [...albumProjectSelect.querySelectorAll("input:checked")]
    .map(c => parseInt(c.value));

  const album = {
    id: Date.now(),
    name,
    desc,
    image: imgURL,
    projects: selectedProjects
  };

  albums.push(album);
  console.log("Albums:", albums); // for debugging
  albumForm.reset();
  albumModal.style.display = "none";
};

// --- Render Projects on Dashboard ---
function renderProjects() {
  projectGrid.innerHTML = "";
  projects.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="cover">
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <small>By ${p.owner}${p.collabs.length ? " + " + p.collabs.join(", ") : ""}</small>
    `;
    projectGrid.appendChild(card);
  });
}

// --- Refresh checkboxes in album modal ---
function refreshProjectCheckboxes() {
  albumProjectSelect.innerHTML = "";
  projects.forEach(p => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${p.id}"> ${p.name}`;
    albumProjectSelect.appendChild(label);
  });
}
