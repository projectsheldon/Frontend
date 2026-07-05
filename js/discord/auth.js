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
        if(token)
        {
            return true;
        }
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

    // prompt
    _PromptDiscordApp(callback)
    {
        const overlay = document.createElement('div');
        overlay.id = 'discord-app-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;transition:opacity 0.2s ease;opacity:0;';

        const modal = document.createElement('div');
        modal.id = 'discord-app-modal';
        modal.style.cssText = 'background:#1e1e1e;border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.5);';

        modal.innerHTML = '<h3 style="color:white;font-size:18px;margin:0 0 8px;">Login with Discord</h3><p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 24px;">Open the Discord app to continue?</p><div style="display:flex;gap:12px;"><button id="discord-app-yes" style="flex:1;background:#5865F2;color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:bold;cursor:pointer;">Open App</button><button id="discord-app-no" style="flex:1;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer;">Browser</button></div>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.style.opacity = '1');

        let minCloseTime = 0;

        function closeOverlay()
        {
            window._discordLoginPopupOpen = false;
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }

        overlay.onclick = (e) => {
            if(e.target === overlay && Date.now() >= minCloseTime) {
                callback(null);
                closeOverlay();
            }
        };
        document.getElementById('discord-app-yes').onclick = () => {
            minCloseTime = Date.now() + 2000;
            callback('app');
        };
        document.getElementById('discord-app-no').onclick = () => {
            callback('browser');
            closeOverlay();
        };
    },

    // window
    async LoginPopup()
    {
        if(window._discordLoginPopupOpen) return;
        window._discordLoginPopupOpen = true;
        const apiUrl = await Api.GetApiUrl();
        const clientId = await this.GetClientId();
        const redirectUri = encodeURIComponent(`${apiUrl.replace(/\/+$/, '')}/discord/callback`);
        const scope = "identify";
        const origin = window.location.origin;

        let authCode = '';
        try
        {
            const res = await fetch(`${apiUrl}/discord/init-auth?origin=${encodeURIComponent(origin)}`);
            const data = await res.json();
            if(data.ok) authCode = data.code;
        } catch(e) {}

        const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(origin)}`;
        const discordAppUrl = `discord://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(authCode)}`;

        this._PromptDiscordApp(function(choice) {
            if(choice === 'app')
            {
                const modal = document.querySelector('#discord-app-modal');
                if(modal)
                {
                    modal.innerHTML = '<h3 style="color:white;font-size:18px;margin:0 0 8px;">Opening Discord...</h3>' +
                        '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;">Authorize in the Discord app.</p>' +
                        (authCode
                            ? '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">' +
                                '<p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0 0 8px;">If a new browser tab opens, enter the code from there:</p>' +
                                '<div style="display:flex;gap:8px;">' +
                                    '<input id="auth-code-input" type="text" maxlength="8" placeholder="Enter code" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px 12px;color:white;font-size:14px;text-align:center;letter-spacing:2px;text-transform:uppercase;outline:none;">' +
                                    '<button id="auth-code-submit" style="background:#5865F2;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:bold;cursor:pointer;">Submit</button>' +
                                '</div>' +
                            '</div>'
                            : '');
                }

                if(authCode)
                {
                    document.getElementById('auth-code-submit').onclick = async () =>
                    {
                        const input = document.getElementById('auth-code-input');
                        if(!input || !input.value.trim()) return;
                        const code = input.value.trim().toUpperCase();
                        try
                        {
                            const res = await fetch(`${apiUrl}/discord/poll-auth?code=${code}`);
                            const data = await res.json();
                            if(data.ok && data.status === 'success')
                            {
                                if(window._resolveAuthPoll) window._resolveAuthPoll(data.token);
                            }
                            else if(data.ok && data.status === 'error')
                            {
                                if(window._resolveAuthPoll) window._resolveAuthPoll(null, 'Login cancelled');
                            }
                            else if(data.status === 'pending')
                            {
                                if(typeof Notify !== 'undefined') Notify('Code not ready yet. Try again.', 'info', 2000);
                            }
                            else
                            {
                                if(typeof Notify !== 'undefined') Notify('Invalid code.', 'error', 3000);
                            }
                        } catch(e) {}
                    };
                }

                const a = document.createElement('a');
                a.href = discordAppUrl;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                DiscordAuth._PollForToken(oauthUrl, authCode, apiUrl);
            }
            else if(choice === 'browser')
            {
                window.location.href = oauthUrl;
            }
        });
    },

    async _PollForToken(fallbackOauthUrl, authCode, apiUrl)
    {
        await new Promise(resolve =>
        {
            function completeAuth(token, error)
            {
                clearInterval(pollInterval);
                clearTimeout(fallbackTimer);
                window._resolveAuthPoll = null;

                if(token) DiscordAuth.SetSessionToken(token);

                const o = document.querySelector('#discord-app-overlay');
                if(o)
                {
                    const modal = document.querySelector('#discord-app-modal');
                    if(modal)
                    {
                        if(token)
                        {
                            modal.innerHTML = '<h3 style="color:#22c55e;font-size:18px;margin:0 0 8px;">Login Successful!</h3>' +
                                '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">You are now logged in.</p>';
                        }
                        else
                        {
                            modal.innerHTML = '<h3 style="color:#ef4444;font-size:18px;margin:0 0 8px;">' + (error || 'Login Cancelled') + '</h3>' +
                                '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">Please try again.</p>';
                        }
                    }
                    window._discordLoginPopupOpen = false;
                    o.style.opacity = '0';
                    setTimeout(() => o.remove(), 200);
                }

                resolve();
            }

            window._resolveAuthPoll = completeAuth;

            const pollInterval = setInterval(async () =>
            {
                if(DiscordAuth.GetSessionToken())
                {
                    completeAuth(DiscordAuth.GetSessionToken());
                    return;
                }

                if(authCode)
                {
                    try
                    {
                        const res = await fetch(`${apiUrl}/discord/poll-auth?code=${authCode}`);
                        const data = await res.json();
                        if(data.ok && data.status === 'success')
                        {
                            completeAuth(data.token);
                            return;
                        }
                        if(data.ok && data.status === 'error')
                        {
                            completeAuth(null, 'Login cancelled');
                            return;
                        }
                    } catch(e) {}
                }

                try
                {
                    const err = localStorage.getItem('discord_error');
                    if(err)
                    {
                        localStorage.removeItem('discord_error');
                        completeAuth(null, 'Login cancelled');
                        return;
                    }
                } catch(e) {}
            }, 800);

            const fallbackTimer = setTimeout(() =>
            {
                clearInterval(pollInterval);
                window._discordLoginPopupOpen = false;
                const o = document.querySelector('#discord-app-overlay');
                if(o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 200); }
                window.location.href = fallbackOauthUrl;
            }, 120000);
        });

        CheckAuthStatus();
    }
};

window.DiscordAuth = DiscordAuth;

// Pick up token or error from URL hash (redirect fallback from callback.html)
(function() {
    const hash = window.location.hash;
    if(hash.startsWith('#discord_token='))
    {
        const token = decodeURIComponent(hash.substring('#discord_token='.length));
        if(token)
        {
            DiscordAuth.SetSessionToken(token);
            history.replaceState(null, '', window.location.pathname + window.location.search);
            setTimeout(() =>
            {
                CheckAuthStatus();
                try { window.close(); } catch(e) {}
            }, 0);
        }
    }
    else if(hash.startsWith('#discord_error='))
    {
        const err = decodeURIComponent(hash.substring('#discord_error='.length));
        history.replaceState(null, '', window.location.pathname + window.location.search);
        try { localStorage.setItem('discord_error', err); } catch(e) {}
        setTimeout(() =>
        {
            if(typeof Notify !== 'undefined') Notify('Login cancelled', 'warning', 3000);
            try { window.close(); } catch(e) {}
        }, 500);
    }
})();

export { DiscordAuth, UpdateUI, DiscordUser };
