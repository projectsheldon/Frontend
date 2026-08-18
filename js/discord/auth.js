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
        // Network error: do NOT assume the token is valid. Returning `true` here previously
        // let a planted token survive validation just because the backend was unreachable,
        // which cements a session-fixation attack whenever the network flaps.
        UpdateUI();
        return false;
    }
}
function UpdateUI(loggedIn, user = null)
{
    // The loading veil stays up until the auth check settles on a definite
    // answer (logged in or not) — never leave the page covered.
    if(window.AuthLoading) window.AuthLoading.hide();

    const discordBtn = document.getElementById('discord-login-btn');
    const userProfileTrigger = document.getElementById('user-profile-trigger');

    // Hero call-to-action: logged-in users see the "Install" button (fetches the link from
    // the server on demand); logged-out users keep the "Join Discord" invite. The button's
    // click behaviour reads login state at click time, so we only need to swap the label here.
    const heroCta = document.getElementById('hero-cta');
    if(heroCta)
    {
        heroCta.textContent = "DOWNLOAD";
    }

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
            // Logged in: hide the button — the account menu's "Sign out" is the
            // logout path now. The logged-out branch below removes `hidden` and
            // restores the "Login" label, so the button reappears after sign-out.
            discordBtn.classList.add('hidden');
            discordBtn.classList.remove('is-authed', 'is-loading');
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
            discordBtn.classList.remove('hidden', 'is-authed', 'is-loading');
            discordBtn.setAttribute('aria-label', 'Login with Discord');

            const loginTxt = discordBtn.querySelector('#discord-login-txt');
            if(loginTxt)
            {
                loginTxt.textContent = 'Login';
                // Restore the mobile-hidden behaviour (icon-only on small screens).
                loginTxt.classList.add('hidden');
            }
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

        // Only follow the URL if it actually points at Discord's OAuth endpoint. Guards
        // against a compromised backend response (or a cache-poisoned Api.GetApiUrl)
        // returning `javascript:...` or an off-domain phishing URL.
        if (typeof data.url === 'string' && /^https:\/\/discord\.com\//i.test(data.url)) {
            window.location.href = data.url;
        }
    },
    async Logout()
    {
        const apiUrl = await Api.GetApiUrl();
        const token = this.GetSessionToken();

        // Send the session token (and cookie) so the backend can invalidate THIS
        // session server-side. Best-effort: a network failure must not block the
        // local sign-out that follows in the click handler.
        try
        {
            await fetch(`${apiUrl}/discord/logout`, {
                method: "POST",
                mode: 'cors',
                credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
        }
        catch(e) {}
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
        const previouslyFocused = document.activeElement;
        const previousBodyOverflow = document.body.style.overflow;
        let minCloseTime = 0;

        const overlay = document.createElement('div');
        overlay.id = 'discord-app-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'discord-app-title');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;transition:opacity 0.2s ease;opacity:0;';

        const modal = document.createElement('div');
        modal.id = 'discord-app-modal';
        modal.style.cssText = 'position:relative;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);transform:scale(0.96);transition:transform 0.2s cubic-bezier(0.16,1,0.3,1);';

        modal.innerHTML =
            '<div style="width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:#5865F2;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(88,101,242,0.35);">' +
                '<svg width="28" height="28" viewBox="0 0 127.14 96.36" fill="#ffffff" aria-hidden="true"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a.41.41,0,0,0-.43.2,72.48,72.48,0,0,0-3.17,6.52,97.26,97.26,0,0,0-29,0,72.84,72.84,0,0,0-3.19-6.52.4.4,0,0,0-.43-.2A105.09,105.09,0,0,0,19.44,8.07a.44.44,0,0,0-.2.07C2.12,34,1.15,59.39,3.46,84.41a.48.48,0,0,0,.19.34A105.77,105.77,0,0,0,35.77,96.36a.42.42,0,0,0,.46-.22,74.22,74.22,0,0,0,6.42-10.38.4.4,0,0,0-.22-.56,68.7,68.7,0,0,1-10-4.76.41.41,0,0,1,0-.69c.83-.62,1.67-1.28,2.46-1.95a.39.39,0,0,1,.41-.05,73.4,73.4,0,0,0,57.48,0,.39.39,0,0,1,.41.05c.79.67,1.63,1.33,2.46,1.95a.41.41,0,0,1,0,.69,68.61,68.61,0,0,1-10,4.76.41.41,0,0,0-.22.56,74.8,74.8,0,0,0,6.43,10.38.42.42,0,0,0,.46.22,105.48,105.48,0,0,0,32.11-11.61.45.45,0,0,0,.19-.34c2.72-28.53-4.67-53.59-20-76.27A.39.39,0,0,0,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.07,65.69,84.69,65.69Z"/></svg>' +
            '</div>' +
            '<h3 id="discord-app-title" style="color:white;font-size:19px;font-weight:700;margin:0 0 8px;">Login with Discord</h3>' +
            '<p style="color:rgba(255,255,255,0.55);font-size:13px;line-height:1.5;margin:0 0 24px;">How would you like to continue?</p>' +
            '<div style="display:flex;gap:12px;">' +
                '<button id="discord-app-yes" style="flex:1;background:#5865F2;color:white;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s ease;">Open App</button>' +
                '<button id="discord-app-no" style="flex:1;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s ease;">Use Browser</button>' +
            '</div>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        // Single teardown for scroll lock, key listener and focus restore. Called both from
        // closeOverlay() here and from _PollForToken's removeOverlay(), so cleanup happens no
        // matter which path tears the overlay down.
        window._discordOverlayCleanup = function()
        {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousBodyOverflow;
            if(previouslyFocused && typeof previouslyFocused.focus === 'function')
            {
                try { previouslyFocused.focus(); } catch(e) {}
            }
            window._discordOverlayCleanup = null;
        };

        function closeOverlay()
        {
            window._discordLoginPopupOpen = false;
            if(window._discordOverlayCleanup) window._discordOverlayCleanup();
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }

        function onKeyDown(e)
        {
            if(e.key === 'Escape' && Date.now() >= minCloseTime)
            {
                callback(null);
                closeOverlay();
            }
        }
        document.addEventListener('keydown', onKeyDown);

        overlay.onclick = (e) => {
            if(e.target === overlay && Date.now() >= minCloseTime) {
                callback(null);
                closeOverlay();
            }
        };

        const yesBtn = document.getElementById('discord-app-yes');
        const noBtn = document.getElementById('discord-app-no');

        yesBtn.onmouseenter = () => yesBtn.style.background = '#4752c4';
        yesBtn.onmouseleave = () => yesBtn.style.background = '#5865F2';
        noBtn.onmouseenter = () => noBtn.style.background = 'rgba(255,255,255,0.14)';
        noBtn.onmouseleave = () => noBtn.style.background = 'rgba(255,255,255,0.08)';

        yesBtn.onclick = () => {
            minCloseTime = Date.now() + 2000;
            callback('app');
        };
        noBtn.onclick = () => {
            callback('browser');
            closeOverlay();
        };

        // Give the primary action keyboard focus so Enter/Escape work immediately.
        requestAnimationFrame(() => { try { yesBtn.focus(); } catch(e) {} });
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

        // Mint a login nonce and stash it in localStorage. The hash-token receiver below
        // requires this flag to exist before accepting `#discord_token=…`. Without it,
        // an attacker-sent link like `?…#discord_token=THEIR_TOKEN` can't plant a session
        // (session fixation). Cleared after use or on TTL.
        try {
            localStorage.setItem('discord_login_pending', String(Date.now()));
        } catch(e) {}

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
                            const res = await fetch(`${apiUrl}/discord/poll-auth?code=${encodeURIComponent(code)}`);
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
                            else if(data.status === 'rate_limited')
                            {
                                if(typeof Notify !== 'undefined') Notify('Too many attempts — wait a moment and try again.', 'warning', 3000);
                            }
                            else if(data.status === 'expired')
                            {
                                if(typeof Notify !== 'undefined') Notify('That code expired. Start login again.', 'error', 3000);
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
                // Open the consent page in a POPUP so this site tab (and its poll loop below)
                // stays alive. `window.location.href` here used to navigate this tab away
                // mid-login: the poll loop and the login overlay died with it, and the user was
                // stranded on the backend's "enter the code" page with no site left to finish
                // the login. The popup resolves two ways: Discord redirects back through
                // /discord/callback with our auth code as `state`, and the poll below consumes
                // the pending result; or, when the callback cookie is missing, the backend's
                // fallback exchange hands the token back through this same tab's URL hash.
                const popup = window.open(oauthUrl, 'sheldon_discord_auth', 'popup=1,width=480,height=680');
                if(!popup)
                {
                    // Popup blocked (no user gesture / blocker extension): fall back to
                    // navigating the current tab, matching the old behaviour.
                    window.location.href = oauthUrl;
                    return;
                }
                // Start consuming the login result regardless of which path the popup takes.
                // Without this the browser flow just hung: nothing ever polled /discord/poll-auth,
                // so the token in the pending login was claimed by nobody.
                DiscordAuth._PollForToken(oauthUrl, authCode, apiUrl);
            }
        });

        // /discord/init-auth failed (backend unreachable / challenged) — the code box will be
        // missing from the modal. Tell the visitor instead of silently degrading.
        if(!authCode)
        {
            setTimeout(() =>
            {
                const modal = document.querySelector('#discord-app-modal');
                if(!modal) return;
                const note = document.createElement('div');
                note.textContent = "Can't reach the authentication server. Login may not complete — close this popup and try again.";
                note.style.cssText = 'margin-top:14px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:11px;color:rgba(255,255,255,0.75);';
                modal.appendChild(note);
            }, 60);
        }
    },

    async _PollForToken(fallbackOauthUrl, authCode, apiUrl)
    {
        await new Promise(resolve =>
        {
            // We only tear the overlay down once the backend CONFIRMS a real session. Any
            // other outcome (cancelled, expired, unconfirmed, timed out) keeps the overlay
            // open so the user can retry or finish via the code — we never auto-dismiss or
            // navigate them away.
            let settled = false;
            let verifying = false;

            function cleanup()
            {
                clearInterval(pollInterval);
                clearTimeout(fallbackTimer);
                window._resolveAuthPoll = null;
            }

            function removeOverlay(delay)
            {
                window._discordLoginPopupOpen = false;
                if(window._discordOverlayCleanup) window._discordOverlayCleanup();
                const o = document.querySelector('#discord-app-overlay');
                if(!o) return;
                if(delay > 0) { o.style.opacity = '0'; setTimeout(() => o.remove(), delay); }
                else o.remove();
            }

            // Not logged in: keep the overlay up with a retry/close so the user is never stuck.
            function keepOpen(title, sub)
            {
                if(settled) return;
                cleanup();
                const modal = document.querySelector('#discord-app-modal');
                if(!modal) { resolve(); return; }
                modal.innerHTML =
                    '<h3 style="color:#ef4444;font-size:18px;margin:0 0 8px;">' + title + '</h3>' +
                    '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 20px;">' + sub + '</p>' +
                    '<div style="display:flex;gap:12px;">' +
                        '<button id="discord-retry-btn" style="flex:1;background:#5865F2;color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:bold;cursor:pointer;">Try Again</button>' +
                        '<button id="discord-cancel-btn" style="flex:1;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer;">Close</button>' +
                    '</div>';
                const retry = document.getElementById('discord-retry-btn');
                const cancel = document.getElementById('discord-cancel-btn');
                if(retry) retry.onclick = () => { removeOverlay(0); resolve(); DiscordAuth.LoginPopup(); };
                if(cancel) cancel.onclick = () => { removeOverlay(0); resolve(); };
            }

            // Confirm the session with /discord/me before closing. If it doesn't check out,
            // keep the overlay open rather than closing on a token we can't trust.
            async function tryFinish(token)
            {
                if(settled || verifying) return;
                verifying = true;
                try
                {
                    if(token) DiscordAuth.SetSessionToken(token);

                    let loggedIn = false;
                    try { loggedIn = await CheckAuthStatus(); } catch(e) { loggedIn = false; }

                    if(!loggedIn)
                    {
                        if(token) DiscordAuth.DeleteSessionToken();
                        keepOpen('Login failed', 'We could not confirm your login. Please try again.');
                        return;
                    }

                    settled = true;
                    cleanup();
                    const modal = document.querySelector('#discord-app-modal');
                    if(modal)
                    {
                        modal.innerHTML = '<h3 style="color:#22c55e;font-size:18px;margin:0 0 8px;">Login Successful!</h3>' +
                            '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">You are now logged in.</p>';
                    }
                    removeOverlay(700);
                    resolve();
                }
                finally { verifying = false; }
            }

            // Resolver used by the manual code-entry Submit button.
            window._resolveAuthPoll = function(token, error)
            {
                if(token) tryFinish(token);
                else keepOpen('Login Cancelled', error || 'You are not logged in yet. Try again.');
            };

            const pollInterval = setInterval(async () =>
            {
                if(settled || verifying) return;

                if(DiscordAuth.GetSessionToken())
                {
                    await tryFinish(DiscordAuth.GetSessionToken());
                    return;
                }

                if(authCode)
                {
                    try
                    {
                        const res = await fetch(`${apiUrl}/discord/poll-auth?code=${encodeURIComponent(authCode)}`);
                        const data = await res.json();
                        if(data.ok && data.status === 'success') { await tryFinish(data.token); return; }
                        if(data.ok && data.status === 'error') { keepOpen('Login Cancelled', 'You cancelled the Discord authorization.'); return; }
                        if(data.status === 'expired') { keepOpen('Code expired', 'That login code expired. Please try again.'); return; }
                    } catch(e) {}
                }

                try
                {
                    const err = localStorage.getItem('discord_error');
                    if(err)
                    {
                        localStorage.removeItem('discord_error');
                        keepOpen('Login Cancelled', 'You cancelled the Discord authorization.');
                        return;
                    }
                } catch(e) {}
            }, 800);

            // Safety net: after the code's server-side lifetime, stop polling but KEEP the
            // overlay with a retry. We deliberately do NOT redirect the user anywhere.
            const fallbackTimer = setTimeout(() =>
            {
                keepOpen('Still waiting…', 'Finish in the Discord app, or try again.');
            }, 300000);
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
        // Only accept a hash-delivered token if we recently opened the OAuth popup
        // ourselves. Without this pairing, anyone can craft
        //   https://projectsheldon.github.io/#discord_token=ATTACKER
        // send the victim, and they end up using the attacker's Discord session.
        // Nonce TTL: 15 min — plenty for a real OAuth round-trip.
        const pending = (() => { try { return Number(localStorage.getItem('discord_login_pending')) || 0; } catch(e) { return 0; } })();
        const NONCE_TTL_MS = 15 * 60 * 1000;
        const nonceValid = pending > 0 && (Date.now() - pending) < NONCE_TTL_MS;
        // Always clear the flag; a single hash-token consumes it.
        try { localStorage.removeItem('discord_login_pending'); } catch(e) {}

        if(!nonceValid) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
            return;
        }
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
        try { localStorage.removeItem('discord_login_pending'); } catch(e) {}
        setTimeout(() =>
        {
            if(typeof Notify !== 'undefined') Notify('Login cancelled', 'warning', 3000);
            try { window.close(); } catch(e) {}
        }, 500);
    }
})();

export { DiscordAuth, UpdateUI, DiscordUser };
