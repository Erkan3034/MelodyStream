// =========================================
// MelodyStream — Main Entry Point
// Initializes all modules
// =========================================

import './state.js';
import * as state from './state.js';
import { playSong, togglePlayPause, playNext, playPrevious, shufflePlaylist, toggleRepeat, seekTo, setVolume } from './player.js';
import { renderPlaylistsSidebar, openAddToPlaylistModal } from './playlist.js';
import { updateFavoritesGrid, renderFavoritesSection, isFavorite, toggleFavorite } from './favorites.js';
import { renderSearchSection } from './search.js';
import { renderHomeSection, loadRecommendedMusic } from './ui.js';
import { showSongDetail, goBack, showPlayHistory, initSidebar, initSwipeGestures } from './navigation.js';
import { renderProfileSection, restoreSession } from './auth-ui.js';

import '../css/base.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/responsive.css';

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

// DOM Ready
window.addEventListener('DOMContentLoaded', () => {
    restoreSession();
    renderHomeSection();
    updateFavoritesGrid();
    renderPlaylistsSidebar();
    initSidebar();
    initSwipeGestures();
    initTabBar();
    initPlayerBarControls();
    initPlayerBarFavorite();
    initNavItems();
});

// ---- Tab Bar Navigation ----
function initTabBar() {
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            switch (target) {
                case 'home':
                    renderHomeSection();
                    break;
                case 'search':
                    renderSearchSection();
                    break;
                case 'library':
                    renderFavoritesSection();
                    break;
                case 'profile':
                    renderProfileSection();
                    break;
            }

            // Close sidebar if open
            if (window._closeSidebar) window._closeSidebar();
        });
    });
}

// ---- Sidebar Nav Items ----
function initNavItems() {
    const navItems = document.querySelectorAll('.nav-item[data-nav]');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const target = item.dataset.nav;
            switch (target) {
                case 'home':
                    renderHomeSection();
                    break;
                case 'search':
                    renderSearchSection();
                    break;
                case 'favorites':
                    renderFavoritesSection();
                    break;
                case 'history':
                    showPlayHistory();
                    break;
            }

            // Close sidebar on mobile
            if (window.innerWidth <= 1024 && window._closeSidebar) {
                window._closeSidebar();
            }
        });
    });
}

// ---- Player Bar Controls ----
function initPlayerBarControls() {
    // Play/Pause
    const playBtn = document.getElementById('playPauseButton');
    if (playBtn) playBtn.addEventListener('click', togglePlayPause);

    // Next/Previous
    const nextBtn = document.getElementById('nextButton');
    if (nextBtn) nextBtn.addEventListener('click', playNext);

    const prevBtn = document.getElementById('prevButton');
    if (prevBtn) prevBtn.addEventListener('click', playPrevious);

    // Shuffle
    const shuffleBtn = document.getElementById('shuffleButton');
    if (shuffleBtn) shuffleBtn.addEventListener('click', shufflePlaylist);

    // Repeat
    const repeatBtn = document.getElementById('repeatButton');
    if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);

    // Progress slider
    const progressSlider = document.getElementById('progressSlider');
    if (progressSlider) {
        progressSlider.addEventListener('input', (e) => seekTo(parseFloat(e.target.value)));
    }

    // Volume
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => setVolume(parseInt(e.target.value)));
    }

    // Detail progress slider
    const detailSlider = document.getElementById('detailProgressSlider');
    if (detailSlider) {
        detailSlider.addEventListener('input', (e) => seekTo(parseFloat(e.target.value)));
    }

    // Detail controls
    const detailPlayBtn = document.getElementById('detailPlayPauseButton');
    if (detailPlayBtn) detailPlayBtn.addEventListener('click', togglePlayPause);

    const detailNextBtn = document.getElementById('detailNextButton');
    if (detailNextBtn) detailNextBtn.addEventListener('click', playNext);

    const detailPrevBtn = document.getElementById('detailPrevButton');
    if (detailPrevBtn) detailPrevBtn.addEventListener('click', playPrevious);

    const detailShuffleBtn = document.getElementById('detailShuffleButton');
    if (detailShuffleBtn) detailShuffleBtn.addEventListener('click', shufflePlaylist);

    const detailRepeatBtn = document.getElementById('detailRepeatButton');
    if (detailRepeatBtn) detailRepeatBtn.addEventListener('click', toggleRepeat);

    // Add to playlist
    const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
    if (addToPlaylistBtn) addToPlaylistBtn.addEventListener('click', openAddToPlaylistModal);

    // Player bar click → show detail
    const playerBar = document.getElementById('playerBar');
    if (playerBar) {
        playerBar.addEventListener('click', (e) => {
            // Don't open detail when clicking buttons
            if (
                e.target.closest('button') ||
                e.target.closest('input[type="range"]') ||
                e.target.closest('.volume-control')
            ) return;

            if (state.currentSong) {
                showSongDetail(state.currentSong, true);
            }
        });
    }
}

// ---- Player Bar Favorite Button ----
function initPlayerBarFavorite() {
    const favBtn = document.getElementById('playerFavBtn');
    if (!favBtn) return;

    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.currentSong) return;
        toggleFavorite(state.currentSong);
        updatePlayerBarFavorite();
    });
}

// Call this whenever the current song changes
export function updatePlayerBarFavorite() {
    const favBtn = document.getElementById('playerFavBtn');
    if (!favBtn) return;
    if (state.currentSong && isFavorite(state.currentSong.videoId)) {
        favBtn.classList.add('active');
    } else {
        favBtn.classList.remove('active');
    }
}

// ---- Profile Section ----
// Rendered by auth-ui.js (renderProfileSection)
