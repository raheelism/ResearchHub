window.ResearchHub = window.ResearchHub || {};

(function() {
  const MODES = ['title', 'full', 'balanced'];
  const MODE_WEIGHTS = {
    title: { title: 0.5, authors: 0.2, abstract: 0.15, keywords: 0.1, venue: 0.05 },
    balanced: { title: 0.4, authors: 0.2, abstract: 0.2, keywords: 0.1, venue: 0.1 },
    full: { title: 0.25, authors: 0.2, abstract: 0.35, keywords: 0.15, venue: 0.05 }
  };

  const Search = {
    _fuse: null,
    _papers: [],
    _mode: 'balanced',

    init(papers) {
      if (typeof Fuse === 'undefined') return;
      this._papers = Array.isArray(papers) ? papers : [];
      this._fuse = new Fuse(this._papers, this.getOptions());
    },

    getOptions(mode = this._mode) {
      const focusMode = MODES.includes(mode) ? mode : 'balanced';
      const weights = MODE_WEIGHTS[focusMode];
      return {
        keys: [
          { name: 'title', weight: weights.title },
          { name: 'authors', weight: weights.authors },
          { name: 'abstract', weight: weights.abstract },
          { name: 'keywords', weight: weights.keywords },
          { name: 'venue', weight: weights.venue }
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2
      };
    },

    setMode(mode) {
      this._mode = MODES.includes(mode) ? mode : 'balanced';
      if (typeof Fuse === 'undefined') return;
      if (!Array.isArray(this._papers)) return;
      this._fuse = new Fuse(this._papers, this.getOptions());
    },

    search(query) {
      if (!query || query.length < 2) return null;
      if (!this._fuse) return null;
      const results = this._fuse.search(query);
      return results.map(r => r.item);
    }
  };

  window.ResearchHub.Search = Search;
})();
