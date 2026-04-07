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

async function HandleDownload()
{
    const downloadButton = document.getElementById('download-btn');
    if(!downloadButton) return;

    const originalText = downloadButton.textContent;
    downloadButton.innerHTML = '<div class="download-spinner"></div>';
    downloadButton.disabled = true;

    try
    {
        const response = await fetch(await Api.GetLink("manifest"), { cache: 'no-store' });

        if(!response.ok)
        {
            throw new Error(`Manifest request failed with status ${response.status}`);
        }

        const manifest = await response.json();
        const loaderUrl = manifest?.loader_url;

        if(typeof loaderUrl !== 'string' || loaderUrl.length === 0)
        {
            throw new Error('Manifest is missing a valid download_url');
        }

        window.location.assign(loaderUrl);
    } catch(err)
    {
        console.error('Failed to download latest binary:', err);
        alert('Failed to get the latest download. Please try again.');
    } finally
    {
        downloadButton.textContent = originalText;
        downloadButton.disabled = false;
    }
}
const downloadButton = document.getElementById('download-btn');
downloadButton.addEventListener('click', HandleDownload);

async function updateMemberCount()
{
    try
    {
        const apiUrl = await Api.GetApiUrl();
        const res = await fetch(`${apiUrl}/discord/servercount`);
        const data = await res.json();
        const el = document.getElementById('discord-count');
        if(el && data.count !== undefined)
        {
            el.textContent = data.count.toLocaleString();
        }
    } catch(e)
    {
    }
}

updateMemberCount();
setInterval(updateMemberCount, 30000);