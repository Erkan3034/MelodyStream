// =========================================
// MelodyStream — YouTube Player Module
// YouTube IFrame API, playback control
// =========================================

import * as state from './state.js';
import { updateMediaSession, enableBackgroundPlayback, updateMediaSessionPlaybackState, updateMediaSessionPosition, requestWakeLock } from './media-session.js';
import { minfo, mwarn, merror, mevent, mstate, ytStateLabel } from './debug-logger.js';

let _isLoadingNewVideo = false;

export function updatePlayPauseButtons() {
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

    // Always update Media Session playback state (Fix 5)
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

export function playSong(song) {
    minfo('SONG', 'playSong() called', {
        title: song.title,
        id: song.videoId,
        hidden: document.hidden,
        hasPlayer: !!state.youtubePlayer,
        ready: state.playerReady
    });

    if (!state.isYouTubeApiReady) {
        mwarn('PLAYER', 'playSong() aborting: YT API not ready');
        return;
    }

    // Pre-warm the background audio context immediately to reduce OS throttling latency
    enableBackgroundPlayback();
    requestWakeLock();

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
        minfo('PLAYER', 'Creating new YT Player instance');
        const playerContainer = document.createElement('div');
        playerContainer.id = 'youtube-player';
        playerContainer.style.display = 'none';
        document.body.appendChild(playerContainer);

        const player = new YT.Player('youtube-player', {
            height: '0', width: '0',
            videoId: song.videoId,
            playerVars: { controls: 0, autoplay: 1, modestbranding: 1, rel: 0, fs: 0, playsinline: 1 },
            events: {
                onReady: (event) => {
                    minfo('PLAYER', 'onReady fired');
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
                    const label = ytStateLabel(event.data);
                    mstate('YT_STATE', label, {
                        hidden: document.hidden,
                        isPlaying: state.isPlaying,
                        userPaused: state.userPaused,
                        loadingNew: _isLoadingNewVideo
                    });

                    if (event.data === YT.PlayerState.ENDED) {
                        mevent('PLAYER', 'Song Ended');
                        if (state.isRepeatOn) event.target.playVideo();
                        else playNext();
                    } else if (event.data === YT.PlayerState.PLAYING) {
                        minfo('PLAYER', 'Playback started');
                        if (_isLoadingNewVideo) {
                            minfo('PLAYER', 'Yeni video yüklemesi tamamlandı (_isLoadingNewVideo = false)');
                            _isLoadingNewVideo = false;
                        }
                        state.setIsPlaying(true);
                        updatePlayPauseButtons();
                        enableBackgroundPlayback();
                        requestWakeLock();
                        updateMediaSessionPlaybackState(true);
                    } else if (event.data === YT.PlayerState.PAUSED) {
                        if (_isLoadingNewVideo) {
                            minfo('PLAYER', 'Ara geçiş (PAUSED) — atlanıyor (_isLoadingNewVideo=true)');
                            return;
                        }

                        if (state.userPaused) {
                            minfo('PLAYER', 'Paused by user');
                        } else {
                            mwarn('PLAYER', 'Browser-forced pause detected!', {
                                hidden: document.hidden,
                                ua: navigator.userAgent
                            });
                        }
                        state.setIsPlaying(false);
                        updatePlayPauseButtons();
                        updateMediaSessionPlaybackState(false);
                    } else if (event.data === YT.PlayerState.BUFFERING) {
                        minfo('PLAYER', 'Buffering...', { hidden: document.hidden });
                    }
                },
                onError: (event) => {
                    merror('PLAYER', 'YouTube error', { code: event.data });
                    _isLoadingNewVideo = false;
                }
            }
        });
        state.setYoutubePlayer(player);
    } else {
        minfo('PLAYER', 'Loading video by ID (set _isLoadingNewVideo=true)', { videoId: song.videoId });
        _isLoadingNewVideo = true;
        state.youtubePlayer.loadVideoById(song.videoId);
        state.setIsPlaying(true);
        updatePlayPauseButtons();
    }

    // Immediate Media Session Update (don't wait for YT event)
    updateMediaSession(song, {
        onPlay: () => togglePlayPause(),
        onPause: () => togglePlayPause(),
        onNext: () => playNext(),
        onPrevious: () => playPrevious(),
        onSeek: (time) => state.youtubePlayer?.seekTo(time, true),
    });
}

