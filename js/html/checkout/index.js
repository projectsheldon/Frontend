import { CheckAuthStatus, DiscordAuth } from "../../discord/auth.js";
import PaypalManager from "../../payment/paypal/manager.js";
import { CreatePaypalButtons } from "../../payment/paypal/paypal.js";
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
        const payCrypto = document.getElementById('connect-wallet');
        if(payCrypto)
        {
            payCrypto.addEventListener('click', async () =>
            {
            });
        }

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
                }
            }
            window.fetchPriceFromApi();
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
            window.fetchPriceFromApi();
        }
    } catch(error)
    {
        console.error('Failed to load product:', error);
    }
}
