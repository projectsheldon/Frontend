(function() {
    if (window.__ResizableColumnsLoaded) return;
    window.__ResizableColumnsLoaded = true;

    var MIN_PX = 60; // smallest a column may be dragged to (px)

    function attach(tableId, storageKey) {
        const table = typeof tableId === 'string' ? document.getElementById(tableId) : tableId;
        if (!table || table._resizableAttached) return;
        table._resizableAttached = true;

        const key = storageKey || ('cols_' + (table.id || Math.random().toString(36).slice(2, 8)));

        // Generate a colgroup if missing so widths have a target.
        let colgroup = table.querySelector('colgroup');
        if (!colgroup) {
            const headers = table.querySelectorAll('thead th');
            colgroup = document.createElement('colgroup');
            headers.forEach(() => colgroup.appendChild(document.createElement('col')));
            table.insertBefore(colgroup, table.firstChild);
        }

        // Ensure a resizer handle exists on every th except the last.
        const headers = Array.from(table.querySelectorAll('thead th'));
        headers.forEach((th, i) => {
            if (i === headers.length - 1) return;
            if (!th.querySelector('.col-resizer')) {
                const handle = document.createElement('span');
                handle.className = 'col-resizer';
                th.appendChild(handle);
            }
        });

        function cols() { return Array.from(colgroup.querySelectorAll('col')); }

        // Remember defaults so double-click can restore them.
        const initialWidths = cols().map(c => c.style.width || '');

        function saveWidths() {
            const widths = cols().map(c => c.style.width || '');
            try { localStorage.setItem(key, JSON.stringify(widths)); } catch (e) {}
        }

        function restoreWidths() {
            try {
                const saved = JSON.parse(localStorage.getItem(key) || 'null');
                if (!Array.isArray(saved)) return;
                const c = cols();
                saved.forEach((w, i) => {
                    if (w && c[i]) c[i].style.width = w;
                });
            } catch (e) {}
        }

        restoreWidths();

        table.querySelectorAll('th .col-resizer').forEach((handle, idx) => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const c = cols();
                const col = c[idx];
                const nextCol = c[idx + 1];
                if (!col || !nextCol) return;

                const ths = Array.from(table.querySelectorAll('thead th'));
                // Header cells always report correctly, the table box can read 0.
                const tableWidth = ths.reduce((s, th) => s + th.getBoundingClientRect().width, 0) || 1;
                const colPct = (colEl, th) => {
                    const s = colEl.style.width;
                    if (s && s.charAt(s.length - 1) === '%') { const v = parseFloat(s); if (isFinite(v)) return v; }
                    return (th.getBoundingClientRect().width / tableWidth) * 100;
                };
                const startX = e.clientX;
                const startPct = colPct(col, ths[idx]);
                const pairPct = startPct + colPct(nextCol, ths[idx + 1]);
                const minPct = Math.min((MIN_PX / tableWidth) * 100, pairPct / 2);

                handle.classList.add('is-dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                function onMove(ev) {
                    // Trade width with the neighbour, keeping the pair total constant.
                    const deltaPct = ((ev.clientX - startX) / tableWidth) * 100;
                    let newPct = startPct + deltaPct;
                    newPct = Math.max(minPct, Math.min(pairPct - minPct, newPct));
                    col.style.width = newPct.toFixed(3) + '%';
                    nextCol.style.width = (pairPct - newPct).toFixed(3) + '%';
                }
                function onUp() {
                    handle.classList.remove('is-dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    saveWidths();
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            // Double-click resets every column to its default width.
            handle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const c = cols();
                initialWidths.forEach((w, i) => { if (c[i]) c[i].style.width = w; });
                try { localStorage.removeItem(key); } catch (e) {}
            });
        });
    }

    function attachAll(root) {
        (root || document).querySelectorAll('table[data-resizable]').forEach(t => attach(t));
    }

    window.ResizableColumns = { attach, attachAll };

    if (document.readyState !== 'loading') attachAll();
    else document.addEventListener('DOMContentLoaded', () => attachAll());
})();
