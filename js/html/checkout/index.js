import { CheckAuthStatus, DiscordAuth } from "../../discord/auth.js";
import PaypalManager from "../../payment/paypal/manager.js";
import { CreatePaypalButtons } from "../../payment/paypal/paypal.js";
import Api from "../../util/backend.js";

const urlParams = new URLSearchParams(window.location.search);
const productKey = urlParams.get('product') || 'lifetime';

window.selectedCurrency = 'BTC';
window.quantity = 1;
window.basePrice = 0;
window.isReseller = false;
window.personalUse = true;

window.calculateDiscount = function() {
    if (!window.isReseller || window.personalUse || window.quantity <= 4) {
        return 0;
    }
    return window.basePrice * window.quantity * 0.24;
}

window.getFinalTotal = function() {
    const subtotal = window.basePrice * window.quantity;
    return subtotal - window.calculateDiscount();
}

const loginRequiredEl = document.getElementById('login-required');
const paymentFormEl = document.getElementById('payment-form');
const personalUseSection = document.getElementById('personal-use-section');

document.addEventListener("DOMContentLoaded", async function()
{
    // Auth & Status
    {
        const isLoggedIn = await CheckAuthStatus();

        if(isLoggedIn)
        {
            TogglePaymentForm(true);
            LoadProductInfo();
            CheckResellerStatus();
        }
        else
        {
            ShowLoginForm();
        }
    }

    // Payment Buttons
    {
        // crypto
        const payCrypto = document.getElementById('connect-wallet');
        if(payCrypto)
        {
            payCrypto.addEventListener('click', async () =>
            {
            });
        }

        // paypal
        await PaypalManager.LoadSDK();
        const paypalButtons = CreatePaypalButtons();
        await paypalButtons.render('#paypal-button-container');
    }
});

async function CheckResellerStatus() {
    const token = DiscordAuth.GetSessionToken();
    if (!token) return;
    
    try {
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
                    checkbox.addEventListener('change', (e) => {
                        window.personalUse = e.target.checked;
                        window.updatePriceDisplay();
                    });
                }
            }
            window.updatePriceDisplay();
        }
    } catch (error) {
    }
}

function ShowLoginForm()
{
    TogglePaymentForm(false);

    const loginBtn = document.querySelector('.discord-login-btn');
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
                TogglePaymentForm(true);
                LoadProductInfo();
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
            window.updatePriceDisplay();
        }
    } catch(error)
    {
        console.error('Failed to load product:', error);
    }
}

window.updatePriceDisplay = function()
{
    const subtotal = window.basePrice * window.quantity;
    const discount = window.calculateDiscount();
    const finalTotal = subtotal - discount;
    const subtotalEl = document.getElementById('subtotal-price');
    const discountEl = document.getElementById('discount-price');
    const discountRow = document.getElementById('discount-row');
    const finalTotalEl = document.getElementById('final-total-price');

    if(subtotalEl) subtotalEl.textContent = '€' + subtotal.toFixed(2);
    
    if (discountRow) {
        if (discount > 0) {
            discountRow.classList.remove('hidden');
            if (discountEl) discountEl.textContent = '-€' + discount.toFixed(2);
            if (finalTotalEl) finalTotalEl.textContent = '€' + finalTotal.toFixed(2);
        } else {
            discountRow.classList.add('hidden');
            if (finalTotalEl) finalTotalEl.textContent = '€' + subtotal.toFixed(2);
        }
    }
};