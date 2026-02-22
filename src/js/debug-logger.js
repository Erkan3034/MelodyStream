// ── MelodyStream Debug Logger ──────────────────────────────────
// Diagnostic logging system for PWA background playback debugging

const DB_NAME = 'MelodyDebugLogs';
const STORE_NAME = 'logs';
const MAX_LOGS = 300;

let db = null;
let panelInitialized = false;
let autoScroll = true;

/**
 * YT State Helper
 */
export function ytStateLabel(stateNumber) {
    const states = {
        '-1': 'UNSTARTED',
        '0': 'ENDED',
        '1': 'PLAYING',
        '2': 'PAUSED',
        '3': 'BUFFERING',
        '5': 'CUED'
    };
    return states[stateNumber] || `UNKNOWN(${stateNumber})`;
}

/**
 * Initialize IndexedDB
 */
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e);
    });
}

/**
 * Core logging function
 */
export async function mlog(level, category, message, data = null) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        category,
        message,
        data: data ? JSON.stringify(data) : null,
        t: performance.now()
    };

    // Print to console too
    const styles = {
        INFO: 'color: #4fc3f7',
        WARN: 'color: #ffb74d',
        ERROR: 'color: #ef5350; font-weight: bold',
        EVENT: 'color: #81c784',
        STATE: 'color: #ce93d8'
    };
    console.log(`%c[${level}][${category}] ${message}`, styles[level] || '', data || '');

    if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.add(entry);

        // Prune oldest
        store.count().onsuccess = (e) => {
            if (e.target.result > MAX_LOGS) {
                store.openCursor().onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (cursor) store.delete(cursor.primaryKey);
                };
            }
        };
    }

    if (panelInitialized) {
        updateUI(entry);
    }
}

export const minfo = (cat, msg, data) => mlog('INFO', cat, msg, data);
export const mwarn = (cat, msg, data) => mlog('WARN', cat, msg, data);
export const merror = (cat, msg, data) => mlog('ERROR', cat, msg, data);
export const mevent = (cat, msg, data) => mlog('EVENT', cat, msg, data);
export const mstate = (cat, msg, data) => mlog('STATE', cat, msg, data);

/**
 * Export Logs
 */
export function exportLogs() {
    return new Promise((resolve) => {
        if (!db) return resolve([]);
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        store.getAll().onsuccess = (e) => resolve(e.target.result);
    });
}

/**
 * Clear Logs
 */
export async function clearLogs() {
    if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
    }
    const container = document.getElementById('debug-log-container');
    if (container) container.innerHTML = '';
}

/**
 * UI Injection
 */
