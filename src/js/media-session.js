// ── Media Session & Background Playback Stability ─────────────
import * as state from './state.js';
import { minfo, mwarn, merror, mevent, mstate } from './debug-logger.js';
import { updatePlayPauseButtons } from './player.js';

let _audioCtx = null;
let _silentSource = null;
let wakeLock = null;
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
        ['play', () => {
            mevent('MEDIASESSION', 'OS → play komutu geldi');
            _currentHandlers.onPlay?.();
        }],
        ['pause', () => {
            mevent('MEDIASESSION', 'OS → pause komutu geldi');
            _currentHandlers.onPause?.();
        }],
        ['previoustrack', () => {
            mevent('MEDIASESSION', 'OS → previoustrack komutu geldi');
            _currentHandlers.onPrevious?.();
        }],
        ['nexttrack', () => {
            mevent('MEDIASESSION', 'OS → nexttrack komutu geldi');
            _currentHandlers.onNext?.();
        }],
        ['stop', () => {
            mevent('MEDIASESSION', 'OS → stop komutu geldi');
            _currentHandlers.onPause?.();
        }],
        ['seekbackward', (details) => {
            mevent('MEDIASESSION', 'OS → seekbackward komutu geldi');
            const skip = details.seekOffset || 10;
            _currentHandlers.onSeek?.(Math.max(0, (state.youtubePlayer?.getCurrentTime() || 0) - skip));
        }],
        ['seekforward', (details) => {
            mevent('MEDIASESSION', 'OS → seekforward komutu geldi');
            const skip = details.seekOffset || 10;
            _currentHandlers.onSeek?.((state.youtubePlayer?.getCurrentTime() || 0) + skip);
        }],
        ['seekto', (details) => {
            mevent('MEDIASESSION', 'OS → seekto komutu geldi');
            _currentHandlers.onSeek?.(details.seekTime);
        }]
    ];

    actionHandlers.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            console.debug(`[MediaSession] Action ${action} not supported.`);
        }
    });
    minfo('MEDIASESSION', "Tüm handler'lar kaydedildi");
}

/**
 * Initializes the silent audio keep-alive (Web Audio API V2). 
 */
export function initBackgroundPlaybackHook() {
    if (_isInitialized) return;
    minfo('INIT', 'initBackgroundPlaybackHook() called');
    ensureSilentAudio();

    const unlock = () => {
        if (_audioCtx && _audioCtx.state === 'suspended') {
            _audioCtx.resume().then(() => {
                minfo('AUDIO', 'AudioContext kullanıcı etkileşimi ile açıldı');
            });
        }
        _isInitialized = true;
        registerMediaHandlers();
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
    };

    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
}

function ensureSilentAudio() {
    if (_audioCtx) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio API not supported');

        _audioCtx = new AC();
        // Create a silent buffer (1 second)
        const buf = _audioCtx.createBuffer(1, _audioCtx.sampleRate, _audioCtx.sampleRate);
        _silentSource = _audioCtx.createBufferSource();
        _silentSource.buffer = buf;
        _silentSource.loop = true;
        _silentSource.connect(_audioCtx.destination);
        _silentSource.start(0);

        minfo('AUDIO', 'WebAudio context oluşturuldu', { state: _audioCtx.state });
    } catch (e) {
        merror('AUDIO', 'WebAudio oluşturulamadı', e.message);
    }
}

export function enableBackgroundPlayback() {
    ensureSilentAudio();
    if (_audioCtx && _audioCtx.state === 'suspended') {
        _audioCtx.resume()
            .then(() => minfo('AUDIO', 'AudioContext resumed'))
            .catch(e => mwarn('AUDIO', 'AudioContext resume failed', e.message));
    }
}

export async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        if (wakeLock) await wakeLock.release();
        wakeLock = await navigator.wakeLock.request('screen');
        minfo('WAKELOCK', 'WakeLock alındı');
    } catch (e) {
        mwarn('WAKELOCK', 'WakeLock alınamadı', e.message);
    }
}

export function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().then(() => {
            minfo('WAKELOCK', 'WakeLock serbest bırakıldı');
            wakeLock = null;
        }).catch(() => { });
    }
}

// ── Metadata & Session Management ──────────────────────────────
export function updateMediaSession(song, handlers) {
    if (!('mediaSession' in navigator)) return;

    minfo('MEDIASESSION', 'updateMediaSession() called', { title: song.title });

    stopSessionHeartbeat();
    minfo('HEARTBEAT', 'Heartbeat sıfırlandı');
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
    minfo('HEARTBEAT', 'Heartbeat başlatıldı');
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
function startSessionHeartbeat() {
    if (_sessionHeartbeat) return;
    let tickCount = 0;
    _sessionHeartbeat = setInterval(() => {
        tickCount++;
        if (state.isPlaying) {
            mstate('HEARTBEAT', `Tick #${tickCount}`, {
                isPlaying: state.isPlaying,
                hidden: document.hidden,
                ytState: state.youtubePlayer ? state.youtubePlayer.getPlayerState() : 'N/A'
            });

            enableBackgroundPlayback();

            // Periodically nudge OS to keep session active
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
            }

            // Recovery nudge for YouTube iframe if swallowed by background
            if (document.hidden && state.youtubePlayer && state.playerReady) {
                const ps = state.youtubePlayer.getPlayerState();
                if ((ps === 2 || ps === -1 || ps === 3)) {
                    if (!state.userPaused) {
                        mwarn('HEARTBEAT', 'Arka plan recovery: playVideo() çağrılıyor', { ytState: ps });
                        state.youtubePlayer.playVideo();
                    } else {
                        minfo('HEARTBEAT', 'Recovery atlandı — kullanıcı pause etti');
                    }
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
        minfo('VISIBILITY', 'Ön plana döndü — enableBackgroundPlayback + requestWakeLock');
        enableBackgroundPlayback();
        requestWakeLock();

        // Bug 3 V2 Fix: 300ms delay then force-check
        setTimeout(() => {
            if (state.youtubePlayer && state.playerReady) {
                const ps = state.youtubePlayer.getPlayerState();
                if (ps === 2) { // still PAUSED
                    mwarn('VISIBILITY', 'Player hâlâ PAUSED — playVideo() zorlanıyor');
                    state.youtubePlayer.playVideo();
                    state.setIsPlaying(true);
                    updatePlayPauseButtons();
                }
            }
        }, 300);
    }
});
