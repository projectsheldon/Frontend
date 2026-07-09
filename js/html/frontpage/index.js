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