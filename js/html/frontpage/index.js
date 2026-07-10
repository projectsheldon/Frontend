import Api from "../../util/backend.js";
import { Product, ProductsManager } from "../../payment/products/manager.js";
import { extractArchive, buildDeliverable, saveBlob } from "../../util/installer.js";

// Only run tab logic on homepage
const isHomepage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');

if (isHomepage) {
    // tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    navTabs.forEach(tab =>
    {
        tab.addEventListener('click', (e) =>
        {
            const href = tab.getAttribute('href');
            if(!href || href === '#') {
                e.preventDefault();
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                return;
            }
            
            const targetPath = new URL(href, window.location.origin).pathname.replace(/\/$/, '') || '/';
            
            if(targetPath === currentPath) {
                e.preventDefault();
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            }
        });
    });
}

// pricing
const productsContainer = document.getElementById('products-grid');

async function LoadProducts()
{
    if(!productsContainer) return;

    const products = await ProductsManager.FetchProducts();

    productsContainer.innerHTML = '';

    products.forEach((product, index) =>
    {
        let cardClass = 'glass-card p-5 rounded-2xl flex flex-col justify-between h-full min-h-[200px]';
        if(product.IsLifetime) cardClass += ' border border-[#c7b18f]/40';

        const staggerClass = `stagger-${Math.min(index + 1, 4)}`;

        const html = `
            <div class="${cardClass} animate-on-scroll ${staggerClass}" style="transition-delay: ${index * 0.1}s;">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-[#c7b18f]">${product.FormatDuration()}</span>
                    ${product.IsFree
                    ? '<span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/40">Free</span>'
                    : product.IsLifetime ? '<span class="text-[10px] font-bold text-[#c7b18f]">★</span>' : ''}
                </div>
                <div class="text-center py-4">
                    <span class="text-4xl font-black text-white">${product.FormatPrice()}</span>
                </div>
                <button class="product-btn w-full py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all ${product.IsFree
                ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                : 'bg-[#c7b18f] hover:bg-[#b59f7d] text-black'
            }" data-product="${product.key}">
                    ${product.IsFree ? 'GET KEY' : 'BUY NOW'}
                </button>
            </div>
        `;

        productsContainer.insertAdjacentHTML('beforeend', html);
    });

    document.querySelectorAll('.product-btn').forEach(btn =>
    {
        btn.addEventListener('click', function()
        {
            const productKey = this.getAttribute('data-product');
            window.location.href = `/checkout/?product=${productKey}`;
        });
    });

    if(window.animateOnScrollObserver)
    {
        document.querySelectorAll('#products-grid .glass-card').forEach(el =>
        {
            window.animateOnScrollObserver.observe(el);
        });
    }
}
document.addEventListener('DOMContentLoaded', LoadProducts);

const dlModal = document.getElementById('download-modal');
const dlLoader = document.getElementById('dl-loader');
const dlTitle = document.getElementById('dl-title');
const dlSub = document.getElementById('dl-sub');
const dlProgressWrap = document.getElementById('dl-progress-wrap');
const dlProgressBar = document.getElementById('dl-progress-bar');
const dlActions = document.getElementById('dl-actions');
const dlSaveAgain = document.getElementById('dl-save-again');
const dlClose = document.getElementById('dl-close-modal');
const dlError = document.getElementById('dl-error');
const dlErrorActions = document.getElementById('dl-error-actions');
const dlFallback = document.getElementById('dl-fallback');
const dlCloseError = document.getElementById('dl-close-error');

let _lastDeliverable = null;   // { blob, name } — retained so "Save file" can re-save
let _installing = false;       // guards against overlapping installs

function dlClearState()
{
    dlLoader.style.display = 'none';
    dlTitle.style.display = 'none';
    dlSub.style.display = 'none';
    if(dlProgressWrap) dlProgressWrap.style.display = 'none';
    if(dlActions) dlActions.style.display = 'none';
    dlError.style.display = 'none';
    if(dlErrorActions) dlErrorActions.style.display = 'none';
}

function dlShowLoading(title, sub)
{
    dlClearState();
    dlModal.classList.add('show');
    dlLoader.style.display = 'block';
    dlTitle.style.display = 'block';
    dlSub.style.display = 'block';
    dlTitle.textContent = title;
    dlSub.textContent = sub;
}

function dlSetProgress(pct)
{
    dlTitle.textContent = 'Downloading…';
    dlSub.textContent = pct + '%';
    if(dlProgressWrap) dlProgressWrap.style.display = 'block';
    if(dlProgressBar) dlProgressBar.style.width = pct + '%';
}

function dlShowDone(name)
{
    dlClearState();
    dlTitle.style.display = 'block';
    dlSub.style.display = 'block';
    dlTitle.textContent = 'Installer ready ✓';
    dlSub.textContent = 'Saved "' + name + '" to your downloads. If it didn\'t start, tap Save file.';
    if(dlActions) dlActions.style.display = 'flex';
}

function dlShowError(msg)
{
    dlClearState();
    dlError.textContent = msg;
    dlError.style.display = 'block';
    if(dlErrorActions) dlErrorActions.style.display = 'flex';
}

