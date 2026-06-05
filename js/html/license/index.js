// License page script
import Api from "../../util/backend.js";
import { DiscordAuth } from "../../discord/auth.js";

let keys = [];

const copyIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

window.escapeHtml = function(str)
{
    if(typeof str !== "string") return "";
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    return str.replace(/[&<>"'\/]/g, c => map[c]);
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
    const list = document.getElementById('license-list');

    async function tryWorkinkToken(tokenVal)
    {
        let sessionToken = localStorage.getItem('discord_session');
        if(!sessionToken) return null;

        let discordId = window.DiscordAuth?.currentUser?.id || null;
        if(!discordId)
        {
            const user = window.DiscordAuth?.currentUser || await DiscordAuth.GetUser();
            if(user) discordId = user.id;
        }

        try
        {
            const apiUrl = await Api.GetApiUrl();
            const response = await fetch(`${apiUrl}/workink/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: tokenVal, discordId, sessionToken })
            });
            return await response.json();
        }
        catch(e)
        {
            return null;
        }
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
                    const user = window.DiscordAuth?.currentUser || await DiscordAuth.GetUser();
                    if(user)
                    {
                        discordId = user.id;
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
            } else if(data.ok && data.new_balance !== undefined)
            {
                const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
                const oldBalance = data.new_balance - added;
                sessionStorage.setItem('balance_added', String(added));
                sessionStorage.setItem('balance_old', String(Math.max(0, oldBalance)));
                window.location.href = '/?balance=' + added;
                return;
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

    const singleKey = urlParams.get('key');
    if(singleKey)
    {
        const data = await tryWorkinkToken(singleKey);
        if(data && data.ok && data.license)
        {
            keys = [ { key: data.license.key, tier: data.license.product } ];
            render();
            return;
        }
        else if(data && data.ok && data.new_balance !== undefined)
        {
            const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
            const oldBalance = data.new_balance - added;
            sessionStorage.setItem('balance_added', String(added));
            sessionStorage.setItem('balance_old', String(Math.max(0, oldBalance)));
            window.location.href = '/?balance=' + added;
            return;
        }

        const colonIdx = singleKey.indexOf(':');
        if(colonIdx !== -1)
        {
            const key = singleKey.substring(0, colonIdx).trim();
            const tier = singleKey.substring(colonIdx + 1).trim();
            keys = [{ key, tier: tier || 'License' }];
        }
        else
        {
            keys = [{ key: singleKey.trim(), tier: 'License' }];
        }
        render();
        return;
    }

    const showKeys = urlParams.get('showKeys');
    if(showKeys)
    {
        try
        {
            const keyList = showKeys.split(',');
            keys = keyList.map(entry =>
            {
                const colonIdx = entry.indexOf(':');
                if(colonIdx === -1)
                {
                    const key = entry.trim();
                    return { key: key, tier: 'License' };
                }
                
                const key = entry.substring(0, colonIdx).trim();
                const tier = entry.substring(colonIdx + 1).trim();
                
                return { key: key, tier: tier || 'License' };
            })
            .filter(item => item.key.length > 0 && item.key.length <= 128);
        }
        catch(e)
        {
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