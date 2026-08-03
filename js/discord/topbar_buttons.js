import Api from "../util/backend.js";
import { CheckAuthStatus, DiscordAuth, UpdateUI } from "./auth.js";
import "../util/cookie_banner.js"; // sets window.SheldonCookies; auto-shows the prompt on main pages only

let cookieChoiceFinal = false; // a Sure/No choice was recorded → the menu button never returns

const discordBtn = document.getElementById('discord-login-btn');
const userProfileTrigger = document.getElementById('user-profile-trigger');

let userMenu = null;

window.addEventListener('message', function(event)
{
    // Only accept messages from our own origin — the OAuth-callback popup — so third-party
    // pages can't plant a session token by postMessage from an attacker-controlled window.
    if(event.origin !== window.location.origin) return;
    if(event.data && event.data.type === 'discord_session')
    {
        window.DiscordAuth.SetSessionToken(event.data.token);
        CheckAuthStatus();
    }
});

async function DiscordBtnHandler(e)
{
    const btn = e && e.currentTarget ? e.currentTarget : document.getElementById('discord-login-btn');

    // Guard against double-clicks while an action is already in flight.
    if(btn && btn.classList.contains('is-loading')) return;

    if(window.DiscordAuth.currentUser)
    {
        // Logout: invalidate the session server-side first (best-effort), then clear locally.
        if(btn) btn.classList.add('is-loading');
        try
        {
            await window.DiscordAuth.Logout();
        }
        catch(err) {}

        window.DiscordAuth.DeleteSessionToken();
        window.DiscordAuth.currentUser = null;
        UpdateUI();

        if(typeof window.Notify !== 'undefined') window.Notify('Logged out', 'info', 2500);
    }
    else
    {
        // Login: show a spinner while the OAuth popup is being prepared (client id +
        // init-auth fetches). The popup itself drives the rest of the flow.
        if(btn) btn.classList.add('is-loading');
        try
        {
            await window.DiscordAuth.LoginPopup();
        }
        finally
        {
            if(btn) btn.classList.remove('is-loading');
        }
    }
}
if(discordBtn)
{
    discordBtn.addEventListener("click", DiscordBtnHandler);
}

