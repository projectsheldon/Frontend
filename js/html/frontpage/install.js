import Api from '../../util/backend.js';
import { extractArchive, buildDeliverable, saveBlob } from '../../util/installer.js';

const MODAL_CSS = `
#install-modal {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center;
    font-family: 'Inter', sans-serif;
}
#install-modal.show { display: flex; }
#install-modal .modal-box {
    background: #111; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 24px; padding: 2.5rem 3rem;
    max-width: 560px; width: 92%;
    text-align: center;
}
#install-modal .modal-title {
    font-size: 1.5rem; font-weight: 800; color: #fff;
    margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;
}
#install-modal .modal-sub {
    font-size: 0.95rem; font-weight: 500; color: #999; margin-bottom: 1.75rem;
}
#install-modal .close-btn {
    padding: 0.75rem 2rem; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
    color: #888; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s;
}
#install-modal .close-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
#install-modal .error-msg { color: #ef4444; font-size: 0.9rem; font-weight: 500; margin-bottom: 1rem; }
#install-modal .loader {
    border: 3px solid rgba(255,255,255,0.06); border-top-color: #c7b18f;
    border-radius: 50%; width: 32px; height: 32px;
    animation: modalSpin 0.8s linear infinite; margin: 1.25rem auto;
}
@keyframes modalSpin { to { transform: rotate(360deg); } }
#install-modal #im-progress-wrap {
    display: none; height: 6px; background: rgba(255,255,255,0.08);
    border-radius: 3px; overflow: hidden; margin: 0.75rem 0 0.25rem;
}
#install-modal #im-progress-bar {
    height: 100%; width: 0%; border-radius: 3px;
    background: linear-gradient(90deg,#c7b18f,#e6d3b5); transition: width 0.2s ease;
}
#install-modal #im-actions, #install-modal #im-error-actions {
    display: none; gap: 1rem; justify-content: center; margin-top: 0.5rem;
}
#install-modal .close-btn.accent {
    background: rgba(199,177,143,0.15); border-color: rgba(199,177,143,0.25); color: #c7b18f;
}
#install-modal .close-btn.accent:hover {
    background: rgba(199,177,143,0.25); color: #fff;
}
`;

const MODAL_HTML = `
<div id="install-modal">
    <div class="modal-box">
        <div id="im-loader" class="loader"></div>
        <div class="modal-title" id="im-title">Preparing…</div>
        <div class="modal-sub" id="im-sub">Starting</div>
        <div id="im-progress-wrap"><div id="im-progress-bar"></div></div>
        <div id="im-actions">
            <button class="close-btn accent" id="im-save-again">Save file</button>
            <button class="close-btn" id="im-close-modal">Close</button>
        </div>
        <div id="im-error" class="error-msg" style="display:none;"></div>
        <div id="im-error-actions">
            <button class="close-btn accent" id="im-fallback">Get .7z archive</button>
            <button class="close-btn" id="im-close-error">Close</button>
        </div>
    </div>
</div>
`;

let _inited = false;
let _lastDeliverable = null;
let _installing = false;

let imModal, imLoader, imTitle, imSub, imProgressWrap, imProgressBar,
    imActions, imError, imErrorActions;

