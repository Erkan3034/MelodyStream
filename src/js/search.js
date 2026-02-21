// =========================================
// MelodyStream — Search Module
// YouTube search API integration
// =========================================

import * as state from './state.js';
import { createMusicCard } from './ui.js';
import { isFavorite, toggleFavorite } from './favorites.js';
import { showSongDetail } from './navigation.js';

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

async function performSearch(query) {
    if (!query) return [];

    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${state.YOUTUBE_API_KEY}&maxResults=12`
    );

    if (!response.ok) throw new Error('Arama başarısız');

    const data = await response.json();
    return data.items
        .filter(item => item.id.videoId)
        .map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails.high.url,
            channelTitle: item.snippet.channelTitle,
            type: 'youtube',
        }));
}

function createSearchListItem(song) {
    const item = document.createElement('div');
    item.className = 'search-list-item';

    const favActive = isFavorite(song.videoId) ? 'active' : '';

    item.innerHTML = `
        <img src="${song.thumbnail}" alt="${song.title}" loading="lazy">
        <div class="search-list-info">
            <h3>${song.title}</h3>
            <p>${song.channelTitle || 'Bilinmeyen Sanatçı'}</p>
        </div>
        <button class="favorite-btn ${favActive}" aria-label="Favori">
            <i class="fas fa-heart"></i>
        </button>
    `;

    item.onclick = () => showSongDetail(song);

    const favBtn = item.querySelector('.favorite-btn');
    if (favBtn) {
        favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song);
            favBtn.classList.toggle('active', isFavorite(song.videoId));
        };
    }

    return item;
}

export function attachSearchHandler(inputEl, gridEl, options = {}) {
    if (!inputEl || !gridEl) return;

    const handler = debounce(async (e) => {
        const query = e.target.value.trim();

        if (!query) {
            if (options.onEmpty) options.onEmpty();
            return;
        }

        try {
            // Show loading
            gridEl.innerHTML = '<div class="loading-spinner visible"></div>';

            const results = await performSearch(query);
            state.setLastSearchResults(results);

            gridEl.innerHTML = '';
            if (results.length === 0) {
                gridEl.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-search"></i>
            <p>Sonuç bulunamadı</p>
          </div>
        `;
            } else {
                results.forEach(song => {
                    gridEl.appendChild(createSearchListItem(song));
                });
            }

            state.setCurrentSongList(results);
        } catch (error) {
            console.error('Arama hatası:', error);
            gridEl.innerHTML = `
        <div class="error-message">Arama yapılırken hata oluştu</div>
      `;
        }
    }, 400);

    inputEl.addEventListener('input', handler);
}

export function renderSearchSection() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="search-wrapper">
      <i class="fas fa-search"></i>
      <input type="text" class="search-bar" id="searchInput" placeholder="Şarkı veya sanatçı ara..." aria-label="Ara">
    </div>
    <div class="section">
      <div class="section-header">
        <h2>Arama Sonuçları</h2>
      </div>
      <div class="search-results-list" id="searchResults"></div>
    </div>
  `;

    const searchInput = document.getElementById('searchInput');
    const grid = document.getElementById('searchResults');

    searchInput.focus();

    attachSearchHandler(searchInput, grid, {
        onEmpty: () => {
            grid.innerHTML = '';
            state.setCurrentSongList([]);
        },
    });

    state.setCurrentView('search');
    state.setCurrentSongList([]);
}
