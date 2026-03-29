window.ResearchHub = window.ResearchHub || {};

(function() {
  const Quality = {
    check(papers) {
      const issues = [];
      papers.forEach(p => {
        const paperIssues = [];
        if (!p.title || p.title.trim() === '') paperIssues.push('Missing title');
        if (!p.abstract || p.abstract.trim() === '') paperIssues.push('Missing abstract');
        if (!p.doi || p.doi.trim() === '') paperIssues.push('Missing DOI');
        if (!p.pdfData) paperIssues.push('Missing PDF');
        if (!p.year) paperIssues.push('Missing year');
        if (!p.venue || p.venue.trim() === '') paperIssues.push('Missing venue/journal');
        if (!p.authors || p.authors.length === 0) paperIssues.push('Missing authors');

        if (paperIssues.length > 0) {
          issues.push({ paperId: p.id, title: p.title || 'Untitled', issues: paperIssues });
        }
      });
      return issues;
    },

    async render(container) {
      if (!container) return;
      const Papers = window.ResearchHub.Papers;
      const Utils = window.ResearchHub.Utils;

      container.innerHTML = '<div class="loading">Checking paper quality...</div>';
      const papers = await Papers.getAll();
      const issueList = this.check(papers);

      const issueTypes = ['Missing abstract', 'Missing DOI', 'Missing PDF', 'Missing year', 'Missing venue/journal', 'Missing authors'];

      if (issueList.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <p>All ${papers.length} papers pass quality check!</p>
          </div>`;
        return;
      }

      let activeFilter = '';

      const renderIssues = () => {
        const filtered = activeFilter
          ? issueList.filter(item => item.issues.includes(activeFilter))
          : issueList;

        const tableBody = container.querySelector('#quality-tbody');
        if (!tableBody) return;

        tableBody.innerHTML = filtered.map(item => `
          <tr>
            <td>
              <span class="paper-title-link" data-paper-id="${item.paperId}">
                ${Utils.escapeHtml(Utils.truncate(item.title, 70))}
              </span>
            </td>
            <td>${item.issues.map(i => `<span class="issue-chip">${Utils.escapeHtml(i)}</span>`).join('')}</td>
            <td><button class="btn btn-sm btn-secondary fix-paper-btn" data-paper-id="${item.paperId}">View</button></td>
          </tr>
        `).join('');
      };

      container.innerHTML = `
        <div class="quality-summary card" style="margin-bottom:16px">
          <strong>${issueList.length}</strong> of ${papers.length} papers have quality issues.
        </div>
        <div class="filter-chips" style="margin-bottom:16px">
          <button class="chip-btn ${activeFilter === '' ? 'active' : ''}" data-filter="">All Issues</button>
          ${issueTypes.map(t => `<button class="chip-btn ${activeFilter === t ? 'active' : ''}" data-filter="${Utils.escapeHtml(t)}">${Utils.escapeHtml(t)}</button>`).join('')}
        </div>
        <div class="card">
          <div style="margin-bottom:12px">
            <button id="export-issues-btn" class="btn btn-secondary btn-sm">Export Issues CSV</button>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>Paper</th><th>Issues</th><th>Actions</th></tr>
            </thead>
            <tbody id="quality-tbody"></tbody>
          </table>
        </div>
      `;

      renderIssues();

      // Filter chips
      container.addEventListener('click', async (e) => {
        const chipBtn = e.target.closest('.chip-btn');
        if (chipBtn) {
          activeFilter = chipBtn.dataset.filter;
          container.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
          chipBtn.classList.add('active');
          renderIssues();
        }

        const fixBtn = e.target.closest('.fix-paper-btn, .paper-title-link');
        if (fixBtn) {
          const paperId = fixBtn.dataset.paperId;
          if (paperId && window.ResearchHub.App) {
            await window.ResearchHub.App.showPaperDetail(paperId);
          }
        }

        if (e.target.closest('#export-issues-btn')) {
          const rows = issueList.map(item => ({
            title: item.title,
            issues: item.issues.join('; ')
          }));
          const csv = Papa.unparse(rows);
          Utils.downloadFile(csv, 'quality-issues.csv', 'text/csv;charset=utf-8');
        }
      });
    }
  };

  window.ResearchHub.Quality = Quality;
})();
