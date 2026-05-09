import Api from "../../util/backend.js";

const TEN_MINUTES = 10 * 60 * 1000;

function getCachedInfo() {
    try {
        const raw = localStorage.getItem('cache_stripe_info');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < TEN_MINUTES) return item.data;
        localStorage.removeItem('cache_stripe_info');
    } catch (e) {}
    return null;
}

function setCachedInfo(info) {
    try {
        localStorage.setItem('cache_stripe_info', JSON.stringify({ data: info, timestamp: Date.now() }));
    } catch (e) {}
}

const StripeManager = 
{
    async GetRemoteInfo()
    {
        const cached = getCachedInfo();
        if (cached) return cached;

        const apiUrl = await Api.GetApiUrl();
        const req = await fetch(`${apiUrl}/stripe/info`);
        const reqJ = await req.json();

        setCachedInfo(reqJ);
        return reqJ;
    },
    async GetPublicKey() 
    {
        const info = await this.GetRemoteInfo();
        return info.publicKey || '';
    },
    async GetCurrency() 
    {
        const info = await this.GetRemoteInfo();
        return info.currency || 'EUR';
    },
    async IsSandbox()
    {
        const info = await this.GetRemoteInfo();
        return info.sandbox || false;
    },
};

export default StripeManager;