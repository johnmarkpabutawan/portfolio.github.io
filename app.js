const db = new Dexie('PortfolioDB');

db.version(1).stores({
  projects: '++id, category, createdAt'
});

const CATEGORIES = ['Web', 'Systems', 'Brand / Logo', 'Automation'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const form = document.querySelector('#project-form');
const formTitle = document.querySelector('#form-title');
const idInput = document.querySelector('#project-id');
const titleInput = document.querySelector('#title');
const categoryInput = document.querySelector('#category');
const descriptionInput = document.querySelector('#description');
const tagsInput = document.querySelector('#tags');
const linkInput = document.querySelector('#link');
const thumbnailInput = document.querySelector('#thumbnail');
const thumbnailPreview = document.querySelector('#thumbnail-preview');
const previewImage = document.querySelector('#preview-image');
const removeThumbnailBtn = document.querySelector('#remove-thumbnail-btn');
const cancelBtn = document.querySelector('#cancel-btn');
const searchInput = document.querySelector('#search');
const listEl = document.querySelector('#project-list');
const countEl = document.querySelector('#count');
const tabsEl = document.querySelector('#tabs');

let activeCategory = 'All';
let selectedThumbnail = null;
let removeExistingThumbnail = false;
let previewObjectUrl = null;
let projectImageUrls = [];

function fillCategoryOptions() {
  CATEGORIES.forEach((name) => {
    categoryInput.add(new Option(name, name));
  });
}

function showThumbnailPreview(source) {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  if (!source) {
    thumbnailPreview.hidden = true;
    previewImage.removeAttribute('src');
    return;
  }

  previewObjectUrl = source instanceof Blob
    ? URL.createObjectURL(source)
    : source;

  previewImage.src = previewObjectUrl;
  thumbnailPreview.hidden = false;
}

function readForm() {
  const data = {
    title: titleInput.value.trim(),
    category: categoryInput.value,
    description: descriptionInput.value.trim(),
    tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
    link: linkInput.value.trim()
  };

  if (selectedThumbnail) {
    data.thumbnail = selectedThumbnail;
  } else if (removeExistingThumbnail) {
    data.thumbnail = null;
  }

  return data;
}

async function createProject(data) {
  return db.projects.add({ ...data, createdAt: Date.now() });
}

async function getProjects() {
  const category = activeCategory;
  const text = searchInput.value.trim().toLowerCase();

  let list = category === 'All'
    ? await db.projects.toArray()
    : await db.projects.where('category').equals(category).toArray();

  if (text) {
    list = list.filter((p) =>
      p.title.toLowerCase().includes(text) ||
      p.tags.some((t) => t.toLowerCase().includes(text))
    );
  }

  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function tabLabel(name) {
  return name === 'All' ? 'All work' : name;
}

function renderTabs() {
  const names = ['All', ...CATEGORIES];

  tabsEl.innerHTML = names.map((name) => `
    <button type="button"
      class="tab ${name === activeCategory ? 'active' : ''}"
      data-tab="${escapeHTML(name)}">${escapeHTML(tabLabel(name))}</button>
  `).join('');
}

async function render() {
  const projects = await getProjects();

  
  projectImageUrls.forEach((url) => URL.revokeObjectURL(url));
  projectImageUrls = [];

  countEl.textContent = `${projects.length} project(s)`;

  if (projects.length === 0) {
    listEl.innerHTML = '<p class="empty">No projects yet.</p>';
    return;
  }

  listEl.innerHTML = projects.map((p) => {
    let thumbnailHTML = '';

    if (p.thumbnail instanceof Blob) {
      const imageUrl = URL.createObjectURL(p.thumbnail);
      projectImageUrls.push(imageUrl);
      thumbnailHTML = `
        <img class="project-thumbnail"
          src="${imageUrl}"
          alt="${escapeHTML(p.title)} thumbnail" />
      `;
    }

    return `
      <article class="project">
        ${thumbnailHTML}
        <span class="badge">${escapeHTML(p.category)}</span>
        <h3>${escapeHTML(p.title)}</h3>
        <p>${escapeHTML(p.description)}</p>
        <p class="tags">${p.tags.map((t) => `<span>#${escapeHTML(t)}</span>`).join('')}</p>
        ${p.link.startsWith('http')
          ? `<a href="${escapeHTML(p.link)}" target="_blank" rel="noopener">View project</a>`
          : ''}
        <div class="actions">
          <button data-action="edit" data-id="${p.id}">Edit</button>
          <button data-action="delete" data-id="${p.id}" class="danger">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

async function updateProject(id, changes) {
  return db.projects.update(id, changes);
}

function startEdit(project) {
  idInput.value = project.id;
  titleInput.value = project.title;
  categoryInput.value = project.category;
  descriptionInput.value = project.description;
  tagsInput.value = project.tags.join(', ');
  linkInput.value = project.link;

  selectedThumbnail = null;
  removeExistingThumbnail = false;
  thumbnailInput.value = '';
  showThumbnailPreview(project.thumbnail || null);

  formTitle.textContent = 'Edit project';
  cancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  form.reset();
  idInput.value = '';
  selectedThumbnail = null;
  removeExistingThumbnail = false;
  showThumbnailPreview(null);
  formTitle.textContent = 'Add a project';
  cancelBtn.hidden = true;
}

async function deleteProject(id) {
  return db.projects.delete(id);
}

thumbnailInput.addEventListener('change', () => {
  const file = thumbnailInput.files[0];

  if (!file) {
    selectedThumbnail = null;
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    alert('Please choose a JPG, PNG, or WEBP image.');
    thumbnailInput.value = '';
    selectedThumbnail = null;
    return;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    alert('The image must be 5 MB or smaller.');
    thumbnailInput.value = '';
    selectedThumbnail = null;
    return;
  }

  selectedThumbnail = file;
  removeExistingThumbnail = false;
  showThumbnailPreview(file);
});

removeThumbnailBtn.addEventListener('click', () => {
  selectedThumbnail = null;
  removeExistingThumbnail = true;
  thumbnailInput.value = '';
  showThumbnailPreview(null);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = readForm();
  const id = Number(idInput.value);

  if (id) {
    await updateProject(id, data);
  } else {
    await createProject(data);
  }

  resetForm();
  await render();
});

listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const id = Number(button.dataset.id);

  if (button.dataset.action === 'edit') {
    startEdit(await db.projects.get(id));
  }

  if (button.dataset.action === 'delete' && confirm('Delete this project?')) {
    await deleteProject(id);
    await render();
  }
});

tabsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tab]');

  if (!button) return;

  activeCategory = button.dataset.tab;

  renderTabs();
  render();
});

cancelBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', render);

fillCategoryOptions();
renderTabs();
render();
