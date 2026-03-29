window.ResearchHub = window.ResearchHub || {};

(function() {
  const Extraction = {
    async getTemplates() {
      return await window.ResearchHub.db.extractionTemplates.toArray();
    },

    async createTemplate(name, fields) {
      const Utils = window.ResearchHub.Utils;
      const template = {
        id: Utils.generateId(),
        name: name || 'Template',
        fields: fields || []
      };
      await window.ResearchHub.db.extractionTemplates.put(template);
      return template;
    },

    async deleteTemplate(id) {
      await window.ResearchHub.db.extractionTemplates.delete(id);
    },

    async saveData(paperId, templateId, data) {
      const Papers = window.ResearchHub.Papers;
      const paper = await Papers.get(paperId);
      if (!paper) return;
      const extractionData = paper.extractionData || {};
      extractionData[templateId] = data;
      await Papers.update(paperId, { extractionData });
    },

    async exportCSV(templateId) {
      const Utils = window.ResearchHub.Utils;
      const Papers = window.ResearchHub.Papers;
      const template = await window.ResearchHub.db.extractionTemplates.get(templateId);
      if (!template) return;

      const papers = await Papers.getAll();
      const papersWithData = papers.filter(p => p.extractionData && p.extractionData[templateId]);

      if (papersWithData.length === 0) {
        Utils.showToast('No extraction data for this template', 'warning');
        return;
      }

      const rows = papersWithData.map(p => {
        const data = p.extractionData[templateId];
        const row = {
          title: p.title || '',
          authors: (p.authors || []).join('; '),
          year: p.year || ''
        };
        (template.fields || []).forEach(f => {
          row[f.name] = data[f.name] !== undefined ? data[f.name] : '';
        });
        return row;
      });

      const csv = Papa.unparse(rows);
      Utils.downloadFile(csv, `extraction-${template.name.replace(/\s+/g, '-')}.csv`, 'text/csv;charset=utf-8');
    },

    async render(container) {
      if (!container) return;
      const Utils = window.ResearchHub.Utils;
      const templates = await this.getTemplates();

      const renderTemplatesList = () => {
        const listEl = container.querySelector('#templates-list');
        if (!listEl) return;
        if (templates.length === 0) {
          listEl.innerHTML = '<p class="text-muted">No templates yet. Create one below.</p>';
          return;
        }
        listEl.innerHTML = templates.map(t => `
          <div class="template-item card" data-id="${t.id}">
            <div class="template-info">
              <strong>${Utils.escapeHtml(t.name)}</strong>
              <span class="text-muted">${(t.fields || []).length} fields</span>
            </div>
            <div class="template-actions">
              <button class="btn btn-sm btn-secondary export-template-btn" data-id="${t.id}">Export CSV</button>
              <button class="btn btn-sm btn-danger delete-template-btn" data-id="${t.id}">Delete</button>
            </div>
          </div>
        `).join('');
      };

      container.innerHTML = `
        <div class="card" style="margin-bottom:24px">
          <h3>Extraction Templates</h3>
          <div id="templates-list"></div>
        </div>
        <div class="card">
          <h3>Create Template</h3>
          <div class="form-group">
            <label>Template Name</label>
            <input type="text" id="template-name" class="form-input" placeholder="e.g., Systematic Review">
          </div>
          <div id="template-fields-list">
            <div class="text-muted" style="margin-bottom:8px">No fields added yet</div>
          </div>
          <div class="add-field-row">
            <input type="text" id="field-name-input" class="form-input" placeholder="Field name">
            <select id="field-type-select" class="form-select">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <button id="add-field-btn" class="btn btn-secondary btn-sm">Add Field</button>
          </div>
          <div class="form-actions" style="margin-top:16px">
            <button id="create-template-btn" class="btn btn-primary">Create Template</button>
          </div>
        </div>
      `;

      renderTemplatesList();

      let newFields = [];

      const updateFieldsList = () => {
        const el = container.querySelector('#template-fields-list');
        if (!el) return;
        if (newFields.length === 0) {
          el.innerHTML = '<div class="text-muted" style="margin-bottom:8px">No fields added yet</div>';
          return;
        }
        el.innerHTML = newFields.map((f, i) => `
          <div class="field-item">
            <span>${Utils.escapeHtml(f.name)}</span>
            <span class="badge">${f.type}</span>
            <button class="btn-icon remove-field-btn" data-index="${i}">×</button>
          </div>
        `).join('');
      };

      container.addEventListener('click', async (e) => {
        if (e.target.closest('#add-field-btn')) {
          const nameInput = container.querySelector('#field-name-input');
          const typeSelect = container.querySelector('#field-type-select');
          const name = nameInput ? nameInput.value.trim() : '';
          const type = typeSelect ? typeSelect.value : 'text';
          if (!name) { Utils.showToast('Enter a field name', 'warning'); return; }
          newFields.push({ name, type });
          nameInput.value = '';
          updateFieldsList();
        }

        if (e.target.closest('.remove-field-btn')) {
          const idx = parseInt(e.target.closest('.remove-field-btn').dataset.index);
          newFields.splice(idx, 1);
          updateFieldsList();
        }

        if (e.target.closest('#create-template-btn')) {
          const nameInput = container.querySelector('#template-name');
          const name = nameInput ? nameInput.value.trim() : '';
          if (!name) { Utils.showToast('Enter a template name', 'warning'); return; }
          if (newFields.length === 0) { Utils.showToast('Add at least one field', 'warning'); return; }
          const tmpl = await this.createTemplate(name, newFields.slice());
          templates.push(tmpl);
          newFields = [];
          if (nameInput) nameInput.value = '';
          updateFieldsList();
          renderTemplatesList();
          Utils.showToast(`Template "${name}" created`, 'success');
        }

        if (e.target.closest('.export-template-btn')) {
          const id = e.target.closest('.export-template-btn').dataset.id;
          await this.exportCSV(id);
        }

        if (e.target.closest('.delete-template-btn')) {
          const id = e.target.closest('.delete-template-btn').dataset.id;
          if (confirm('Delete this template?')) {
            await this.deleteTemplate(id);
            const idx = templates.findIndex(t => t.id === id);
            if (idx !== -1) templates.splice(idx, 1);
            renderTemplatesList();
            Utils.showToast('Template deleted', 'info');
          }
        }
      });
    },

    async renderPaperExtraction(paper, container) {
      if (!container) return;
      const Utils = window.ResearchHub.Utils;
      const templates = await this.getTemplates();

      if (templates.length === 0) {
        container.innerHTML = '<p class="text-muted">No extraction templates. Create one in the Extraction section.</p>';
        return;
      }

      container.innerHTML = templates.map(t => {
        const data = (paper.extractionData || {})[t.id] || {};
        const fieldsHtml = (t.fields || []).map(f => {
          const val = data[f.name] !== undefined ? data[f.name] : '';
          let input = '';
          if (f.type === 'checkbox') {
            input = `<input type="checkbox" class="extraction-field" data-template="${t.id}" data-field="${Utils.escapeHtml(f.name)}" ${val ? 'checked' : ''}>`;
          } else if (f.type === 'number') {
            input = `<input type="number" class="form-input extraction-field" data-template="${t.id}" data-field="${Utils.escapeHtml(f.name)}" value="${Utils.escapeHtml(String(val))}">`;
          } else {
            input = `<input type="text" class="form-input extraction-field" data-template="${t.id}" data-field="${Utils.escapeHtml(f.name)}" value="${Utils.escapeHtml(String(val))}">`;
          }
          return `<div class="form-group"><label>${Utils.escapeHtml(f.name)}</label>${input}</div>`;
        }).join('');
        return `
          <div class="extraction-template-block card" style="margin-bottom:16px">
            <h4>${Utils.escapeHtml(t.name)}</h4>
            ${fieldsHtml}
            <div class="save-indicator text-muted" id="save-ind-${t.id}" style="font-size:12px"></div>
          </div>`;
      }).join('');

      // Auto-save on change
      const save = Utils.debounce(async (templateId) => {
        const ind = container.querySelector(`#save-ind-${templateId}`);
        if (ind) ind.textContent = 'Saving...';
        const fields = container.querySelectorAll(`.extraction-field[data-template="${templateId}"]`);
        const data = {};
        fields.forEach(f => {
          data[f.dataset.field] = f.type === 'checkbox' ? f.checked : f.value;
        });
        await this.saveData(paper.id, templateId, data);
        if (ind) ind.textContent = 'Saved ✓';
        setTimeout(() => { if (ind) ind.textContent = ''; }, 2000);
      }, 800);

      container.addEventListener('change', (e) => {
        const field = e.target.closest('.extraction-field');
        if (field) save(field.dataset.template);
      });
      container.addEventListener('input', (e) => {
        const field = e.target.closest('.extraction-field');
        if (field) save(field.dataset.template);
      });
    }
  };

  window.ResearchHub.Extraction = Extraction;
})();
