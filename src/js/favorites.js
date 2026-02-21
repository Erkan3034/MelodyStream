// =========================================
// MelodyStream — Favorites Module
// Cloud sync for logged-in users, localStorage for guests
// =========================================

import * as state from './state.js';
import { api } from './api.js';

export function toggleFavorite(song) {
    const index = state.favorites.findIndex(f => f.videoId === song.videoId);
    const isAdding = index === -1;

    if (isAdding) {
        state.favorites.push(song);
    } else {
        state.favorites.splice(index, 1);
    }

    // Always persist to localStorage as fallback
    localStorage.setItem('favorites', JSON.stringify(state.favorites));

    // Sync to backend if logged in
    if (state.user) {
        if (isAdding) {
            api.addFavorite(song).catch(err => console.warn('Favori senkronizasyon hatası:', err));
        } else {
            api.removeFavorite(song.videoId).catch(err => console.warn('Favori silme hatası:', err));
        }
    }

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

// Load favorites from backend (called after login)
export async function loadFavoritesFromBackend() {
    if (!state.user) return;
    try {
        const backendFavs = await api.getFavorites();
        // Backend is the single source of truth — replace local state entirely
        const mapped = backendFavs.map(f => ({
            videoId: f.video_id,
            title: f.title,
            thumbnail: f.thumbnail,
            channelTitle: f.channel_title,
            type: 'youtube'
        }));

        // Deduplicate by videoId (safety net)
        const seen = new Set();
        const deduped = mapped.filter(f => {
            if (seen.has(f.videoId)) return false;
            seen.add(f.videoId);
            return true;
        });

        state.setFavorites(deduped);
        localStorage.setItem('favorites', JSON.stringify(deduped));
        updateFavoritesGrid();
    } catch (err) {
        console.warn('Backend favorileri yüklenemedi, yerel kullanılıyor:', err);
    }
}

export function updateFavoritesGrid() {
    const list = document.getElementById('favoriteMusic');
    if (!list) return;

    list.innerHTML = '';
    if (state.favorites.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-heart"></i>
        <p>Henüz favori şarkın yok</p>
      </div>
    `;
    } else {
        state.favorites.forEach(song => {
            const item = document.createElement('div');
            item.className = 'search-list-item';
            item.innerHTML = `
                <img src="${song.thumbnail || '/favicon.svg'}" alt="${song.title}" loading="lazy">
                <div class="search-list-info">
                    <h3>${song.title}</h3>
                    <p>${song.channelTitle || 'Bilinmeyen Sanatçı'}</p>
                </div>
                <button class="favorite-btn active" aria-label="Favori">
                    <i class="fas fa-heart"></i>
                </button>
            `;
            item.onclick = () => import('./navigation.js').then(nav => nav.showSongDetail(song));
            const favBtn = item.querySelector('.favorite-btn');
            if (favBtn) {
                favBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleFavorite(song);
                };
            }
            list.appendChild(item);
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
        <span style="color:var(--ms-text-secondary);font-size:13px">${state.favorites.length} şarkı</span>
      </div>
      <div class="search-results-list" id="favoriteMusic"></div>
    </div>
  `;
    updateFavoritesGrid();
    state.setCurrentView('favorites');
    state.setCurrentSongList([...state.favorites]);
}