function injectUI() {
    if (document.getElementById('debug-toggle-btn')) return;

    // Toggle Button
    const btn = document.createElement('button');
    btn.id = 'debug-toggle-btn';
    btn.innerHTML = '🪲';
    btn.style.cssText = `
        position: fixed; bottom: 85px; right: 12px; z-index: 10001;
        width: 44px; height: 44px; border-radius: 50%; border: none;
        background: #333; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 20px; transition: transform 0.2s;
    `;
    btn.onclick = () => {
        const panel = document.getElementById('debug-panel');
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        if (panel.style.display === 'flex') {
            const container = document.getElementById('debug-log-container');
            container.scrollTop = container.scrollHeight;
        }
    };

    // Panel
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
        position: fixed; bottom: 140px; right: 12px; z-index: 10000;
        width: min(500px, 100vw - 24px); height: 60vh; background: #121212;
        border-radius: 12px; border: 1px solid #333; display: none;
        flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.8);
        font-family: 'JetBrains Mono', 'Consolas', monospace; color: #eee;
        overflow: hidden;
    `;

    panel.innerHTML = `
        <div style="padding: 12px; background: #1e1e1e; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 14px;">Melody Debug Logger</span>
            <div style="display: flex; gap: 8px;">
                <button id="dl-export-btn" style="background: #2a2a2a; border: 1px solid #444; color: #4fc3f7; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">⬇ JSON</button>
                <button id="dl-clear-btn" style="background: #2a2a2a; border: 1px solid #444; color: #ef5350; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">🗑 Temizle</button>
            </div>
        </div>
        <div id="debug-status-bar" style="padding: 6px 12px; background: #222; font-size: 11px; color: #aaa; border-bottom: 1px solid #333; display: flex; gap: 12px; flex-wrap: wrap;">
            <span>Visibility: <b id="st-vis">-</b></span>
            <span>OS: <b id="st-os">-</b></span>
            <span>Time: <b id="st-time">-</b></span>
        </div>
        <div id="debug-log-container" style="flex: 1; overflow-y: auto; padding: 4px 0; font-size: 12px;"></div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    document.getElementById('dl-clear-btn').onclick = clearLogs;
    document.getElementById('dl-export-btn').onclick = async () => {
        const logs = await exportLogs();
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `melodystream-logs-${new Date().getTime()}.json`;
        a.click();
    };

    // Auto status updates
    setInterval(() => {
        const vis = document.hidden ? 'HIDDEN' : 'VISIBLE';
        const ms = ('mediaSession' in navigator) ? 'SUPPORTED' : 'NONE';
        const now = new Date().toLocaleTimeString();

        const visEl = document.getElementById('st-vis');
        if (visEl) visEl.textContent = vis;

        const osEl = document.getElementById('st-os');
        if (osEl) osEl.textContent = ms;

        const timeEl = document.getElementById('st-time');
        if (timeEl) timeEl.textContent = now;
    }, 1000);

    panelInitialized = true;

    // Initial fetch from DB
    exportLogs().then(logs => {
        logs.forEach(updateUI);
    });
}

function updateUI(entry) {
    const container = document.getElementById('debug-log-container');
    if (!container) return;

    const colors = {
        INFO: '#4fc3f7',
        WARN: '#ffb74d',
        ERROR: '#ef5350',
        EVENT: '#81c784',
        STATE: '#ce93d8'
    };

    const date = new Date(entry.ts);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;

    const row = document.createElement('div');
    row.style.cssText = 'padding: 4px 12px; border-bottom: 1px solid #222; display: flex; gap: 8px; line-height: 1.4;';
    row.innerHTML = `
        <span style="color: #666; flex-shrink: 0; min-width: 85px;">${timeStr}</span>
        <span style="color: ${colors[entry.level] || '#fff'}; font-weight: bold; flex-shrink: 0; min-width: 50px;">[${entry.level}]</span>
        <span style="color: #999; flex-shrink: 0; min-width: 80px;">[${entry.category}]</span>
        <span style="word-break: break-all;">${entry.message} ${entry.data ? `<i style="color: #666; font-size: 11px;">${entry.data}</i>` : ''}</span>
    `;

    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    container.appendChild(row);
    if (isAtBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Initialize
 */
export async function initDebugLogger() {
    await initDB();
    injectUI();

    minfo('INIT', 'Debug logger initialized', {
        ua: navigator.userAgent,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        mediaSession: ('mediaSession' in navigator),
        wakeLock: ('wakeLock' in navigator)
    });

    // Auto system listeners
    document.addEventListener('visibilitychange', () => {
        mevent('VISIBILITY', `Document is now ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`);
    });

    window.addEventListener('online', () => mevent('NETWORK', 'Browser is ONLINE'));
    window.addEventListener('offline', () => mevent('NETWORK', 'Browser is OFFLINE'));

    window.onerror = (msg, url, line, col, error) => {
        merror('GLOBAL', `Uncaught Error: ${msg}`, { url, line, error: error?.message });
    };

    window.addEventListener('unhandledrejection', (event) => {
        merror('GLOBAL', 'Unhandled Promise Rejection', { reason: event.reason?.message || event.reason });
    });
}
