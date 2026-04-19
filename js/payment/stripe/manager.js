import Api from "../../util/backend.js";

const StripeManager = 
{
    async GetRemoteInfo()
    {
        const apiUrl = await Api.GetApiUrl();
        const req = await fetch(`${apiUrl}/stripe/info`);
        const reqJ = await req.json();

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
}