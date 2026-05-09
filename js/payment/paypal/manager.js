import Api from "../../util/backend.js";

const TEN_MINUTES = 10 * 60 * 1000;

const SandboxHosts = [ 'sandbox', 'test', 'localhost' ];

function getCachedInfo() {
    try {
        const raw = localStorage.getItem('cache_paypal_info');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < TEN_MINUTES) return item.data;
        localStorage.removeItem('cache_paypal_info');
    } catch (e) {}
    return null;
}

function setCachedInfo(info) {
    try {
        localStorage.setItem('cache_paypal_info', JSON.stringify({ data: info, timestamp: Date.now() }));
    } catch (e) {}
}

const PaypalManager =
{
    async GetRemoteInfo()
    {
        const cached = getCachedInfo();
        if (cached) return cached;

        const apiUrl = await Api.GetApiUrl();
        const req = await fetch(`${apiUrl}/paypal/info`);
        const reqJ = await req.json();

        setCachedInfo(reqJ);
        return reqJ;
    },
    async GetClientId() 
    {
        const info = await this.GetRemoteInfo();
        return info.clientId || '';
    },
    async GetCurrency() 
    {
        const info = await this.GetRemoteInfo();
        return info.currency || 'USD';
    },
    async IsSandbox()
    {
        const info = await this.GetRemoteInfo();
        return info.sandbox || false;
    },

    async LoadSDK()
    {
        return new Promise(async (resolve, reject) =>
        {
            const existingScript = document.getElementById("paypal-sdk-script");
            if(existingScript && window.paypal)
            {
                resolve(true);
                return;
            }

            const clientId = await this.GetClientId();
            const currency = await this.GetCurrency();
            const sandbox = await this.IsSandbox();

            if(!clientId)
            {
                resolve(false);
                return;
            }

            const baseUrl = sandbox ? 'https://www.paypal.com/sdk/js' : 'https://www.paypal.com/sdk/js';
            const script = document.createElement("script");
            script.id = "paypal-sdk-script";
            script.src = `${baseUrl}?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}`;
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error("PayPal SDK failed to load"));
            document.head.appendChild(script);
        });
    },
};
export default PaypalManager;