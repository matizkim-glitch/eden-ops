// js/components/charts.js
// Chart.js configuration wrapper and formatting helpers

(function() {
  const chartComponent = {
    colors: {
      primary: '#006c03',
      primaryLight: '#1f8719',
      secondary: '#805533',
      secondaryLight: '#fdc39a',
      tertiary: '#515c70',
      error: '#ba1a1a',
      grey: '#becab6',
      colorsPalette: ['#006c03', '#805533', '#515c70', '#1f8719', '#fdc39a', '#bcc7dd', '#ba1a1a']
    },

    createLineChart: function(canvasId, labels, data, datasetLabel) {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded!');
        return null;
      }
      
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;

      // Destroy existing chart if it exists to prevent mouseover glitches
      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();

      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: datasetLabel,
            data: data,
            borderColor: this.colors.primary,
            backgroundColor: this.colors.primary + '11', // transparent fill
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    },

    createBarChart: function(canvasId, labels, data, datasetLabel) {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded!');
        return null;
      }

      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;

      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();

      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: datasetLabel,
            data: data,
            backgroundColor: this.colors.primary,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    },

    createDoughnutChart: function(canvasId, labels, data) {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded!');
        return null;
      }

      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;

      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();

      return new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: this.colors.colorsPalette,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10 } }
            }
          }
        }
      });
    }
  };

  window.chartComponent = chartComponent;
})();
