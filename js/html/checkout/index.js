import { CheckAuthStatus, DiscordAuth } from "../../discord/auth.js";
import { initStripe } from "../../payment/stripe/stripe.js";
import Api from "../../util/backend.js";

window.Api = Api;

const urlParams = new URLSearchParams(window.location.search);
const productKey = urlParams.get('product') || 'lifetime';
window.productKey = productKey;

const loginRequiredEl = document.getElementById('login-required');
const paymentFormEl = document.getElementById('payment-form');
const personalUseSection = document.getElementById('personal-use-section');

document.addEventListener("DOMContentLoaded", async function()
{
    const isLoggedIn = await CheckAuthStatus();

    if(isLoggedIn)
    {
        await ShowCheckout();
        return;
    }

    ShowLoginForm();
});

async function ShowCheckout()
{
    // Hide ticket text by default
    const ticketText = document.getElementById('ticket-text');
    if(ticketText) ticketText.style.display = 'none';
    
    TogglePaymentForm(true);
    await LoadProductInfo();
    
    // Only show ticket text for non-free products
    if(productKey !== 'free')
    {
        if(ticketText) ticketText.style.display = 'block';
        await CheckResellerStatus();
    }
}

function getCachedResellerStatus() {
    try {
        const raw = localStorage.getItem('cache_is_reseller');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < 600000) return item.data;
        localStorage.removeItem('cache_is_reseller');
    } catch (e) {}
    return null;
}

