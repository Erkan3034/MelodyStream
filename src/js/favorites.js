// =========================================
// MelodyStream — Favorites Module
// =========================================

import * as state from './state.js';

export function toggleFavorite(song) {
    const index = state.favorites.findIndex(f => f.videoId === song.videoId);
    if (index === -1) {
        state.favorites.push(song);
    } else {
        state.favorites.splice(index, 1);
    }
    localStorage.setItem('favorites', JSON.stringify(state.favorites));

    // Update detail button if current song
    if (state.currentSong && state.currentSong.videoId === song.videoId) {
        const detailFavBtn = document.getElementById('detailFavoriteBtn');
        if (detailFavBtn) {
            detailFavBtn.classList.toggle('active', state.favorites.some(f => f.videoId === song.videoId));
        }
    }

    // Re-render grids
    updateFavoritesGrid();
    import('./ui.js').then(ui => ui.updateRecommendedMusicGrid());
}

export function isFavorite(videoId) {
    return state.favorites.some(f => f.videoId === videoId);
}

export function updateFavoritesGrid() {
    const grid = document.getElementById('favoriteMusic');
    if (!grid) return;

    grid.innerHTML = '';
    if (state.favorites.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-heart"></i>
        <p>Henüz favori şarkın yok</p>
      </div>
    `;
    } else {
        import('./ui.js').then(ui => {
            state.favorites.forEach(song => {
                const card = ui.createMusicCard(song);
                grid.appendChild(card);
            });
        });
    }

    if (state.currentView === 'favorites') {
        state.setCurrentSongList([...state.favorites]);
    }
}

export function renderFavoritesSection() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="section">
      <div class="section-header">
        <h2>❤️ Favorilerin</h2>
      </div>
      <div class="music-grid" id="favoriteMusic"></div>
    </div>
  `;
    updateFavoritesGrid();
    state.setCurrentView('favorites');
    state.setCurrentSongList([...state.favorites]);
}
