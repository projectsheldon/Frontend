// License page script
import Api from "../../util/backend.js";

let keys = [];

const copyIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

window.escapeHtml = function(str)
{
    if(typeof str !== "string") return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

window.isValidLicenseKey = function(key)
{
    if(typeof key !== "string") return false;
    return /^ps-[A-Z0-9]{4}-[A-Z0-9]{7}-[A-Z0-9]{3}$/i.test(key);
}

window.isValidProductName = function(name)
{
    if(typeof name !== "string") return false;
    if(name.length > 50) return false;
    return /^[a-zA-Z0-9\s\-]+$/.test(name);
}

window.copyKey = function(btn, val)
{
    const el = document.createElement('textarea');
    el.value = val;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    btn.innerHTML = checkIcon;
    btn.classList.add('success');

    setTimeout(() =>
    {
        btn.innerHTML = copyIcon;
        btn.classList.remove('success');
    }, 2000);
}

function render()
{
    const list = document.getElementById('license-list');
    if(!list) return;

    if(keys.length === 0)
    {
        list.innerHTML = '<p class="text-neutral-500">No licenses found.</p>';
        return;
    }
    list.innerHTML = keys.map(item => `
        <div class="license-item">
            <div style="min-width: 0;">
                <div class="key-text truncate">${window.escapeHtml(item.key)}</div>
                <span class="tier-label">${window.escapeHtml(item.tier || item.product || 'License')}</span>
            </div>
            <div class="copy-btn" title="Copy Key" onclick="copyKey(this, '${window.escapeHtml(item.key)}')">
                ${copyIcon}
            </div>
        </div>
    `).join('');
}

async function loadLicenses()
{
    const urlParams = new URLSearchParams(window.location.search);

    const showKeys = urlParams.get('showKeys');
    if(showKeys)
    {
        const keyList = showKeys.split(',').map(k => k.trim()).filter(k => k);
        keys = keyList.map(item =>
        {
            const parts = item.split(':');
            const key = parts[ 0 ];
            const tierRaw = parts[ 1 ] ? decodeURIComponent(parts[ 1 ]) : '';
            
            if(!window.isValidLicenseKey(key)) return null;
            if(tierRaw && !window.isValidProductName(tierRaw)) return null;
            
            return { key: key, tier: tierRaw };
        }).filter(k => k !== null);
        
        if(keys.length === 0)
        {
            list.innerHTML = '<p class="text-neutral-500">Invalid license key format.</p>';
            return;
        }
        
        render();
        return;
    }

    const token = urlParams.get('token');
    if(token)
    {
        try
        {
            let discordId = window.DiscordAuth?.currentUser?.id || null;
            let sessionToken = localStorage.getItem('discord_session');

            if(!sessionToken)
            {
                list.innerHTML = '<p class="text-neutral-500">Please log in with Discord first to claim your free license.</p>';
                return;
            }

            if(!discordId)
            {
                const sessionToken = localStorage.getItem('discord_session');
                if(sessionToken)
                {
                    const apiUrl = await Api.GetApiUrl();
                    const userRes = await fetch(`${apiUrl}/discord/me?token=` + encodeURIComponent(sessionToken));
                    const userData = await userRes.json();
                    if(userData.success && userData.user)
                    {
                        discordId = userData.user.id;
                    }
                }
            }

            const apiUrl = await Api.GetApiUrl();
            const response = await fetch(`${apiUrl}/workink/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, discordId: discordId, sessionToken: sessionToken })
            });
            const data = await response.json();
            if(data.ok && data.license)
            {
                keys = [ { key: data.license.key, tier: data.license.product } ];
            } else
            {
                keys = [];
                if(data.message === "Not logged in" || data.message === "Invalid session")
                {
                    list.innerHTML = '<p class="text-neutral-500">Please log in with Discord first to claim your free license.</p>';
                    return;
                }
            }
        } catch(e)
        {
            console.error('Failed to generate license:', e);
            keys = [];
        }
        render();
        return;
    }

    render();
}

// Confetti on license success
function triggerConfetti() {
  if (typeof confetti !== 'undefined') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#bb86fc', '#c7b18f', '#5865F2', '#22c55e', '#fbbf24']
    });
  }
}

// Initialize
window.onload = () =>
{
    if(typeof initParticles === 'function')
    {
        initParticles();
    }
    loadLicenses();
};

// Trigger confetti after render if success
const originalRender = render;
render = function() {
  originalRender.apply(this, arguments);
  if (keys.length > 0) {
    setTimeout(triggerConfetti, 500);
  }
};

const originalLoadLicenses = loadLicenses;
loadLicenses = async function() {
  await originalLoadLicenses.apply(this, arguments);
  if (keys.length > 0) {
    setTimeout(triggerConfetti, 800);
  }
};