window.ResearchHub = window.ResearchHub || {};

(function() {
  const App = {
    currentSection: 'dashboard',
    allPapers: [],
    allCollections: [],
    filteredPapers: [],
    sortField: 'createdAt',
    sortDir: 'desc',
    currentPage: 1,
    pageSize: 50,
    activeFilters: {},
    editingPaperId: null,
    _pdfState: { pdf: null, page: 1, scale: 1.0 },
    _notesCleanup: null,
    _parsedBibtex: null,

    async init() {
      const Settings = window.ResearchHub.Settings;
      const darkMode = await Settings.get('darkMode', false);
      if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        const btn = document.getElementById('dark-mode-toggle');
        if (btn) btn.textContent = '☀️';
      }

      await this.loadData();
      this.setupNav();
      this.setupSearch();
      this.setupKeyboardShortcuts();
      this.setupGlobalEventListeners();
      await this.showSection('dashboard');
    },

    async loadData() {
      const Papers = window.ResearchHub.Papers;
      const Collections = window.ResearchHub.Collections;
      const Search = window.ResearchHub.Search;

      this.allPapers = await Papers.getAll();
      this.allCollections = await Collections.getAll();
      Search.init(this.allPapers);
      this.updateSidebarCollections();
      await this.updateFilterOptions();
    },

    updateSidebarCollections() {
      const container = document.getElementById('sidebar-collections');
      if (!container) return;
      const Utils = window.ResearchHub.Utils;
      container.innerHTML = `<div class="sidebar-section-title">Collections</div>`;
      if (this.allCollections.length === 0) {
        container.innerHTML += `<div class="sidebar-collection-empty text-muted" style="padding:8px 20px;font-size:13px">No collections</div>`;
        return;
      }
      this.allCollections.forEach(col => {
        const count = (col.paperIds || []).length;
        const el = document.createElement('a');
        el.href = '#';
        el.className = 'nav-link nav-collection';
        el.dataset.collectionId = col.id;
        el.innerHTML = `📁 ${Utils.escapeHtml(col.name)} <span class="nav-badge">${count}</span>`;
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.activeFilters.collectionId = col.id;
          this.currentPage = 1;
          this.showSection('library');
        });
        container.appendChild(el);
      });
    },

    async updateFilterOptions() {
      const Status = window.ResearchHub.Status;
      const Tags = window.ResearchHub.Tags;
      const Utils = window.ResearchHub.Utils;

      const statuses = await Status.getAll();
      const tags = Tags.getAll(this.allPapers);

      const statusFilter = document.getElementById('filter-status');
      if (statusFilter) {
        const val = statusFilter.value;
        statusFilter.innerHTML = '<option value="">All Statuses</option>';
        statuses.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          if (s === val) opt.selected = true;
          statusFilter.appendChild(opt);
        });
      }

      const tagFilter = document.getElementById('filter-tag');
      if (tagFilter) {
        const val = tagFilter.value;
        tagFilter.innerHTML = '<option value="">All Tags</option>';
        tags.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.tag;
          opt.textContent = `${Utils.escapeHtml(t.tag)} (${t.count})`;
          if (t.tag === val) opt.selected = true;
          tagFilter.appendChild(opt);
        });
      }

      const colFilter = document.getElementById('filter-collection');
      if (colFilter) {
        const val = colFilter.value;
        colFilter.innerHTML = '<option value="">All Collections</option>';
        this.allCollections.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = Utils.escapeHtml(c.name);
          if (c.id === val) opt.selected = true;
          colFilter.appendChild(opt);
        });
      }

      const formStatus = document.getElementById('form-status');
      if (formStatus) {
        const val = formStatus.value;
        formStatus.innerHTML = '';
        statuses.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          if (s === val) opt.selected = true;
          formStatus.appendChild(opt);
        });
      }
    },

    setupNav() {
      document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const section = link.dataset.section;
          this.showSection(section);
        });
      });

      const sidebarToggle = document.getElementById('sidebar-toggle');
      if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
          document.getElementById('sidebar').classList.toggle('collapsed');
        });
      }

      const mobileBtn = document.getElementById('mobile-menu-btn');
      if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
          document.getElementById('sidebar').classList.toggle('open');
        });
      }

      const darkBtn = document.getElementById('dark-mode-toggle');
      if (darkBtn) {
        darkBtn.addEventListener('click', async () => {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
          darkBtn.textContent = isDark ? '🌙' : '☀️';
          await window.ResearchHub.Settings.set('darkMode', !isDark);
        });
      }

      const addPaperBtn = document.getElementById('add-paper-btn');
      if (addPaperBtn) {
        addPaperBtn.addEventListener('click', () => this.showAddPaperModal());
      }
    },

    async showSection(name) {
      this.currentSection = name;
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-link[data-section]').forEach(l => {
        l.classList.toggle('active', l.dataset.section === name);
      });
      const section = document.getElementById(`section-${name}`);
      if (section) section.classList.add('active');

      switch(name) {
        case 'dashboard': await this.renderDashboard(); break;
        case 'library': await this.renderLibrary(); break;
        case 'add-paper': await this.renderAddPaper(); break;
        case 'kanban': await this.renderKanban(); break;
        case 'collections': await this.renderCollections(); break;
        case 'tags': await this.renderTags(); break;
        case 'quality': await window.ResearchHub.Quality.render(document.getElementById('quality-content')); break;
        case 'duplicates': await window.ResearchHub.Duplicates.render(document.getElementById('duplicates-content')); break;
        case 'extraction': await window.ResearchHub.Extraction.render(document.getElementById('extraction-content')); break;
        case 'settings': await window.ResearchHub.Settings.render(document.getElementById('settings-content')); break;
      }
    },

    async renderDashboard() {
      await window.ResearchHub.Dashboard.render(document.getElementById('dashboard-content'));
    },

    async renderLibrary() {
      const Papers = window.ResearchHub.Papers;
      const Utils = window.ResearchHub.Utils;

      let papers = this.allPapers.slice();

      // Apply search
      const searchInput = document.getElementById('global-search');
      if (searchInput && searchInput.value.length >= 2) {
        const results = window.ResearchHub.Search.search(searchInput.value);
        if (results !== null) papers = results;
      }

      // Apply filters
      papers = Papers.filter(papers, this.activeFilters);

      // Apply sort
      papers = Papers.sort(papers, this.sortField, this.sortDir);

      this.filteredPapers = papers;

      const countEl = document.getElementById('papers-count');
      if (countEl) countEl.textContent = `${papers.length} paper${papers.length !== 1 ? 's' : ''}`;

      await this.renderPapersTable(papers);
      this.renderPagination(papers.length);
      this.setupFilters();
      this.setupTableSort();
    },

    async renderAddPaper() {
      const container = document.getElementById('add-paper-content');
      if (!container) return;
      container.innerHTML = `
        <div class="card">
          <h3>Choose how to add papers</h3>
          <p class="text-muted">Use manual entry, BibTeX, DOI lookup, file upload, or RIS import.</p>
          <div class="section-actions">
            <button class="btn btn-primary open-add-paper-btn" data-tab="manual">Manual Entry</button>
            <button class="btn btn-secondary open-add-paper-btn" data-tab="bibtex">BibTeX</button>
            <button class="btn btn-secondary open-add-paper-btn" data-tab="doi">DOI Lookup</button>
            <button class="btn btn-secondary open-add-paper-btn" data-tab="upload">File Upload</button>
            <button class="btn btn-secondary open-add-paper-btn" data-tab="ris">RIS Import</button>
          </div>
        </div>
      `;
      container.querySelectorAll('.open-add-paper-btn').forEach(btn => {
        btn.addEventListener('click', () => this.showAddPaperModal(null, btn.dataset.tab || 'manual'));
      });
    },

    async renderPapersTable(papers) {
      const Status = window.ResearchHub.Status;
      const Utils = window.ResearchHub.Utils;
      const tbody = document.getElementById('papers-tbody');
      if (!tbody) return;

      const statuses = await Status.getAll();
      const start = (this.currentPage - 1) * this.pageSize;
      const paged = papers.slice(start, start + this.pageSize);

      if (paged.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state-cell"><div class="empty-state"><div class="empty-icon">📚</div><p>No papers found. Add some papers to get started!</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = paged.map(paper => this.renderPaperRow(paper, statuses)).join('');

      // Setup row events
      tbody.querySelectorAll('.paper-title-link').forEach(el => {
        el.addEventListener('click', async () => {
          await this.showPaperDetail(el.dataset.paperId);
        });
      });

      tbody.querySelectorAll('.inline-status').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const paperId = sel.dataset.paperId;
          await window.ResearchHub.Papers.update(paperId, { status: sel.value });
          const idx = this.allPapers.findIndex(p => p.id === paperId);
          if (idx !== -1) this.allPapers[idx].status = sel.value;
          Utils.showToast('Status updated', 'success');
        });
      });

      tbody.querySelectorAll('.delete-paper-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const paperId = btn.dataset.paperId;
          const paper = this.allPapers.find(p => p.id === paperId);
          if (!paper) return;
          if (!confirm(`Delete "${Utils.truncate(paper.title || 'this paper', 60)}"?`)) return;
          await window.ResearchHub.Papers.delete(paperId);
          this.allPapers = this.allPapers.filter(p => p.id !== paperId);
          window.ResearchHub.Search.init(this.allPapers);
          await this.renderLibrary();
          Utils.showToast('Paper deleted', 'info');
        });
      });

      // Select all
      const selectAll = document.getElementById('select-all-papers');
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          tbody.querySelectorAll('.paper-checkbox').forEach(cb => cb.checked = selectAll.checked);
        });
      }
    },

    renderPaperRow(paper, statuses) {
      const Utils = window.ResearchHub.Utils;
      const Status = window.ResearchHub.Status;
      const title = Utils.truncate(paper.title || 'Untitled', 60);
      const authors = Utils.formatAuthors(paper.authors);
      const year = paper.year || '—';
      const venue = Utils.truncate(paper.venue || '—', 35);
      const color = Status.getColor(paper.status);
      const tags = (paper.tags || []).slice(0, 3);
      const hasPdf = paper.pdfData ? '<span class="pdf-badge">PDF</span>' : '';
      const priority = paper.priority ? `<span class="priority-${paper.priority}">${paper.priority === 'high' ? '▲' : paper.priority === 'medium' ? '◆' : '▼'}</span>` : '';

      const statusOptions = statuses.map(s =>
        `<option value="${Utils.escapeHtml(s)}" ${s === paper.status ? 'selected' : ''}>${Utils.escapeHtml(s)}</option>`
      ).join('');

      const tagChips = tags.map(t =>
        `<span class="tag-chip">${Utils.escapeHtml(t)}</span>`
      ).join('') + ((paper.tags || []).length > 3 ? `<span class="tag-chip tag-chip-more">+${(paper.tags || []).length - 3}</span>` : '');

      return `
        <tr class="paper-row" data-paper-id="${paper.id}">
          <td><input type="checkbox" class="paper-checkbox" value="${paper.id}"></td>
          <td>
            <span class="paper-title-link" data-paper-id="${paper.id}">${Utils.escapeHtml(title)}</span>${hasPdf}${priority}
          </td>
          <td class="text-muted">${Utils.escapeHtml(authors)}</td>
          <td>${year}</td>
          <td class="text-muted">${Utils.escapeHtml(venue)}</td>
          <td>
            <select class="inline-status" data-paper-id="${paper.id}" style="border-left: 3px solid ${color}">
              ${statusOptions}
            </select>
          </td>
          <td class="tags-cell">${tagChips}</td>
          <td>
            <button class="btn btn-icon delete-paper-btn" data-paper-id="${paper.id}" title="Delete">🗑️</button>
          </td>
        </tr>`;
    },

    setupTableSort() {
      document.querySelectorAll('#papers-table th.sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', async () => {
          const field = th.dataset.sort;
          if (this.sortField === field) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortField = field;
            this.sortDir = 'asc';
          }
          document.querySelectorAll('#papers-table th.sortable .sort-icon').forEach(ic => ic.textContent = '↕');
          const icon = th.querySelector('.sort-icon');
          if (icon) icon.textContent = this.sortDir === 'asc' ? '↑' : '↓';
          await this.renderLibrary();
        });
      });
    },

    setupFilters() {
      const filterIds = ['filter-status', 'filter-tag', 'filter-collection', 'filter-priority'];
      filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // Remove old listener first using clone
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('change', async () => {
          if (id === 'filter-status') this.activeFilters.status = newEl.value;
          if (id === 'filter-tag') this.activeFilters.tag = newEl.value;
          if (id === 'filter-collection') this.activeFilters.collectionId = newEl.value;
          if (id === 'filter-priority') this.activeFilters.priority = newEl.value;
          this.currentPage = 1;
          await this.renderLibrary();
        });
      });

      // Export buttons
      const exportBib = document.getElementById('export-bibtex-btn');
      if (exportBib) {
        const newBtn = exportBib.cloneNode(true);
        exportBib.parentNode.replaceChild(newBtn, exportBib);
        newBtn.addEventListener('click', () => {
          window.ResearchHub.Export.bibtex(this.filteredPapers.length > 0 ? this.filteredPapers : this.allPapers);
        });
      }
      const exportCsv = document.getElementById('export-csv-btn');
      if (exportCsv) {
        const newBtn = exportCsv.cloneNode(true);
        exportCsv.parentNode.replaceChild(newBtn, exportCsv);
        newBtn.addEventListener('click', () => {
          window.ResearchHub.Export.csv(this.filteredPapers.length > 0 ? this.filteredPapers : this.allPapers);
        });
      }
    },

    renderPagination(total) {
      const container = document.getElementById('pagination');
      if (!container) return;
      const totalPages = Math.ceil(total / this.pageSize);
      if (totalPages <= 1) { container.innerHTML = ''; return; }

      const start = (this.currentPage - 1) * this.pageSize + 1;
      const end = Math.min(this.currentPage * this.pageSize, total);

      let html = `<span class="pagination-info">Showing ${start}–${end} of ${total}</span>`;
      html += `<div class="pagination-btns">`;
      html += `<button class="btn btn-secondary btn-sm" id="pg-prev" ${this.currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;

      const maxPages = 5;
      let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
      let endPage = Math.min(totalPages, startPage + maxPages - 1);
      if (endPage - startPage < maxPages - 1) startPage = Math.max(1, endPage - maxPages + 1);

      for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn btn-sm ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'} pg-num" data-page="${i}">${i}</button>`;
      }
      html += `<button class="btn btn-secondary btn-sm" id="pg-next" ${this.currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
      html += `</div>`;

      container.innerHTML = html;

      document.getElementById('pg-prev')?.addEventListener('click', async () => {
        if (this.currentPage > 1) { this.currentPage--; await this.renderPapersTable(this.filteredPapers); this.renderPagination(total); }
      });
      document.getElementById('pg-next')?.addEventListener('click', async () => {
        if (this.currentPage < totalPages) { this.currentPage++; await this.renderPapersTable(this.filteredPapers); this.renderPagination(total); }
      });
      container.querySelectorAll('.pg-num').forEach(btn => {
        btn.addEventListener('click', async () => {
          this.currentPage = parseInt(btn.dataset.page);
          await this.renderPapersTable(this.filteredPapers);
          this.renderPagination(total);
        });
      });
    },

    async showPaperDetail(paperId) {
      const Papers = window.ResearchHub.Papers;
      const Utils = window.ResearchHub.Utils;
      const Status = window.ResearchHub.Status;

      let paper = await Papers.get(paperId);
      if (!paper) return;

      const modal = document.getElementById('paper-detail-modal');
      if (!modal) return;

      const titleEl = document.getElementById('modal-paper-title');
      if (titleEl) titleEl.textContent = paper.title || 'Untitled';

      if (this._notesCleanup) { this._notesCleanup(); this._notesCleanup = null; }

      const statuses = await Status.getAll();
      const allTags = window.ResearchHub.Tags.getAll(this.allPapers);

      const body = document.getElementById('paper-detail-body');
      if (!body) return;

      const priorityLabels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low', '': 'None' };

      body.innerHTML = `
        <div class="paper-detail-layout">
          <div class="paper-detail-main">
            <div class="detail-section">
              <div class="detail-meta-grid">
                <div class="meta-item"><label>Authors</label><span id="detail-authors">${Utils.escapeHtml((paper.authors || []).join(', ') || 'Unknown')}</span></div>
                <div class="meta-item"><label>Year</label><span id="detail-year">${paper.year || '—'}</span></div>
                <div class="meta-item"><label>Venue</label><span id="detail-venue">${Utils.escapeHtml(paper.venue || '—')}</span></div>
                <div class="meta-item"><label>DOI</label><span id="detail-doi">${paper.doi ? `<a href="https://doi.org/${Utils.escapeHtml(paper.doi)}" target="_blank">${Utils.escapeHtml(paper.doi)}</a>` : '—'}</span></div>
                <div class="meta-item"><label>Status</label>
                  <select class="inline-status detail-status-select" id="detail-status">
                    ${statuses.map(s => `<option value="${Utils.escapeHtml(s)}" ${s === paper.status ? 'selected' : ''}>${Utils.escapeHtml(s)}</option>`).join('')}
                  </select>
                </div>
                <div class="meta-item"><label>Priority</label>
                  <select class="form-select detail-edit-field" id="detail-priority" style="display:none">
                    <option value="">None</option>
                    <option value="high" ${paper.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${paper.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${paper.priority === 'low' ? 'selected' : ''}>Low</option>
                  </select>
                  <span id="detail-priority-display" class="priority-${paper.priority || ''}">${priorityLabels[paper.priority || ''] || 'None'}</span>
                </div>
                <div class="meta-item"><label>Citation Key</label><code>${Utils.escapeHtml(paper.citationKey || '—')}</code></div>
                <div class="meta-item"><label>Added</label><span>${Utils.formatDate(paper.createdAt)}</span></div>
              </div>
            </div>

            ${paper.abstract ? `
            <div class="detail-section">
              <h4>Abstract</h4>
              <p class="abstract-text" id="detail-abstract">${Utils.escapeHtml(paper.abstract)}</p>
            </div>` : ''}

            ${(paper.keywords && paper.keywords.length > 0) ? `
            <div class="detail-section">
              <h4>Keywords</h4>
              <div>${(paper.keywords || []).map(k => `<span class="tag-chip">${Utils.escapeHtml(k)}</span>`).join('')}</div>
            </div>` : ''}

            <div class="detail-section">
              <h4>Tags
                <button class="btn btn-sm btn-secondary" id="add-tag-toggle-btn" style="margin-left:8px">+ Add Tag</button>
              </h4>
              <div id="paper-tags-container">
                ${(paper.tags || []).map(t => `
                  <span class="tag-chip tag-chip-removable">
                    ${Utils.escapeHtml(t)}
                    <button class="remove-tag-btn" data-tag="${Utils.escapeHtml(t)}" data-paper-id="${paper.id}">×</button>
                  </span>`).join('')}
              </div>
              <div id="add-tag-form" style="display:none;margin-top:8px">
                <div class="input-with-btn">
                  <input type="text" id="new-tag-input" class="form-input" placeholder="Add tag..." list="tag-suggestions">
                  <datalist id="tag-suggestions">
                    ${allTags.map(t => `<option value="${Utils.escapeHtml(t.tag)}">`).join('')}
                  </datalist>
                  <button class="btn btn-primary btn-sm" id="add-tag-confirm-btn">Add</button>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h4>Tasks</h4>
              <div id="tasks-list">
                ${(paper.tasks || []).map((task, i) => `
                  <div class="task-item" data-index="${i}">
                    <input type="checkbox" class="task-checkbox" data-index="${i}" ${task.done ? 'checked' : ''}>
                    <span class="task-label ${task.done ? 'task-done' : ''}">${Utils.escapeHtml(task.label)}</span>
                    <button class="btn-icon delete-task-btn" data-index="${i}">×</button>
                  </div>`).join('')}
              </div>
              <div class="input-with-btn" style="margin-top:8px">
                <input type="text" id="new-task-input" class="form-input" placeholder="Add task...">
                <button class="btn btn-secondary btn-sm" id="add-task-btn">Add</button>
              </div>
            </div>

            <div class="detail-section">
              <h4>Notes <span class="text-muted" id="notes-save-indicator" style="font-size:12px"></span></h4>
              <div id="notes-editor" class="notes-editor" contenteditable="true">${window.ResearchHub.Notes.get(paper)}</div>
            </div>

            <div class="detail-section">
              <h4>PDF</h4>
              <div id="pdf-section">
                ${paper.pdfData ? `
                  <div>
                    <span class="text-muted">${Utils.escapeHtml(paper.pdfFilename || 'PDF attached')}</span>
                    <button class="btn btn-sm btn-primary" id="view-pdf-btn" data-paper-id="${paper.id}" style="margin-left:8px">View PDF</button>
                    <button class="btn btn-sm btn-danger" id="remove-pdf-btn" data-paper-id="${paper.id}" style="margin-left:4px">Remove</button>
                  </div>` : `
                  <label class="btn btn-secondary btn-sm" style="cursor:pointer">
                    📎 Attach PDF
                    <input type="file" id="pdf-upload-input" accept=".pdf" style="display:none" data-paper-id="${paper.id}">
                  </label>`}
              </div>
            </div>

            <div class="detail-section" id="extraction-section">
              <h4>Data Extraction</h4>
              <div id="extraction-data-container"></div>
            </div>
          </div>

          <div class="paper-detail-sidebar">
            <div class="detail-section">
              <h4>Collections</h4>
              <div id="paper-collections">
                ${(this.allCollections || []).map(col => {
                  const inCol = (paper.collections || []).includes(col.id);
                  return `<label class="collection-toggle">
                    <input type="checkbox" class="collection-checkbox" value="${col.id}" ${inCol ? 'checked' : ''} data-paper-id="${paper.id}">
                    ${Utils.escapeHtml(col.name)}
                  </label>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Form (hidden by default) -->
        <div id="paper-edit-form" style="display:none">
          <form id="edit-paper-form">
            <div class="form-grid">
              <div class="form-group full-width">
                <label>Title</label>
                <input type="text" name="title" id="edit-title" class="form-input" value="${Utils.escapeHtml(paper.title || '')}">
              </div>
              <div class="form-group full-width">
                <label>Authors</label>
                <input type="text" name="authors" id="edit-authors" class="form-input" value="${Utils.escapeHtml((paper.authors || []).join(', '))}">
              </div>
              <div class="form-group">
                <label>Year</label>
                <input type="number" name="year" id="edit-year" class="form-input" value="${paper.year || ''}">
              </div>
              <div class="form-group">
                <label>Venue</label>
                <input type="text" name="venue" id="edit-venue" class="form-input" value="${Utils.escapeHtml(paper.venue || '')}">
              </div>
              <div class="form-group">
                <label>DOI</label>
                <input type="text" name="doi" id="edit-doi" class="form-input" value="${Utils.escapeHtml(paper.doi || '')}">
              </div>
              <div class="form-group">
                <label>Citation Key</label>
                <input type="text" name="citationKey" id="edit-citationKey" class="form-input" value="${Utils.escapeHtml(paper.citationKey || '')}">
              </div>
              <div class="form-group full-width">
                <label>Keywords (comma separated)</label>
                <input type="text" name="keywords" id="edit-keywords" class="form-input" value="${Utils.escapeHtml((paper.keywords || []).join(', '))}">
              </div>
              <div class="form-group full-width">
                <label>Abstract</label>
                <textarea name="abstract" id="edit-abstract" class="form-textarea" rows="5">${Utils.escapeHtml(paper.abstract || '')}</textarea>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save Changes</button>
              <button type="button" class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>
            </div>
          </form>
        </div>
      `;

      this.openModal('paper-detail-modal');

      // Auto-save notes
      const notesEl = document.getElementById('notes-editor');
      const notesInd = document.getElementById('notes-save-indicator');
      if (notesEl) {
        this._notesCleanup = window.ResearchHub.Notes.initAutoSave(paper.id, notesEl, notesInd);
      }

      // Load extraction templates
      const extractionContainer = document.getElementById('extraction-data-container');
      if (extractionContainer) {
        await window.ResearchHub.Extraction.renderPaperExtraction(paper, extractionContainer);
      }

      // Edit button
      const editBtn = document.getElementById('modal-edit-btn');
      const detailMain = body.querySelector('.paper-detail-layout');
      const editForm = document.getElementById('paper-edit-form');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const isEditing = editForm.style.display !== 'none';
          if (isEditing) {
            editForm.style.display = 'none';
            if (detailMain) detailMain.style.display = '';
            editBtn.textContent = 'Edit';
          } else {
            editForm.style.display = 'block';
            if (detailMain) detailMain.style.display = 'none';
            editBtn.textContent = 'View';
          }
        });
      }

      // Save edit form
      const editPaperForm = document.getElementById('edit-paper-form');
      if (editPaperForm) {
        editPaperForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const authorsRaw = document.getElementById('edit-authors').value;
          const authors = authorsRaw.split(/,(?=\s*[A-Z])|\s+and\s+/i).map(a => a.trim()).filter(Boolean);
          const keywordsRaw = document.getElementById('edit-keywords').value;
          const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);
          const changes = {
            title: document.getElementById('edit-title').value,
            authors,
            year: parseInt(document.getElementById('edit-year').value) || null,
            venue: document.getElementById('edit-venue').value,
            doi: document.getElementById('edit-doi').value,
            citationKey: document.getElementById('edit-citationKey').value,
            keywords,
            abstract: document.getElementById('edit-abstract').value
          };
          await window.ResearchHub.Papers.update(paper.id, changes);
          paper = await window.ResearchHub.Papers.get(paper.id);
          const idx = this.allPapers.findIndex(p => p.id === paper.id);
          if (idx !== -1) this.allPapers[idx] = paper;
          if (titleEl) titleEl.textContent = paper.title || 'Untitled';
          window.ResearchHub.Utils.showToast('Paper updated', 'success');
          editForm.style.display = 'none';
          if (detailMain) detailMain.style.display = '';
          if (editBtn) editBtn.textContent = 'Edit';
          if (this.currentSection === 'library') await this.renderLibrary();
        });
      }

      const cancelEditBtn = document.getElementById('cancel-edit-btn');
      if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
          editForm.style.display = 'none';
          if (detailMain) detailMain.style.display = '';
          if (editBtn) editBtn.textContent = 'Edit';
        });
      }

      // Status change in detail modal
      const detailStatus = document.getElementById('detail-status');
      if (detailStatus) {
        detailStatus.addEventListener('change', async () => {
          await window.ResearchHub.Papers.update(paper.id, { status: detailStatus.value });
          const idx = this.allPapers.findIndex(p => p.id === paper.id);
          if (idx !== -1) this.allPapers[idx].status = detailStatus.value;
          window.ResearchHub.Utils.showToast('Status updated', 'success');
        });
      }

      // Tags
      const addTagToggle = document.getElementById('add-tag-toggle-btn');
      const addTagForm = document.getElementById('add-tag-form');
      if (addTagToggle && addTagForm) {
        addTagToggle.addEventListener('click', () => {
          addTagForm.style.display = addTagForm.style.display === 'none' ? 'block' : 'none';
          if (addTagForm.style.display !== 'none') {
            document.getElementById('new-tag-input')?.focus();
          }
        });
      }

      const addTagConfirm = document.getElementById('add-tag-confirm-btn');
      if (addTagConfirm) {
        addTagConfirm.addEventListener('click', async () => {
          const input = document.getElementById('new-tag-input');
          const tag = input ? input.value.trim() : '';
          if (!tag) return;
          await window.ResearchHub.Tags.addToPaper(paper.id, tag);
          paper = await window.ResearchHub.Papers.get(paper.id);
          const idx = this.allPapers.findIndex(p => p.id === paper.id);
          if (idx !== -1) this.allPapers[idx] = paper;
          const tagsContainer = document.getElementById('paper-tags-container');
          if (tagsContainer) {
            tagsContainer.innerHTML = (paper.tags || []).map(t => `
              <span class="tag-chip tag-chip-removable">
                ${Utils.escapeHtml(t)}
                <button class="remove-tag-btn" data-tag="${Utils.escapeHtml(t)}" data-paper-id="${paper.id}">×</button>
              </span>`).join('');
          }
          if (input) input.value = '';
          if (addTagForm) addTagForm.style.display = 'none';
        });
      }

      body.addEventListener('click', async (e) => {
        // Remove tag
        const removeTagBtn = e.target.closest('.remove-tag-btn');
        if (removeTagBtn) {
          const tag = removeTagBtn.dataset.tag;
          await window.ResearchHub.Tags.removeFromPaper(paper.id, tag);
          paper = await window.ResearchHub.Papers.get(paper.id);
          const idx = this.allPapers.findIndex(p => p.id === paper.id);
          if (idx !== -1) this.allPapers[idx] = paper;
          removeTagBtn.closest('.tag-chip-removable').remove();
        }

        // Tasks
        const taskCheckbox = e.target.closest('.task-checkbox');
        if (taskCheckbox) {
          const idx = parseInt(taskCheckbox.dataset.index);
          const tasks = (paper.tasks || []).slice();
          if (tasks[idx]) {
            tasks[idx] = { ...tasks[idx], done: taskCheckbox.checked };
            await window.ResearchHub.Papers.update(paper.id, { tasks });
            paper = await window.ResearchHub.Papers.get(paper.id);
            const labelEl = taskCheckbox.nextElementSibling;
            if (labelEl) labelEl.classList.toggle('task-done', taskCheckbox.checked);
          }
        }

        const deleteTaskBtn = e.target.closest('.delete-task-btn');
        if (deleteTaskBtn) {
          const idx = parseInt(deleteTaskBtn.dataset.index);
          const tasks = (paper.tasks || []).slice();
          tasks.splice(idx, 1);
          await window.ResearchHub.Papers.update(paper.id, { tasks });
          paper = await window.ResearchHub.Papers.get(paper.id);
          const taskItem = deleteTaskBtn.closest('.task-item');
          if (taskItem) taskItem.remove();
        }

        // View PDF
        if (e.target.closest('#view-pdf-btn')) {
          await this.viewPDF(paper.id);
        }

        // Remove PDF
        if (e.target.closest('#remove-pdf-btn')) {
          if (confirm('Remove attached PDF?')) {
            await window.ResearchHub.Papers.update(paper.id, { pdfData: null, pdfFilename: null });
            paper = await window.ResearchHub.Papers.get(paper.id);
            const idx = this.allPapers.findIndex(p => p.id === paper.id);
            if (idx !== -1) this.allPapers[idx] = paper;
            const pdfSection = document.getElementById('pdf-section');
            if (pdfSection) {
              pdfSection.innerHTML = `<label class="btn btn-secondary btn-sm" style="cursor:pointer">
                📎 Attach PDF
                <input type="file" id="pdf-upload-input" accept=".pdf" style="display:none" data-paper-id="${paper.id}">
              </label>`;
              this._setupPdfUpload(paper.id);
            }
            Utils.showToast('PDF removed', 'info');
          }
        }

        // Collection checkboxes
        const colCheckbox = e.target.closest('.collection-checkbox');
        if (colCheckbox) {
          const collectionId = colCheckbox.value;
          if (colCheckbox.checked) {
            await window.ResearchHub.Collections.addPaper(collectionId, paper.id);
          } else {
            await window.ResearchHub.Collections.removePaper(collectionId, paper.id);
          }
          paper = await window.ResearchHub.Papers.get(paper.id);
          const idx = this.allPapers.findIndex(p => p.id === paper.id);
          if (idx !== -1) this.allPapers[idx] = paper;
          this.updateSidebarCollections();
        }
      });

      // Add task
      const addTaskBtn = document.getElementById('add-task-btn');
      if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
          const input = document.getElementById('new-task-input');
          const label = input ? input.value.trim() : '';
          if (!label) return;
          const tasks = (paper.tasks || []).slice();
          tasks.push({ label, done: false });
          await window.ResearchHub.Papers.update(paper.id, { tasks });
          paper = await window.ResearchHub.Papers.get(paper.id);
          const idx = this.allPapers.findIndex(p => p.id === paper.id);
          if (idx !== -1) this.allPapers[idx] = paper;
          const tasksList = document.getElementById('tasks-list');
          if (tasksList) {
            const ti = tasks.length - 1;
            const div = document.createElement('div');
            div.className = 'task-item';
            div.dataset.index = ti;
            div.innerHTML = `<input type="checkbox" class="task-checkbox" data-index="${ti}"><span class="task-label">${Utils.escapeHtml(label)}</span><button class="btn-icon delete-task-btn" data-index="${ti}">×</button>`;
            tasksList.appendChild(div);
          }
          if (input) input.value = '';
        });
      }

      // PDF upload
      this._setupPdfUpload(paper.id);
    },

    _setupPdfUpload(paperId) {
      const input = document.getElementById('pdf-upload-input');
      if (!input) return;
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await this.attachPDF(paperId, file);
      });
    },

    async attachPDF(paperId, file) {
      const Utils = window.ResearchHub.Utils;
      try {
        const buffer = await file.arrayBuffer();
        const base64 = Utils.arrayBufferToBase64(buffer);
        await window.ResearchHub.Papers.update(paperId, { pdfData: base64, pdfFilename: file.name });
        const idx = this.allPapers.findIndex(p => p.id === paperId);
        if (idx !== -1) {
          this.allPapers[idx].pdfData = base64;
          this.allPapers[idx].pdfFilename = file.name;
        }
        const pdfSection = document.getElementById('pdf-section');
        if (pdfSection) {
          pdfSection.innerHTML = `
            <div>
              <span class="text-muted">${Utils.escapeHtml(file.name)}</span>
              <button class="btn btn-sm btn-primary" id="view-pdf-btn" data-paper-id="${paperId}" style="margin-left:8px">View PDF</button>
              <button class="btn btn-sm btn-danger" id="remove-pdf-btn" data-paper-id="${paperId}" style="margin-left:4px">Remove</button>
            </div>`;
        }
        Utils.showToast('PDF attached', 'success');
      } catch(err) {
        Utils.showToast('Failed to attach PDF: ' + err.message, 'error');
      }
    },

    async viewPDF(paperId) {
      const Utils = window.ResearchHub.Utils;
      const paper = await window.ResearchHub.Papers.get(paperId);
      if (!paper || !paper.pdfData) { Utils.showToast('No PDF attached', 'warning'); return; }

      this.openModal('pdf-viewer-modal');
      const titleEl = document.getElementById('pdf-modal-title');
      if (titleEl) titleEl.textContent = paper.pdfFilename || paper.title || 'PDF';

      this._pdfState = { pdf: null, page: 1, scale: 1.0 };

      try {
        if (typeof pdfjsLib === 'undefined') {
          Utils.showToast('PDF.js not loaded', 'error'); return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const buffer = Utils.base64ToArrayBuffer(paper.pdfData);
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        this._pdfState.pdf = pdf;
        this._pdfState.page = 1;
        await this._renderPdfPage();
      } catch(err) {
        Utils.showToast('Error loading PDF: ' + err.message, 'error');
      }
    },

    async _renderPdfPage() {
      const pdf = this._pdfState.pdf;
      if (!pdf) return;
      const canvas = document.getElementById('pdf-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const page = await pdf.getPage(this._pdfState.page);
      const viewport = page.getViewport({ scale: this._pdfState.scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const pageInfo = document.getElementById('pdf-page-info');
      if (pageInfo) pageInfo.textContent = `Page ${this._pdfState.page} of ${pdf.numPages}`;
    },

    showAddPaperModal(prefillData, initialTab = 'manual') {
      const modal = document.getElementById('add-paper-modal');
      if (!modal) return;

      const titleEl = document.getElementById('add-paper-modal-title');
      if (titleEl) titleEl.textContent = 'Add Paper';

      this._parsedBibtex = null;

      // Reset form
      const form = document.getElementById('add-paper-form');
      if (form) form.reset();

      // Prefill status options
      window.ResearchHub.Status.getAll().then(statuses => {
        const sel = document.getElementById('form-status');
        if (sel) {
          sel.innerHTML = statuses.map(s => `<option value="${window.ResearchHub.Utils.escapeHtml(s)}">${window.ResearchHub.Utils.escapeHtml(s)}</option>`).join('');
        }
      });

      if (prefillData) {
        const fields = ['title', 'authors', 'year', 'venue', 'doi', 'abstract', 'keywords', 'tags', 'status', 'priority'];
        fields.forEach(f => {
          const el = document.getElementById(`form-${f}`);
          if (!el) return;
          let val = prefillData[f];
          if (Array.isArray(val)) val = val.join(', ');
          if (val !== undefined && val !== null) el.value = val;
        });
      }

      this.openModal('add-paper-modal');
      this.setupAddPaperForm();
      this.activateAddPaperTab(initialTab);
    },

    activateAddPaperTab(tabName) {
      const tabBtns = document.querySelectorAll('#add-paper-modal .tab-btn');
      const tabContents = document.querySelectorAll('#add-paper-modal .tab-content');
      tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
      tabContents.forEach(tc => tc.classList.remove('active'));
      const target = document.getElementById(`tab-${tabName}`);
      if (target) target.classList.add('active');
    },

    setupAddPaperForm() {
      // Tabs
      const tabBtns = document.querySelectorAll('#add-paper-modal .tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('#add-paper-modal .tab-content').forEach(tc => tc.classList.remove('active'));
          const tab = document.getElementById(`tab-${btn.dataset.tab}`);
          if (tab) tab.classList.add('active');
        });
      });

      // Manual form submit
      const form = document.getElementById('add-paper-form');
      if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const Utils = window.ResearchHub.Utils;
          const authorsRaw = document.getElementById('form-authors').value;
          const authors = authorsRaw.split(/,(?=\s*[A-Z])|\s+and\s+/i).map(a => a.trim()).filter(Boolean);
          const keywords = document.getElementById('form-keywords').value.split(',').map(k => k.trim()).filter(Boolean);
          const tags = document.getElementById('form-tags').value.split(',').map(t => t.trim()).filter(Boolean);
          const yearRaw = document.getElementById('form-year').value;

          const paper = await window.ResearchHub.Papers.add({
            title: document.getElementById('form-title').value,
            authors,
            year: yearRaw ? parseInt(yearRaw) : null,
            venue: document.getElementById('form-venue').value,
            doi: document.getElementById('form-doi').value,
            abstract: document.getElementById('form-abstract').value,
            keywords,
            tags,
            status: document.getElementById('form-status').value || 'Collected',
            priority: document.getElementById('form-priority').value
          });
          this.allPapers.unshift(paper);
          window.ResearchHub.Search.init(this.allPapers);
          this.closeModal('add-paper-modal');
          Utils.showToast(`Added: ${Utils.truncate(paper.title || 'Paper', 40)}`, 'success');
          await this.updateFilterOptions();
          if (this.currentSection === 'library') await this.renderLibrary();
          else await this.showSection('library');
        });

        // Re-attach DOI autofill
        const doiBtn = document.getElementById('doi-autofill-btn');
        if (doiBtn) {
          doiBtn.addEventListener('click', async () => {
            const doiInput = document.getElementById('form-doi');
            const doi = doiInput ? doiInput.value.trim() : '';
            if (!doi) { window.ResearchHub.Utils.showToast('Enter a DOI first', 'warning'); return; }
            try {
              doiBtn.textContent = 'Loading...';
              doiBtn.disabled = true;
              const paper = await window.ResearchHub.Import.fromDOI(doi);
              // Fill form fields
              const fields = { title: paper.title, authors: (paper.authors || []).join(', '), year: paper.year, venue: paper.venue, abstract: paper.abstract, keywords: (paper.keywords || []).join(', ') };
              Object.entries(fields).forEach(([key, val]) => {
                const el = document.getElementById(`form-${key}`);
                if (el && val) el.value = val;
              });
              // Remove the auto-added paper, just fill the form
              await window.ResearchHub.Papers.delete(paper.id);
              this.allPapers = this.allPapers.filter(p => p.id !== paper.id);
              window.ResearchHub.Utils.showToast('Fields filled from CrossRef', 'success');
            } catch(err) {
              window.ResearchHub.Utils.showToast('DOI lookup failed: ' + err.message, 'error');
            } finally {
              doiBtn.textContent = 'Auto-fill';
              doiBtn.disabled = false;
            }
          });
        }
      }

      // BibTeX parse & import
      const parseBibBtn = document.getElementById('parse-bibtex-btn');
      if (parseBibBtn) {
        parseBibBtn.addEventListener('click', () => {
          const text = document.getElementById('bibtex-input').value;
          const parsed = window.ResearchHub.BibTeX.parse(text);
          this._parsedBibtex = parsed;
          const preview = document.getElementById('bibtex-preview');
          const importBtn = document.getElementById('import-bibtex-btn');
          if (preview) {
            if (parsed.length === 0) {
              preview.innerHTML = '<p class="text-muted">No valid BibTeX entries found.</p>';
              if (importBtn) importBtn.style.display = 'none';
            } else {
              preview.innerHTML = `<p><strong>${parsed.length} entries found:</strong></p>` +
                parsed.slice(0, 10).map(p => `<div class="preview-item"><strong>${window.ResearchHub.Utils.escapeHtml(p.title || 'Untitled')}</strong> (${p.year || '?'})</div>`).join('') +
                (parsed.length > 10 ? `<p class="text-muted">...and ${parsed.length - 10} more</p>` : '');
              if (importBtn) importBtn.style.display = 'inline-block';
            }
          }
        });
      }

      const importBibBtn = document.getElementById('import-bibtex-btn');
      if (importBibBtn) {
        importBibBtn.addEventListener('click', async () => {
          const text = document.getElementById('bibtex-input').value;
          importBibBtn.disabled = true;
          importBibBtn.textContent = 'Importing...';
          const result = await window.ResearchHub.Import.bibtex(text);
          await this.loadData();
          this.closeModal('add-paper-modal');
          window.ResearchHub.Utils.showToast(`Imported ${result.imported} papers, skipped ${result.skipped}`, 'success');
          if (this.currentSection === 'library') await this.renderLibrary();
          else await this.showSection('library');
        });
      }

      // DOI Lookup
      const doiLookupBtn = document.getElementById('doi-lookup-btn');
      if (doiLookupBtn) {
        doiLookupBtn.addEventListener('click', async () => {
          const doi = document.getElementById('doi-lookup-input').value.trim();
          if (!doi) { window.ResearchHub.Utils.showToast('Enter a DOI', 'warning'); return; }
          doiLookupBtn.disabled = true;
          doiLookupBtn.textContent = 'Looking up...';
          const preview = document.getElementById('doi-preview');
          try {
            const paper = await window.ResearchHub.Import.fromDOI(doi);
            await this.loadData();
            if (preview) {
              preview.innerHTML = `
                <div class="preview-item success-preview">
                  <strong>${window.ResearchHub.Utils.escapeHtml(paper.title)}</strong><br>
                  <span class="text-muted">${window.ResearchHub.Utils.escapeHtml(window.ResearchHub.Utils.formatAuthors(paper.authors))} · ${paper.year || '?'}</span><br>
                  <span class="text-muted">${window.ResearchHub.Utils.escapeHtml(paper.venue || '')}</span>
                </div>
                <p class="text-muted" style="margin-top:8px">✅ Paper added to library</p>`;
            }
            window.ResearchHub.Utils.showToast('Paper added from DOI', 'success');
            if (this.currentSection === 'library') await this.renderLibrary();
          } catch(err) {
            if (preview) preview.innerHTML = `<p class="text-muted error-text">❌ ${window.ResearchHub.Utils.escapeHtml(err.message)}</p>`;
            window.ResearchHub.Utils.showToast('DOI lookup failed: ' + err.message, 'error');
          } finally {
            doiLookupBtn.disabled = false;
            doiLookupBtn.textContent = 'Lookup';
          }
        });
      }

      // File upload
      const fileInput = document.getElementById('bibtex-file-input');
      const uploadArea = document.getElementById('bibtex-upload-area');
      if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const text = ev.target.result;
            const result = await window.ResearchHub.Import.bibtex(text);
            await this.loadData();
            const preview = document.getElementById('upload-preview');
            if (preview) preview.innerHTML = `<p>✅ Imported ${result.imported} papers, skipped ${result.skipped}</p>`;
            window.ResearchHub.Utils.showToast(`Imported ${result.imported} papers from file`, 'success');
            if (this.currentSection === 'library') await this.renderLibrary();
          };
          reader.readAsText(file);
        });
      }

      if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('drag-over');
          const file = e.dataTransfer.files[0];
          if (file && fileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change'));
          }
        });
      }

      // RIS import
      const risBtn = document.getElementById('import-ris-btn');
      if (risBtn) {
        risBtn.addEventListener('click', async () => {
          const text = document.getElementById('ris-input').value;
          if (!text.trim()) { window.ResearchHub.Utils.showToast('Paste RIS data first', 'warning'); return; }
          risBtn.disabled = true;
          risBtn.textContent = 'Importing...';
          const result = await window.ResearchHub.Import.ris(text);
          await this.loadData();
          this.closeModal('add-paper-modal');
          window.ResearchHub.Utils.showToast(`Imported ${result.imported} papers`, 'success');
          if (this.currentSection === 'library') await this.renderLibrary();
          risBtn.disabled = false;
          risBtn.textContent = 'Import RIS';
        });
      }
    },

    async renderKanban() {
      const Status = window.ResearchHub.Status;
      const Utils = window.ResearchHub.Utils;
      const board = document.getElementById('kanban-board');
      if (!board) return;

      const statusList = await Status.getAllWithColors();

      board.innerHTML = statusList.map(s => {
        const papers = this.allPapers.filter(p => p.status === s.name);
        const cards = papers.map(p => `
          <div class="kanban-card" draggable="true" data-paper-id="${p.id}" data-status="${Utils.escapeHtml(s.name)}">
            <div class="kanban-card-title">${Utils.escapeHtml(Utils.truncate(p.title || 'Untitled', 70))}</div>
            <div class="kanban-card-meta text-muted">${Utils.escapeHtml(Utils.formatAuthors(p.authors))} ${p.year ? '· ' + p.year : ''}</div>
            ${(p.tags || []).slice(0, 2).map(t => `<span class="tag-chip" style="font-size:10px">${Utils.escapeHtml(t)}</span>`).join('')}
          </div>`).join('');

        return `
          <div class="kanban-column" data-status="${Utils.escapeHtml(s.name)}">
            <div class="kanban-column-header" style="border-top: 3px solid ${s.color}">
              <span>${Utils.escapeHtml(s.name)}</span>
              <span class="kanban-count">${papers.length}</span>
            </div>
            <div class="kanban-cards" data-status="${Utils.escapeHtml(s.name)}">${cards}</div>
          </div>`;
      }).join('');

      this.setupKanbanDragDrop();

      // Card click to open detail
      board.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('click', async () => {
          await this.showPaperDetail(card.dataset.paperId);
        });
      });
    },

    setupKanbanDragDrop() {
      const board = document.getElementById('kanban-board');
      if (!board) return;
      let dragCard = null;
      let dragPaperId = null;

      board.addEventListener('dragstart', (e) => {
        dragCard = e.target.closest('.kanban-card');
        if (dragCard) {
          dragPaperId = dragCard.dataset.paperId;
          dragCard.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      board.addEventListener('dragend', () => {
        if (dragCard) dragCard.classList.remove('dragging');
        board.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
        dragCard = null;
      });

      board.addEventListener('dragover', (e) => {
        e.preventDefault();
        const col = e.target.closest('.kanban-column');
        if (col) {
          board.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
          col.classList.add('drag-over');
        }
        e.dataTransfer.dropEffect = 'move';
      });

      board.addEventListener('drop', async (e) => {
        e.preventDefault();
        const col = e.target.closest('.kanban-column');
        if (col && dragPaperId) {
          const newStatus = col.dataset.status;
          const oldCard = board.querySelector(`.kanban-card[data-paper-id="${dragPaperId}"]`);
          if (oldCard) {
            const oldStatus = oldCard.dataset.status;
            if (newStatus !== oldStatus) {
              await window.ResearchHub.Papers.update(dragPaperId, { status: newStatus });
              const idx = this.allPapers.findIndex(p => p.id === dragPaperId);
              if (idx !== -1) this.allPapers[idx].status = newStatus;
              window.ResearchHub.Utils.showToast(`Moved to ${newStatus}`, 'success');
              await this.renderKanban();
            }
          }
        }
        board.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
      });
    },

    async renderCollections() {
      const Collections = window.ResearchHub.Collections;
      const Utils = window.ResearchHub.Utils;
      const container = document.getElementById('collections-content');
      if (!container) return;

      const collections = await Collections.getAll();

      if (collections.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><p>No collections yet. Create one to organize your papers.</p></div>`;
      } else {
        container.innerHTML = `<div class="collections-grid">
          ${collections.map(col => {
            const papers = Collections.getPapers(col, this.allPapers);
            return `
              <div class="card collection-card" data-id="${col.id}">
                <div class="collection-header">
                  <h3>${Utils.escapeHtml(col.name)}</h3>
                  <div class="collection-actions">
                    <button class="btn btn-sm btn-secondary rename-col-btn" data-id="${col.id}">Rename</button>
                    <button class="btn btn-sm btn-danger delete-col-btn" data-id="${col.id}">Delete</button>
                  </div>
                </div>
                <p class="text-muted">${Utils.escapeHtml(col.description || '')}</p>
                <div class="collection-count">${papers.length} paper${papers.length !== 1 ? 's' : ''}</div>
                <div class="collection-papers-list">
                  ${papers.slice(0, 5).map(p => `
                    <div class="collection-paper-item">
                      <span class="paper-title-link" data-paper-id="${p.id}">${Utils.escapeHtml(Utils.truncate(p.title || 'Untitled', 60))}</span>
                    </div>`).join('')}
                  ${papers.length > 5 ? `<p class="text-muted" style="font-size:13px">...and ${papers.length - 5} more</p>` : ''}
                </div>
                <div class="collection-add-paper" style="margin-top:12px">
                  <select class="form-select add-paper-to-col-select" data-col-id="${col.id}">
                    <option value="">Add paper...</option>
                    ${this.allPapers.filter(p => !(col.paperIds || []).includes(p.id)).map(p =>
                      `<option value="${p.id}">${Utils.escapeHtml(Utils.truncate(p.title || 'Untitled', 50))}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>`;
          }).join('')}
        </div>`;
      }

      // New collection button
      const newBtn = document.getElementById('new-collection-btn');
      if (newBtn) {
        const freshBtn = newBtn.cloneNode(true);
        newBtn.parentNode.replaceChild(freshBtn, newBtn);
        freshBtn.id = 'new-collection-btn';
        freshBtn.addEventListener('click', async () => {
          const name = prompt('Collection name:');
          if (!name) return;
          const desc = prompt('Description (optional):') || '';
          await Collections.create(name, desc);
          await this.loadData();
          await this.renderCollections();
          Utils.showToast(`Collection "${name}" created`, 'success');
        });
      }

      container.addEventListener('click', async (e) => {
        const paperLink = e.target.closest('.paper-title-link');
        if (paperLink) await this.showPaperDetail(paperLink.dataset.paperId);

        const renameBtn = e.target.closest('.rename-col-btn');
        if (renameBtn) {
          const id = renameBtn.dataset.id;
          const col = this.allCollections.find(c => c.id === id);
          const newName = prompt('New name:', col ? col.name : '');
          if (newName) {
            await Collections.update(id, { name: newName });
            await this.loadData();
            await this.renderCollections();
          }
        }

        const deleteBtn = e.target.closest('.delete-col-btn');
        if (deleteBtn) {
          const id = deleteBtn.dataset.id;
          const col = this.allCollections.find(c => c.id === id);
          if (confirm(`Delete collection "${col ? col.name : ''}"?`)) {
            await Collections.delete(id);
            await this.loadData();
            await this.renderCollections();
            Utils.showToast('Collection deleted', 'info');
          }
        }
      });

      container.addEventListener('change', async (e) => {
        const sel = e.target.closest('.add-paper-to-col-select');
        if (sel && sel.value) {
          const colId = sel.dataset.colId;
          const paperId = sel.value;
          await Collections.addPaper(colId, paperId);
          await this.loadData();
          await this.renderCollections();
          Utils.showToast('Paper added to collection', 'success');
        }
      });
    },

    async renderTags() {
      const Tags = window.ResearchHub.Tags;
      const Utils = window.ResearchHub.Utils;
      const container = document.getElementById('tags-content');
      if (!container) return;

      const tags = Tags.getAll(this.allPapers);

      if (tags.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div><p>No tags yet. Add tags to papers to see them here.</p></div>`;
        return;
      }

      container.innerHTML = `
        <div class="card">
          <table class="data-table">
            <thead>
              <tr><th>Tag</th><th>Papers</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${tags.map(t => `
                <tr>
                  <td><span class="tag-chip">${Utils.escapeHtml(t.tag)}</span></td>
                  <td>${t.count}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary filter-by-tag-btn" data-tag="${Utils.escapeHtml(t.tag)}">Filter Library</button>
                    <button class="btn btn-sm btn-secondary rename-tag-btn" data-tag="${Utils.escapeHtml(t.tag)}">Rename</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

      container.addEventListener('click', async (e) => {
        const filterBtn = e.target.closest('.filter-by-tag-btn');
        if (filterBtn) {
          this.activeFilters.tag = filterBtn.dataset.tag;
          const sel = document.getElementById('filter-tag');
          if (sel) sel.value = filterBtn.dataset.tag;
          await this.showSection('library');
        }

        const renameBtn = e.target.closest('.rename-tag-btn');
        if (renameBtn) {
          const oldName = renameBtn.dataset.tag;
          const newName = prompt(`Rename tag "${oldName}" to:`, oldName);
          if (newName && newName !== oldName) {
            await Tags.rename(oldName, newName);
            await this.loadData();
            await this.renderTags();
            Utils.showToast(`Tag renamed to "${newName}"`, 'success');
          }
        }
      });
    },

    handleSearch(query) {
      const Utils = window.ResearchHub.Utils;
      if (this.currentSection !== 'library') {
        this.showSection('library');
        return;
      }
      this.currentPage = 1;
      this.renderLibrary();
    },

    setupSearch() {
      const searchInput = document.getElementById('global-search');
      if (!searchInput) return;
      const Utils = window.ResearchHub.Utils;
      const debouncedSearch = Utils.debounce(() => {
        this.currentPage = 1;
        if (this.currentSection !== 'library') {
          this.showSection('library');
        } else {
          this.renderLibrary();
        }
      }, 300);
      searchInput.addEventListener('input', debouncedSearch);
    },

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Ctrl+K: focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          const search = document.getElementById('global-search');
          if (search) search.focus();
        }
        // Ctrl+N: add paper
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
          e.preventDefault();
          this.showAddPaperModal();
        }
        // Escape: close modals
        if (e.key === 'Escape') {
          this.closeAllModals();
        }
      });
    },

    setupGlobalEventListeners() {
      // Modal close buttons
      document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.modal-close');
        if (closeBtn) {
          const modalId = closeBtn.dataset.modal;
          if (modalId) this.closeModal(modalId);
        }
        // Click outside modal
        if (e.target.classList.contains('modal-overlay')) {
          this.closeAllModals();
        }
        // Cancel buttons
        if (e.target.dataset && e.target.dataset.modal) {
          const modalId = e.target.dataset.modal;
          if (document.getElementById(modalId)) this.closeModal(modalId);
        }
      });

      // PDF controls
      document.getElementById('pdf-prev')?.addEventListener('click', async () => {
        if (this._pdfState.page > 1) {
          this._pdfState.page--;
          await this._renderPdfPage();
        }
      });
      document.getElementById('pdf-next')?.addEventListener('click', async () => {
        if (this._pdfState.pdf && this._pdfState.page < this._pdfState.pdf.numPages) {
          this._pdfState.page++;
          await this._renderPdfPage();
        }
      });
      document.getElementById('pdf-zoom-in')?.addEventListener('click', async () => {
        this._pdfState.scale = Math.min(this._pdfState.scale + 0.25, 4.0);
        document.getElementById('pdf-zoom-level').textContent = Math.round(this._pdfState.scale * 100) + '%';
        await this._renderPdfPage();
      });
      document.getElementById('pdf-zoom-out')?.addEventListener('click', async () => {
        this._pdfState.scale = Math.max(this._pdfState.scale - 0.25, 0.25);
        document.getElementById('pdf-zoom-level').textContent = Math.round(this._pdfState.scale * 100) + '%';
        await this._renderPdfPage();
      });

      // Confirm modal
      const confirmOk = document.getElementById('confirm-ok');
      const confirmCancel = document.getElementById('confirm-cancel');
      if (confirmOk) confirmOk.addEventListener('click', () => {
        const cb = this._confirmCallback;
        this.closeModal('confirm-modal');
        if (cb) cb(true);
      });
      if (confirmCancel) confirmCancel.addEventListener('click', () => {
        this.closeModal('confirm-modal');
        if (this._confirmCallback) this._confirmCallback(false);
      });

      // New tab input enter key for tag
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'new-tag-input') {
          e.preventDefault();
          const addBtn = document.getElementById('add-tag-confirm-btn');
          if (addBtn) addBtn.click();
        }
        if (e.key === 'Enter' && e.target.id === 'new-task-input') {
          e.preventDefault();
          const addBtn = document.getElementById('add-task-btn');
          if (addBtn) addBtn.click();
        }
      });
    },

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    },

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
      if (modalId === 'paper-detail-modal' && this._notesCleanup) {
        this._notesCleanup();
        this._notesCleanup = null;
      }
    },

    closeAllModals() {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.display = 'none';
      });
      document.body.style.overflow = '';
      if (this._notesCleanup) {
        this._notesCleanup();
        this._notesCleanup = null;
      }
    }
  };

  window.ResearchHub.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