export function togglePlayPause() {
    if (!state.youtubePlayer || !state.playerReady) {
        mwarn('PLAYER', 'togglePlayPause() aborting: Player not ready');
        return;
    }

    const ps = state.youtubePlayer.getPlayerState();
    minfo('PLAYER', 'togglePlayPause() called', {
        currentState: ytStateLabel(ps),
        userPaused: state.userPaused
    });

    if (ps === YT.PlayerState.PLAYING) {
        minfo('PLAYER', '⏸ User requested pause');
        state.setUserPaused(true);
        state.youtubePlayer.pauseVideo();
        state.setIsPlaying(false);
    } else {
        minfo('PLAYER', '▶ User requested play');
        state.setUserPaused(false);
        state.youtubePlayer.playVideo();
        state.setIsPlaying(true);
        enableBackgroundPlayback();
    }
    updatePlayPauseButtons();
}

export function playNext() {
    minfo('PLAYER', 'Requesting NEXT song');
    if (!state.currentSong || !state.currentSongList.length) {
        mwarn('PLAYER', 'playNext() aborting: No songs available');
        return;
    }

    let nextSong;
    const currentIndex = state.currentSongList.findIndex(s => s.videoId === state.currentSong.videoId);

    if (state.isShuffleOn) {
        nextSong = state.currentSongList[Math.floor(Math.random() * state.currentSongList.length)];
    } else {
        nextSong = state.currentSongList[(currentIndex + 1) % state.currentSongList.length];
    }

    if (nextSong) {
        minfo('PLAYER', 'Switching to next song', {
            title: nextSong.title,
            index: currentIndex + 1
        });
        // Import showSongDetail dynamically to avoid circular imports
        import('./navigation.js').then(nav => nav.showSongDetail(nextSong));
    }
}

export function playPrevious() {
    minfo('PLAYER', 'Requesting PREVIOUS song');
    if (!state.currentSong || !state.currentSongList.length) {
        mwarn('PLAYER', 'playPrevious() aborting: No songs available');
        return;
    }

    let prevSong;
    const currentIndex = state.currentSongList.findIndex(s => s.videoId === state.currentSong.videoId);

    if (state.isShuffleOn) {
        prevSong = state.currentSongList[Math.floor(Math.random() * state.currentSongList.length)];
    } else {
        prevSong = state.currentSongList[(currentIndex - 1 + state.currentSongList.length) % state.currentSongList.length];
    }

    if (prevSong) {
        minfo('PLAYER', 'Switching to previous song', {
            title: prevSong.title,
            index: currentIndex - 1
        });
        import('./navigation.js').then(nav => nav.showSongDetail(prevSong));
    }
}

export function shufflePlaylist() {
    state.setIsShuffleOn(!state.isShuffleOn);
    minfo('PLAYER', 'Shuffle toggled', { on: state.isShuffleOn });
    document.querySelectorAll('[data-action="shuffle"]').forEach(btn => {
        btn.classList.toggle('active', state.isShuffleOn);
    });
}

export function toggleRepeat() {
    state.setIsRepeatOn(!state.isRepeatOn);
    minfo('PLAYER', 'Repeat toggled', { on: state.isRepeatOn });
    document.querySelectorAll('[data-action="repeat"]').forEach(btn => {
        btn.classList.toggle('active', state.isRepeatOn);
    });
}

export function seekTo(percent) {
    if (!state.youtubePlayer || !state.playerReady) return;
    const duration = state.youtubePlayer.getDuration();
    const targetTime = (percent / 100) * duration;
    minfo('PLAYER', 'Seeking...', { percent, targetTime });
    state.youtubePlayer.seekTo(targetTime, true);
}

export function setVolume(volume) {
    if (state.youtubePlayer && state.playerReady) {
        state.youtubePlayer.setVolume(volume);
    }
}

// Make YouTube API callback global
window.onYouTubeIframeAPIReady = () => {
    minfo('YTAPI', 'YouTube IFrame API is READY');
    state.setYouTubeApiReady(true);

    // Trigger initial load
    import('./ui.js').then(ui => ui.loadRecommendedMusic());
};
