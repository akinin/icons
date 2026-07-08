const state = {
  icons: [],
  settings: {},
  editing: null,
  previewing: null,
  previewFormat: null,
};

const els = {
  brandLogo: document.querySelector('#brand-logo'),
  brandPicker: document.querySelector('#brand-picker'),
  cancelEdit: document.querySelector('#cancel-edit'),
  closeDialog: document.querySelector('#close-dialog'),
  closePreview: document.querySelector('#close-preview'),
  currentFormats: document.querySelector('#current-formats'),
  deleteIcon: document.querySelector('#delete-icon'),
  dialog: document.querySelector('#editor'),
  dialogTitle: document.querySelector('#dialog-title'),
  dropzone: document.querySelector('#dropzone'),
  editFileSummary: document.querySelector('#edit-file-summary'),
  fileInput: document.querySelector('#file-input'),
  formatFilter: document.querySelector('#format-filter'),
  form: document.querySelector('#editor-form'),
  grid: document.querySelector('#grid'),
  iconFiles: document.querySelector('#icon-files'),
  iconName: document.querySelector('#icon-name'),
  logoFileInput: document.querySelector('#logo-file-input'),
  pickEditFiles: document.querySelector('#pick-edit-files'),
  pickFiles: document.querySelector('#pick-files'),
  previewDialog: document.querySelector('#preview-dialog'),
  previewFormats: document.querySelector('#preview-formats'),
  previewImage: document.querySelector('#preview-image'),
  previewTitle: document.querySelector('#preview-title'),
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

function baseName(file) {
  return file.name.replace(/\.[^.]+$/, '');
}

function humanNameFromFile(file) {
  return baseName(file).replace(/[-_]+/g, ' ').trim();
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
  state.settings = data.settings || {};
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

  els.summary.textContent = `Показано: ${filtered.length} из ${state.icons.length}`;
  renderBrandLogo();
  els.grid.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = state.icons.length ? 'Иконки не найдены' : 'Пока нет кастомных иконок';
    els.grid.appendChild(empty);
    return;
  }

  for (const icon of filtered) {
    els.grid.appendChild(renderCard(icon));
  }
}

function renderBrandLogo() {
  const icon = state.icons.find((item) => item.id === state.settings.logoIconId);
  const format = state.settings.logoFormat;
  if (icon && icon.formats[format]) {
    els.brandLogo.src = iconUrl(icon, format);
    els.brandLogo.hidden = false;
    document.querySelector('#brand-logo-empty').hidden = true;
  } else {
    els.brandLogo.hidden = true;
    document.querySelector('#brand-logo-empty').hidden = false;
  }
}

function renderCard(icon) {
  const card = document.createElement('article');
  card.className = 'icon-card';
  card.tabIndex = 0;
  card.addEventListener('click', () => openPreview(icon));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') openPreview(icon);
  });

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'edit-button';
  edit.textContent = '✐';
  edit.title = 'Редактировать';
  edit.setAttribute('aria-label', `Редактировать ${icon.name}`);
  edit.addEventListener('click', (event) => {
    event.stopPropagation();
    openEditor(icon);
  });
  card.appendChild(edit);

  const format = previewFormat(icon);
  if (format) {
    const img = document.createElement('img');
    img.src = iconUrl(icon, format);
    img.alt = icon.name;
    card.appendChild(img);
  }

  const title = document.createElement('div');
  title.className = 'icon-name';
  title.textContent = icon.name;

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const formats = document.createElement('div');
  formats.className = 'format-buttons';
  for (const item of iconFormats(icon)) {
    const pill = document.createElement('span');
    pill.className = 'format-pill';
    pill.textContent = item;
    formats.appendChild(pill);
  }

  footer.append(formats);
  card.append(title, footer);
  return card;
}

function openPreview(icon) {
  state.previewing = icon;
  state.previewFormat = previewFormat(icon);
  renderPreview();
  els.previewDialog.showModal();
}

function renderPreview() {
  const icon = state.previewing;
  if (!icon) return;

  els.previewTitle.textContent = icon.name;
  els.previewImage.src = iconUrl(icon, state.previewFormat);
  els.previewImage.alt = icon.name;
  els.previewFormats.innerHTML = '';

  for (const format of iconFormats(icon)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = format.toUpperCase();
    button.addEventListener('click', () => {
      copyIconLink(icon, format);
    });
    els.previewFormats.appendChild(button);
  }
}

function closePreview() {
  els.previewDialog.close();
  state.previewing = null;
  state.previewFormat = null;
}

