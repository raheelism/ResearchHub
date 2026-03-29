window.ResearchHub = window.ResearchHub || {};

(function() {
  const Notes = {
    _saveDebounced: null,

    get(paper) {
      return paper ? (paper.notes || '') : '';
    },

    initAutoSave(paperId, element, indicator) {
      const Papers = window.ResearchHub.Papers;
      const Utils = window.ResearchHub.Utils;

      const save = Utils.debounce(async function() {
        if (indicator) indicator.textContent = 'Saving...';
        try {
          const content = element.innerHTML !== undefined ? element.innerHTML : element.value;
          await Papers.update(paperId, { notes: content });
          if (indicator) indicator.textContent = 'Saved ✓';
          setTimeout(() => {
            if (indicator) indicator.textContent = '';
          }, 2000);
        } catch(e) {
          if (indicator) indicator.textContent = 'Error saving';
        }
      }, 1000);

      element.addEventListener('input', save);

      // Return cleanup function
      return function cleanup() {
        element.removeEventListener('input', save);
      };
    }
  };

  window.ResearchHub.Notes = Notes;
})();
