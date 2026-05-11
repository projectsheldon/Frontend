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
    const ticketSection = document.getElementById('ticket-section');
    if(ticketSection) ticketSection.style.display = 'none';
    
    TogglePaymentForm(true);
    await LoadProductInfo();
    
    // Show purchase ticket section for non-free products
    if(productKey !== 'free')
    {
        if(ticketSection) ticketSection.style.display = 'block';
        await CheckResellerStatus();
    }
}

async function CheckResellerStatus() {
    const token = DiscordAuth.GetSessionToken();
    if (!token) return;

    try {
        localStorage.removeItem('cache_is_reseller');
        const response = await fetch(`${await Api.GetApiUrl()}/resellers/is-reseller`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
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
        const nameEl = document.getElementById('product-name');
        if(nameEl) nameEl.textContent = 'Free Key';

        const sidebar = document.querySelector('.sidebar');
        if(sidebar)
        {
            const subtotalRow = document.getElementById('subtotal-price')?.parentElement;
            if(subtotalRow) subtotalRow.style.display = 'none';
            const discountRow = document.getElementById('discount-row');
            if(discountRow) discountRow.style.display = 'none';
            const totalEl = document.getElementById('final-total-price');
            if(totalEl) totalEl.textContent = `${window.quantity}.0 Balance`;
            const couponSection = document.getElementById('coupon-section');
            if(couponSection) couponSection.style.display = 'none';
        }

        await ShowBalanceCheckout();
        return;
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
    
    SetupTicketButton();
}

function SetupTicketButton()
{
    const createBtn = document.getElementById('create-ticket-btn');
    if(!createBtn) return;

    createBtn.addEventListener('click', async function()
    {
        const statusEl = document.getElementById('ticket-status');
        const originalText = createBtn.innerHTML;
        
        createBtn.disabled = true;
        createBtn.innerHTML = '<div class="download-spinner" style="border-top-color: #000;"></div> Creating...';
        if(statusEl) { statusEl.style.display = 'none'; }

        try
        {
            const token = window.DiscordAuth?.GetSessionToken();
            if(!token)
            {
                if(statusEl)
                {
                    statusEl.style.cssText = 'display: block; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
                    statusEl.textContent = 'You must be logged in to create a ticket.';
                }
                return;
            }

            const apiUrl = await Api.GetApiUrl();
            const qty = parseInt(document.getElementById('qty-value')?.value || '1', 10);

            const res = await fetch(`${apiUrl}/discord/create-purchase-ticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    product: productKey,
                    quantity: qty,
                    is_personal_use: window.personalUse || false,
                    coupon_code: window.couponCode || undefined
                })
            });

            const data = await res.json();

            if(data.ok)
            {
                createBtn.innerHTML = 'Ticket Created';
                createBtn.style.background = 'rgba(34,197,94,0.2)';
                createBtn.style.color = '#22c55e';
                createBtn.style.cursor = 'default';
            }
            else
            {
                if(statusEl)
                {
                    statusEl.style.cssText = 'display: block; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
                    statusEl.textContent = data.message || 'Failed to create ticket.';
                }
                createBtn.innerHTML = originalText;
                createBtn.disabled = false;
            }
        }
        catch(err)
        {
            const statusEl = document.getElementById('ticket-status');
            if(statusEl)
            {
                statusEl.style.cssText = 'display: block; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
                statusEl.textContent = 'Failed to create ticket. Please try again.';
            }
            createBtn.innerHTML = originalText;
            createBtn.disabled = false;
        }
    });
}

async function ShowBalanceCheckout()
{
    const authToken = DiscordAuth.GetSessionToken();
    if(!authToken) return;

    const apiUrl = await Api.GetApiUrl();
    const authHeaders = { 'Authorization': `Bearer ${authToken}` };

    try
    {
        const response = await fetch(`${apiUrl}/discord/balance`, {
            headers: authHeaders,
            credentials: 'include'
        });
        const data = await response.json();

        if(!data.ok) return;

        const balance = data.balance || 0;
        const adRewardBalance = data.ad_reward_balance || 0.1;
        const freeKeyCost = data.free_key_cost || 1.0;
        const noCooldown = data.no_cooldown ? true : false;

        let durationHours = 4.5;
        try
        {
            const productRes = await fetch(`${apiUrl}/products/get?product=free`);
            const productData = await productRes.json();
            if(productData && productData.duration) durationHours = productData.duration;
        }
        catch(e) {}

        const workinkLink = await Api.GetLink('workink');

        function renderCheckout()
        {
            const qty = window.quantity || 1;
            const totalCost = qty * freeKeyCost;
            const canAfford = balance >= totalCost;

            const paymentForm = document.getElementById('payment-form');
            if(!paymentForm) return;

            paymentForm.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; width: 100%; text-align: center; gap: 24px;">
                    <div style="font-size: 22px; font-weight: 700; color: #e8d5b8;">Pay with your Balance</div>

                    <div style="font-size: 14px; color: rgba(255,255,255,0.6); max-width: 80%; line-height: 1.2; margin-top: -20px;">
                        Redeem your balance for ${qty} x ${durationHours} hours key${qty > 1 ? 's' : ''}
                    </div>

                    <button id="purchase-balance-btn" class="btn-action" style="max-width: 300px; padding-top: 17px; padding-bottom: 17px; ${canAfford ? '' : 'opacity: 0.5; cursor: not-allowed;'}" ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? `PURCHASE KEY${qty > 1 ? 'S' : ''}` : 'Insufficient Balance'}
                    </button>

                    <a href="${workinkLink}" style="font-size: 13px; color: #c7b18f; text-decoration: underline;">
                        ${noCooldown ? 'Watch Ads for 1 Free Key' : `Watch Ads for +${adRewardBalance} balance`}
                    </a>
                </div>
            `;

            const totalEl = document.getElementById('final-total-price');
            if(totalEl) totalEl.textContent = `${totalCost.toFixed(1)} Balance`;

            const purchaseBtn = document.getElementById('purchase-balance-btn');
            if(purchaseBtn && canAfford)
            {
                purchaseBtn.addEventListener('click', async () =>
                {
                    purchaseBtn.disabled = true;
                    purchaseBtn.textContent = 'Processing...';

                    try
                    {
                        const purchaseRes = await fetch(`${apiUrl}/discord/purchase-free-key`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authHeaders },
                            credentials: 'include',
                            body: JSON.stringify({ quantity: qty })
                        });
                        const purchaseData = await purchaseRes.json();

                        if(purchaseData.ok)
                        {
                            try { localStorage.removeItem('cache_licenses'); } catch(e) {}

                            if(purchaseData.licenses && purchaseData.licenses.length > 0)
                            {
                                const params = purchaseData.licenses.map(l =>
                                    `${encodeURIComponent(l.key)}:${encodeURIComponent(l.product || 'License')}`
                                ).join(',');
                                window.location.href = `/license/?showKeys=${params}`;
                            }
                            else
                            {
                                window.location.href = '/license/';
                            }
                        }
                        else
                        {
                            alert(purchaseData.message || 'Purchase failed');
                            purchaseBtn.disabled = false;
                            purchaseBtn.textContent = `PURCHASE ${qty} KEY${qty > 1 ? 'S' : ''} (${totalCost.toFixed(1)} Balance)`;
                        }
                    }
                    catch(err)
                    {
                        alert('Purchase failed');
                        purchaseBtn.disabled = false;
                        purchaseBtn.textContent = `PURCHASE ${qty} KEY${qty > 1 ? 'S' : ''} (${totalCost.toFixed(1)} Balance)`;
                    }
                });
            }
        }

        renderCheckout();

        // Re-render on quantity change
        const qtyMinus = document.getElementById('qty-minus');
        const qtyPlus = document.getElementById('qty-plus');
        const qtyValue = document.getElementById('qty-value');
        const rerender = () => setTimeout(renderCheckout, 50);
        if(qtyMinus) qtyMinus.addEventListener('click', rerender);
        if(qtyPlus) qtyPlus.addEventListener('click', rerender);
        if(qtyValue) qtyValue.addEventListener('change', rerender);
    }
    catch(error)
    {
        console.error('Failed to load balance:', error);
    }
}
