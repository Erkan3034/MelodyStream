// ── Media Session & Background Playback Stability ─────────────
import * as state from './state.js';

const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAQKAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

let silentAudio = null;
let wakeLock = null;
let _resumeAfterHide = false;
let _sessionHeartbeat = null;
let _isInitialized = false;

// Global handler bridge to ensure registration is persistent
let _currentHandlers = {
    onPlay: null,
    onPause: null,
    onNext: null,
    onPrevious: null,
    onSeek: null
};

/**
 * Register global handlers once. 
 * This ensures the buttons are present in the OS UI even if track changes.
 */
function registerMediaHandlers() {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers = [
        ['play', () => _currentHandlers.onPlay?.()],
        ['pause', () => _currentHandlers.onPause?.()],
        ['previoustrack', () => _currentHandlers.onPrevious?.()],
        ['nexttrack', () => _currentHandlers.onNext?.()],
        ['stop', () => _currentHandlers.onPause?.()],
        ['seekbackward', (details) => {
            const skip = details.seekOffset || 10;
            _currentHandlers.onSeek?.(Math.max(0, (state.youtubePlayer?.getCurrentTime() || 0) - skip));
        }],
        ['seekforward', (details) => {
            const skip = details.seekOffset || 10;
            _currentHandlers.onSeek?.((state.youtubePlayer?.getCurrentTime() || 0) + skip);
        }],
        ['seekto', (details) => _currentHandlers.onSeek?.(details.seekTime)]
    ];

    actionHandlers.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            console.debug(`[MediaSession] Action ${action} not supported.`);
        }
    });
}

/**
 * Initializes the silent audio keep-alive. 
 */
export function initBackgroundPlaybackHook() {
    if (_isInitialized) return;
    ensureSilentAudio();

    const startAudio = () => {
        silentAudio.play().catch(() => { });
        _isInitialized = true;
        registerMediaHandlers(); // Initial registration
        console.debug('[MediaSession] Background hooks initialized.');

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

    silentAudio.addEventListener('pause', () => {
        if (state.isPlaying) {
            setTimeout(() => {
                if (state.isPlaying) silentAudio.play().catch(() => { });
            }, 1000);
        }
    });
}

export function enableBackgroundPlayback() {
    ensureSilentAudio();
    if (silentAudio.paused) {
        silentAudio.play().catch(() => {
            _isInitialized = false;
            initBackgroundPlaybackHook();
        });
    }
}

export async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        if (wakeLock) await wakeLock.release();
        wakeLock = await navigator.wakeLock.request('screen');
    } catch { }
}

export function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().then(() => wakeLock = null).catch(() => { });
    }
}

// ── Metadata & Session Management ──────────────────────────────
export function updateMediaSession(song, handlers) {
    if (!('mediaSession' in navigator)) return;

    stopSessionHeartbeat();
    _sessionHeartbeat = null;

    _currentHandlers = handlers;
    registerMediaHandlers(); // Refresh handlers on every song

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

    updateMediaSessionPlaybackState(state.isPlaying);
    startSessionHeartbeat();
}

export function updateMediaSessionPlaybackState(playing) {
    if ('mediaSession' in navigator) {
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
// Slower heartbeat to avoid fighting browser/OS throttling
function startSessionHeartbeat() {
    if (_sessionHeartbeat) return;
    _sessionHeartbeat = setInterval(() => {
        if (state.isPlaying) {
            enableBackgroundPlayback();

            // Periodically nudge OS to keep session active
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
            }

            // Recovery nudge for YouTube iframe if swallowed by background
            if (document.hidden && state.youtubePlayer && state.playerReady) {
                const ps = state.youtubePlayer.getPlayerState();
                if ((ps === 2 || ps === -1 || ps === 3) && !state.userPaused) {
                    console.debug('[Heartbeat] Proactive background resume...');
                    state.youtubePlayer.playVideo();
                }
            }
        }
    }, 4000); // 4s for absolute stability
}

export function stopSessionHeartbeat() {
    if (_sessionHeartbeat) {
        clearInterval(_sessionHeartbeat);
        _sessionHeartbeat = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.isPlaying) {
        enableBackgroundPlayback();
        requestWakeLock();
    }
});
