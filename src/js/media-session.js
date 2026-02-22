// ── Silent audio keep-alive ────────────────────────────────────
// Proactive strategy: start early, never stop, and pulse to keep main thread alive.
import * as state from './state.js';
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
    silentAudio.volume = 0.05;

    // Recovery if the audio stalls or the OS pauses it
    silentAudio.addEventListener('pause', () => {
        if (state.isPlaying || _isInitialized) {
            // Only resume if we aren't explicitly paused by user
            setTimeout(() => {
                if (state.isPlaying || _isInitialized) silentAudio.play().catch(() => { });
            }, 500);
        }
    });

    // Pulse: nudge the main thread every time the loop repeats
    silentAudio.addEventListener('timeupdate', () => {
        if (silentAudio.currentTime > 2.0) {
            silentAudio.currentTime = 0;
        }
    });
}

export function enableBackgroundPlayback() {
    ensureSilentAudio();
    if (silentAudio.paused) {
        silentAudio.play().catch(() => {
            initBackgroundPlaybackHook();
        });
    }
}

export function disableBackgroundPlayback() {
    // Stop the silent audio only if we are truly ending the session
    // For PWA, it's better to keep it paused but not destroyed
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
            // Sync up YouTube player if it drifted
            setTimeout(() => {
                const player = state.youtubePlayer;
                if (player && state.playerReady) {
                    const ps = player.getPlayerState?.();
                    if (ps === 2 || ps === -1) player.playVideo();
                }
            }, 300);
        }
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);

// ── Media Session metadata / controls ─────────────────────────
let _lastMetadataUsed = null;

export function updateMediaSession(song, handlers) {
    if (!('mediaSession' in navigator)) return;

    // Register all standard handlers immediately and persistently
    const actionHandlers = [
        ['play', () => handlers.onPlay?.()],
        ['pause', () => handlers.onPause?.()],
        ['previoustrack', () => handlers.onPrevious?.()],
        ['nexttrack', () => handlers.onNext?.()],
        ['stop', () => handlers.onPause?.()],
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
        }]
    ];

    actionHandlers.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            console.debug(`[MediaSession] Action ${action} not supported.`);
        }
    });

    // Update metadata
    if (song && _lastMetadataUsed?.videoId !== song.videoId) {
        _lastMetadataUsed = song;
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
    }

    updateMediaSessionPlaybackState(state.isPlaying);
    startSessionHeartbeat();
}

export function updateMediaSessionPlaybackState(playing) {
    if ('mediaSession' in navigator) {
        // Only update if current state differs to avoid OS-level flickering
        const newState = playing ? 'playing' : 'paused';
        if (navigator.mediaSession.playbackState !== newState) {
            navigator.mediaSession.playbackState = newState;
        }
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
// Slower, more stable re-sync (3s) to keep OS from killing the session without causing flicker
function startSessionHeartbeat() {
    if (_sessionHeartbeat) return;
    _sessionHeartbeat = setInterval(() => {
        if (state.isPlaying) {
            // Nudge silent audio
            enableBackgroundPlayback();

            // Periodically re-sync playbackState quietly
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
            }

            // Check if YouTube iframe needs a nudge (pushed here from player.js for stability)
            if (document.hidden && state.youtubePlayer && state.playerReady) {
                const ps = state.youtubePlayer.getPlayerState();
                if (ps === 2 || ps === -1 || ps === 3) {
                    state.youtubePlayer.playVideo();
                }
            }
        }
    }, 3000); // 3s is much more stable
}

function stopSessionHeartbeat() {
    if (_sessionHeartbeat) {
        clearInterval(_sessionHeartbeat);
    }
}
