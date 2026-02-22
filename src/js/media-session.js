// ── Silent audio keep-alive ────────────────────────────────────
// Proactive strategy: start early, never stop, and pulse to keep main thread alive.
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAQKAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

let silentAudio = null;
let wakeLock = null;
let _resumeAfterHide = false;
let _sessionHeartbeat = null;
let _isInitialized = false;

/**
 * Initializes the silent audio keep-alive. 
 * MUST be called on a user gesture (first click/touch).
 */
export function initBackgroundPlaybackHook() {
    if (_isInitialized) return;
    ensureSilentAudio();

    const startAudio = () => {
        silentAudio.play().catch(() => { });
        _isInitialized = true;
        console.debug('[MediaSession] Proactive heartbeat started.');

        // Remove listeners
        document.removeEventListener('click', startAudio);
        document.removeEventListener('touchstart', startAudio);
    };

    document.addEventListener('click', startAudio, { once: true });
    document.addEventListener('touchstart', startAudio, { once: true });
}

function ensureSilentAudio() {
    if (silentAudio) return;
    silentAudio = new Audio(SILENT_MP3);
    silentAudio.loop = true;
    silentAudio.volume = 0.05; // Slightly higher for OS to detect active audio

    // Recovery if the audio stalls or the OS pauses it
    silentAudio.addEventListener('pause', () => {
        if (state.isPlaying || _isInitialized) {
            setTimeout(() => silentAudio.play().catch(() => { }), 100);
        }
    });

    // Pulse: nudge the main thread every time the loop repeats
    silentAudio.addEventListener('timeupdate', () => {
        if (silentAudio.currentTime > 1.8) {
            silentAudio.currentTime = 0; // Force loop nudge to keep main thread alive
        }
    });
}

export function enableBackgroundPlayback() {
    ensureSilentAudio();
    if (silentAudio.paused) {
        silentAudio.play().catch(() => {
            // If play fails, we rely on the next interaction
            initBackgroundPlaybackHook();
        });
    }
}

export function disableBackgroundPlayback() {
    // We don't actually stop the silent audio anymore, we just stop the heartbeat
    // This keeps the audio context alive for the next track
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
        if (state.isPlaying) {
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
            { src: song.thumbnail, sizes: '128x128', type: 'image/jpeg' },
            { src: song.thumbnail, sizes: '192x192', type: 'image/jpeg' },
            { src: song.thumbnail, sizes: '256x256', type: 'image/jpeg' },
            { src: song.thumbnail, sizes: '384x384', type: 'image/jpeg' },
            { src: song.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
    });

    // Register all standard handlers to ensure full OS media player controls
    const actionHandlers = [
        ['play', () => handlers.onPlay?.()],
        ['pause', () => handlers.onPause?.()],
        ['previoustrack', () => handlers.onPrevious?.()],
        ['nexttrack', () => handlers.onNext?.()],
        ['stop', () => handlers.onPause?.()], // Standard stop as pause
        ['seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            handlers.onSeek?.(Math.max(0, state.youtubePlayer?.getCurrentTime() - skipTime));
        }],
        ['seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            handlers.onSeek?.(state.youtubePlayer?.getCurrentTime() + skipTime);
        }],
        ['seekto', (details) => {
            handlers.onSeek?.(details.seekTime);
            updateMediaSessionPlaybackState(true);
        }]
    ];

    actionHandlers.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            console.debug(`[MediaSession] Action ${action} not supported.`);
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
// High-frequency re-sync to prevent OS suspension
function startSessionHeartbeat() {
    if (_sessionHeartbeat) return;
    _sessionHeartbeat = setInterval(() => {
        if (state.isPlaying) {
            // Keep the session "warm"
            updateMediaSessionPlaybackState(true);
            enableBackgroundPlayback();
        }
    }, 2000); // 2s is safer for PWA
}

function stopSessionHeartbeat() {
    if (_sessionHeartbeat) {
        clearInterval(_sessionHeartbeat);
        _sessionHeartbeat = null;
    }
}
