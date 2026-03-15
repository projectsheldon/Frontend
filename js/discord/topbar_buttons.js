import Api from "../util/backend.js";
import { CheckAuthStatus, DiscordAuth, UpdateUI } from "./auth.js";

const discordBtn = document.getElementById('discord-login-btn');
const userProfileTrigger = document.getElementById('user-profile-trigger');

let userMenu = null;

window.addEventListener('message', function(event)
{
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
        max-height: 450px;
        background: rgba(30, 30, 30, 0.98);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 16px;
        z-index: 10000;
        display: none;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        overflow-y: auto;
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

    const user = await DiscordAuth.GetUser();
    if (!user) {
        menu.innerHTML = `
            <div class="text-neutral-400 text-sm text-center py-4">Failed to load user</div>
        `;
        return;
    }
    
    const discordId = user.id;

    menu.innerHTML = `
        <div class="text-white font-bold text-sm mb-4">Your Licenses</div>
        <div class="text-neutral-400 text-xs text-center py-4">Loading...</div>
    `;

    try
    {
        const response = await fetch(`http://localhost:3350/auth/user-licenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                discordId: discordId,
                loginToken: token
            })
        });
        const data = await response.json();

        if(data.ok && data.licenses && data.licenses.length > 0)
        {
            const licensesHtml = data.licenses.slice(0, 5).map(lic => `
                <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 8px;">
                    <div style="font-family: monospace; font-size: 11px; color: #c7b18f; word-break: break-all;">${lic.key}</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">${lic.product}</div>
                </div>
            `).join('');

            const moreText = data.licenses.length > 5 ? `<div class="text-center text-neutral-500 text-xs mt-2">+${data.licenses.length - 5} more</div>` : '';

            menu.innerHTML = `
                <div class="text-white font-bold text-sm mb-4">Your Licenses</div>
                ${licensesHtml}
                ${moreText}
            `;

            return true;
        } 
        else
        {
            menu.innerHTML = `
                <div class="text-white font-bold text-sm mb-4">Your Licenses</div>
                <div class="text-neutral-400 text-xs text-center py-4">No licenses found</div>
            `;
            return true;
        }
    } catch(e)
    {
        menu.innerHTML = `
            <div class="text-white font-bold text-sm mb-4">Your Licenses</div>
            <div class="text-neutral-400 text-xs text-center py-4">Failed to load licenses</div>
        `;

        return false;
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