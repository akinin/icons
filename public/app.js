const state = {
  icons: [],
  editing: null,
};

const els = {
  addButton: document.querySelector('#add-button'),
  cancelEdit: document.querySelector('#cancel-edit'),
  closeDialog: document.querySelector('#close-dialog'),
  currentFormats: document.querySelector('#current-formats'),
  deleteIcon: document.querySelector('#delete-icon'),
  dialog: document.querySelector('#editor'),
  dialogTitle: document.querySelector('#dialog-title'),
  dropzone: document.querySelector('#dropzone'),
  fileInput: document.querySelector('#file-input'),
  formatFilter: document.querySelector('#format-filter'),
  form: document.querySelector('#editor-form'),
  grid: document.querySelector('#grid'),
  iconFiles: document.querySelector('#icon-files'),
  iconName: document.querySelector('#icon-name'),
  pickFiles: document.querySelector('#pick-files'),
  search: document.querySelector('#search'),
  summary: document.querySelector('#summary'),
  toast: document.querySelector('#toast'),
};

const formatOrder = ['svg', 'png', 'ico'];

function iconFormats(icon) {
  return formatOrder.filter((format) => icon.formats && icon.formats[format]);
}

function iconUrl(icon, format) {
  const file = icon.formats[format];
  return `/icons/${icon.id}/${encodeURIComponent(file.filename)}?v=${encodeURIComponent(file.updatedAt)}`;
}

function previewFormat(icon) {
  return iconFormats(icon)[0];
}

function humanNameFromFile(file) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2600);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function loadIcons() {
  const data = await requestJson('/api/icons');
  state.icons = data.icons;
  render();
}

function render() {
  const query = els.search.value.trim().toLowerCase();
  const format = els.formatFilter.value;
  const filtered = state.icons.filter((icon) => {
    const matchesText = !query || icon.name.toLowerCase().includes(query) || icon.slug.includes(query);
    const matchesFormat = !format || Boolean(icon.formats[format]);
    return matchesText && matchesFormat;
  });

  els.summary.textContent = `${state.icons.length} иконок`;
  els.grid.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = state.icons.length ? 'Ничего не найдено' : 'Пока нет кастомных иконок';
    els.grid.appendChild(empty);
    return;
  }

  for (const icon of filtered) {
    els.grid.appendChild(renderCard(icon));
  }
}

function renderCard(icon) {
  const card = document.createElement('article');
  card.className = 'card';

  const preview = document.createElement('div');
  preview.className = 'preview';
  const format = previewFormat(icon);
  if (format) {
    const img = document.createElement('img');
    img.src = iconUrl(icon, format);
    img.alt = icon.name;
    preview.appendChild(img);
  }

  const title = document.createElement('h3');
  title.textContent = icon.name;

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const formats = document.createElement('div');
  formats.className = 'format-row';
  for (const item of iconFormats(icon)) {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = item;
    formats.appendChild(pill);
  }

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Редактировать';
  edit.addEventListener('click', () => openEditor(icon));

  footer.append(formats, edit);
  card.append(preview, title, footer);
  return card;
}

function openEditor(icon = null, files = []) {
  state.editing = icon;
  els.dialogTitle.textContent = icon ? 'Редактировать иконку' : 'Добавить иконку';
  els.iconName.value = icon ? icon.name : (files[0] ? humanNameFromFile(files[0]) : '');
  els.iconFiles.value = '';
  els.deleteIcon.hidden = !icon;
  els.currentFormats.innerHTML = '';

  if (icon) {
    for (const format of iconFormats(icon)) {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = format;
      els.currentFormats.appendChild(pill);
    }
  }

  els.dialog.showModal();

  if (files.length) {
    setInputFiles(els.iconFiles, files);
  }
}

function closeEditor() {
  els.dialog.close();
  state.editing = null;
  els.form.reset();
}

function setInputFiles(input, files) {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  input.files = transfer.files;
}

function validFiles(files) {
  const allowed = new Set(['svg', 'png', 'ico']);
  return files.filter((file) => allowed.has(file.name.split('.').pop().toLowerCase()));
}

async function submitEditor(event) {
  event.preventDefault();

  const files = Array.from(els.iconFiles.files);
  const form = new FormData();
  form.append('name', els.iconName.value.trim());
  for (const file of files) {
    form.append('files', file);
  }

  const icon = state.editing;
  const url = icon ? `/api/icons/${icon.id}` : '/api/icons';
  const method = icon ? 'PUT' : 'POST';

  try {
    await requestJson(url, { method, body: form });
    closeEditor();
    await loadIcons();
    showToast('Сохранено');
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteCurrentIcon() {
  if (!state.editing) return;
  const confirmed = window.confirm(`Удалить "${state.editing.name}"?`);
  if (!confirmed) return;

  try {
    await requestJson(`/api/icons/${state.editing.id}`, { method: 'DELETE' });
    closeEditor();
    await loadIcons();
    showToast('Удалено');
  } catch (error) {
    showToast(error.message);
  }
}

function handleFiles(files) {
  const accepted = validFiles(Array.from(files));
  if (!accepted.length) {
    showToast('Поддерживаются только SVG, PNG и ICO');
    return;
  }
  openEditor(null, accepted);
}

els.addButton.addEventListener('click', () => openEditor());
els.cancelEdit.addEventListener('click', closeEditor);
els.closeDialog.addEventListener('click', closeEditor);
els.deleteIcon.addEventListener('click', deleteCurrentIcon);
els.form.addEventListener('submit', submitEditor);
els.search.addEventListener('input', render);
els.formatFilter.addEventListener('change', render);
els.pickFiles.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => handleFiles(Array.from(els.fileInput.files)));

for (const eventName of ['dragenter', 'dragover']) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.add('dragover');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('dragover');
  });
}

els.dropzone.addEventListener('drop', (event) => {
  handleFiles(Array.from(event.dataTransfer.files));
});

loadIcons().catch((error) => {
  els.summary.textContent = 'Ошибка загрузки';
  showToast(error.message);
});
