window.ResearchHub = window.ResearchHub || {};

(function() {
  const Papers = {
    async getAll() {
      return await window.ResearchHub.db.papers.orderBy('createdAt').reverse().toArray();
    },

    async get(id) {
      return await window.ResearchHub.db.papers.get(id);
    },

    async add(paperData) {
      const Utils = window.ResearchHub.Utils;
      const now = Date.now();
      const paper = Object.assign({
        id: Utils.generateId(),
        title: '',
        authors: [],
        year: null,
        venue: '',
        doi: '',
        abstract: '',
        keywords: [],
        citationKey: '',
        status: 'Collected',
        tags: [],
        collections: [],
        pdfData: null,
        pdfFilename: null,
        notes: '',
        extractionData: {},
        datasets: [],
        tasks: [],
        priority: '',
        createdAt: now,
        updatedAt: now
      }, paperData);

      // Ensure arrays
      if (!Array.isArray(paper.authors)) paper.authors = paper.authors ? [paper.authors] : [];
      if (!Array.isArray(paper.keywords)) paper.keywords = paper.keywords ? [paper.keywords] : [];
      if (!Array.isArray(paper.tags)) paper.tags = paper.tags ? [paper.tags] : [];
      if (!Array.isArray(paper.collections)) paper.collections = [];
      if (!Array.isArray(paper.tasks)) paper.tasks = [];
      if (!Array.isArray(paper.datasets)) paper.datasets = [];

      if (!paper.citationKey) {
        paper.citationKey = Utils.generateCitationKey(paper);
      }
      paper.createdAt = now;
      paper.updatedAt = now;

      await window.ResearchHub.db.papers.put(paper);
      return paper;
    },

    async update(id, changes) {
      changes.updatedAt = Date.now();
      await window.ResearchHub.db.papers.update(id, changes);
      return await window.ResearchHub.db.papers.get(id);
    },

    async delete(id) {
      await window.ResearchHub.db.papers.delete(id);
    },

    filter(papers, filters) {
      if (!filters) return papers;
      let result = papers;

      if (filters.status) {
        result = result.filter(p => p.status === filters.status);
      }
      if (filters.tag) {
        result = result.filter(p => p.tags && p.tags.includes(filters.tag));
      }
      if (filters.collectionId) {
        result = result.filter(p => p.collections && p.collections.includes(filters.collectionId));
      }
      if (filters.priority) {
        result = result.filter(p => p.priority === filters.priority);
      }
      if (filters.search && filters.search.length >= 2) {
        const q = filters.search.toLowerCase();
        result = result.filter(p => {
          return (p.title && p.title.toLowerCase().includes(q)) ||
            (p.abstract && p.abstract.toLowerCase().includes(q)) ||
            (p.authors && p.authors.some(a => a.toLowerCase().includes(q))) ||
            (p.keywords && p.keywords.some(k => k.toLowerCase().includes(q))) ||
            (p.venue && p.venue.toLowerCase().includes(q));
        });
      }
      return result;
    },

    sort(papers, field, dir) {
      if (!papers) return [];
      const sorted = papers.slice();
      sorted.sort((a, b) => {
        let va = a[field];
        let vb = b[field];

        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;

        if (field === 'authors') {
          va = Array.isArray(va) ? va[0] || '' : String(va);
          vb = Array.isArray(vb) ? vb[0] || '' : String(vb);
        }

        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();

        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }
  };

  window.ResearchHub.Papers = Papers;
})();
