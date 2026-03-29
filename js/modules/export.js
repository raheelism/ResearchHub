window.ResearchHub = window.ResearchHub || {};

(function() {
  const Export = {
    bibtex(papers) {
      const BibTeX = window.ResearchHub.BibTeX;
      const Utils = window.ResearchHub.Utils;
      const content = BibTeX.export(papers);
      Utils.downloadFile(content, 'papers.bib', 'text/plain;charset=utf-8');
    },

    csv(papers) {
      const Utils = window.ResearchHub.Utils;
      const rows = papers.map(p => ({
        id: p.id || '',
        title: p.title || '',
        authors: (p.authors || []).join('; '),
        year: p.year || '',
        venue: p.venue || '',
        doi: p.doi || '',
        abstract: p.abstract || '',
        keywords: (p.keywords || []).join('; '),
        status: p.status || '',
        tags: (p.tags || []).join('; '),
        priority: p.priority || '',
        citationKey: p.citationKey || '',
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : ''
      }));

      const csv = Papa.unparse(rows);
      Utils.downloadFile(csv, 'papers.csv', 'text/csv;charset=utf-8');
    },

    json(papers) {
      const Utils = window.ResearchHub.Utils;
      const content = JSON.stringify(papers, null, 2);
      Utils.downloadFile(content, 'papers.json', 'application/json;charset=utf-8');
    },

    markdown(papers) {
      const Utils = window.ResearchHub.Utils;
      const escape = s => (s || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      let md = '# Research Papers\n\n';
      md += '| Title | Authors | Year | Venue | Status |\n';
      md += '|-------|---------|------|-------|--------|\n';
      papers.forEach(p => {
        const title = escape(p.title || '');
        const authors = escape((p.authors || []).slice(0, 2).join(', ') + (p.authors && p.authors.length > 2 ? ' et al.' : ''));
        const year = p.year || '';
        const venue = escape(Utils.truncate(p.venue || '', 40));
        const status = escape(p.status || '');
        md += `| ${title} | ${authors} | ${year} | ${venue} | ${status} |\n`;
      });
      Utils.downloadFile(md, 'papers.md', 'text/markdown;charset=utf-8');
    },

    async fullBackup() {
      const Utils = window.ResearchHub.Utils;
      const db = window.ResearchHub.db;
      const papers = await db.papers.toArray();
      const collections = await db.collections.toArray();
      const settings = await db.settings.toArray();
      const extractionTemplates = await db.extractionTemplates.toArray();

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        papers,
        collections,
        settings,
        extractionTemplates
      };

      const date = new Date().toISOString().split('T')[0];
      const content = JSON.stringify(backup, null, 2);
      Utils.downloadFile(content, `researchhub-backup-${date}.json`, 'application/json;charset=utf-8');
    }
  };

  window.ResearchHub.Export = Export;
})();
