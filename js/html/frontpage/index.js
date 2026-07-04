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
                    ${product.IsLifetime ? '<span class="text-[10px] font-bold text-[#c7b18f]">★</span>' : ''}
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

function formatBytes(bytes)
{
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

const dlOverlay = document.getElementById('download-overlay');
const dlFill = document.getElementById('dl-fill');
const dlPct = document.getElementById('dl-pct');

const dlTitle = document.getElementById('dl-title');
const dlSub = document.getElementById('dl-sub');
const dlIcon = document.getElementById('dl-icon');
const dlSvg = document.getElementById('dl-svg');
const dlClose = document.getElementById('dl-close');

dlClose.addEventListener('click', () => dlOverlay.classList.remove('show'));

function setDownloadIcon(type)
{
    dlIcon.className = 'modal-icon ' + type;
    if(type === 'done')
    {
        dlSvg.innerHTML = '<path d="M20 6L9 17l-5-5" stroke="#22c55e" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if(type === 'error')
    {
        dlSvg.innerHTML = '<circle cx="12" cy="12" r="10" stroke="#ef4444" fill="none" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>';
    } else
    {
        dlSvg.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';
    }
}

async function HandleDownload()
{
    const downloadButton = document.getElementById('download-btn');
    if(!downloadButton) return;

    const originalText = downloadButton.textContent;
    downloadButton.innerHTML = '<div class="download-spinner"></div>';
    downloadButton.disabled = true;

    dlClose.classList.remove('show');
    dlOverlay.classList.add('show');
    setDownloadIcon('downloading');
    dlTitle.textContent = 'Downloading...';
    dlSub.textContent = 'Preparing download';
    dlFill.style.width = '0%';
    dlPct.textContent = '0%';

    try
    {
        const apiUrl = await Api.GetApiUrl();
        const proxyUrl = apiUrl + '/download/loader';

        const fileRes = await fetch(proxyUrl);
        if(!fileRes.ok)
        {
            const errData = await fileRes.json().catch(() => ({}));
            throw new Error(errData.error || 'HTTP ' + fileRes.status);
        }

        const total = parseInt(fileRes.headers.get('content-length'), 10) || 0;
        const reader = fileRes.body.getReader();
        let received = 0;
        const chunks = [];

        while(true)
        {
            const { done, value } = await reader.read();
            if(done) break;
            if(value)
            {
                chunks.push(value);
                received += value.length;
                if(total > 0)
                {
                    const p = Math.round((received / total) * 100);
                    dlFill.style.width = p + '%';
                    dlPct.textContent = p + '% (' + formatBytes(received) + ' / ' + formatBytes(total) + ')';
                } else
                {
                    dlPct.textContent = formatBytes(received) + ' downloaded';
                    dlFill.style.width = Math.min((received / (1024 * 1024 * 10)) * 100, 95) + '%';
                }
            }
        }

        const blob = new Blob(chunks);

        dlTitle.textContent = 'Extracting...';
        dlSub.textContent = 'Unpacking .7z archive';
        dlFill.style.width = '50%';
        dlPct.textContent = '...';

        const { Archive } = await import('https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/libarchive.js');
        Archive.init({
            workerUrl: './js/lib/worker-bundle.js'
        });

        const archive = await Archive.open(blob);

        const filesObj = await archive.extractFiles();

        function collectFiles(obj, path)
        {
            const entries = [];
            for(const key of Object.keys(obj))
            {
                const val = obj[key];
                const fullPath = path ? path + '/' + key : key;
                if(val instanceof File)
                {
                    entries.push({ file: val, path: fullPath });
                } else if(val && typeof val === 'object')
                {
                    entries.push(...collectFiles(val, fullPath));
                }
            }
            return entries;
        }

        const files = collectFiles(filesObj);

        if(!files || files.length === 0) throw new Error('Archive is empty');

        for(const entry of files)
        {
            const name = entry.path.split('/').pop() || 'output.bin';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(entry.file);
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
        }

        dlOverlay.classList.remove('show');

    } catch(err)
    {
        console.error('Download failed:', err);
        setDownloadIcon('error');
        dlTitle.textContent = 'Failed';
        dlSub.textContent = err.message || 'Something went wrong';
        dlClose.classList.add('show');
    } finally
    {
        downloadButton.textContent = originalText;
        downloadButton.disabled = false;
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