function ensureModal() {
    if (_inited) return;

    const style = document.createElement('style');
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);

    const holder = document.createElement('div');
    holder.innerHTML = MODAL_HTML.trim();
    document.body.appendChild(holder.firstElementChild);

    imModal = document.getElementById('install-modal');
    imLoader = document.getElementById('im-loader');
    imTitle = document.getElementById('im-title');
    imSub = document.getElementById('im-sub');
    imProgressWrap = document.getElementById('im-progress-wrap');
    imProgressBar = document.getElementById('im-progress-bar');
    imActions = document.getElementById('im-actions');
    imError = document.getElementById('im-error');
    imErrorActions = document.getElementById('im-error-actions');

    const imSaveAgain = document.getElementById('im-save-again');
    const imClose = document.getElementById('im-close-modal');
    const imFallback = document.getElementById('im-fallback');
    const imCloseError = document.getElementById('im-close-error');

    const closeModal = () => imModal.classList.remove('show');
    imClose?.addEventListener('click', closeModal);
    imCloseError?.addEventListener('click', closeModal);
    imModal.addEventListener('click', (e) => { if (e.target === imModal) closeModal(); });

    imSaveAgain?.addEventListener('click', () => {
        if (_lastDeliverable) saveBlob(_lastDeliverable.blob, _lastDeliverable.name);
    });

    // Last resort: hand over the raw .7z link so the user is never stuck.
    imFallback?.addEventListener('click', async () => {
        try
        {
            const token = window.DiscordAuth?.GetSessionToken?.();
            const apiUrl = await Api.GetApiUrl();
            const res = await fetch(`${apiUrl}/download/url`, {
                mode: 'cors', credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            const data = await res.json().catch(() => null);
            if (data && data.ok && data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
        } catch (e) {}
    });

    _inited = true;
}

function imClearState() {
    imLoader.style.display = 'none';
    imTitle.style.display = 'none';
    imSub.style.display = 'none';
    if (imProgressWrap) imProgressWrap.style.display = 'none';
    if (imActions) imActions.style.display = 'none';
    imError.style.display = 'none';
    if (imErrorActions) imErrorActions.style.display = 'none';
}

function imShowLoading(title, sub) {
    imClearState();
    imModal.classList.add('show');
    imLoader.style.display = 'block';
    imTitle.style.display = 'block';
    imSub.style.display = 'block';
    imTitle.textContent = title;
    imSub.textContent = sub;
}

function imSetProgress(pct) {
    imTitle.textContent = 'Loading…';
    imSub.textContent = pct + '%';
    if (imProgressWrap) imProgressWrap.style.display = 'block';
    if (imProgressBar) imProgressBar.style.width = pct + '%';
}

function imShowDone(name) {
    imClearState();
    imTitle.style.display = 'block';
    imSub.style.display = 'block';
    imTitle.textContent = 'Installer ready ✓';
    imSub.textContent = 'Saved "' + name + '" to your device. If it didn\'t start, tap Save file.';
    if (imActions) imActions.style.display = 'flex';
}

function imShowError(msg) {
    imClearState();
    imError.textContent = msg;
    imError.style.display = 'block';
    if (imErrorActions) imErrorActions.style.display = 'flex';
}

async function readWithProgress(res, onPct) {
    const total = Number(res.headers.get('Content-Length')) || 0;
    if (!res.body || !total) {
        const buf = new Uint8Array(await res.arrayBuffer());
        onPct(100);
        return buf;
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onPct(Math.min(99, Math.floor((received / total) * 100)));
    }

    const out = new Uint8Array(received);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    onPct(100);
    return out;
}

export async function runInstall() {
    ensureModal();
    if (_installing) return;
    _installing = true;
    _lastDeliverable = null;

    imShowLoading('Preparing…', 'Starting secure transfer');

    try
    {
        const token = window.DiscordAuth?.GetSessionToken?.();
        const apiUrl = await Api.GetApiUrl();

        const res = await fetch(`${apiUrl}/download/bytes`, {
            mode: 'cors',
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (res.status === 401) throw new Error('Please log in again to continue.');
        if (!res.ok) throw new Error('Install failed. Please try again.');

        const bytes = await readWithProgress(res, imSetProgress);

        imShowLoading('Extracting…', 'Unpacking the installer');
        const files = await extractArchive(bytes);

        const deliverable = buildDeliverable(files);
        _lastDeliverable = deliverable;
        saveBlob(deliverable.blob, deliverable.name);

        imShowDone(deliverable.name);
    }
    catch (err) {
        imShowError((err && err.message) ? err.message : 'Installation failed. Please try again.');
    }
    finally
    {
        _installing = false;
    }
}
