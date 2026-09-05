import Api from '../../util/backend.js';
import { DiscordAuth } from '../../discord/auth.js';
import StripeManager from './manager.js';

const STRIPE_PUBLIC_KEY = 'pk_test_...';

let stripeInstance = null;
let elementsInstance = null;
let paymentElementInstance = null;
let initialized = false;
let isSubmitting = false;
let refreshPromise = null;
let refreshTimeout = null;
let priceHookBound = false;

function getPayButton()
{
    return document.getElementById('pay-btn');
}

function getPaymentElementContainer()
{
    return document.getElementById('payment-element');
}

function getErrorContainer()
{
    let errorEl = document.getElementById('stripe-error');
    if(errorEl)
    {
        return errorEl;
    }

    const payBtn = getPayButton();
    if(!payBtn || !payBtn.parentElement)
    {
        return null;
    }

    errorEl = document.createElement('div');
    errorEl.id = 'stripe-error';
    errorEl.className = 'text-xs text-red-300 mt-3 text-center';
    errorEl.style.display = 'none';
    payBtn.parentElement.insertBefore(errorEl, payBtn);

    return errorEl;
}

function showError(message)
{
    const errorEl = getErrorContainer();
    if(!errorEl)
    {
        if(message)
        {
            alert(message);
        }

        return;
    }

    errorEl.textContent = message || '';
    errorEl.style.display = message ? 'block' : 'none';
}

function setPayButtonDisabled(disabled)
{
    const payBtn = getPayButton();
    if(!payBtn)
    {
        return;
    }

    payBtn.disabled = disabled;
    payBtn.style.opacity = disabled ? '0.7' : '1';
    payBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
}

function clearMountedElement()
{
    if(!paymentElementInstance)
    {
        return;
    }

    try
    {
        if(typeof paymentElementInstance.unmount === 'function')
        {
            paymentElementInstance.unmount();
        }

        if(typeof paymentElementInstance.destroy === 'function')
        {
            paymentElementInstance.destroy();
        }
    } catch(e) {}

    paymentElementInstance = null;
    elementsInstance = null;
}

async function createPaymentIntentRequest()
{
    const apiUrl = await Api.GetApiUrl();
    const sessionToken = DiscordAuth.GetSessionToken();

    const headers = {
        'Content-Type': 'application/json'
    };

    if(sessionToken)
    {
        headers.Authorization = `Bearer ${sessionToken}`;
    }

    const response = await fetch(`${apiUrl}/stripe/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            product_key: window.productKey,
            quantity: Number(window.quantity) || 1,
            is_personal_use: !!window.personalUse,
            coupon_code: window.couponCode || undefined
        })
    });

    const data = await response.json().catch(() => ({}));
    if(!response.ok || !data.client_secret)
    {
        throw new Error(data.error || data.message || 'Failed to initialize payment.');
    }

    return data.client_secret;
}

function scheduleRefresh()
{
    if(!initialized)
    {
        return;
    }

    if(refreshTimeout)
    {
        clearTimeout(refreshTimeout);
    }

    refreshTimeout = setTimeout(() =>
    {
        refreshStripe().catch((error) =>
        {
            showError(error.message || 'Failed to refresh payment form.');
        });
    }, 250);
}

function bindPriceRefreshHook()
{
    if(priceHookBound || typeof window.fetchPriceFromApi !== 'function')
    {
        return;
    }

    const originalFetchPrice = window.fetchPriceFromApi.bind(window);
    window.fetchPriceFromApi = async function(...args)
    {
        try
        {
            return await originalFetchPrice(...args);
        } finally
        {
            scheduleRefresh();
        }
    };

    priceHookBound = true;
}

function bindPayButton()
{
    const payBtn = getPayButton();
    if(!payBtn || payBtn.dataset.stripeBound === 'true')
    {
        return;
    }

    payBtn.dataset.stripeBound = 'true';
    payBtn.addEventListener('click', handlePayment);
}

export async function initStripe()
{
    if(initialized && stripeInstance)
    {
        return true;
    }

    if(typeof window.Stripe !== 'function')
    {
        showError('Stripe SDK failed to load.');
        return false;
    }

    const remotePublicKey = await StripeManager.GetPublicKey().catch(() => '');
    const publishableKey = remotePublicKey || STRIPE_PUBLIC_KEY;
    if(!publishableKey || !publishableKey.startsWith('pk_'))
    {
        showError('Missing Stripe public key.');
        return false;
    }

    stripeInstance = window.Stripe(publishableKey);
    if(!stripeInstance)
    {
        showError('Failed to initialize Stripe.');
        return false;
    }

    bindPayButton();
    bindPriceRefreshHook();

    initialized = true;

    try
    {
        await refreshStripe();
        return true;
    } catch(e)
    {
        return false;
    }
}

export async function refreshStripe()
{
    if(!initialized || !stripeInstance)
    {
        return;
    }

    if(refreshPromise)
    {
        return refreshPromise;
    }

    refreshPromise = (async () =>
    {
        showError('');
        setPayButtonDisabled(true);

        const clientSecret = await createPaymentIntentRequest();
        const container = getPaymentElementContainer();
        if(!container)
        {
            throw new Error('Payment element container was not found.');
        }

        clearMountedElement();
        elementsInstance = stripeInstance.elements({ clientSecret });
        paymentElementInstance = elementsInstance.create('payment');
        paymentElementInstance.mount('#payment-element');
    })()
        .catch((error) =>
        {
            showError(error.message || 'Failed to load payment form.');
            throw error;
        })
        .finally(() =>
        {
            refreshPromise = null;
            setPayButtonDisabled(isSubmitting);
        });

    return refreshPromise;
}

export async function handlePayment(event)
{
    event?.preventDefault();

    if(isSubmitting || refreshPromise)
    {
        return;
    }

    if(!stripeInstance || !elementsInstance)
    {
        await refreshStripe();
        if(!stripeInstance || !elementsInstance)
        {
            return;
        }
    }

    isSubmitting = true;
    setPayButtonDisabled(true);
    showError('');

    try
    {
        const result = await stripeInstance.confirmPayment({
            elements: elementsInstance,
            confirmParams: {
                return_url: `${window.location.origin}/success.html`
            }
        });

        if(result.error)
        {
            showError(result.error.message || 'Payment failed. Please try again.');
        }
    } catch(error)
    {
        showError(error.message || 'Payment failed. Please try again.');
    } finally
    {
        isSubmitting = false;
        setPayButtonDisabled(false);
    }
}
