window.ResearchHub = window.ResearchHub || {};

(function() {
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
      const focusMode = ['title', 'full', 'balanced'].includes(mode) ? mode : 'balanced';
      return {
        keys: [
          { name: 'title', weight: focusMode === 'title' ? 0.6 : (focusMode === 'full' ? 0.3 : 0.4) },
          { name: 'authors', weight: 0.2 },
          { name: 'abstract', weight: focusMode === 'full' ? 0.3 : 0.2 },
          { name: 'keywords', weight: focusMode === 'full' ? 0.15 : 0.1 },
          { name: 'venue', weight: 0.1 }
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2
      };
    },

    setMode(mode) {
      this._mode = ['title', 'full', 'balanced'].includes(mode) ? mode : 'balanced';
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
