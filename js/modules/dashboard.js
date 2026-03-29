window.ResearchHub = window.ResearchHub || {};

(function() {
  const Dashboard = {
    _charts: {},

    async render(container) {
      if (!container) return;
      const Papers = window.ResearchHub.Papers;
      const Status = window.ResearchHub.Status;
      const Tags = window.ResearchHub.Tags;

      const papers = await Papers.getAll();
      this._destroyCharts();

      const now = new Date();
      const thisMonth = papers.filter(p => {
        if (!p.createdAt) return false;
        const d = new Date(p.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      const statusCounts = {};
      papers.forEach(p => {
        const s = p.status || 'Collected';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const allTags = Tags.getAll(papers);
      const topTag = allTags.length > 0 ? allTags[0].tag : 'None';

      const topStatuses = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      container.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${papers.length}</div>
            <div class="stat-label">Total Papers</div>
          </div>
          ${topStatuses.map(([status, count]) => `
            <div class="stat-card">
              <div class="stat-icon" style="color:${Status.getColor(status)}">●</div>
              <div class="stat-value">${count}</div>
              <div class="stat-label">${status}</div>
            </div>
          `).join('')}
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value">${thisMonth}</div>
            <div class="stat-label">Added This Month</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏷️</div>
            <div class="stat-value">${topTag}</div>
            <div class="stat-label">Top Tag</div>
          </div>
        </div>
        <div class="charts-grid">
          <div class="card chart-card">
            <h3>Status Distribution</h3>
            <div class="chart-wrapper"><canvas id="chart-status"></canvas></div>
          </div>
          <div class="card chart-card">
            <h3>Papers Added Over Time</h3>
            <div class="chart-wrapper"><canvas id="chart-timeline"></canvas></div>
          </div>
          <div class="card chart-card">
            <h3>Top Tags</h3>
            <div class="chart-wrapper"><canvas id="chart-tags"></canvas></div>
          </div>
        </div>
      `;

      if (typeof Chart !== 'undefined' && papers.length > 0) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        Chart.defaults.color = textColor;

        const statusData = this._statusDistribution(papers);
        if (statusData.labels.length > 0) {
          const ctx1 = document.getElementById('chart-status');
          if (ctx1) {
            this._charts.status = new Chart(ctx1, {
              type: 'doughnut',
              data: {
                labels: statusData.labels,
                datasets: [{ data: statusData.data, backgroundColor: statusData.colors, borderWidth: 2 }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: textColor } } }
              }
            });
          }
        }

        const timeData = this._papersOverTime(papers);
        const ctx2 = document.getElementById('chart-timeline');
        if (ctx2) {
          this._charts.timeline = new Chart(ctx2, {
            type: 'line',
            data: {
              labels: timeData.labels,
              datasets: [{
                label: 'Papers Added',
                data: timeData.data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: isDark ? '#334155' : '#e2e8f0' } },
                x: { ticks: { color: textColor }, grid: { color: isDark ? '#334155' : '#e2e8f0' } }
              },
              plugins: { legend: { labels: { color: textColor } } }
            }
          });
        }

        const tagsData = this._tagsFrequency(papers);
        if (tagsData.labels.length > 0) {
          const ctx3 = document.getElementById('chart-tags');
          if (ctx3) {
            this._charts.tags = new Chart(ctx3, {
              type: 'bar',
              data: {
                labels: tagsData.labels,
                datasets: [{
                  label: 'Papers',
                  data: tagsData.data,
                  backgroundColor: '#3b82f6',
                  borderRadius: 4
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                  x: { beginAtZero: true, ticks: { color: textColor }, grid: { color: isDark ? '#334155' : '#e2e8f0' } },
                  y: { ticks: { color: textColor }, grid: { color: 'transparent' } }
                },
                plugins: { legend: { display: false } }
              }
            });
          }
        }
      } else if (papers.length === 0) {
        const chartsGrid = container.querySelector('.charts-grid');
        if (chartsGrid) {
          chartsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Add papers to see analytics</p></div>';
        }
      }
    },

    _statusDistribution(papers) {
      const Status = window.ResearchHub.Status;
      const counts = {};
      papers.forEach(p => {
        const s = p.status || 'Collected';
        counts[s] = (counts[s] || 0) + 1;
      });
      const labels = Object.keys(counts);
      const data = labels.map(l => counts[l]);
      const colors = labels.map(l => Status.getColor(l));
      return { labels, data, colors };
    },

    _papersOverTime(papers) {
      const months = [];
      const counts = {};
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        months.push({ key, label });
        counts[key] = 0;
      }
      papers.forEach(p => {
        if (!p.createdAt) return;
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (counts.hasOwnProperty(key)) counts[key]++;
      });
      return {
        labels: months.map(m => m.label),
        data: months.map(m => counts[m.key])
      };
    },

    _tagsFrequency(papers) {
      const Tags = window.ResearchHub.Tags;
      const all = Tags.getAll(papers).slice(0, 10);
      return {
        labels: all.map(t => t.tag),
        data: all.map(t => t.count)
      };
    },

    _destroyCharts() {
      Object.values(this._charts).forEach(c => {
        try { c.destroy(); } catch(e) {}
      });
      this._charts = {};
    }
  };

  window.ResearchHub.Dashboard = Dashboard;
})();
