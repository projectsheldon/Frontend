const Api = {
    _backendUrl: null,
    _apiKey: null,

    async _fetchBackendUrl()
    {
        const remoteServer = 'https://projectsheldon.xyz';
        const localServer = 'http://localhost:3350';

        if(this._backendUrl) return this._backendUrl;

        try
        {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const fallbackUrl = isLocalhost ? localServer : remoteServer;

            const response = await fetch(`${fallbackUrl}/config/backend`);
            if(response.ok)
            {
                const data = await response.json();
                this._backendUrl = isLocalhost ? data.localhost : data.server;
            } else
            {
                this._backendUrl = fallbackUrl;
            }
        } catch(e)
        {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            this._backendUrl = isLocalhost ? localServer : remoteServer;
        }

        return this._backendUrl;
    },

    async GetApiUrl()
    {
        if(!this._backendUrl)
        {
            await this._fetchBackendUrl();
        }
        return this._backendUrl;
    },

    async GetApiKey()
    {
        if(this._apiKey) return this._apiKey;
        
        const apiUrl = await this.GetApiUrl();
        try {
            const response = await fetch(`${apiUrl}/license/key`);
            if(response.ok) {
                const data = await response.json();
                this._apiKey = data.key || null;
            }
        } catch(e) {}
        return this._apiKey;
    },

    async GetLink(platform)
    {
        const apiUrl = await Api.GetApiUrl();
        const endpoint = `${apiUrl}/links/${platform}`;

        const response = await fetch(endpoint);
        const data = await response.json();

        return data.link;
    }
};
export default Api;
