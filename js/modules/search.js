window.ResearchHub = window.ResearchHub || {};

(function() {
  const Search = {
    _fuse: null,

    init(papers) {
      if (typeof Fuse === 'undefined') return;
      this._fuse = new Fuse(papers, this.getOptions());
    },

    getOptions() {
      return {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'authors', weight: 0.2 },
          { name: 'abstract', weight: 0.2 },
          { name: 'keywords', weight: 0.1 },
          { name: 'venue', weight: 0.1 }
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2
      };
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
