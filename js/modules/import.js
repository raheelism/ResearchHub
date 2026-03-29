window.ResearchHub = window.ResearchHub || {};

(function() {
  const Import = {
    async bibtex(text) {
      const BibTeX = window.ResearchHub.BibTeX;
      const Papers = window.ResearchHub.Papers;
      const db = window.ResearchHub.db;

      const parsed = BibTeX.parse(text);
      let imported = 0, skipped = 0;
      const errors = [];

      for (const paper of parsed) {
        try {
          // Check for duplicate by DOI or citation key
          if (paper.doi) {
            const existing = await db.papers.where('doi').equals(paper.doi).first();
            if (existing) { skipped++; continue; }
          }
          if (paper.citationKey) {
            const existing = await db.papers.where('citationKey').equals(paper.citationKey).first();
            if (existing) { skipped++; continue; }
          }
          await Papers.add(paper);
          imported++;
        } catch(e) {
          errors.push(e.message || String(e));
        }
      }
      return { imported, skipped, errors, total: parsed.length };
    },

    async ris(text) {
      const Papers = window.ResearchHub.Papers;
      const db = window.ResearchHub.db;

      const records = [];
      const lines = text.split('\n');
      let current = null;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // RIS format: "TAG  - value"
        const match = line.match(/^([A-Z][A-Z0-9])\s{1,2}-\s{0,2}(.*)/);
        if (!match) continue;

        const tag = match[1];
        const value = match[2].trim();

        if (tag === 'TY') {
          current = { type: value, authors: [] };
          records.push(current);
        } else if (tag === 'ER') {
          current = null;
        } else if (current) {
          switch(tag) {
            case 'TI': case 'T1': current.title = value; break;
            case 'AU': case 'A1': current.authors.push(value); break;
            case 'PY': case 'Y1': current.year = parseInt(value) || null; break;
            case 'JO': case 'JF': case 'T2': case 'BT': current.venue = value; break;
            case 'DO': current.doi = value; break;
            case 'AB': case 'N2': current.abstract = (current.abstract || '') + (current.abstract ? ' ' : '') + value; break;
            case 'KW': if (!current.keywords) current.keywords = []; current.keywords.push(value); break;
            case 'UR': if (!current.doi) current.url = value; break;
            case 'VL': current.volume = value; break;
            case 'SP': current.pages = value; break;
          }
        }
      }

      let imported = 0, skipped = 0;
      const errors = [];

      for (const rec of records) {
        if (!rec.title) { skipped++; continue; }
        try {
          if (rec.doi) {
            const existing = await db.papers.where('doi').equals(rec.doi).first();
            if (existing) { skipped++; continue; }
          }
          await Papers.add({
            title: rec.title || '',
            authors: rec.authors || [],
            year: rec.year || null,
            venue: rec.venue || '',
            doi: rec.doi || '',
            abstract: rec.abstract || '',
            keywords: rec.keywords || [],
            status: 'Collected'
          });
          imported++;
        } catch(e) {
          errors.push(e.message || String(e));
        }
      }
      return { imported, skipped, errors, total: records.length };
    },

    async csv(text) {
      const Papers = window.ResearchHub.Papers;
      const db = window.ResearchHub.db;

      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = result.data;
      let imported = 0;
      const errors = [];

      for (const row of rows) {
        try {
          // Normalize column names (case insensitive)
          const get = (keys) => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
              if (found && row[found]) return row[found];
            }
            return '';
          };

          const title = get(['title']);
          if (!title) continue;

          const authorsRaw = get(['authors', 'author']);
          const authors = authorsRaw ? authorsRaw.split(/[;,]\s*(?=[A-Z])|\s+and\s+/).map(a => a.trim()).filter(Boolean) : [];
          const keywordsRaw = get(['keywords', 'keyword']);
          const keywords = keywordsRaw ? keywordsRaw.split(/[;,]/).map(k => k.trim()).filter(Boolean) : [];
          const tagsRaw = get(['tags', 'tag']);
          const tags = tagsRaw ? tagsRaw.split(/[;,]/).map(t => t.trim()).filter(Boolean) : [];
          const yearRaw = get(['year']);
          const year = yearRaw ? parseInt(yearRaw) || null : null;

          const doi = get(['doi']);
          if (doi) {
            const existing = await db.papers.where('doi').equals(doi).first();
            if (existing) { continue; }
          }

          await Papers.add({
            title,
            authors,
            year,
            venue: get(['venue', 'journal', 'booktitle', 'publisher']),
            doi,
            abstract: get(['abstract']),
            keywords,
            tags,
            status: get(['status']) || 'Collected',
            priority: get(['priority']) || ''
          });
          imported++;
        } catch(e) {
          errors.push(e.message || String(e));
        }
      }
      return { imported, errors, total: rows.length };
    },

    async fromDOI(doi) {
      const Papers = window.ResearchHub.Papers;
      doi = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');

      const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('DOI not found or network error');
      const data = await res.json();
      const item = data.message;

      const title = (item.title && item.title[0]) || '';
      const authors = (item.author || []).map(a => {
        const parts = [];
        if (a.family) parts.push(a.family);
        if (a.given) parts.push(a.given);
        if (parts.length === 2) return parts[0] + ', ' + parts[1];
        return parts.join(' ');
      }).filter(Boolean);
      const year = item.published && item.published['date-parts'] && item.published['date-parts'][0]
        ? item.published['date-parts'][0][0]
        : null;
      const venue = (item['container-title'] && item['container-title'][0]) || '';
      let abstract = item.abstract || '';
      // Strip HTML tags safely: remove all tags iteratively until none remain
      let prev = '';
      while (prev !== abstract) {
        prev = abstract;
        abstract = abstract.replace(/<[^>]*>/g, '');
      }
      abstract = abstract.trim();

      const paper = await Papers.add({
        title,
        authors,
        year,
        venue,
        doi: item.DOI || doi,
        abstract,
        status: 'Collected'
      });
      return paper;
    },

    async backup(jsonText) {
      const db = window.ResearchHub.db;
      const Papers = window.ResearchHub.Papers;
      const Collections = window.ResearchHub.Collections;

      let data;
      try {
        data = JSON.parse(jsonText);
      } catch(e) {
        throw new Error('Invalid JSON backup file');
      }

      let papersImported = 0, papersSkipped = 0;
      let collectionsImported = 0;

      if (data.papers && Array.isArray(data.papers)) {
        for (const paper of data.papers) {
          const existing = paper.id ? await db.papers.get(paper.id) : null;
          if (existing) {
            papersSkipped++;
          } else {
            // Check by DOI
            let dupe = false;
            if (paper.doi) {
              const byDoi = await db.papers.where('doi').equals(paper.doi).first();
              if (byDoi) { dupe = true; }
            }
            if (!dupe) {
              await db.papers.put(paper);
              papersImported++;
            } else {
              papersSkipped++;
            }
          }
        }
      }

      if (data.collections && Array.isArray(data.collections)) {
        for (const col of data.collections) {
          const existing = col.id ? await db.collections.get(col.id) : null;
          if (!existing) {
            await db.collections.put(col);
            collectionsImported++;
          }
        }
      }

      if (data.settings && Array.isArray(data.settings)) {
        for (const setting of data.settings) {
          await db.settings.put(setting);
        }
      }

      if (data.extractionTemplates && Array.isArray(data.extractionTemplates)) {
        for (const tmpl of data.extractionTemplates) {
          await db.extractionTemplates.put(tmpl);
        }
      }

      return { papersImported, papersSkipped, collectionsImported };
    }
  };

  window.ResearchHub.Import = Import;
})();
