// js/components/table.js
// Handles dynamic, filterable, and sortable table rendering

(function() {
  const tableComponent = {
    render: function(containerId, headers, rows, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (!rows || rows.length === 0) {
        window.modalComponent.showEmptyState(
          container,
          options.emptyMessage || 'No records found.',
          options.emptyActionText,
          options.emptyActionCallback
        );
        return;
      }

      // Base layout structure
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'overflow-x-auto w-full';

      const table = document.createElement('table');
      table.className = 'w-full text-left border-collapse';

      // Header
      const thead = document.createElement('thead');
      thead.className = 'bg-surface-container';

      const headerRow = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.className = 'px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider cursor-pointer select-none';
        th.textContent = String(h.label ?? '');

        // Add click listener if sorting enabled
        if (options.sortable && h.key) {
          th.addEventListener('click', () => {
            const currentSort = options.sortKey === h.key && options.sortOrder === 'asc' ? 'desc' : 'asc';
            if (options.onSort) {
              options.onSort(h.key, currentSort);
            }
          });
          // Visual sort indicators
          if (options.sortKey === h.key) {
            th.appendChild(document.createTextNode(options.sortOrder === 'asc' ? ' asc' : ' desc'));
          }
        }

        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body
      const tbody = document.createElement('tbody');
      tbody.className = 'divide-y divide-outline-variant';

      rows.forEach((row, rIdx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-low transition-colors';

        if (options.onRowClick) {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => options.onRowClick(row));
        }

        headers.forEach(h => {
          const td = document.createElement('td');
          td.className = 'px-md py-md font-body-md text-body-md';

          const rawVal = row[h.key];

          if (h.render) {
            // Custom cell renderer
            td.textContent = String(h.render(rawVal, row, rIdx) ?? '');
          } else {
            td.textContent = rawVal !== undefined && rawVal !== null ? String(rawVal) : '-';
          }
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      tableWrapper.appendChild(table);

      container.textContent = '';
      container.appendChild(tableWrapper);
    }
  };

  window.tableComponent = tableComponent;
})();
