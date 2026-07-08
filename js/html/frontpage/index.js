import Api from "../../util/backend.js";
import { Product, ProductsManager } from "../../payment/products/manager.js";

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
const dlContent = document.getElementById('dl-content');
const dlUrl = document.getElementById('dl-url');
const dlCopy = document.getElementById('dl-copy');
const dlClose = document.getElementById('dl-close-modal');
const dlError = document.getElementById('dl-error');
const dlCloseError = document.getElementById('dl-close-error');

if(dlModal)
{
    function closeModal()
    {
        dlModal.classList.remove('show');
    }

    dlClose?.addEventListener('click', closeModal);
    dlCloseError?.addEventListener('click', closeModal);
    dlModal.addEventListener('click', (e) => { if(e.target === dlModal) closeModal(); });

    dlCopy?.addEventListener('click', async () =>
    {
        try
        {
            await navigator.clipboard.writeText(dlUrl.value);
            dlCopy.textContent = 'Copied';
            dlCopy.classList.add('copied');
            setTimeout(() => { dlCopy.textContent = 'Copy'; dlCopy.classList.remove('copied'); }, 2000);
        } catch {}
    });
}

function triggerDownload(url)
{
    // Best-effort auto-start. Popup blockers may stop this after the await, but the modal
    // still shows the copyable link as a fallback.
    try
    {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch(e) {}
}

async function HandleDownload()
{
    const loggedIn = !!(window.DiscordAuth && window.DiscordAuth.currentUser);

    // Logged-out visitors just get the Discord invite. The download link is never fetched
    // (or exposed) unless there is a valid session.
    if(!loggedIn)
    {
        RedirectToPlatform('discord_invite');
        return;
    }

    if(!dlModal) return;

    dlModal.classList.add('show');
    dlLoader.style.display = 'block';
    dlTitle.style.display = 'block';
    dlSub.style.display = 'block';
    dlContent.style.display = 'none';
    dlError.style.display = 'none';
    dlCloseError.style.display = 'none';
    dlTitle.textContent = 'Getting link...';
    dlSub.textContent = 'Fetching latest download';

    try
    {
        const token = window.DiscordAuth?.GetSessionToken?.();
        const apiUrl = await Api.GetApiUrl();

        // Auth-gated: the server only returns the URL for a valid Discord session.
        const res = await fetch(`${apiUrl}/download/url`, {
            mode: 'cors',
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if(res.status === 401) throw new Error('Please log in again to download.');
        if(!res.ok) throw new Error('Failed to get download link');

        const data = await res.json();
        const url = data && data.ok ? data.url : null;
        if(!url) throw new Error('No download link available');

        dlLoader.style.display = 'none';
        dlTitle.style.display = 'none';
        dlSub.style.display = 'none';
        dlContent.style.display = 'block';
        dlUrl.value = url;

        triggerDownload(url);
    } catch(err)
    {
        dlLoader.style.display = 'none';
        dlTitle.style.display = 'none';
        dlSub.style.display = 'none';
        dlError.textContent = err.message || 'Failed to get download link';
        dlError.style.display = 'block';
        dlCloseError.style.display = 'inline-block';
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