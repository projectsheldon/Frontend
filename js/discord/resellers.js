import Api from "../util/backend.js";
import { DiscordAuth } from "../discord/auth.js";

async function fetchAdminKey() {
    const apiKey = await Api.GetApiKey();
    return apiKey;
}

async function getApiUrl() {
    return await Api.GetApiUrl();
}

function getStateElements() {
    return {
        loading: document.getElementById('resellers-loading'),
        login: document.getElementById('resellers-login'),
        notMember: document.getElementById('resellers-not-member'),
        dashboard: document.getElementById('resellers-dashboard'),
        adminTabs: document.getElementById('resellers-admin-tabs'),
        public: document.getElementById('resellers-public'),
        verified: document.getElementById('resellers-verified'),
        unverified: document.getElementById('resellers-unverified'),
        deleted: document.getElementById('resellers-deleted')
    };
}

function showState(state) {
    const s = getStateElements();
    
    if (s.loading) s.loading.style.display = state === 'loading' ? 'flex' : 'none';
    if (s.login) s.login.style.display = state === 'login' ? 'block' : 'none';
    if (s.notMember) s.notMember.style.display = state === 'notMember' ? 'block' : 'none';
    if (s.dashboard) s.dashboard.style.display = state === 'dashboard' ? 'block' : 'none';
}

