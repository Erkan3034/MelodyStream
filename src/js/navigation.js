// =========================================
// MelodyStream — Navigation Module
// Song detail, history, back navigation,
// sidebar toggle, swipe gestures
// =========================================

import * as state from './state.js';
import { playSong, playNext, playPrevious } from './player.js';
import { isFavorite, toggleFavorite } from './favorites.js';

export function addToHistory(song) {
    // Guard: if the most recent item is the same song added within 5s, skip
    if (state.playHistory.length > 0) {
        const last = state.playHistory[0];
        const elapsed = Date.now() - new Date(last.playedAt).getTime();
        if (last.song.videoId === song.videoId && elapsed < 5000) return;
    }

    // Deduplicate: remove all existing entries of this song
    const filtered = state.playHistory.filter(item => item.song.videoId !== song.videoId);

    // Add to top, then save
    const historyItem = { song, playedAt: new Date().toISOString() };
    filtered.unshift(historyItem);

    // Limit to 50 items
    if (filtered.length > 50) filtered.pop();

    state.setPlayHistory(filtered);
    localStorage.setItem('playHistory', JSON.stringify(state.playHistory));
}

export function showSongDetail(song, onlyShowUI = false) {
    if (!onlyShowUI) {
        addToHistory(song);
        playSong(song);
    }

    const songDetail = document.getElementById('songDetail');
    if (!songDetail) return;

    songDetail.classList.add('active');

    // Always update UI elements
    const detailSongName = document.getElementById('detailSongName');
    const detailArtist = document.getElementById('detailArtist');
    const detailThumbnail = document.getElementById('detailThumbnail');
    const headerTitle = document.getElementById('detailHeaderTitle');

    if (detailSongName) detailSongName.textContent = song.title;
    if (detailArtist) detailArtist.textContent = song.channelTitle || 'Bilinmeyen Sanatçı';
    if (detailThumbnail) detailThumbnail.src = song.thumbnail;
    if (headerTitle) headerTitle.textContent = song.title;

    // Set blurred background from album art
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

    // Update play button state
    import('./player.js').then(player => {
        // Need to ensure the detail play button matches global state
        const icon = state.isPlaying ? 'fa-pause' : 'fa-play';
        const detailPlayBtn = document.getElementById('detailPlayPauseButton');
        if (detailPlayBtn) detailPlayBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    });

    // Hide main content and bottom player
    const mainContent = document.querySelector('.main-content');
    const playerBar = document.getElementById('playerBar');
    const tabBar = document.querySelector('.tab-bar');
    if (mainContent) mainContent.style.display = 'none';
    if (playerBar) playerBar.style.display = 'none';
    if (tabBar) tabBar.style.display = 'none';

    // Click on background -> close the expanded tabs tray
    songDetail.onclick = (e) => {
        const tabsContainer = document.querySelector('.sd-tabs');
        if (tabsContainer && tabsContainer.classList.contains('expanded')) {
            // If click is truly on background (not inside the tray)
            if (!e.target.closest('.sd-tabs')) {
                tabsContainer.classList.remove('expanded');
            }
        }
    };

    // Bind back button
    const backBtn = songDetail.querySelector('.sd-back-btn');
    if (backBtn) backBtn.onclick = goBack;

    state.setCurrentView('songDetail');

    // Initialize/Refresh tabs
    initPlayerTabs();
    updatePlayerQueue();
    updateRelatedSongs(song.videoId, song.title);
}

// YT Music style tabs logic
export function initPlayerTabs() {
    const tabsContainer = document.querySelector('.sd-tabs');
    const tabsBar = document.querySelector('.sd-tabs-bar');

    if (!tabsContainer || !tabsBar) return;

    // Stop propagation inside tray so background clicks don't close it when clicking content
    tabsContainer.onclick = (e) => e.stopPropagation();

    // Remove existing listener to avoid duplicates if re-initialized
    tabsBar.onclick = (e) => {
        const tab = e.target.closest('.sd-tab');
        if (tab) {
            const target = tab.dataset.sdTab;
            switchPlayerTab(target);
            tabsContainer.classList.add('expanded');
        } else {
            // Clicked the bar empty space -> toggle
            tabsContainer.classList.toggle('expanded');
        }
    };
}

function switchPlayerTab(tabId) {
    const tabs = document.querySelectorAll('.sd-tab');
    const panels = document.querySelectorAll('.sd-tab-panel');

    tabs.forEach(t => t.classList.toggle('active', t.dataset.sdTab === tabId));
    panels.forEach(p => p.classList.toggle('active', p.dataset.sdPanel === tabId));
}

export function updatePlayerQueue() {
    const queueList = document.getElementById('sdQueueList');
    if (!queueList) return;

    if (!state.currentSongList || state.currentSongList.length === 0) {
        queueList.innerHTML = '<p class="empty-state">Sırada şarkı yok</p>';
        return;
    }

    queueList.innerHTML = '';
    state.currentSongList.forEach(song => {
        const item = createQueueItem(song);
        if (state.currentSong && song.videoId === state.currentSong.videoId) {
            item.classList.add('active');
        }
        queueList.appendChild(item);
    });
}

export async function updateRelatedSongs(videoId, songTitle) {
    const relatedList = document.getElementById('sdRelatedList');
    if (!relatedList) return;

    if (!state.YOUTUBE_API_KEY) {
        relatedList.innerHTML = '<p class="error-message">API Anahtarı eksik</p>';
        return;
    }

    relatedList.innerHTML = '<div class="loading-spinner visible" style="margin: 20px auto;"></div>';

    try {
        // Use keyword search since relatedToVideoId is deprecated (returns 400)
        const query = encodeURIComponent(`more music like ${songTitle}`);
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${query}&maxResults=15&key=${state.YOUTUBE_API_KEY}`
        );

        if (!response.ok) throw new Error('Benzer şarkılar yüklenemedi');

        const data = await response.json();
        const songs = data.items
            .filter(item => item.snippet && item.id.videoId)
            .map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url,
                channelTitle: item.snippet.channelTitle,
                type: 'youtube'
            }));

        relatedList.innerHTML = '';
        if (songs.length === 0) {
            relatedList.innerHTML = '<p class="empty-state">Benzer şarkı bulunamadı</p>';
            return;
        }

        songs.forEach(song => {
            relatedList.appendChild(createQueueItem(song));
        });
    } catch (err) {
        console.error('Related songs error:', err);
        relatedList.innerHTML = '<p class="error-message">Yüklenirken hata oluştu</p>';
    }
}

function createQueueItem(song) {
    const div = document.createElement('div');
    div.className = 'sd-queue-item';
    div.innerHTML = `
        <img src="${song.thumbnail}" alt="${song.title}">
        <div class="sd-queue-info">
            <h4>${song.title}</h4>
            <p>${song.channelTitle}</p>
        </div>
        <div class="sd-queue-active-icon">
            <i class="fas fa-volume-up"></i>
        </div>
    `;
    div.onclick = () => {
        playSong(song);
        updatePlayerQueue(); // Refresh highlight
    };
    return div;
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
