// =========================================
// MelodyStream — YouTube Player Module
// YouTube IFrame API, playback control
// =========================================

import * as state from './state.js';
import { updateMediaSession, enableBackgroundPlayback, updateMediaSessionPlaybackState, updateMediaSessionPosition, requestWakeLock } from './media-session.js';

function updatePlayPauseButtons() {
    const icon = state.isPlaying ? 'fa-pause' : 'fa-play';
    const label = state.isPlaying ? 'Duraklat' : 'Oynat';

    const mainBtn = document.getElementById('playPauseButton');
    if (mainBtn) {
        mainBtn.innerHTML = `<i class="fas ${icon}"></i>`;
        mainBtn.setAttribute('aria-label', label);
    }

    const detailBtn = document.getElementById('detailPlayPauseButton');
    if (detailBtn) {
        detailBtn.innerHTML = `<i class="fas ${icon}"></i>`;
        detailBtn.setAttribute('aria-label', label);
    }

    updateMediaSessionPlaybackState(state.isPlaying);
}

function updateProgress() {
    if (!state.youtubePlayer || !state.playerReady) return;

    try {
        const currentTime = state.youtubePlayer.getCurrentTime();
        const duration = state.youtubePlayer.getDuration();

        if (duration > 0) {
            const progress = (currentTime / duration) * 100;

            const mainSlider = document.getElementById('progressSlider');
            if (mainSlider) mainSlider.value = progress;

            const detailSlider = document.getElementById('detailProgressSlider');
            if (detailSlider) detailSlider.value = progress;

            // Mini Bar Times
            const currentTimeEl = document.getElementById('currentTime');
            if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime);

            const durationEl = document.getElementById('duration');
            if (durationEl) durationEl.textContent = formatTime(duration);

            // Detail View Times
            const detailCurrentTimeEl = document.getElementById('detailCurrentTime');
            if (detailCurrentTimeEl) detailCurrentTimeEl.textContent = formatTime(currentTime);

            const detailDurationEl = document.getElementById('detailDuration');
            if (detailDurationEl) detailDurationEl.textContent = formatTime(duration);

            updateMediaSessionPosition(currentTime, duration);
        }
    } catch (e) {
        // Player might not be ready
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// ... (formatTime stays same)
export function playSong(song) {
    if (!state.isYouTubeApiReady) return;

    if (state.youtubePlayer) {
        state.youtubePlayer.stopVideo();
    }

    state.setCurrentSong(song);

    // Update UI (Multi-target sync)
    document.querySelectorAll('.current-song-name').forEach(el => el.textContent = song.title);
    document.querySelectorAll('.current-artist').forEach(el => el.textContent = song.channelTitle || 'Bilinmeyen Sanatçı');

    // Update Thumbnails
    const thumbnails = [
        document.getElementById('currentThumbnail'),
        document.getElementById('detailThumbnail')
    ];
    thumbnails.forEach(img => { if (img) img.src = song.thumbnail; });

    // Show Add-to-Playlist buttons
    document.querySelectorAll('#addToPlaylistBtn, #detailAddToPlaylistBtn').forEach(btn => {
        if (btn) btn.style.display = 'flex';
    });

    if (!state.youtubePlayer) {
        const playerContainer = document.createElement('div');
        playerContainer.id = 'youtube-player';
        playerContainer.style.display = 'none';
        document.body.appendChild(playerContainer);

        const player = new YT.Player('youtube-player', {
            height: '0', width: '0',
            videoId: song.videoId,
            playerVars: { controls: 0, autoplay: 1, modestbranding: 1, rel: 0, fs: 0 },
            events: {
                onReady: (event) => {
                    state.setPlayerReady(true);
                    event.target.playVideo();
                    state.setIsPlaying(true);
                    updatePlayPauseButtons();
                    if (state.progressInterval) clearInterval(state.progressInterval);
                    state.setProgressInterval(setInterval(updateProgress, 500));
                    enableBackgroundPlayback();
                    requestWakeLock();
                },
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
                        if (state.isRepeatOn) event.target.playVideo();
                        else playNext();
                    } else if (event.data === YT.PlayerState.PLAYING) {
                        state.setIsPlaying(true);
                        updatePlayPauseButtons();
                        enableBackgroundPlayback();
                        requestWakeLock();
                        updateMediaSessionPlaybackState(true);
                    } else if (event.data === YT.PlayerState.PAUSED) {
                        // Crucial: Only sync pause if NOT hidden. 
                        // If hidden, the browser might have forced pause — we'll fight back via heartbeat.
                        if (!document.hidden) {
                            state.setIsPlaying(false);
                            updatePlayPauseButtons();
                            updateMediaSessionPlaybackState(false);
                        }
                    }
                }
            }
        });
        state.setYoutubePlayer(player);
    } else {
        state.youtubePlayer.loadVideoById(song.videoId);
    }

    // Media Session Update
    updateMediaSession(song, {
        onPlay: () => togglePlayPause(),
        onPause: () => togglePlayPause(),
        onNext: () => playNext(),
        onPrevious: () => playPrevious(),
        onSeek: (time) => state.youtubePlayer?.seekTo(time, true),
    });
}

