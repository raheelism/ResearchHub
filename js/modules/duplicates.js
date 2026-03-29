window.ResearchHub = window.ResearchHub || {};

(function() {
  const Duplicates = {
    find(papers) {
      const groups = [];
      const seenPairs = new Set();

      // 1. DOI duplicates
      const doiMap = {};
      papers.forEach(p => {
        if (p.doi && p.doi.trim()) {
          const doi = p.doi.trim().toLowerCase();
          if (!doiMap[doi]) doiMap[doi] = [];
          doiMap[doi].push(p);
        }
      });
      Object.values(doiMap).forEach(group => {
        if (group.length > 1) {
          const pairKey = group.map(p => p.id).sort().join('|');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            groups.push({ type: 'doi', papers: group });
          }
        }
      });

      // 2. Similar title duplicates using Fuse
      if (typeof Fuse !== 'undefined' && papers.length > 1) {
        const titledPapers = papers.filter(p => p.title && p.title.length > 3);
        const fuse = new Fuse(titledPapers, {
          keys: ['title'],
          threshold: 0.15,
          includeScore: true
        });

        for (let i = 0; i < titledPapers.length; i++) {
          const p = titledPapers[i];
          const results = fuse.search(p.title);
          // Find very close matches (excluding self)
          const matches = results.filter(r => r.item.id !== p.id && r.score < 0.15);
          for (const match of matches) {
            const pairKey = [p.id, match.item.id].sort().join('|');
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              groups.push({ type: 'title', papers: [p, match.item] });
            }
          }
        }
      }

      return groups;
    },

    async merge(keepId, deleteId) {
      const Papers = window.ResearchHub.Papers;
      const keep = await Papers.get(keepId);
      const del = await Papers.get(deleteId);
      if (!keep || !del) return null;

      // Merge: primary fields from keep, fill in blanks from del
      const merged = Object.assign({}, keep);
      const fieldsToMerge = ['title','authors','year','venue','doi','abstract','keywords','tags','collections','pdfData','pdfFilename','notes'];
      for (const field of fieldsToMerge) {
        if (!merged[field] || (Array.isArray(merged[field]) && merged[field].length === 0)) {
          if (del[field] && (!Array.isArray(del[field]) || del[field].length > 0)) {
            merged[field] = del[field];
          }
        }
      }
      // Merge arrays uniquely
      merged.tags = [...new Set([...(keep.tags || []), ...(del.tags || [])])];
      merged.collections = [...new Set([...(keep.collections || []), ...(del.collections || [])])];
      merged.keywords = [...new Set([...(keep.keywords || []), ...(del.keywords || [])])];

      await Papers.update(keepId, merged);
      await Papers.delete(deleteId);
      return await Papers.get(keepId);
    },

    async render(container) {
      if (!container) return;
      const Papers = window.ResearchHub.Papers;
      const Utils = window.ResearchHub.Utils;

      container.innerHTML = '<div class="loading">Analyzing papers for duplicates...</div>';
      const papers = await Papers.getAll();
      const groups = this.find(papers);

      if (groups.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <p>No duplicates found!</p>
          </div>`;
        return;
      }

      let html = `<p class="text-muted" style="margin-bottom:16px">Found ${groups.length} potential duplicate group(s).</p>`;
      html += '<div class="duplicates-list">';

      groups.forEach((group, gi) => {
        html += `
          <div class="card duplicate-group" id="dup-group-${gi}">
            <div class="dup-type-badge ${group.type === 'doi' ? 'badge-danger' : 'badge-warning'}">
              ${group.type === 'doi' ? '🔗 Same DOI' : '📄 Similar Title'}
            </div>
            <div class="dup-papers">
              ${group.papers.map((p, pi) => `
                <div class="dup-paper-row">
                  <div class="dup-paper-info">
                    <strong>${Utils.escapeHtml(p.title || 'Untitled')}</strong>
                    <span class="text-muted">${Utils.escapeHtml(Utils.formatAuthors(p.authors))} · ${p.year || '?'}</span>
                    ${p.doi ? `<span class="text-muted">DOI: ${Utils.escapeHtml(p.doi)}</span>` : ''}
                  </div>
                  <div class="dup-paper-actions">
                    ${pi > 0 ? `<button class="btn btn-sm btn-primary merge-keep-btn" data-keep="${group.papers[0].id}" data-delete="${p.id}" data-group="${gi}">Keep Other, Delete This</button>` : ''}
                    ${pi === 0 && group.papers.length > 1 ? `<button class="btn btn-sm btn-secondary merge-keep-btn" data-keep="${p.id}" data-delete="${group.papers[1].id}" data-group="${gi}">Keep This, Delete Other</button>` : ''}
                  </div>
                </div>
              `).join('<hr class="dup-divider">')}
            </div>
            <div class="dup-group-footer">
              <button class="btn btn-sm btn-secondary dismiss-dup-btn" data-group="${gi}">Not a Duplicate</button>
            </div>
          </div>`;
      });

      html += '</div>';
      container.innerHTML = html;

      container.addEventListener('click', async (e) => {
        const mergeBtn = e.target.closest('.merge-keep-btn');
        if (mergeBtn) {
          const keepId = mergeBtn.dataset.keep;
          const deleteId = mergeBtn.dataset.delete;
          const gi = mergeBtn.dataset.group;
          if (confirm('Merge these papers? The deleted paper\'s data will be merged into the kept paper.')) {
            try {
              await this.merge(keepId, deleteId);
              const groupEl = document.getElementById(`dup-group-${gi}`);
              if (groupEl) groupEl.remove();
              if (window.ResearchHub.App) await window.ResearchHub.App.loadData();
              Utils.showToast('Papers merged successfully', 'success');
            } catch(err) {
              Utils.showToast('Merge failed: ' + err.message, 'error');
            }
          }
        }

        const dismissBtn = e.target.closest('.dismiss-dup-btn');
        if (dismissBtn) {
          const gi = dismissBtn.dataset.group;
          const groupEl = document.getElementById(`dup-group-${gi}`);
          if (groupEl) groupEl.remove();
        }
      });
    }
  };

  window.ResearchHub.Duplicates = Duplicates;
})();
