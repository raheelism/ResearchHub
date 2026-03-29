window.ResearchHub = window.ResearchHub || {};

(function() {
  const db = new Dexie('ResearchHub');
  db.version(1).stores({
    papers: 'id, title, year, doi, status, citationKey, createdAt',
    collections: 'id, name',
    settings: 'key',
    extractionTemplates: 'id, name'
  });
  window.ResearchHub.db = db;
})();