// ── Background Heartbeat ───────────────────────────────────────
// Monitors player health every 2s, especially when page is hidden.
setInterval(() => {
    if (state.isPlaying && state.youtubePlayer && state.playerReady) {
        try {
            const ps = state.youtubePlayer.getPlayerState();
            // If we think we're playing but YT is paused (state 2), resume.
            // This bypasses many browser background throttling mechanisms.
            if (ps === 2 && document.hidden) {
                console.debug('[Heartbeat] Resuming background playback...');
                state.youtubePlayer.playVideo();
                enableBackgroundPlayback();
            }
        } catch (e) { }
    }
}, 2000);

export function togglePlayPause() {
    if (!state.youtubePlayer || !state.playerReady) return;
    const ps = state.youtubePlayer.getPlayerState();
    if (ps === YT.PlayerState.PLAYING) {
        state.youtubePlayer.pauseVideo();
        state.setIsPlaying(false);
    } else {
        state.youtubePlayer.playVideo();
        state.setIsPlaying(true);
        enableBackgroundPlayback();
    }
    updatePlayPauseButtons();
}
// ... (rest of the functions stay same)

export function playNext() {
    if (!state.currentSong || !state.currentSongList.length) return;

    let nextSong;
    if (state.isShuffleOn) {
        nextSong = state.currentSongList[Math.floor(Math.random() * state.currentSongList.length)];
    } else {
        const currentIndex = state.currentSongList.findIndex(s => s.videoId === state.currentSong.videoId);
        nextSong = state.currentSongList[(currentIndex + 1) % state.currentSongList.length];
    }

    if (nextSong) {
        // Import showSongDetail dynamically to avoid circular imports
        import('./navigation.js').then(nav => nav.showSongDetail(nextSong));
    }
}

export function playPrevious() {
    if (!state.currentSong || !state.currentSongList.length) return;

    let prevSong;
    if (state.isShuffleOn) {
        prevSong = state.currentSongList[Math.floor(Math.random() * state.currentSongList.length)];
    } else {
        const currentIndex = state.currentSongList.findIndex(s => s.videoId === state.currentSong.videoId);
        prevSong = state.currentSongList[(currentIndex - 1 + state.currentSongList.length) % state.currentSongList.length];
    }

    if (prevSong) {
        import('./navigation.js').then(nav => nav.showSongDetail(prevSong));
    }
}

export function shufflePlaylist() {
    state.setIsShuffleOn(!state.isShuffleOn);
    document.querySelectorAll('[data-action="shuffle"]').forEach(btn => {
        btn.classList.toggle('active', state.isShuffleOn);
    });
}

export function toggleRepeat() {
    state.setIsRepeatOn(!state.isRepeatOn);
    document.querySelectorAll('[data-action="repeat"]').forEach(btn => {
        btn.classList.toggle('active', state.isRepeatOn);
    });
}

export function seekTo(percent) {
    if (!state.youtubePlayer || !state.playerReady) return;
    const duration = state.youtubePlayer.getDuration();
    state.youtubePlayer.seekTo((percent / 100) * duration, true);
}

export function setVolume(volume) {
    if (state.youtubePlayer && state.playerReady) {
        state.youtubePlayer.setVolume(volume);
    }
}

// Make YouTube API callback global
window.onYouTubeIframeAPIReady = () => {
    state.setYouTubeApiReady(true);

    // Trigger initial load
    import('./ui.js').then(ui => ui.loadRecommendedMusic());
};