function CreateLicensesMenu()
{
    if(userMenu) return userMenu;

    userMenu = document.createElement('div');
    userMenu.id = 'user-dropdown-menu';
    userMenu.style.cssText = `
        position: fixed;
        width: 360px;
        background: rgba(30, 30, 30, 0.98);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 16px;
        z-index: 10000;
        display: none;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(userMenu);
    return userMenu;
}
function ToggleLicensesMenu(show)
{
    const menu = CreateLicensesMenu();

    if(show)
    {
        const trigger = document.getElementById('user-profile-trigger');
        if(trigger)
        {
            const rect = trigger.getBoundingClientRect();
            menu.style.left = (rect.right - 320) + 'px';
            menu.style.top = (rect.bottom + 10) + 'px';
            menu.style.right = 'auto';
        }
        menu.style.display = 'block';
        LoadLicenses();
    } else
    {
        menu.style.display = 'none';
    }
}
function getCachedLicenses() {
    try {
        const raw = localStorage.getItem('cache_licenses');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < 600000) return item.data;
        localStorage.removeItem('cache_licenses');
    } catch (e) {}
    return null;
}

// "Cookie settings" row in the licenses menu: shown while consent is undecided or declined
// (a way to read/re-open the prompt without the banner auto-showing). Once the user
// proceeds with Sure or No, the row is removed forever.
function appendCookieSettingsButton(menu)
{
    if(cookieChoiceFinal) return;
    let status = null;
    try { status = window.SheldonCookies?.GetConsentStatus?.() ?? null; } catch(e) {}
    if(status === 'accepted') return;

    const wrap = document.createElement('div');
    wrap.id = 'cookie-settings-btn';
    wrap.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);';

    const btn = document.createElement('button');
    btn.textContent = status === 'declined' ? 'Cookie settings \u2014 declined' : 'Cookie settings';
    btn.title = 'Show the cookie / fingerprint consent prompt again';
    btn.style.cssText = 'width:100%;padding:8px 0;border-radius:10px;border:1px solid rgba(199,177,143,0.35);background:rgba(199,177,143,0.08);color:#c7b18f;font-size:10.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:background .2s;';
    btn.addEventListener('click', () =>
    {
        try { window.SheldonCookies?.ShowCookiePrompt?.(); } catch(e) {}
    });
    wrap.append(btn);
    menu.append(wrap);
}

window.addEventListener('sheldon-consent', function()
{
    cookieChoiceFinal = true;
    const btn = document.getElementById('cookie-settings-btn');
    if(btn) btn.remove();
});

window.addEventListener('sheldon-consent-state', function(e)
{
    if(e && e.detail && e.detail.consent === 'accepted')
    {
        cookieChoiceFinal = true;
        const btn = document.getElementById('cookie-settings-btn');
        if(btn) btn.remove();
    }
});

function setCachedLicenses(licenses) {
    try {
        localStorage.setItem('cache_licenses', JSON.stringify({ data: licenses, timestamp: Date.now() }));
    } catch (e) {}
}

async function LoadLicenses()
{
    const menu = CreateLicensesMenu();

    const token = DiscordAuth.GetSessionToken();
    if(!token)
    {
        menu.innerHTML = `
            <div class="text-neutral-400 text-sm text-center py-4">Please log in to view licenses</div>
        `;
        return;
    }

    const cached = getCachedLicenses();
    if (cached) {
        RenderLicenses(menu, cached, token);
        return;
    }

    const user = await DiscordAuth.GetUser();
    if (!user) {
        menu.innerHTML = `
            <div class="text-neutral-400 text-sm text-center py-4">Failed to load user</div>
        `;
        return;
    }
    
    const discordId = user.id;

    menu.innerHTML = `
        <div class="text-white font-bold text-sm mb-2">Your Licenses</div>
        <div id="licenses-scroll-rect" style="max-height: 280px; overflow-y: auto; margin-top: 8px;">
            <div class="text-neutral-400 text-xs text-center py-4">Loading...</div>
        </div>
    `;

    try
    {
        const response = await fetch(`${await Api.GetApiUrl()}/auth/user-licenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                discordId: discordId,
                loginToken: token
            })
        });
        const data = await response.json();

        const licenses = data.ok && data.licenses ? data.licenses : [];
        setCachedLicenses(licenses);
        RenderLicenses(menu, licenses, token);
        return true;
    } catch(e)
    {
        menu.innerHTML = `
            <div class="text-white font-bold text-sm mb-2">Your Licenses</div>
            <div id="licenses-scroll-rect" style="max-height: 280px; overflow-y: auto; margin-top: 8px;">
                <div class="text-neutral-400 text-xs text-center py-4">Failed to load licenses</div>
            </div>
        `;

        return false;
    }
}

