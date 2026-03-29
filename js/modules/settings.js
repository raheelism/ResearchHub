window.ResearchHub = window.ResearchHub || {};

(function() {
  const Settings = {
    async get(key, defaultValue) {
      const db = window.ResearchHub.db;
      const record = await db.settings.get(key);
      return record !== undefined ? record.value : defaultValue;
    },

    async set(key, value) {
      const db = window.ResearchHub.db;
      await db.settings.put({ key, value });
    },

    async getAll() {
      const db = window.ResearchHub.db;
      const arr = await db.settings.toArray();
      const obj = {};
      arr.forEach(r => { obj[r.key] = r.value; });
      return obj;
    },

    async render(container) {
      if (!container) return;
      const Status = window.ResearchHub.Status;
      const Export = window.ResearchHub.Export;
      const Utils = window.ResearchHub.Utils;

      const statuses = await Status.getAllWithColors();
      const darkMode = await this.get('darkMode', false);

      container.innerHTML = `
        <div class="settings-section card">
          <h3>Status Pipeline</h3>
          <p class="text-muted">Drag to reorder. Click × to remove.</p>
          <div id="status-pipeline-list" class="status-pipeline-list">
            ${statuses.map(s => `
              <div class="status-pipeline-item" draggable="true" data-name="${Utils.escapeHtml(s.name)}">
                <span class="drag-handle">⠿</span>
                <span class="status-dot" style="background:${s.color}"></span>
                <span class="status-name">${Utils.escapeHtml(s.name)}</span>
                <button class="btn-icon remove-status-btn" data-name="${Utils.escapeHtml(s.name)}" title="Remove">×</button>
              </div>
            `).join('')}
          </div>
          <div class="add-status-row">
            <input type="text" id="new-status-name" placeholder="New status name" class="form-input">
            <input type="color" id="new-status-color" value="#3b82f6" class="color-input">
            <button id="add-status-btn" class="btn btn-secondary btn-sm">Add Status</button>
          </div>
        </div>

        <div class="settings-section card">
          <h3>Appearance</h3>
          <div class="settings-row">
            <label>Dark Mode</label>
            <label class="toggle-switch">
              <input type="checkbox" id="dark-mode-setting" ${darkMode ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section card">
          <h3>Data Management</h3>
          <div class="settings-actions">
            <button id="export-backup-btn" class="btn btn-secondary">📥 Export Full Backup</button>
            <label class="btn btn-secondary" style="cursor:pointer">
              📤 Import Backup
              <input type="file" id="import-backup-input" accept=".json" style="display:none">
            </label>
          </div>
        </div>

        <div class="settings-section card danger-zone">
          <h3>⚠️ Danger Zone</h3>
          <p class="text-muted">These actions cannot be undone.</p>
          <button id="clear-data-btn" class="btn btn-danger">Clear All Data</button>
        </div>
      `;

      // Setup drag and drop for status reordering
      this._setupStatusDrag(container);

      // Remove status
      container.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.remove-status-btn');
        if (removeBtn) {
          const name = removeBtn.dataset.name;
          if (name) {
            await Status.remove(name);
            Utils.showToast(`Removed status "${name}"`, 'success');
            this.render(container);
          }
        }
      });

      // Add status
      const addBtn = container.querySelector('#add-status-btn');
      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          const nameInput = container.querySelector('#new-status-name');
          const colorInput = container.querySelector('#new-status-color');
          const name = nameInput ? nameInput.value.trim() : '';
          const color = colorInput ? colorInput.value : '#3b82f6';
          if (!name) { Utils.showToast('Please enter a status name', 'warning'); return; }
          await Status.add(name, color);
          Utils.showToast(`Added status "${name}"`, 'success');
          this.render(container);
        });
      }

      // Dark mode toggle
      const darkToggle = container.querySelector('#dark-mode-setting');
      if (darkToggle) {
        darkToggle.addEventListener('change', async () => {
          const checked = darkToggle.checked;
          await this.set('darkMode', checked);
          document.documentElement.setAttribute('data-theme', checked ? 'dark' : '');
          Utils.showToast(`Dark mode ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
      }

      // Export backup
      const exportBtn = container.querySelector('#export-backup-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
          await Export.fullBackup();
          Utils.showToast('Backup exported', 'success');
        });
      }

      // Import backup
      const importInput = container.querySelector('#import-backup-input');
      if (importInput) {
        importInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const stats = await window.ResearchHub.Import.backup(ev.target.result);
              Utils.showToast(`Imported: ${stats.papersImported} papers, ${stats.collectionsImported} collections`, 'success');
              if (window.ResearchHub.App) {
                await window.ResearchHub.App.loadData();
              }
            } catch(err) {
              Utils.showToast('Import failed: ' + err.message, 'error');
            }
          };
          reader.readAsText(file);
        });
      }

      // Clear all data
      const clearBtn = container.querySelector('#clear-data-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to clear ALL data? This cannot be undone!')) return;
          const db = window.ResearchHub.db;
          await db.papers.clear();
          await db.collections.clear();
          await db.settings.clear();
          await db.extractionTemplates.clear();
          Utils.showToast('All data cleared', 'info');
          if (window.ResearchHub.App) {
            await window.ResearchHub.App.loadData();
          }
        });
      }
    },

    _setupStatusDrag(container) {
      const list = container.querySelector('#status-pipeline-list');
      if (!list) return;

      let dragItem = null;
      list.addEventListener('dragstart', (e) => {
        dragItem = e.target.closest('.status-pipeline-item');
        if (dragItem) dragItem.style.opacity = '0.5';
      });
      list.addEventListener('dragend', (e) => {
        if (dragItem) dragItem.style.opacity = '';
        dragItem = null;
      });
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.status-pipeline-item');
        if (target && dragItem && target !== dragItem) {
          const rect = target.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          if (e.clientY < midpoint) {
            list.insertBefore(dragItem, target);
          } else {
            list.insertBefore(dragItem, target.nextSibling);
          }
        }
      });
      list.addEventListener('drop', async (e) => {
        e.preventDefault();
        const items = list.querySelectorAll('.status-pipeline-item');
        const newOrder = Array.from(items).map(item => item.dataset.name);
        const Status = window.ResearchHub.Status;
        await Status.reorder(newOrder);
        window.ResearchHub.Utils.showToast('Status order saved', 'success');
      });
    }
  };

  window.ResearchHub.Settings = Settings;
})();
