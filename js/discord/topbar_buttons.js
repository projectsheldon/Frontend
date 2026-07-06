import Api from "../util/backend.js";
import { CheckAuthStatus, DiscordAuth, UpdateUI } from "./auth.js";

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

function DiscordBtnHandler()
{
    if(window.DiscordAuth.currentUser)
    {
        window.DiscordAuth.DeleteSessionToken();
        window.DiscordAuth.currentUser = null;
        UpdateUI();
    } else
    {
        window.DiscordAuth.LoginPopup();
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

function RenderLicenses(menu, licenses, token)
{
    if(licenses.length > 0)
    {
        const licensesHtml = licenses.map(lic => `
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
            <div class="text-white font-bold text-sm mb-2">Your Licenses</div>
            <div id="licenses-scroll-rect" style="max-height: 280px; overflow-y: auto; margin-top: 8px;">
                ${licensesHtml}
            </div>
        `;

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
    }
    else
    {
        menu.innerHTML = `
            <div class="text-white font-bold text-sm mb-2">Your Licenses</div>
            <div id="licenses-scroll-rect" style="max-height: 280px; overflow-y: auto; margin-top: 8px;">
                <div class="text-neutral-400 text-xs text-center py-4">No licenses found</div>
            </div>
        `;
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