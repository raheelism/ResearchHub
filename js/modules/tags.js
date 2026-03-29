window.ResearchHub = window.ResearchHub || {};

(function() {
  const Tags = {
    getAll(papers) {
      const counts = {};
      (papers || []).forEach(p => {
        (p.tags || []).forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      });
      return Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    },

    async addToPaper(paperId, tag) {
      const Papers = window.ResearchHub.Papers;
      const paper = await Papers.get(paperId);
      if (!paper) return;
      const tags = paper.tags || [];
      if (!tags.includes(tag)) {
        tags.push(tag);
        await Papers.update(paperId, { tags });
      }
    },

    async removeFromPaper(paperId, tag) {
      const Papers = window.ResearchHub.Papers;
      const paper = await Papers.get(paperId);
      if (!paper) return;
      const tags = (paper.tags || []).filter(t => t !== tag);
      await Papers.update(paperId, { tags });
    },

    async rename(oldName, newName) {
      const Papers = window.ResearchHub.Papers;
      const allPapers = await Papers.getAll();
      const updates = [];
      for (const paper of allPapers) {
        if (paper.tags && paper.tags.includes(oldName)) {
          const tags = paper.tags.map(t => t === oldName ? newName : t);
          updates.push(Papers.update(paper.id, { tags }));
        }
      }
      await Promise.all(updates);
    }
  };

  window.ResearchHub.Tags = Tags;
})();
