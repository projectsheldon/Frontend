// Dashboard page script
import Api from "../../util/backend.js";
import { DiscordAuth } from "../../discord/auth.js";

let state = {
    data: null,
    filter: 'all',
    range: 14,
    expanded: null
};

const RANGE_SUB = {
    1: 'day', 3: '3 days', 7: 'week', 14: '2 weeks', 30: 'month',
    90: '3 months', 365: 'year', all: 'year'
};

function escapeHtml(s)
{
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// ── Formatting helpers ────────────────────────────────────────────────

function formatDuration(totalSeconds)
{
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    if(s < 60) return '<1 minute';
    const units = [
        [ 31536000, 'year' ],
        [ 2592000, 'month' ],
        [ 604800, 'week' ],
        [ 86400, 'day' ],
        [ 3600, 'hour' ],
        [ 60, 'minute' ]
    ];
    for(const [ secs, name ] of units)
    {
        if(s >= secs)
        {
            const v = Math.floor(s / secs);
            return v + ' ' + name + (v === 1 ? '' : 's');
        }
    }
    return s + ' seconds';
}

function formatDate(ms)
{
    if(!ms || ms <= 0) return 'Unknown';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLastSeen(ts)
{
    if(!ts || ts <= 0) return 'Never';
    const diff = Date.now() - ts;
    if(diff < 60 * 1000) return 'now';
    if(diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + 'm ago';
    if(diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + 'h ago';
    if(diff < 30 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + 'd ago';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function licenseStatus(lic)
{
    if(lic.banned || lic.disabled) return 'disabled';
    if(lic.expires_at !== -1 && Date.now() > lic.expires_at) return 'expired';
    return 'active';
}

function isActiveLicense(lic)
{
    return licenseStatus(lic) === 'active';
}

// ── Profile / stats ───────────────────────────────────────────────────

function setAvatar(imgEl, fallbackEl, avatarUrl, name)
{
    if(avatarUrl)
    {
        imgEl.src = avatarUrl;
        imgEl.style.display = 'block';
        fallbackEl.style.display = 'none';
    }
    else
    {
        fallbackEl.textContent = (name || '?').charAt(0).toUpperCase();
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
    }
}

function renderProfile()
{
    const { user, banned, memberSince, usage, licenses } = state.data;
    const name = user.globalName || user.username || 'Account';

    setAvatar(document.getElementById('dash-avatar'), document.getElementById('dash-avatar-fallback'), user.avatar, name);
    setAvatar(document.getElementById('dash-avatar-lg'), document.getElementById('dash-avatar-lg-fallback'), user.avatar, name);
    document.getElementById('dash-username').textContent = name;
    document.getElementById('dash-summary-name').textContent = name;

    const stats = document.getElementById('dash-stats');
    stats.innerHTML = '';
    const cards = [
        { label: 'Member since', value: formatDate(memberSince), cls: '' },
        { label: 'Total usage', value: formatDuration(usage.totalSeconds), cls: 'gold' },
        { label: 'Licenses', value: String(licenses.length), cls: '' },
        { label: 'Status', value: banned ? 'Banned' : 'Not banned', cls: banned ? 'red' : 'green' }
    ];
    cards.forEach(card =>
    {
        const el = document.createElement('div');
        el.className = 'dash-stat';

        const label = document.createElement('div');
        label.className = 'dash-stat-label';
        label.textContent = card.label;

        const value = document.createElement('div');
        value.className = 'dash-stat-value' + (card.cls ? ' ' + card.cls : '');
        value.textContent = card.value;

        el.appendChild(label);
        el.appendChild(value);
        stats.appendChild(el);
    });
}

function renderWeekly()
{
    const { usage } = state.data;
    const card = document.getElementById('dash-weekly-card');
    if(!usage.thresholdSeconds || usage.thresholdSeconds <= 0) { card.style.display = 'none'; return; }

    const seconds = Math.max(0, Number(usage.weeklySeconds) || 0);
    const threshold = usage.thresholdSeconds;
    const pct = Math.min(100, Math.round((seconds / threshold) * 100));
    const hours = Math.floor(seconds / 3600);
    const thresholdHours = Math.round(threshold / 3600);
    const remaining = Math.max(0, thresholdHours - hours);
    const note = pct >= 100
        ? 'Milestone reached — a free key is ready!'
        : `Use Sheldon ${remaining} more hour${remaining === 1 ? '' : 's'} this week for a free key.`;

    document.getElementById('dash-weekly-count').textContent = `${hours} / ${thresholdHours} hours`;
    document.getElementById('dash-weekly-fill').style.width = pct + '%';
    document.getElementById('dash-weekly-note').textContent = note;
    card.style.display = 'block';
}

// ── Chart (copy of the admin statistics chart) ────────────────────────

function chartHours(daily)
{
    // Map API daily entries (seconds) to whole hours for the chart.
    return (daily || []).map(d => ({
        ts: d.ts,
        date: d.date,
        label: d.label,
        count: Math.round((Number(d.seconds) || 0) / 3600),
        sessions: d.sessions || 0
    }));
}

function barChartHtml(daily, getSub, opts)
{
    const max = Math.max(...daily.map(d => d.count), 1);
    const min = Math.min(...daily.map(d => d.count));
    const hasData = daily.some(d => d.count > 0);
    const last = daily.length - 1;
    const bars = daily.map((d, i) =>
    {
        const h = d.count > 0 ? Math.max((d.count / max) * 100, 4) : 0;
        const cls = d.count > 0 ? 'bar' : 'bar bar-empty';
        const today = d.count > 0 && i === last && opts?.highlightLast !== false ? ' bar-today' : '';
        const sub = typeof getSub === 'function' ? getSub(d) : '';
        return `
            <div class="bar-col">
                <div class="${cls}${today}" style="height:0" data-h="${h.toFixed(1)}" data-label="${escapeHtml(d.label)}" data-count="${escapeHtml(d.count + 'h')}"${d.ts ? ` data-ts="${d.ts}"` : ''}${d.date ? ` data-date="${escapeHtml(d.date)}"` : ''}${sub ? ` data-sub="${escapeHtml(sub)}"` : ''}></div>
            </div>
        `;
    }).join('');
    return `
        <div class="stats-chart">
            ${hasData ? `<span class="chart-max">Peak: ${max}h · Lowest: ${min}h</span>` : ''}
            <span class="chart-gridline" style="top:25%"></span>
            <span class="chart-gridline" style="top:50%"></span>
            <span class="chart-gridline" style="top:75%"></span>
            <span class="chart-gridline chart-gridline-base"></span>
            ${bars}
        </div>
    `;
}

function animateBars(container)
{
    if(!container) return;
    const bars = container.querySelectorAll('.bar');
    requestAnimationFrame(() => requestAnimationFrame(() =>
    {
        bars.forEach(bar =>
        {
            bar.style.height = (bar.dataset.h || '0') + '%';
        });
    }));
}

let barTooltipEl = null;

function getBarTooltip()
{
    if(!barTooltipEl)
    {
        barTooltipEl = document.createElement('div');
        barTooltipEl.className = 'bar-tooltip';
        document.body.appendChild(barTooltipEl);
        document.addEventListener('scroll', hideBarTooltip, true);
        document.addEventListener('resize', hideBarTooltip);
    }
    return barTooltipEl;
}

function moveBarTooltip(e)
{
    const tip = getBarTooltip();
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 12;
    let y = e.clientY - r.height - 10;
    if(x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 12;
    if(y < 8) y = e.clientY + 12;
    if(y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
}

function showBarTooltip(e)
{
    const bar = e.currentTarget.querySelector('.bar') || e.currentTarget;
    const tip = getBarTooltip();
    tip.innerHTML =
        (bar.dataset.label ? `<p class="bar-tooltip-label">${escapeHtml(bar.dataset.label)}</p>` : '') +
        `<p class="bar-tooltip-count">${escapeHtml(bar.dataset.count || '0')}</p>` +
        (bar.dataset.sub ? `<p class="bar-tooltip-sub">${escapeHtml(bar.dataset.sub)}</p>` : '');
    tip.style.opacity = '1';
    tip.style.visibility = 'visible';
    moveBarTooltip(e);
}

function hideBarTooltip()
{
    if(barTooltipEl)
    {
        barTooltipEl.style.opacity = '0';
        barTooltipEl.style.visibility = 'hidden';
    }
}

function bindChartTooltips(container, onClick)
{
    if(!container) return;
    container.querySelectorAll('.bar-col').forEach(col =>
    {
        const bar = col.querySelector('.bar');
        if(!bar) return;
        col.addEventListener('mousemove', moveBarTooltip);
        col.addEventListener('mouseenter', showBarTooltip);
        col.addEventListener('mouseleave', hideBarTooltip);
        if(typeof onClick === 'function' && !bar.classList.contains('bar-empty'))
        {
            col.addEventListener('click', () => onClick(bar));
        }
    });
}

function fmtHour(h)
{
    return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

function hourlyItems(hourly)
{
    const ordered = hourly.slice(1).concat(hourly[0]);
    return ordered.map((n, idx) => ({
        label: fmtHour((idx + 1) % 24),
        count: Math.round((Number(n.seconds) || 0) / 3600)
    }));
}

function dateRangeText(daily)
{
    if(!Array.isArray(daily) || daily.length === 0 || !daily.some(d => d.count > 0)) return 'No data yet.';
    const first = daily[0].label;
    const last = daily[daily.length - 1].label;
    return first === last ? first : `${first} – ${last}`;
}

function emptyStateHtml(text)
{
    return `
        <div class="chart-empty">
            <div class="flex flex-col items-center gap-2 text-center px-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-600"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <p class="text-xs text-neutral-500">${escapeHtml(text)}</p>
            </div>
        </div>
    `;
}

function hourlyWrapHtml(label, items)
{
    return `
        <div class="hourly-wrap">
            <div class="flex items-center justify-between gap-3 pb-2 mb-1 border-b border-white/10">
                <span class="text-xs text-neutral-400 font-mono">${escapeHtml(label)} &mdash; hourly</span>
                <button class="hourly-back flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors">← back</button>
            </div>
            ${barChartHtml(items, null, { highlightLast: false })}
        </div>
    `;
}

async function expandHourly(ts, bar)
{
    const el = document.getElementById('dash-activity-chart');
    if(!el || !ts) return;
    if(state.expanded && state.expanded.ts === ts)
    {
        collapseHourly();
        return;
    }
    const dateStr = (bar && bar.dataset && bar.dataset.date) || '';
    if(!dateStr) return;
    const dayLabel = bar.dataset.label || dateStr;
    let hourly = null;
    try
    {
        const data = await loadDashboard({ day: dateStr });
        hourly = (data.activity && data.activity.hourly) || null;
    } catch(e) { return; }
    if(!Array.isArray(hourly)) return;
    const items = hourlyItems(hourly);
    hideBarTooltip();
    el.innerHTML = hourlyWrapHtml(dayLabel, items);
    bindChartTooltips(el, () => collapseHourly());
    el.querySelector('.hourly-back')?.addEventListener('click', () => collapseHourly());
    animateBars(el);
    state.expanded = { ts: Number(ts) };
}

function collapseHourly()
{
    const el = document.getElementById('dash-activity-chart');
    state.expanded = null;
    if(!el) return;
    hideBarTooltip();
    renderChart(el);
}

function renderChart(el)
{
    const daily = chartHours(state.data.activity.daily);
    if(daily.length === 0)
    {
        el.innerHTML = emptyStateHtml('No activity yet.');
        document.getElementById('dash-activity-date-range').textContent = 'No data yet.';
        document.getElementById('dash-activity-labels').innerHTML = '';
        return;
    }
    el.innerHTML = barChartHtml(daily, d => d.count > 0
        ? `${d.count}h · ${d.sessions} session${d.sessions === 1 ? '' : 's'}`
        : '');
    bindChartTooltips(el, bar => expandHourly(Number(bar.dataset.ts), bar));
    animateBars(el);

    const rangeText = dateRangeText(daily);
    document.getElementById('dash-activity-date-range').textContent =
        rangeText === 'No data yet.' ? rangeText : `${rangeText} · EU/Athens`;

    const labels = document.getElementById('dash-activity-labels');
    labels.innerHTML = `<span>${escapeHtml(daily[0].label)}</span><span>${escapeHtml(daily[daily.length - 1].label)}</span>`;
}

// ── Licenses tab ──────────────────────────────────────────────────────

const copyIcon = `<svg class="copy-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="check-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

function copyKey(btn, val)
{
    const done = () =>
    {
        btn.classList.add('success');
        setTimeout(() => btn.classList.remove('success'), 1200);
    };
    if(navigator.clipboard && navigator.clipboard.writeText)
    {
        navigator.clipboard.writeText(val).then(done).catch(() => fallbackCopy(val, done));
    }
    else
    {
        fallbackCopy(val, done);
    }
}

function fallbackCopy(val, done)
{
    const el = document.createElement('textarea');
    el.value = val;
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el);
    done();
}

function renderLicenses()
{
    const list = document.getElementById('dash-license-list');
    if(!list || !state.data) return;

    const licenses = state.data.licenses || [];
    const filtered = licenses.filter(l =>
    {
        if(state.filter === 'active') return isActiveLicense(l);
        if(state.filter === 'inactive') return !isActiveLicense(l);
        return true;
    }).sort((a, b) =>
    {
        const sa = isActiveLicense(a) ? 0 : 1;
        const sb = isActiveLicense(b) ? 0 : 1;
        if(sa !== sb) return sa - sb;
        return (b.created_at || 0) - (a.created_at || 0);
    });

    list.innerHTML = '';
    if(filtered.length === 0)
    {
        const p = document.createElement('p');
        p.className = 'text-neutral-500 text-sm py-6 text-center';
        p.textContent = licenses.length === 0 ? 'No licenses found.' : 'No licenses match this filter.';
        list.appendChild(p);
        return;
    }

    filtered.forEach(lic =>
    {
        const item = document.createElement('div');
        item.className = 'license-item';

        // Header: key + status + copy
        const head = document.createElement('div');
        head.className = 'license-item-head';

        const key = document.createElement('div');
        key.className = 'license-item-key';
        key.textContent = lic.key;

        const badge = document.createElement('span');
        const status = licenseStatus(lic);
        badge.className = 'license-status ' + status;
        badge.textContent = status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Disabled';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copy Key';
        copyBtn.dataset.key = lic.key;
        copyBtn.innerHTML = copyIcon + checkIcon;
        copyBtn.addEventListener('click', function() { copyKey(this, this.dataset.key); });

        head.appendChild(key);
        head.appendChild(badge);
        head.appendChild(copyBtn);
        item.appendChild(head);

        // Meta grid: product / expires / created / last activity
        const grid = document.createElement('div');
        grid.className = 'license-item-grid';
        const metas = [
            { label: 'Product', value: lic.product || 'License' },
            { label: 'Expires', value: lic.expires_at === -1 ? 'Never' : formatDate(lic.expires_at) },
            { label: 'Created', value: formatDate(lic.created_at) },
            { label: 'Last activity', value: formatLastSeen(lic.last_activity) }
        ];
        metas.forEach(m =>
        {
            const box = document.createElement('div');
            box.className = 'license-meta';

            const lbl = document.createElement('div');
            lbl.className = 'license-meta-label';
            lbl.textContent = m.label;

            const val = document.createElement('div');
            val.className = 'license-meta-value';
            val.textContent = m.value;

            box.appendChild(lbl);
            box.appendChild(val);
            grid.appendChild(box);
        });
        item.appendChild(grid);
        list.appendChild(item);
    });
}

// ── Data loading ──────────────────────────────────────────────────────

async function loadDashboard(extra)
{
    const token = DiscordAuth.GetSessionToken();
    const user = await DiscordAuth.GetUser();
    if(!token || !user) return null;

    const body = {
        discordId: user.id,
        loginToken: token,
        days: String(state.range)
    };
    if(extra && extra.day) body.day = extra.day;

    const apiUrl = await Api.GetApiUrl();
    const response = await fetch(`${apiUrl}/auth/dashboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if(!data.ok) throw new Error(data.message || 'Failed to load dashboard');
    return data;
}

function showError(message)
{
    const chart = document.getElementById('dash-activity-chart');
    if(chart) chart.innerHTML = emptyStateHtml(message || 'Failed to load. Refresh to try again.');
    const list = document.getElementById('dash-license-list');
    if(list)
    {
        list.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'text-neutral-500 text-sm py-6 text-center';
        p.textContent = message || 'Failed to load.';
        list.appendChild(p);
    }
}

async function loadAll()
{
    const chart = document.getElementById('dash-activity-chart');
    try
    {
        const data = await loadDashboard();
        if(!data)
        {
            window.location.href = '/';
            return;
        }
        state.data = data;
        renderProfile();
        renderWeekly();
        renderChart(chart);
        renderLicenses();
    } catch(e)
    {
        console.error('Dashboard load failed:', e);
        showError();
    }
}

// ── Init ──────────────────────────────────────────────────────────────

window.onload = () =>
{
    if(typeof initParticles === 'function')
    {
        initParticles();
    }
    if(!DiscordAuth.GetSessionToken())
    {
        window.location.href = '/';
        return;
    }
    loadAll();
};

document.querySelectorAll('.dash-nav-item').forEach(btn =>
{
    btn.addEventListener('click', () =>
    {
        document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-overview').classList.toggle('hidden', tab !== 'overview');
        document.getElementById('tab-licenses').classList.toggle('hidden', tab !== 'licenses');
    });
});

document.querySelectorAll('.dash-filter-btn').forEach(btn =>
{
    btn.addEventListener('click', () =>
    {
        document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderLicenses();
    });
});

document.getElementById('dash-activity-range').addEventListener('change', async function()
{
    const raw = this.value;
    state.range = raw === 'all' ? 'all' : (parseInt(raw, 10) || 14);
    state.expanded = null;
    document.getElementById('dash-activity-sub').textContent =
        `Your activity over the last ${RANGE_SUB[state.range]}.`;
    const chart = document.getElementById('dash-activity-chart');
    chart.innerHTML = '<div class="chart-empty"><p class="text-xs text-neutral-500">Loading...</p></div>';
    try
    {
        const data = await loadDashboard();
        if(!data) { window.location.href = '/'; return; }
        state.data = data;
        renderChart(chart);
        renderLicenses();
    } catch(e)
    {
        showError();
    }
});