window.ResearchHub = window.ResearchHub || {};

(function() {
  const Status = {
    DEFAULT_STATUSES: ['Collected', 'Reading', 'Read', 'Analyzing', 'Analyzed', 'Writing', 'Done'],
    STATUS_COLORS: {
      'Collected': '#64748b',
      'Reading': '#3b82f6',
      'Read': '#8b5cf6',
      'Analyzing': '#f59e0b',
      'Analyzed': '#f97316',
      'Writing': '#ec4899',
      'Done': '#22c55e'
    },

    async getAll() {
      const db = window.ResearchHub.db;
      try {
        const record = await db.settings.get('statusPipeline');
        if (record && record.value && record.value.length > 0) {
          return record.value.map(s => (typeof s === 'string' ? s : s.name));
        }
      } catch(e) { /* ignore */ }
      return this.DEFAULT_STATUSES.slice();
    },

    async getAllWithColors() {
      const db = window.ResearchHub.db;
      try {
        const record = await db.settings.get('statusPipeline');
        if (record && record.value && record.value.length > 0) {
          return record.value.map(s => {
            if (typeof s === 'string') {
              return { name: s, color: this.STATUS_COLORS[s] || '#64748b' };
            }
            return s;
          });
        }
      } catch(e) { /* ignore */ }
      return this.DEFAULT_STATUSES.map(name => ({
        name,
        color: this.STATUS_COLORS[name] || '#64748b'
      }));
    },

    async add(name, color) {
      const db = window.ResearchHub.db;
      const all = await this.getAllWithColors();
      if (!all.find(s => s.name === name)) {
        all.push({ name, color: color || '#64748b' });
        await db.settings.put({ key: 'statusPipeline', value: all });
      }
    },

    async remove(name) {
      const db = window.ResearchHub.db;
      const all = await this.getAllWithColors();
      const filtered = all.filter(s => s.name !== name);
      await db.settings.put({ key: 'statusPipeline', value: filtered });
    },

    async reorder(newOrder) {
      const db = window.ResearchHub.db;
      const all = await this.getAllWithColors();
      const reordered = newOrder.map(name => {
        const existing = all.find(s => s.name === name);
        return existing || { name, color: this.STATUS_COLORS[name] || '#64748b' };
      });
      await db.settings.put({ key: 'statusPipeline', value: reordered });
    },

    getColor(status) {
      if (!status) return '#64748b';
      if (this.STATUS_COLORS[status]) return this.STATUS_COLORS[status];
      return '#64748b';
    }
  };

  window.ResearchHub.Status = Status;
})();
