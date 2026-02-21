// =========================================
// MelodyStream — Navigation Module
// Song detail, history, back navigation,
// sidebar toggle, swipe gestures
// =========================================

import * as state from './state.js';
import { playSong, playNext, playPrevious } from './player.js';
import { isFavorite, toggleFavorite } from './favorites.js';

export function addToHistory(song) {
    const historyItem = { song, playedAt: new Date().toISOString() };
    state.playHistory.unshift(historyItem);
    if (state.playHistory.length > 50) {
        state.playHistory.pop();
    }
    localStorage.setItem('playHistory', JSON.stringify(state.playHistory));
}

export function showSongDetail(song) {
    addToHistory(song);
    playSong(song);

    const songDetail = document.getElementById('songDetail');
    if (!songDetail) return;

    songDetail.classList.add('active');

    // Set glass background
    const bgUrl = song.thumbnail ? `url('${song.thumbnail}')` : 'none';
    songDetail.style.setProperty('--song-bg-image', bgUrl);

    // Update favorite button
    const detailFavBtn = document.getElementById('detailFavoriteBtn');
    if (detailFavBtn) {
        detailFavBtn.classList.toggle('active', isFavorite(song.videoId));
        detailFavBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song);
            detailFavBtn.classList.toggle('active', isFavorite(song.videoId));
        };
    }

    // Hide main content and bottom player
    const mainContent = document.querySelector('.main-content');
    const playerBar = document.getElementById('playerBar');
    const tabBar = document.querySelector('.tab-bar');
    if (mainContent) mainContent.style.display = 'none';
    if (playerBar) playerBar.style.display = 'none';
    if (tabBar) tabBar.style.display = 'none';

    // Bind back button
    const backBtn = songDetail.querySelector('.back-btn');
    if (backBtn) backBtn.onclick = goBack;

    state.setCurrentView('songDetail');
}

export function goBack() {
    const songDetail = document.getElementById('songDetail');
    const mainContent = document.querySelector('.main-content');
    const playerBar = document.getElementById('playerBar');
    const tabBar = document.querySelector('.tab-bar');

    if (songDetail) songDetail.classList.remove('active');
    if (mainContent) mainContent.style.display = '';
    if (playerBar) playerBar.style.display = '';
    if (tabBar) tabBar.style.display = '';

    // Re-render current view
    const previousView = state.currentView;
    if (previousView === 'songDetail') {
        // Go back to home by default
        import('./ui.js').then(ui => ui.renderHomeSection());
    }
}

export function showPlayHistory() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="section">
      <div class="section-header">
        <h2>🕐 Son Dinlenenler</h2>
      </div>
      <div class="music-grid" id="historyGrid"></div>
    </div>
  `;

    const grid = document.getElementById('historyGrid');
    if (state.playHistory.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-clock"></i>
        <p>Henüz hiç şarkı dinlemedin</p>
      </div>
    `;
    } else {
        import('./ui.js').then(ui => {
            state.playHistory.forEach(item => {
                const card = ui.createMusicCard(item.song);
                grid.appendChild(card);
            });
        });
    }

    state.setCurrentView('history');
    state.setCurrentSongList(state.playHistory.map(h => h.song));
}

// ---- Sidebar Toggle ----
export function initSidebar() {
    const hamburger = document.getElementById('hamburgerMenu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!hamburger || !sidebar) return;

    function openSidebar() {
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        hamburger.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        hamburger.classList.remove('active');
    }

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    if (overlay) overlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) closeSidebar();
    });

    // Export for use by other modules
    window._closeSidebar = closeSidebar;
}

// ---- Swipe Gestures ----
export function initSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    const minSwipeDistance = 60;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                playPrevious();
            } else {
                playNext();
            }
        }

        // Vertical swipe down — close song detail
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minSwipeDistance) {
            if (deltaY > 0) {
                const songDetail = document.getElementById('songDetail');
                if (songDetail && songDetail.classList.contains('active')) {
                    goBack();
                }
            }
        }
    }, { passive: true });
}
