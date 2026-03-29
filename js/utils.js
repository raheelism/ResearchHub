window.ResearchHub = window.ResearchHub || {};

(function() {
  const Utils = {
    generateId() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    generateCitationKey(paper) {
      let key = '';
      if (paper.authors && paper.authors.length > 0) {
        const firstAuthor = paper.authors[0];
        if (firstAuthor) {
          const parts = firstAuthor.split(',');
          const lastName = (parts[0] || firstAuthor).trim().replace(/\s+/g, '');
          key += lastName;
        }
      } else {
        key += 'Unknown';
      }
      if (paper.year) {
        key += paper.year;
      }
      if (paper.title) {
        const stopWords = new Set(['a','an','the','of','in','on','at','to','for','and','or','but','with','by','from','is','are','was','were']);
        const words = paper.title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
        const significantWord = words.find(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
        if (significantWord) {
          key += significantWord.charAt(0).toUpperCase() + significantWord.slice(1).toLowerCase();
        }
      }
      return key || 'Paper' + Date.now();
    },

    formatAuthors(authors) {
      if (!authors || authors.length === 0) return 'Unknown';
      if (authors.length === 1) {
        const parts = authors[0].split(',');
        return parts[0].trim();
      }
      if (authors.length <= 3) {
        return authors.map(a => {
          const parts = a.split(',');
          return parts[0].trim();
        }).join(', ');
      }
      const first = authors[0].split(',')[0].trim();
      return first + ' et al.';
    },

    showToast(message, type) {
      type = type || 'info';
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3500);
    },

    debounce(fn, delay) {
      let timer;
      return function() {
        const args = arguments;
        const ctx = this;
        clearTimeout(timer);
        timer = setTimeout(function() {
          fn.apply(ctx, args);
        }, delay);
      };
    },

    formatDate(timestamp) {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    base64ToArrayBuffer(base64) {
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return bytes.buffer;
    },

    arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    },

    downloadFile(content, filename, mimeType) {
      if (window.saveAs) {
        const blob = new Blob([content], { type: mimeType });
        window.saveAs(blob, filename);
      } else {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    },

    sanitizeHTML(str) {
      if (!str) return '';
      // Iteratively apply all replacements until the string stabilizes
      // (prevents bypass via nested/split patterns like <scr<script>ipt>)
      let prev;
      let result = str;
      do {
        prev = result;
        // Remove script elements (open + close, with any whitespace/attrs inside)
        result = result.replace(/<\s*script(?:\s[^>]*)?>[\s\S]*?<\s*\/\s*script(?:\s[^>]*)?>/gi, '');
        // Remove orphan opening script tags
        result = result.replace(/<\s*script(?:\s[^>]*)?>/gi, '');
        // Remove orphan closing script tags
        result = result.replace(/<\s*\/\s*script(?:\s[^>]*)?>/gi, '');
        // Remove event handler attributes
        result = result.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|\S*)/gi, '');
        // Remove javascript: URIs
        result = result.replace(/javascript\s*:/gi, '');
      } while (result !== prev);
      return result;
    },

    truncate(str, len) {
      if (!str) return '';
      if (str.length <= len) return str;
      return str.substring(0, len) + '…';
    },

    escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
  };

  window.ResearchHub.Utils = Utils;
})();