function setCachedResellerStatus(data) {
    try {
        localStorage.setItem('cache_is_reseller', JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {}
}

async function CheckResellerStatus() {
    const token = DiscordAuth.GetSessionToken();
    if (!token) return;

    const cached = getCachedResellerStatus();
    if (cached) {
        if (cached.ok && cached.isReseller) {
            window.isReseller = true;
            if (personalUseSection) {
                personalUseSection.classList.remove('hidden');
                const checkbox = document.getElementById('personal-use-checkbox');
                if (checkbox) checkbox.checked = window.personalUse;
            }
            await window.fetchPriceFromApi();
        }
        return;
    }
    
    try {
        const response = await fetch(`${await Api.GetApiUrl()}/resellers/is-reseller`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setCachedResellerStatus(data);
        
        if (data.ok && data.isReseller) {
            window.isReseller = true;
            if (personalUseSection) {
                personalUseSection.classList.remove('hidden');
                const checkbox = document.getElementById('personal-use-checkbox');
                if (checkbox) {
                    checkbox.checked = window.personalUse;
                }
            }
            await window.fetchPriceFromApi();
        }
    } catch (error) {
    }
}

function ShowLoginForm()
{
    TogglePaymentForm(false);

    const loginBtn = loginRequiredEl?.querySelector('.discord-login-btn');
    if(loginBtn)
    {
        loginBtn.addEventListener('click', () =>
        {
            window.DiscordAuth.LoginPopup();
        });
    }

    window.addEventListener('message', async function handleLogin(event)
    {
        if(event.data && event.data.type === 'discord_session')
        {
            window.DiscordAuth.SetSessionToken(event.data.token);
            const isLoggedIn = await CheckAuthStatus();

            if(isLoggedIn)
            {
                window.removeEventListener('message', handleLogin);
                await ShowCheckout();
            }
        }
    });
}
function TogglePaymentForm(enabled)
{
    if(loginRequiredEl) loginRequiredEl.style.display = enabled ? 'none' : 'flex';
    if(paymentFormEl) paymentFormEl.style.display = enabled ? 'flex' : 'none';
}

async function LoadProductInfo()
{
    if(productKey === "free")
    {
        window.location.href = await Api.GetLink("workink");

        // const nameEl = document.getElementById('product-name');
        // if(nameEl) nameEl.textContent = '4.5H Free Key (Balance)';
        
        // const qtyRow = document.getElementById('qty-row') || document.querySelector('[style*="Amount"]')?.parentElement?.parentElement;
        // const sidebar = document.querySelector('.sidebar');
        // if(sidebar)
        // {
        //     const subtotalEl = document.getElementById('subtotal-price');
        //     const discountRow = document.getElementById('discount-row');
        //     const finalTotalEl = document.getElementById('final-total-price');
        //     if(subtotalEl) subtotalEl.parentElement.style.display = 'none';
        //     if(discountRow) discountRow.style.display = 'none';
        //     if(finalTotalEl) finalTotalEl.parentElement.style.display = 'none';
        // }
        
        // // Show balance-based UI
        // await ShowBalanceCheckout();
        // return;
    }

    const nameEl = document.getElementById('product-name');
    const priceEl = document.getElementById('final-price');

    try
    {
        const response = await fetch(`${await Api.GetApiUrl()}/products/get?product=${productKey}`);
        const product = await response.json();

        if(product && product.name)
        {
            if(nameEl) nameEl.textContent = product.name;
            if(priceEl) priceEl.textContent = '€' + parseFloat(product.price).toFixed(2);
            window.basePrice = parseFloat(product.price) || 0;
            await window.fetchPriceFromApi();
        }
    } catch(error)
    {
        console.error('Failed to load product:', error);
    }
}

async function ShowBalanceCheckout()
{
    // Fetch user balance
    const token = DiscordAuth.GetSessionToken();
    if(!token) return;

    try
    {
        const response = await fetch(`${await Api.GetApiUrl()}/discord/balance?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        
        if(!data.ok) return;

        const balance = data.balance || 0;
        const lastWorkinkTime = data.last_workink_time || 0;
        const now = Date.now();
        const THIRTY_TWO_HOURS = 32 * 60 * 60 * 1000;
        const canWorkink = (now - lastWorkinkTime) >= THIRTY_TWO_HOURS;

        // Update the main content area
        const paymentForm = document.getElementById('payment-form');
        if(paymentForm)
        {
            paymentForm.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; width: 100%; text-align: center; gap: 20px;">
                    <div style="font-size: 48px; font-weight: 800; color: #c7b18f;">${balance.toFixed(1)}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;">Current Balance</div>
                    
                    <div style="width: 100%; max-width: 300px; height: 1px; background: rgba(255,255,255,0.1); margin: 10px 0;"></div>
                    
                    <div style="font-size: 14px; color: white; font-weight: 700;">Cost: <span style="color: #c7b18f;">1.0 Balance</span> per 4.5H Key</div>
                    
                    <button id="purchase-balance-btn" class="btn-action" style="max-width: 300px; ${balance < 1.0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${balance < 1.0 ? 'disabled' : ''}>
                        ${balance >= 1.0 ? 'PURCHASE KEY (1.0 Balance)' : 'Insufficient Balance'}
                    </button>
                    
                    <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 10px; max-width: 300px;">
                        ${canWorkink 
                            ? 'You can farm ads now to get +0.1 balance and a 4.5H key!' 
                            : `Next farm available in ${Math.ceil((THIRTY_TWO_HOURS - (now - lastWorkinkTime)) / 1000 / 60)} minutes`
                        }
                    </div>
                    
                    <a href="${await Api.GetLink('workink')}" style="font-size: 11px; color: #c7b18f; text-decoration: underline; margin-top: 5px;">
                        Farm ads now (get 4.5H key + 0.1 balance)
                    </a>
                </div>
            `;

            // Add purchase button handler
            const purchaseBtn = document.getElementById('purchase-balance-btn');
            if(purchaseBtn && balance >= 1.0)
            {
                purchaseBtn.addEventListener('click', async () => {
                    purchaseBtn.disabled = true;
                    purchaseBtn.textContent = 'Processing...';
                    
                    try
                    {
                        const purchaseRes = await fetch(`${await Api.GetApiUrl()}/discord/purchase-free-key?token=${encodeURIComponent(token)}`, {
                            method: 'POST'
                        });
                        const purchaseData = await purchaseRes.json();
                        
                        if(purchaseData.ok)
                        {
                            // Show success
                            paymentForm.innerHTML = `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; width: 100%; text-align: center; gap: 20px;">
                                    <svg class="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                    <h2 style="font-size: 20px; font-weight: 800; color: white;">Key Purchased!</h2>
                                    <div style="font-size: 12px; color: rgba(255,255,255,0.5);">Your key: <span style="color: #c7b18f; font-weight: 700;">${purchaseData.license.key}</span></div>
                                    <div style="font-size: 12px; color: rgba(255,255,255,0.4);">New Balance: ${purchaseData.new_balance.toFixed(1)}</div>
                                    <button onclick="location.reload()" class="btn-action" style="max-width: 300px;">Back</button>
                                </div>
                            `;
                        }
                        else
                        {
                            alert(purchaseData.message || 'Purchase failed');
                            purchaseBtn.disabled = false;
                            purchaseBtn.textContent = 'PURCHASE KEY (1.0 Balance)';
                        }
                    }
                    catch(err)
                    {
                        alert('Purchase failed');
                        purchaseBtn.disabled = false;
                        purchaseBtn.textContent = 'PURCHASE KEY (1.0 Balance)';
                    }
                });
            }
        }
        
        // Hide the ticket text for free product
        const ticketText = document.querySelector('h1');
        if(ticketText && ticketText.textContent.includes('discord server'))
        {
            ticketText.style.display = 'none';
        }
    }
    catch(error)
    {
        console.error('Failed to load balance:', error);
    }
}
