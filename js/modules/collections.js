window.ResearchHub = window.ResearchHub || {};

(function() {
  const Collections = {
    async getAll() {
      return await window.ResearchHub.db.collections.toArray();
    },

    async create(name, description) {
      const Utils = window.ResearchHub.Utils;
      const collection = {
        id: Utils.generateId(),
        name: name || 'New Collection',
        description: description || '',
        paperIds: [],
        createdAt: Date.now()
      };
      await window.ResearchHub.db.collections.put(collection);
      return collection;
    },

    async update(id, changes) {
      await window.ResearchHub.db.collections.update(id, changes);
      return await window.ResearchHub.db.collections.get(id);
    },

    async delete(id) {
      // Remove collection from all papers
      const Papers = window.ResearchHub.Papers;
      const allPapers = await Papers.getAll();
      const updates = [];
      for (const paper of allPapers) {
        if (paper.collections && paper.collections.includes(id)) {
          const collections = paper.collections.filter(c => c !== id);
          updates.push(Papers.update(paper.id, { collections }));
        }
      }
      await Promise.all(updates);
      await window.ResearchHub.db.collections.delete(id);
    },

    async addPaper(collectionId, paperId) {
      const db = window.ResearchHub.db;
      const Papers = window.ResearchHub.Papers;

      const collection = await db.collections.get(collectionId);
      if (!collection) return;
      if (!collection.paperIds.includes(paperId)) {
        collection.paperIds.push(paperId);
        await db.collections.put(collection);
      }

      // Also update paper's collections array
      const paper = await Papers.get(paperId);
      if (paper) {
        const cols = paper.collections || [];
        if (!cols.includes(collectionId)) {
          cols.push(collectionId);
          await Papers.update(paperId, { collections: cols });
        }
      }
    },

    async removePaper(collectionId, paperId) {
      const db = window.ResearchHub.db;
      const Papers = window.ResearchHub.Papers;

      const collection = await db.collections.get(collectionId);
      if (!collection) return;
      collection.paperIds = collection.paperIds.filter(id => id !== paperId);
      await db.collections.put(collection);

      // Also update paper's collections array
      const paper = await Papers.get(paperId);
      if (paper) {
        const cols = (paper.collections || []).filter(c => c !== collectionId);
        await Papers.update(paperId, { collections: cols });
      }
    },

    getPapers(collection, allPapers) {
      if (!collection || !collection.paperIds) return [];
      return allPapers.filter(p => collection.paperIds.includes(p.id));
    }
  };

  window.ResearchHub.Collections = Collections;
})();