if(dlModal)
{
    const closeModal = () => dlModal.classList.remove('show');
    dlClose?.addEventListener('click', closeModal);
    dlCloseError?.addEventListener('click', closeModal);
    dlModal.addEventListener('click', (e) => { if(e.target === dlModal) closeModal(); });

    dlSaveAgain?.addEventListener('click', () =>
    {
        if(_lastDeliverable) saveBlob(_lastDeliverable.blob, _lastDeliverable.name);
    });

    // Last resort: if in-browser install fails, hand over the raw .7z link (same auth gate)
    // so the user is never stuck with no way to get the file.
    dlFallback?.addEventListener('click', async () =>
    {
        try
        {
            const token = window.DiscordAuth?.GetSessionToken?.();
            const apiUrl = await Api.GetApiUrl();
            const res = await fetch(`${apiUrl}/download/url`, {
                mode: 'cors', credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            const data = await res.json().catch(() => null);
            if(data && data.ok && data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
        } catch(e) {}
    });
}

async function readWithProgress(res, onPct)
{
    const total = Number(res.headers.get('Content-Length')) || 0;
    if(!res.body || !total)
    {
        const buf = new Uint8Array(await res.arrayBuffer());
        onPct(100);
        return buf;
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while(true)
    {
        const { done, value } = await reader.read();
        if(done) break;
        chunks.push(value);
        received += value.length;
        onPct(Math.min(99, Math.floor((received / total) * 100)));
    }

    const out = new Uint8Array(received);
    let pos = 0;
    for(const c of chunks) { out.set(c, pos); pos += c.length; }
    onPct(100);
    return out;
}

async function HandleDownload()
{
    const loggedIn = !!(window.DiscordAuth && window.DiscordAuth.currentUser);

    // Logged-out visitors just get the Discord invite. Nothing about the download is fetched
    // or exposed without a valid session.
    if(!loggedIn)
    {
        RedirectToPlatform('discord_invite');
        return;
    }

    if(!dlModal || _installing) return;
    _installing = true;
    _lastDeliverable = null;

    dlShowLoading('Preparing…', 'Starting secure download');

    try
    {
        const token = window.DiscordAuth?.GetSessionToken?.();
        const apiUrl = await Api.GetApiUrl();

        // 1) Pull the raw installer bytes through the auth-gated proxy (CORS-enabled).
        const res = await fetch(`${apiUrl}/download/bytes`, {
            mode: 'cors',
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if(res.status === 401) throw new Error('Please log in again to download.');
        if(!res.ok) throw new Error('Download failed. Please try again.');

        const bytes = await readWithProgress(res, dlSetProgress);

        // 2) Extract the .7z fully client-side — the user needs no 7-Zip tool.
        dlShowLoading('Extracting…', 'Unpacking the installer');
        const files = await extractArchive(bytes);

        // 3) Hand over ready-to-use files: the .exe directly, or a native .zip if several.
        const deliverable = buildDeliverable(files);
        _lastDeliverable = deliverable;
        saveBlob(deliverable.blob, deliverable.name);

        dlShowDone(deliverable.name);
    }
    catch(err)
    {
        dlShowError((err && err.message) ? err.message : 'Installation failed. Please try again.');
    }
    finally
    {
        _installing = false;
    }
}

document.getElementById('download-btn')?.addEventListener('click', HandleDownload);

function getCachedServerCount() {
    try {
        const raw = localStorage.getItem('cache_server_count');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < 600000) return item.data;
        localStorage.removeItem('cache_server_count');
    } catch (e) {}
    return null;
}

function setCachedServerCount(count) {
    try {
        localStorage.setItem('cache_server_count', JSON.stringify({ data: count, timestamp: Date.now() }));
    } catch (e) {}
}

async function updateMemberCount()
{
    try
    {
        const cached = getCachedServerCount();
        const el = document.getElementById('discord-count');
        if (cached) {
            if (el) el.textContent = cached.toLocaleString();
            return;
        }

        const apiUrl = await Api.GetApiUrl();
        const res = await fetch(`${apiUrl}/discord/servercount`);
        const data = await res.json();
        if(el && data.count !== undefined)
        {
            el.textContent = data.count.toLocaleString();
            setCachedServerCount(data.count);
        }
    } catch(e)
    {
    }
}

updateMemberCount();
setInterval(updateMemberCount, 600000);

// ─── WorkInk reward claim, handled inline on the homepage ────────────────────────────
// When WorkInk redirects here with ?token=… (point its destination at
// https://www.projectsheldon.me/?token= instead of /license/?token=), we claim the reward
// right here and play the balance gain animation — no hop through the /license page.

function claimFingerprint()
{
    try
    {
        let fp = localStorage.getItem('sheldon_fp');
        if(!fp)
        {
            fp = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            localStorage.setItem('sheldon_fp', fp);
        }
        return fp;
    } catch(e) { return null; }
}

// Resolve once the user is logged in (session token + profile loaded), or null on timeout.
function waitForLogin(timeoutMs)
{
    return new Promise(resolve =>
    {
        const start = Date.now();
        (function check()
        {
            const st = window.DiscordAuth?.GetSessionToken?.();
            if(st && window.DiscordAuth?.currentUser) return resolve(st);
            if(Date.now() - start > timeoutMs) return resolve(null);
            setTimeout(check, 300);
        })();
    });
}

// Fire the existing homepage balance-gain animation (global fn from index.html) once the
// balance chip is on screen.
function playBalanceGain(added, oldBalance)
{
    if(!(added > 0)) return;
    const poll = setInterval(() =>
    {
        const el = document.querySelector('.user-balance');
        if(el && el.offsetParent !== null)
        {
            clearInterval(poll);
            setTimeout(() => { try { window.animateBalanceGain(added, oldBalance); } catch(e) {} }, 600);
        }
    }, 100);
    setTimeout(() => clearInterval(poll), 10000);
}

// Minimal, XSS-safe modal for the rare usage-reward free key.
function showRewardKey(key, product)
{
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:2rem;max-width:420px;width:90%;text-align:center;';
    const title = document.createElement('div');
    title.textContent = 'Free key unlocked';
    title.style.cssText = 'font-size:1rem;font-weight:800;color:#22c55e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    const sub = document.createElement('div');
    sub.textContent = product || 'License';
    sub.style.cssText = 'font-size:0.7rem;color:#666;margin-bottom:1.25rem;';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:1rem;';
    const input = document.createElement('input');
    input.type = 'text'; input.readOnly = true; input.value = key;
    input.style.cssText = 'flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:0.75rem 1rem;color:#c7b18f;font-size:0.8rem;letter-spacing:1px;outline:none;';
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'background:rgba(199,177,143,0.12);border:1px solid rgba(199,177,143,0.2);color:#c7b18f;border-radius:12px;padding:0 1rem;font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'padding:0.5rem 1.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#888;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;';
    wrap.append(input, copyBtn);
    box.append(title, sub, wrap, closeBtn);
    overlay.append(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    copyBtn.addEventListener('click', async () =>
    {
        try { await navigator.clipboard.writeText(String(key)); copyBtn.textContent = 'Copied'; } catch(e) {}
    });
    if(window.confetti) { try { window.confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } }); } catch(e) {} }
}

async function claimWorkinkToken()
{
    const params = new URLSearchParams(location.search);
    let token = params.get('token');

    if(token)
    {
        // Stash it so it survives a full-page login redirect, then strip it from the URL so a
        // refresh can't re-submit a single-use token.
        try { sessionStorage.setItem('pending_workink_token', token); } catch(e) {}
        history.replaceState({}, '', location.pathname + location.hash);
    }
    else
    {
        try { token = sessionStorage.getItem('pending_workink_token'); } catch(e) {}
    }
    if(!token) return;

    let sessionToken = await waitForLogin(4000);
    if(!sessionToken)
    {
        if(typeof window.Notify === 'function') window.Notify('Log in with Discord to claim your reward.', 'info', 5000);
        try { window.DiscordAuth?.LoginPopup?.(); } catch(e) {}
        sessionToken = await waitForLogin(180000);
        if(!sessionToken) return;
    }

    // About to consume the token — clear the stash so it can't loop.
    try { sessionStorage.removeItem('pending_workink_token'); } catch(e) {}

    try
    {
        const apiUrl = await Api.GetApiUrl();
        const discordId = window.DiscordAuth?.currentUser?.id || null;

        // Form-urlencoded = a CORS simple request (no preflight), so it works behind the
        // Cloudflare challenge — same reason the /license page was switched over.
        const body = new URLSearchParams();
        body.set('token', token);
        if(discordId) body.set('discordId', discordId);
        body.set('sessionToken', sessionToken);
        const fp = claimFingerprint();
        if(fp) body.set('fingerprint', fp);

        const res = await fetch(`${apiUrl}/workink/generate`, { method: 'POST', body });
        const data = await res.json().catch(() => null);

        if(data && data.ok && data.license)
        {
            showRewardKey(data.license.key, data.license.product);
        }
        else if(data && data.ok && data.new_balance !== undefined)
        {
            const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
            const oldBalance = Math.max(0, data.new_balance - added);
            if(added > 0) playBalanceGain(added, oldBalance);
            if(data.capped && typeof window.Notify === 'function')
                window.Notify('Daily balance maxed — come back later.', 'info', 5000);
            else if(added <= 0 && typeof window.Notify === 'function')
                window.Notify('Balance updated.', 'success', 3000);
        }
        else if((res.status === 429 || (data && data.rate_limited_until)))
        {
            if(typeof window.Notify === 'function')
                window.Notify((data && data.message) || 'Daily limit reached — try again later.', 'warning', 6000);
        }
        else if(data && data.message)
        {
            if(typeof window.Notify === 'function') window.Notify(data.message, 'error', 5000);
        }
    }
    catch(e)
    {
        if(typeof window.Notify === 'function') window.Notify('Could not claim your reward. Please try again.', 'error', 5000);
    }
}

claimWorkinkToken();