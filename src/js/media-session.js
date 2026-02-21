// =========================================
// MelodyStream — Media Session API
// Background playback & notification controls
// =========================================

import * as state from './state.js';

// ── Silent audio keep-alive ────────────────────────────────────
// A real (but silent) audio element keeps the browser "audio context"
// alive so the YouTube IFrame isn't throttled in the background.
// Using a base64 MP3 that is 2s long and loops to avoid iOS gaps.
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAQKAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

let silentAudio = null;
let wakeLock = null;
let _resumeAfterHide = false; // track if we paused because of hide

function ensureSilentAudio() {
    if (silentAudio) return;
    silentAudio = new Audio(SILENT_MP3);
    silentAudio.loop = true;
    silentAudio.volume = 0.001; // near-zero but not muted (iOS ignores muted)
    // Re-play if the audio element stalls (shouldn't happen but safety net)
    silentAudio.addEventListener('ended', () => {
        if (state.isPlaying) silentAudio.play().catch(() => { });
    });
}

export function enableBackgroundPlayback() {
    ensureSilentAudio();
    silentAudio.play().catch(() => {
        // Auto-play may be blocked before user gesture — retry once on next interaction
        const tryOnce = () => {
            silentAudio.play().catch(() => { });
            document.removeEventListener('click', tryOnce);
            document.removeEventListener('touchstart', tryOnce);
        };
        document.addEventListener('click', tryOnce, { once: true });
        document.addEventListener('touchstart', tryOnce, { once: true });
    });
}

export function disableBackgroundPlayback() {
    silentAudio?.pause();
}

// ── WakeLock ───────────────────────────────────────────────────
export async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        // Release existing before re-requesting
        if (wakeLock) { try { await wakeLock.release(); } catch { } }
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            wakeLock = null;
            // Auto re-acquire if still playing (e.g. screen briefly turned off)
            if (state.isPlaying) {
                setTimeout(() => { if (state.isPlaying) requestWakeLock(); }, 1000);
            }
        });
    } catch {
        // WakeLock not available or denied — not fatal
    }
}

export function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => { });
        wakeLock = null;
    }
}

// ── Visibility / Page lifecycle handlers ──────────────────────
// This is the primary fix for the "brief pause when switching apps" issue.
// When the page becomes hidden, browsers may throttle the YT IFrame.
// When it becomes visible again, we force-resume both silentAudio and the YT player.

function handleVisibilityChange() {
    if (document.hidden) {
        // Page is hiding — make sure silentAudio keeps going
        // (browsers are less likely to kill a native <audio> vs an IFrame)
        if (state.isPlaying) {
            _resumeAfterHide = true;
            // Keep silentAudio alive; YT IFrame may or may not survive
            silentAudio?.play().catch(() => { });
        }
    } else {
        // Page is visible again
        if (_resumeAfterHide && state.isPlaying) {
            _resumeAfterHide = false;
            // Give the browser 300ms to settle the page, then resume
            setTimeout(() => {
                try {
                    const player = state.youtubePlayer;
                    if (player && state.playerReady) {
                        const ps = player.getPlayerState?.();
                        // YT.PlayerState.PAUSED = 2
                        if (ps === 2 || ps === -1) {
                            player.playVideo();
                        }
                    }
                } catch { }
                // Also re-enable silent audio and wake lock
                silentAudio?.play().catch(() => { });
                if (state.isPlaying) requestWakeLock();
            }, 300);
        }
    }
}

// iOS PWA uses pagehide/pageshow (not visibilitychange) when swiping home
function handlePageShow(e) {
    if (state.isPlaying && state.youtubePlayer && state.playerReady) {
        setTimeout(() => {
            try {
                const ps = state.youtubePlayer.getPlayerState?.();
                if (ps === 2 || ps === -1) state.youtubePlayer.playVideo();
            } catch { }
            silentAudio?.play().catch(() => { });
            requestWakeLock();
        }, 400);
    }
}

// Register once
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('pageshow', handlePageShow);

// ── Audio interruption recovery (headphones unplug, calls etc.) ──
// On mobile, audio can be "interrupted" by calls or headphone unplug.
// The 'pause' event on silentAudio is a proxy — if it fires we try to resume.
// (We do this lazily so we don't fight with intentional pauses.)
let _interruptionTimer = null;
function onSilentAudioPause() {
    if (!state.isPlaying) return; // user paused intentionally
    clearTimeout(_interruptionTimer);
    _interruptionTimer = setTimeout(() => {
        if (state.isPlaying) silentAudio?.play().catch(() => { });
    }, 800);
}

// Attach lazily when silentAudio is created
const _origEnsure = ensureSilentAudio;
// Patch: after creation attach the pause recovery
function ensureSilentAudioWithRecovery() {
    const before = silentAudio;
    _origEnsure();
    if (!before && silentAudio) {
        silentAudio.addEventListener('pause', onSilentAudioPause);
    }
}
// Override
// (We do it inline to avoid hoisting issues)

// ── Media Session metadata / controls ─────────────────────────
export function updateMediaSession(song, { onPlay, onPause, onNext, onPrevious, onSeek }) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Bilinmeyen',
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

    navigator.mediaSession.setActionHandler('play', onPlay);
    navigator.mediaSession.setActionHandler('pause', onPause);
    navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
    navigator.mediaSession.setActionHandler('nexttrack', onNext);

    if (onSeek) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            onSeek(details.seekTime);
            updateMediaSessionPlaybackState(true);
        });
    }
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
                duration,
                playbackRate: 1,
                position: Math.min(currentTime, duration),
            });
        } catch {
            // Some browsers throw on invalid position state — safe to ignore
        }
    }
}