async function setLogo() {
  if (!state.previewing || !state.previewFormat) return;
  try {
    const data = await requestJson('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logoIconId: state.previewing.id,
        logoFormat: state.previewFormat,
      }),
    });
    state.settings = data.settings;
    render();
    showToast('Логотип обновлен');
  } catch (error) {
    showToast(error.message);
  }
}

async function copyIconLink(icon, format) {
  const url = new URL(iconUrl(icon, format), window.location.href);
  url.search = '';
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url.href);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url.href;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) throw new Error('copy failed');
    }
    showToast('Скопировано');
  } catch {
    showToast('Не удалось скопировать');
  }
}

async function uploadLogo(file) {
  const accepted = validFiles([file]);
  if (!accepted.length) {
    showToast('Поддерживаются только SVG, PNG и ICO');
    return;
  }

  const form = new FormData();
  form.append('name', 'AHS Logo');
  form.append('files', file);

  try {
    const data = await requestJson('/api/icons', { method: 'POST', body: form });
    state.previewing = data.icon;
    state.previewFormat = iconFormats(data.icon)[0];
    await setLogo();
    state.previewing = null;
    state.previewFormat = null;
    await loadIcons();
  } catch (error) {
    showToast(error.message);
  }
}

function openEditor(icon = null, files = []) {
  state.editing = icon;
  els.dialogTitle.textContent = icon ? 'Редактировать иконку' : 'Добавить иконку';
  els.iconName.value = icon ? icon.name : (files[0] ? humanNameFromFile(files[0]) : '');
  els.iconFiles.value = '';
  updateEditFileSummary();
  els.deleteIcon.hidden = !icon;
  els.currentFormats.innerHTML = '';

  if (icon) {
    for (const format of iconFormats(icon)) {
      const pill = document.createElement('span');
      pill.className = 'format-pill';
      pill.textContent = format;
      els.currentFormats.appendChild(pill);
    }
  }

  els.dialog.showModal();

  if (files.length) {
    setInputFiles(els.iconFiles, files);
    updateEditFileSummary();
  }
}

function closeEditor() {
  els.dialog.close();
  state.editing = null;
  els.form.reset();
  updateEditFileSummary();
}

function setInputFiles(input, files) {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  input.files = transfer.files;
}

function updateEditFileSummary() {
  const count = els.iconFiles.files.length;
  els.editFileSummary.textContent = count ? `${count} файл(ов)` : 'Файлы не выбраны';
}

function validFiles(files) {
  const allowed = new Set(['svg', 'png', 'ico']);
  return files.filter((file) => allowed.has(file.name.split('.').pop().toLowerCase()));
}

function groupFiles(files) {
  const groups = new Map();
  for (const file of files) {
    const key = baseName(file).toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  return Array.from(groups.values());
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

async function createIconFromFiles(files) {
  const form = new FormData();
  form.append('name', humanNameFromFile(files[0]));
  for (const file of files) {
    form.append('files', file);
  }
  await requestJson('/api/icons', { method: 'POST', body: form });
}

async function handleFiles(files) {
  const accepted = validFiles(Array.from(files));
  if (!accepted.length) {
    showToast('Поддерживаются только SVG, PNG и ICO');
    return;
  }

  const groups = groupFiles(accepted);
  if (groups.length === 1) {
    openEditor(null, groups[0]);
    return;
  }

  try {
    for (const group of groups) {
      await createIconFromFiles(group);
    }
    await loadIcons();
    showToast(`Добавлено: ${groups.length}`);
  } catch (error) {
    showToast(error.message);
  }
}

els.brandPicker.addEventListener('click', () => els.logoFileInput.click());
els.cancelEdit.addEventListener('click', closeEditor);
els.closeDialog.addEventListener('click', closeEditor);
els.closePreview.addEventListener('click', closePreview);
els.deleteIcon.addEventListener('click', deleteCurrentIcon);
els.form.addEventListener('submit', submitEditor);
els.formatFilter.addEventListener('change', render);
els.iconFiles.addEventListener('change', updateEditFileSummary);
els.logoFileInput.addEventListener('change', () => {
  const file = els.logoFileInput.files[0];
  if (file) uploadLogo(file);
  els.logoFileInput.value = '';
});
els.pickEditFiles.addEventListener('click', () => els.iconFiles.click());
els.pickFiles.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => handleFiles(Array.from(els.fileInput.files)));
els.search.addEventListener('input', render);

els.previewDialog.addEventListener('click', (event) => {
  if (event.target === els.previewDialog) closePreview();
});

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
