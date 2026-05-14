import Api from "../util/backend.js";

export async function CheckAuthStatus()
{
    const token = DiscordAuth.GetSessionToken();
    const apiUrl = await Api.GetApiUrl();

    try
    {
        const endpoint = token
            ? `${apiUrl}/discord/me`
            : `${apiUrl}/discord/me`;

        const response = await fetch(endpoint, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            headers: token
                ? { Authorization: `Bearer ${token}` }
                : undefined
        });

        const data = await response.json();

        if(data.success && data.loggedIn)
        {
            DiscordAuth.currentUser = data.user;
            UpdateUI(true, data.user);
            return true;
        } else
        {
            DiscordAuth.currentUser = null;
            if(token)
            {
                DiscordAuth.DeleteSessionToken();
            }
            UpdateUI();
            return false;
        }
    }
    catch(error)
    {
        UpdateUI();
        return false;
    }
}
function UpdateUI(loggedIn, user = null)
{
    const discordBtn = document.getElementById('discord-login-btn');
    const userProfileTrigger = document.getElementById('user-profile-trigger');

    if(loggedIn)
    {
        if(userProfileTrigger)
        {
            userProfileTrigger.classList.remove('hidden');

            const nameEl = userProfileTrigger.querySelector('.user-name');
            if(nameEl)
            {
                nameEl.textContent = user.globalName || user.username;
            }

            const avatarEl = userProfileTrigger.querySelector('.user-avatar');
            const defaultAvatarEl = userProfileTrigger.querySelector('.default-avatar');

            if(avatarEl && user.avatar)
            {
                avatarEl.src = user.avatar;
                avatarEl.classList.remove('hidden');
                if(defaultAvatarEl) defaultAvatarEl.classList.add('hidden');
            }

            // Show balance next to username
            const balanceEl = userProfileTrigger.querySelector('.user-balance');
            if(balanceEl)
            {
                const balance = user.balance !== undefined ? user.balance : 0;
                balanceEl.textContent = `Balance: ${Number(balance).toFixed(1)}`;
                balanceEl.classList.remove('hidden');
            }
            else
            {
                const balanceSpan = document.createElement('span');
                balanceSpan.className = 'user-balance text-[0.6rem] font-bold text-[#c7b18f] tracking-wider leading-none';
                balanceSpan.style.marginTop = '1px';
                balanceSpan.textContent = `Balance: ${Number(user.balance || 0).toFixed(1)}`;
                const textRight = userProfileTrigger.querySelector('.text-right');
                if(textRight) textRight.appendChild(balanceSpan);
            }
        }

        if(discordBtn)
        {
            discordBtn.classList.remove('hidden');
            discordBtn.className = 'bg-white text-black font-black px-5 py-2 rounded-xl text-[0.65rem] uppercase tracking-wider transition-all hover:bg-[#c7b18f] flex items-center justify-center';
            discordBtn.style.display = 'flex';
            discordBtn.style.justifyContent = 'center';
            discordBtn.style.alignItems = 'center';

            const loginTxt = discordBtn.querySelector('#discord-login-txt');
            if(loginTxt)
            {
                loginTxt.textContent = 'Logout';
                loginTxt.classList.remove('hidden');
            }
            const discordIcon = discordBtn.querySelector('svg');
            if(discordIcon)
            {
                discordIcon.remove();
            }
        }
    }
    else
    {
        DiscordAuth.currentUser = null;

        if(userProfileTrigger)
        {
            userProfileTrigger.classList.add('hidden');
            const balanceEl = userProfileTrigger.querySelector('.user-balance');
            if(balanceEl) balanceEl.classList.add('hidden');
        }
        if(discordBtn)
        {
            discordBtn.classList.remove('hidden');
            discordBtn.className = 'btn-discord px-5 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all';

            const loginTxt = discordBtn.querySelector('#discord-login-txt');
            if(loginTxt) loginTxt.textContent = 'Login';
        }
    }
}

class DiscordUser {
    constructor(id, username, globalName, avatar) {
        this.id = id;
        this.username = username;
        this.globalName = globalName;
        this.avatar = avatar;
    }

    get Avatar() {
        if (this.avatar) {
            return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.png?size=256`;
        }
        return null;
    }

    get Displayname() {
        return this.globalName || this.username;
    }
}

const DiscordAuth = {
    currentUser: null,
    
    // api request
    async Login()
    {
        const apiUrl = await Api.GetApiUrl();
        const response = await fetch(`${apiUrl}/discord/login`);
        const data = await response.json();

        window.location.href = data.url;
    },
    async Logout()
    {
        const apiUrl = await Api.GetApiUrl();
        await fetch(`${apiUrl}/discord/logout`, { method: "POST" });
    },
    async GetUser()
    {
        const apiUrl = await Api.GetApiUrl();
        const token = this.GetSessionToken();

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${apiUrl}/discord/me`, { headers });
        const data = await response.json();

        if (!data.success || !data.user) {
            return null;
        }

        const u = data.user;
        return new DiscordUser(u.id, u.username, u.global_name || u.globalName, u.avatar);
    },

    // bot
    async GetClientId()
    {
        const data = await Api.GetDiscordConfig();
        return data.clientId;
    },

    // token
    GetSessionToken()
    {
        return localStorage.getItem('discord_session');
    },
    SetSessionToken(token)
    {
        localStorage.setItem('discord_session', token);
    },
    DeleteSessionToken()
    {
        localStorage.removeItem('discord_session');
        localStorage.removeItem('cache_discord_user');
        localStorage.removeItem('cache_bulk_info_timestamp');
    },

    // window
    async LoginPopup()
    {
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        const apiUrl = await Api.GetApiUrl();

        const clientId = await this.GetClientId();
        const redirectUri = encodeURIComponent(`${apiUrl.replace(/\/+$/, '')}/discord/callback`);
        const scope = "identify";

        const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

        const popup = window.open(oauthUrl, 'Discord Login', `width=${width},height=${height},left=${left},top=${top}`);

        const checkClosed = setInterval(() =>
        {
            if(popup.closed)
            {
                clearInterval(checkClosed);
                CheckAuthStatus();
            }
        }, 500);
    }
};

window.DiscordAuth = DiscordAuth;

export { DiscordAuth, UpdateUI, DiscordUser };