async function loadWeeklyProgress(token)
{
    const slot = document.getElementById('weekly-progress-slot');
    if(!slot || !token) return;
    try
    {
        const res = await fetch(`${await Api.GetApiUrl()}/workink/usage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionToken: token })
        });
        const data = await res.json();
        if(!data.ok || !data.threshold_seconds) { slot.innerHTML = ''; return; }

        const seconds = Math.max(0, Number(data.seconds) || 0);
        const threshold = data.threshold_seconds;
        const pct = Math.min(100, Math.round((seconds / threshold) * 100));
        const hours = Math.floor(seconds / 3600);
        const thresholdHours = Math.round(threshold / 3600);
        const remaining = Math.max(0, thresholdHours - hours);
        const note = pct >= 100
            ? 'Milestone reached — a free key is ready!'
            : `Use Sheldon ${remaining} more hour${remaining === 1 ? '' : 's'} this week for a free key.`;

        slot.innerHTML = `
            <div style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.5); font-weight:700;">Weekly usage</span>
                    <span style="font-size:12px; color:#c7b18f; font-weight:700;">${hours} / ${thresholdHours} hours</span>
                </div>
                <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#c7b18f,#e6d3b5); border-radius:3px;"></div>
                </div>
                <div style="font-size:10px; color:rgba(255,255,255,0.35); margin-top:6px;">${note}</div>
            </div>
        `;
    }
    catch(e)
    {
        if(slot) slot.innerHTML = '';
    }
}

function RenderLicenses(menu, licenses, token)
{
    const validLicenses = (licenses || []).filter(l =>
    {
        if (l.banned || l.disabled) return false;
        if (l.expires_at && l.expires_at !== -1 && Date.now() > l.expires_at) return false;
        return true;
    });

    if(validLicenses.length > 0)
    {
        const licensesHtml = validLicenses.map(lic => `
            <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; color: #c7b18f; word-break: break-all;">${lic.key}</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 1px;">${lic.product}</div>
                </div>
                <button class="copy-license-btn" data-key="${lic.key}" style="background: rgba(255,255,255,0.1); border: none; border-radius: 6px; padding: 6px; cursor: pointer; color: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; transition: all 0.2s; width: 28px; height: 28px; position: relative;">
                    <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: all 0.2s;">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c7b18f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; opacity: 0; transform: scale(0.5); transition: all 0.2s;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
            </div>
        `).join('');

        menu.innerHTML = `
            <div id="weekly-progress-slot"></div>
            <div class="text-white font-bold text-sm mb-2">Your Licenses</div>
            <div id="licenses-scroll-rect" style="max-height: 280px; overflow-y: auto; margin-top: 8px;">
                ${licensesHtml}
            </div>
        `;
        loadWeeklyProgress(token);

        document.querySelectorAll('.copy-license-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.getAttribute('data-key');
                navigator.clipboard.writeText(key).then(() => {
                    const copyIcon = this.querySelector('.copy-icon');
                    const checkIcon = this.querySelector('.check-icon');
                    
                    this.style.background = 'rgba(199, 177, 143, 0.3)';
                    copyIcon.style.opacity = '0';
                    copyIcon.style.transform = 'scale(0.5)';
                    checkIcon.style.opacity = '1';
                    checkIcon.style.transform = 'scale(1)';
                    
                    setTimeout(() => {
                        copyIcon.style.opacity = '1';
                        copyIcon.style.transform = 'scale(1)';
                        checkIcon.style.opacity = '0';
                        checkIcon.style.transform = 'scale(0.5)';
                        this.style.background = 'rgba(255,255,255,0.1)';
                    }, 1200);
                });
            });
        });

        const scrollRect = document.getElementById('licenses-scroll-rect');
        if (scrollRect) {
            scrollRect.style.scrollbarWidth = 'thin';
            scrollRect.style.scrollbarColor = 'rgba(255,255,255,0.2) transparent';
            scrollRect.style.msOverflowStyle = 'none';
            scrollRect.style.overflowY = 'auto';
            scrollRect.style.paddingRight = '4px';
        }
        
        const style = document.createElement('style');
        style.textContent = `
            #licenses-scroll-rect::-webkit-scrollbar { width: 6px; }
            #licenses-scroll-rect::-webkit-scrollbar-track { background: transparent; }
            #licenses-scroll-rect::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
            #licenses-scroll-rect::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        `;
        document.head.appendChild(style);
        appendCookieSettingsButton(menu);
    }
    else
    {
        menu.innerHTML = `
            <div id="weekly-progress-slot"></div>
            <div class="text-white font-bold text-sm mb-2">Your Licenses</div>
            <div id="licenses-scroll-rect" style="max-height: 280px; overflow-y: auto; margin-top: 8px;">
                <div class="text-neutral-400 text-xs text-center py-4">No licenses found</div>
            </div>
        `;
        loadWeeklyProgress(token);
        appendCookieSettingsButton(menu);
    }
}

if(userProfileTrigger)
{
    userProfileTrigger.addEventListener("click", function(e)
    {
        e.stopPropagation();
        const menu = CreateLicensesMenu();
        const isVisible = menu.style.display === 'block';

        ToggleLicensesMenu(!isVisible);
    });
}

document.addEventListener('click', function(e)
{
    if(userMenu && !userMenu.contains(e.target) && !userProfileTrigger?.contains(e.target))
    {
        userMenu.style.display = 'none';
    }
});
document.querySelectorAll('.discord-login-btn').forEach(btn =>
{
    btn.addEventListener("click", DiscordBtnHandler);
});
document.addEventListener('DOMContentLoaded', CheckAuthStatus);