function getDiscordAvatar(discordId, avatar) {
    if (avatar) {
        return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`;
    }
    return `https://cdn.discordapp.com/embed/avatars/0.png?size=64`;
}

export async function loadResellers() {
    const apiUrl = await getApiUrl();
    const adminKey = await fetchAdminKey();
    const isAdmin = adminKey && adminKey.length > 0;
    const s = getStateElements();
    
    const token = DiscordAuth.GetSessionToken();
    
    if (!token) {
        showState('login');
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/me`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            showState('notMember');
            return;
        }
        
        const data = await response.json();
        
        if (!data.ok || !data.reseller) {
            showState('notMember');
            return;
        }
        
        showState('dashboard');
        
        if (isAdmin) {
            if (s.adminTabs) s.adminTabs.classList.remove('hidden');
            switchTab('verified');
        } else {
            if (s.adminTabs) s.adminTabs.classList.add('hidden');
            if (s.public) s.public.classList.remove('hidden');
            if (s.verified) s.verified.classList.add('hidden');
            if (s.unverified) s.unverified.classList.add('hidden');
            loadPublicResellers(apiUrl);
        }
    } catch (err) {
        console.error('Reseller check failed:', err);
        window.Notify?.('Failed to load reseller status. Please try again.', 'error');
        showState('login');
    }
}

async function loadPublicResellers(apiUrl) {
    const container = document.getElementById('resellers-public');
    if (!container) return;
    
    try {
        const response = await fetch(`${apiUrl}/resellers/verified`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.ok || !data.resellers || data.resellers.length === 0) {
            container.innerHTML = '<p class="text-neutral-500 text-center col-span-full py-8">No verified resellers yet.</p>';
            return;
        }
        
        container.innerHTML = data.resellers.map(r => `
            <div class="glass-card p-4 rounded-2xl flex items-center gap-3">
                <img src="${getDiscordAvatar(r.discord_id, r.discord_avatar)}" alt="Avatar" 
                    class="w-12 h-12 rounded-full object-cover">
                <div>
                    <p class="text-white font-bold">${r.discord_username || 'Unknown'}</p>
                    <p class="text-neutral-500 text-xs">Verified Reseller</p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-red-400 text-center col-span-full py-8">Failed to load resellers</p>';
    }
}

async function loadVerifiedResellers(apiUrl) {
    const tbody = document.getElementById('verified-resellers-tbody');
    if (!tbody) return;
    
    const adminKey = await fetchAdminKey();
    
    try {
        const response = await fetch(`${apiUrl}/resellers/verified`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.ok || !data.resellers || data.resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-neutral-500">No verified resellers</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.resellers.map(r => `
            <tr>
                <td><img src="${getDiscordAvatar(r.discord_id, r.discord_avatar)}" alt="Avatar" class="w-10 h-10 rounded-full object-cover"></td>
                <td class="text-white">${r.discord_username || 'Unknown'}</td>
                <td class="text-neutral-400">${r.verified_at ? new Date(r.verified_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    ${adminKey ? `<button onclick="ResellersModule.unverify('${r.discord_id}')" class="text-xs font-bold text-red-400 hover:text-red-300">Unverify</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-400">Failed to load</td></tr>';
    }
}

async function loadUnverifiedResellers(apiUrl) {
    const tbody = document.getElementById('unverified-resellers-tbody');
    if (!tbody) return;
    
    const adminKey = await fetchAdminKey();
    
    if (!adminKey) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-400">Admin key required</td></tr>';
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/unverified?apiKey=${adminKey}`);
        const data = await response.json();
        
        if (!data.ok || !data.resellers || data.resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-neutral-500">No unverified resellers</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.resellers.map(r => `
            <tr>
                <td><img src="${getDiscordAvatar(r.discord_id, r.discord_avatar)}" alt="Avatar" class="w-10 h-10 rounded-full object-cover"></td>
                <td class="text-white">${r.discord_username || 'Unknown'}</td>
                <td class="text-neutral-400">${r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button onclick="ResellersModule.verify('${r.discord_id}')" class="text-xs font-bold text-green-400 hover:text-green-300">Verify</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-400">Failed to load</td></tr>';
    }
}

async function loadDeletedResellers(apiUrl) {
    const tbody = document.getElementById('deleted-resellers-tbody');
    if (!tbody) return;
    
    const adminKey = await fetchAdminKey();
    
    if (!adminKey) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-400">Admin key required</td></tr>';
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/deleted?apiKey=${adminKey}`);
        const data = await response.json();
        
        if (!data.ok || !data.resellers || data.resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-neutral-500">No deleted resellers</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.resellers.map(r => {
            const threeDays = 3 * 24 * 60 * 60 * 1000;
            const timeSince = Date.now() - r.deleted_at;
            const hoursLeft = Math.max(0, Math.ceil((threeDays - timeSince) / (60 * 60 * 1000)));
            const daysLeft = Math.floor(hoursLeft / 24);
            const remainingHours = hoursLeft % 24;
            
            let timeLeftStr = '';
            if (daysLeft > 0) timeLeftStr += `${daysLeft}d `;
            if (remainingHours > 0) timeLeftStr += `${remainingHours}h`;
            
            return `
            <tr>
                <td><img src="${getDiscordAvatar(r.discord_id, r.discord_avatar)}" alt="Avatar" class="w-10 h-10 rounded-full object-cover"></td>
                <td class="text-white">${r.discord_username || 'Unknown'}</td>
                <td class="text-neutral-400">${r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : 'N/A'}</td>
                <td class="text-neutral-400">${timeLeftStr}</td>
                <td>
                    <button onclick="ResellersModule.removeCooldown('${r.discord_id}')" class="text-xs font-bold text-yellow-400 hover:text-yellow-300">Remove Cooldown</button>
                </td>
            </tr>
        `}).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-400">Failed to load</td></tr>';
    }
}

export async function switchTab(tab) {
    const s = getStateElements();
    const adminKey = await fetchAdminKey();
    const apiUrl = await getApiUrl();
    
    document.querySelectorAll('#resellers-admin-tabs .nav-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'verified') {
        if (s.public) s.public.classList.add('hidden');
        if (s.verified) s.verified.style.display = 'block';
        if (s.unverified) s.unverified.style.display = 'none';
        if (s.deleted) s.deleted.style.display = 'none';
        loadVerifiedResellers(apiUrl);
    } else if (tab === 'unverified') {
        if (s.public) s.public.classList.add('hidden');
        if (s.verified) s.verified.style.display = 'none';
        if (s.unverified) s.unverified.style.display = 'block';
        if (s.deleted) s.deleted.style.display = 'none';
        loadUnverifiedResellers(apiUrl);
    } else if (tab === 'deleted') {
        if (s.public) s.public.classList.add('hidden');
        if (s.verified) s.verified.style.display = 'none';
        if (s.unverified) s.unverified.style.display = 'none';
        if (s.deleted) s.deleted.style.display = 'block';
        loadDeletedResellers(apiUrl);
    }
}

export async function verify(discordId) {
    const apiUrl = await getApiUrl();
    const adminKey = await fetchAdminKey();
    
    if (!adminKey) {
        window.Notify?.('Admin key required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/verify?apiKey=${adminKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discord_id: discordId })
        });
        const data = await response.json();
        
        if (data.ok) {
            window.Notify?.('Reseller verified successfully', 'success');
            loadVerifiedResellers(apiUrl);
            loadUnverifiedResellers(apiUrl);
        } else {
            window.Notify?.(data.message || 'Failed to verify', 'error');
        }
    } catch (err) {
        window.Notify?.('Error: ' + err.message, 'error');
    }
}

export async function unverify(discordId) {
    const apiUrl = await getApiUrl();
    const adminKey = await fetchAdminKey();
    
    if (!adminKey) {
        window.Notify?.('Admin key required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/unverify?apiKey=${adminKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discord_id: discordId })
        });
        const data = await response.json();
        
        if (data.ok) {
            window.Notify?.('Reseller unverified successfully', 'success');
            loadVerifiedResellers(apiUrl);
            loadUnverifiedResellers(apiUrl);
        } else {
            window.Notify?.(data.message || 'Failed to unverify', 'error');
        }
    } catch (err) {
        window.Notify?.('Error: ' + err.message, 'error');
    }
}

export async function createReseller() {
    const input = document.getElementById('new-reseller-discord-id');
    const discordId = input?.value?.trim();
    const apiUrl = await getApiUrl();
    const adminKey = await fetchAdminKey();
    
    if (!discordId) {
        window.Notify?.('Please enter a Discord ID', 'error');
        return;
    }
    
    if (!adminKey) {
        window.Notify?.('Admin key required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/create?apiKey=${adminKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discord_id: discordId })
        });
        const data = await response.json();
        
        if (data.ok) {
            window.Notify?.('Reseller created successfully', 'success');
            input.value = '';
            loadUnverifiedResellers(apiUrl);
        } else {
            window.Notify?.(data.message || 'Failed to create', 'error');
        }
    } catch (err) {
        window.Notify?.('Error: ' + err.message, 'error');
    }
}

export async function logout() {
    const apiUrl = await getApiUrl();
    try {
        await fetch(`${apiUrl}/discord/logout`, { method: "POST" });
    } catch (e) {}
    DiscordAuth.DeleteSessionToken();
    showState('login');
}

export async function removeCooldown(discordId) {
    const apiUrl = await getApiUrl();
    const adminKey = await fetchAdminKey();
    
    if (!adminKey) {
        window.Notify?.('Admin key required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/resellers/remove-cooldown?apiKey=${adminKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discord_id: discordId })
        });
        const data = await response.json();
        
        if (data.ok) {
            window.Notify?.('Cooldown removed', 'success');
            loadDeletedResellers(apiUrl);
        } else {
            window.Notify?.(data.message || 'Failed to remove cooldown', 'error');
        }
    } catch (err) {
        window.Notify?.('Error: ' + err.message, 'error');
    }
}

window.ResellersModule = {
    loadResellers,
    switchTab,
    verify,
    unverify,
    createReseller,
    logout,
    removeCooldown
};
