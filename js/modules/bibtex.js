window.ResearchHub = window.ResearchHub || {};

(function() {
  const BibTeX = {
    parse(text) {
      const papers = [];
      // Remove line comments (% to end of line), but only outside braces
      const lines = text.split('\n');
      const cleanedLines = lines.map(line => {
        let inBrace = 0;
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '{' && !inQuote) inBrace++;
          else if (c === '}' && !inBrace && !inQuote) { /* ignore unbalanced */ }
          else if (c === '}' && !inQuote) inBrace--;
          else if (c === '"' && inBrace === 0) inQuote = !inQuote;
          else if (c === '%' && inBrace === 0 && !inQuote) {
            return line.substring(0, i);
          }
        }
        return line;
      });
      text = cleanedLines.join('\n');

      let pos = 0;
      while (pos < text.length) {
        const atIdx = text.indexOf('@', pos);
        if (atIdx === -1) break;
        pos = atIdx + 1;

        // Read type
        let typeEnd = pos;
        while (typeEnd < text.length && /[a-zA-Z]/.test(text[typeEnd])) typeEnd++;
        const entryType = text.substring(pos, typeEnd).toLowerCase();
        pos = typeEnd;

        const validTypes = ['article','inproceedings','conference','book','misc','techreport','phdthesis','mastersthesis','preprint','incollection','unpublished','proceedings','manual','booklet'];
        if (!validTypes.includes(entryType)) continue;

        // Skip whitespace
        while (pos < text.length && /\s/.test(text[pos])) pos++;
        if (pos >= text.length || text[pos] !== '{') continue;
        pos++; // skip '{'

        // Find the matching closing brace using brace counting
        let depth = 1;
        let entryStart = pos;
        let i = pos;
        while (i < text.length && depth > 0) {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') depth--;
          i++;
        }
        if (depth !== 0) { pos = i; continue; }
        const entryContent = text.substring(entryStart, i - 1);
        pos = i;

        // Parse citation key (first thing before first comma)
        const commaIdx = entryContent.indexOf(',');
        if (commaIdx === -1) continue;
        const citationKey = entryContent.substring(0, commaIdx).trim();
        const fieldsText = entryContent.substring(commaIdx + 1);

        const fields = this._parseFields(fieldsText);
        const paper = this._entryToPaper(entryType, citationKey, fields);
        papers.push(paper);
      }
      return papers;
    },

    _parseFields(fieldsText) {
      const fields = {};
      let pos = 0;
      const text = fieldsText;

      while (pos < text.length) {
        // Skip whitespace and commas
        while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
        if (pos >= text.length) break;

        // Read field name
        let nameEnd = pos;
        while (nameEnd < text.length && /[a-zA-Z0-9_\-]/.test(text[nameEnd])) nameEnd++;
        if (nameEnd === pos) { pos++; continue; }
        const fieldName = text.substring(pos, nameEnd).toLowerCase().trim();
        pos = nameEnd;

        // Skip whitespace
        while (pos < text.length && /\s/.test(text[pos])) pos++;
        if (pos >= text.length || text[pos] !== '=') { continue; }
        pos++; // skip '='

        // Skip whitespace
        while (pos < text.length && /\s/.test(text[pos])) pos++;
        if (pos >= text.length) break;

        // Read value
        let value = '';
        if (text[pos] === '{') {
          // Brace-delimited value
          let depth = 1;
          pos++; // skip opening {
          let valueStart = pos;
          while (pos < text.length && depth > 0) {
            if (text[pos] === '{') depth++;
            else if (text[pos] === '}') depth--;
            if (depth > 0) pos++;
            else pos++;
          }
          value = text.substring(valueStart, pos - 1);
        } else if (text[pos] === '"') {
          // Quote-delimited value
          pos++; // skip opening "
          let valueStart = pos;
          let escaped = false;
          while (pos < text.length) {
            if (escaped) { escaped = false; pos++; continue; }
            if (text[pos] === '\\') { escaped = true; pos++; continue; }
            if (text[pos] === '"') break;
            pos++;
          }
          value = text.substring(valueStart, pos);
          pos++; // skip closing "
        } else {
          // Bare value (number or string without delimiters)
          let valueStart = pos;
          while (pos < text.length && text[pos] !== ',' && text[pos] !== '\n' && text[pos] !== '}') pos++;
          value = text.substring(valueStart, pos).trim();
        }

        if (fieldName) {
          fields[fieldName] = value;
        }
      }
      return fields;
    },

    _parseSingleField(val) {
      if (!val) return '';
      val = val.trim();
      if (val.startsWith('{') && val.endsWith('}')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      return val.trim();
    },

    _parseAuthors(authorStr) {
      if (!authorStr) return [];
      const parts = authorStr.split(/\s+and\s+/i);
      return parts.map(author => {
        author = author.trim();
        if (!author) return null;
        if (author.indexOf(',') !== -1) {
          return author;
        }
        // "First Last" format -> try to convert
        const words = author.split(/\s+/);
        if (words.length === 1) return author;
        const last = words[words.length - 1];
        const first = words.slice(0, -1).join(' ');
        return last + ', ' + first;
      }).filter(Boolean);
    },

    _entryToPaper(entryType, citationKey, fields) {
      const title = fields.title || '';
      const authors = this._parseAuthors(fields.author || '');
      const year = parseInt(fields.year) || null;
      const venue = fields.journal || fields.booktitle || fields.publisher || fields.school || '';
      const doi = fields.doi || fields.url || '';
      const abstract = fields.abstract || '';
      const keywordsRaw = fields.keywords || fields.keyword || '';
      const keywords = keywordsRaw ? keywordsRaw.split(/[,;]/).map(k => k.trim()).filter(Boolean) : [];

      return {
        title,
        authors,
        year,
        venue,
        doi: doi.replace(/^https?:\/\/doi\.org\//i, '').trim(),
        abstract,
        keywords,
        citationKey,
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
        extractionMeta: {
          volume: fields.volume || '',
          number: fields.number || '',
          pages: fields.pages || '',
          entryType
        }
      };
    },

    export(papers) {
      if (!papers || papers.length === 0) return '';
      const entries = papers.map(p => this._paperToEntry(p));
      return entries.join('\n\n');
    },

    _paperToEntry(paper) {
      let entryType = 'misc';
      if (paper.venue) {
        const v = paper.venue.toLowerCase();
        if (v.includes('journal') || v.includes('proceedings') === false) {
          entryType = 'article';
        } else if (v.includes('conference') || v.includes('proceedings') || v.includes('workshop') || v.includes('symposium')) {
          entryType = 'inproceedings';
        } else {
          entryType = 'article';
        }
      }

      const key = paper.citationKey || 'paper' + (paper.id || '').substring(0, 8);
      const authorsStr = (paper.authors || []).join(' and ');
      const keywordsStr = (paper.keywords || []).join(', ');

      const lines = [`@${entryType}{${key},`];
      if (paper.title) lines.push(`  title = {${paper.title}},`);
      if (authorsStr) lines.push(`  author = {${authorsStr}},`);
      if (paper.year) lines.push(`  year = {${paper.year}},`);
      if (paper.venue) {
        if (entryType === 'article') lines.push(`  journal = {${paper.venue}},`);
        else if (entryType === 'inproceedings') lines.push(`  booktitle = {${paper.venue}},`);
        else lines.push(`  publisher = {${paper.venue}},`);
      }
      if (paper.doi) lines.push(`  doi = {${paper.doi}},`);
      if (paper.abstract) lines.push(`  abstract = {${paper.abstract.replace(/[{}]/g, '')}},`);
      if (keywordsStr) lines.push(`  keywords = {${keywordsStr}},`);
      if (paper.extractionMeta) {
        if (paper.extractionMeta.volume) lines.push(`  volume = {${paper.extractionMeta.volume}},`);
        if (paper.extractionMeta.pages) lines.push(`  pages = {${paper.extractionMeta.pages}},`);
      }
      // Remove trailing comma from last field
      if (lines.length > 1) {
        lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
      }
      lines.push('}');
      return lines.join('\n');
    }
  };

  window.ResearchHub.BibTeX = BibTeX;
})();
