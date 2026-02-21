// =========================================
// MelodyStream — Media Session API
// Background playback & notification controls
// =========================================

import * as state from './state.js';

// ── Silent audio keep-alive ────────────────────────────────────
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAQKAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

let silentAudio = null;
let wakeLock = null;
let _resumeAfterHide = false;
let _sessionHeartbeat = null;

function ensureSilentAudio() {
    if (silentAudio) return;
    silentAudio = new Audio(SILENT_MP3);
    silentAudio.loop = true;
    silentAudio.volume = 0.01; // Slighting higher for some browsers to detect activity

    // Recovery if the audio stalls
    silentAudio.addEventListener('pause', () => {
        if (state.isPlaying) {
            setTimeout(() => { if (state.isPlaying) silentAudio.play().catch(() => { }); }, 100);
        }
    });
}

export function enableBackgroundPlayback() {
    ensureSilentAudio();
    if (silentAudio.paused) {
        silentAudio.play().catch(() => {
            const tryOnce = () => {
                silentAudio.play().catch(() => { });
                document.removeEventListener('click', tryOnce);
                document.removeEventListener('touchstart', tryOnce);
            };
            document.addEventListener('click', tryOnce, { once: true });
            document.addEventListener('touchstart', tryOnce, { once: true });
        });
    }
}

export function disableBackgroundPlayback() {
    silentAudio?.pause();
    stopSessionHeartbeat();
}

// ── WakeLock ───────────────────────────────────────────────────
export async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        if (wakeLock) { try { await wakeLock.release(); } catch { } }
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            wakeLock = null;
            if (state.isPlaying) setTimeout(() => { if (state.isPlaying) requestWakeLock(); }, 1000);
        });
    } catch { }
}

export function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => { });
        wakeLock = null;
    }
}

// ── Visibility / Lifecycle ────────────────────────────────────
function handleVisibilityChange() {
    if (document.hidden) {
        if (state.isPlaying) {
            _resumeAfterHide = true;
            enableBackgroundPlayback();
        }
    } else {
        if (_resumeAfterHide && state.isPlaying) {
            _resumeAfterHide = false;
            setTimeout(() => {
                const player = state.youtubePlayer;
                if (player && state.playerReady) {
                    const ps = player.getPlayerState?.();
                    if (ps === 2 || ps === -1) player.playVideo();
                }
                enableBackgroundPlayback();
                requestWakeLock();
            }, 300);
        }
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);

// ── Media Session metadata / controls ─────────────────────────
let _lastMetadata = null;
let _lastHandlers = null;

export function updateMediaSession(song, handlers) {
    if (!('mediaSession' in navigator)) return;

    _lastMetadata = song;
    _lastHandlers = handlers;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'MelodiStream',
        artist: song.channelTitle || 'Bilinmeyen Sanatçı',
        album: 'MelodyStream',
        artwork: [
            { src: song.thumbnail, sizes: '96x96', type: 'image/jpeg' },
            { src: song.thumbnail, sizes: '192x192', type: 'image/jpeg' },
            { src: song.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
    });

    // Register handlers
    const actionHandlers = [
        ['play', handlers.onPlay],
        ['pause', handlers.onPause],
        ['previoustrack', handlers.onPrevious],
        ['nexttrack', handlers.onNext],
        ['seekto', (details) => {
            handlers.onSeek?.(details.seekTime);
            updateMediaSessionPlaybackState(true);
        }]
    ];

    actionHandlers.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            console.warn(`MediaSession action ${action} not supported.`);
        }
    });

    updateMediaSessionPlaybackState(state.isPlaying);
    startSessionHeartbeat();
}

export function updateMediaSessionPlaybackState(playing) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
}

export function updateMediaSessionPosition(currentTime, duration) {
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration > 0) {
        try {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1,
                position: Math.min(currentTime, duration),
            });
        } catch { }
    }
}

// ── Session Heartbeat ──────────────────────────────────────────
// Periodically re-syncs state and ensures handlers are active
function startSessionHeartbeat() {
    if (_sessionHeartbeat) return;
    _sessionHeartbeat = setInterval(() => {
        if (state.isPlaying && _lastMetadata && _lastHandlers) {
            // Re-sync basic state to keep OS from killing the session
            updateMediaSessionPlaybackState(true);
            enableBackgroundPlayback();
        }
    }, 5000);
}

function stopSessionHeartbeat() {
    if (_sessionHeartbeat) {
        clearInterval(_sessionHeartbeat);
        _sessionHeartbeat = null;
    }
}
