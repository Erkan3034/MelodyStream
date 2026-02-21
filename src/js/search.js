// =========================================
// MelodyStream — Search Module
// YouTube search API integration
// =========================================

import * as state from './state.js';
import { createMusicCard } from './ui.js';
import { isFavorite, toggleFavorite } from './favorites.js';
import { showSongDetail } from './navigation.js';

// ── Per-query search cache (2h default, 24h for browse tiles) ──────────────────────────
const NORMAL_TTL = 2 * 60 * 60 * 1000;
const BROWSE_TTL = 24 * 60 * 60 * 1000;

function getSearchCached(query) {
    try {
        const raw = localStorage.getItem(`search_cache_${query}`);
        if (!raw) return null;

        const { data, ts, isBrowse } = JSON.parse(raw);
        const ttl = isBrowse ? BROWSE_TTL : NORMAL_TTL;

        if (Date.now() - ts > ttl) {
            localStorage.removeItem(`search_cache_${query}`);
            return null;
        }
        return data;
    } catch { return null; }
}

function setSearchCache(query, data, isBrowse = false) {
    try {
        const cacheObj = { data, ts: Date.now(), isBrowse };
        localStorage.setItem(`search_cache_${query}`, JSON.stringify(cacheObj));
    } catch {
        // Handle quota full: clear old search caches if needed
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('search_cache_')) localStorage.removeItem(key);
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

async function performSearch(query, isBrowse = false) {
    if (!query) return [];

    // ── Serve from cache ──
    const cached = getSearchCached(query);
    if (cached) {
        console.debug(`[Search] Cache hit: "${query}"`);
        return cached;
    }

    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${state.YOUTUBE_API_KEY}&maxResults=12`
    );

    if (!response.ok) throw new Error('Arama başarısız');

    const data = await response.json();
    const results = data.items
        .filter(item => item.id.videoId)
        .map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails.high.url,
            channelTitle: item.snippet.channelTitle,
            type: 'youtube',
        }));

    setSearchCache(query, results, isBrowse);
    return results;
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
    }, 600); // 600ms debounce — reduces API calls vs 400ms

    inputEl.addEventListener('input', handler);
}

export function renderSearchSuggestions(container) {
    if (!container) return;

    const suggestions = [
        { label: 'Yalın', query: 'Yalın', color: 'bc-purple', icon: 'fa-user' },
        { label: 'Sezen Aksu', query: 'Sezen Aksu', color: 'bc-red', icon: 'fa-user' },
        { label: 'Tarkan', query: 'Tarkan', color: 'bc-blue', icon: 'fa-star' },
        { label: 'Müslüm Gürses', query: 'Müslüm Gürses', color: 'bc-orange', icon: 'fa-microphone' },
        { label: 'Ahmet Kaya', query: 'Ahmet Kaya', color: 'bc-indigo', icon: 'fa-microphone' },
        { label: 'Mabel Matiz', query: 'Mabel Matiz', color: 'bc-cyan', icon: 'fa-magic' },
        { label: 'Ezhel', query: 'Ezhel', color: 'bc-green', icon: 'fa-bolt' },
        { label: 'Cem Karaca', query: 'Cem Karaca', color: 'bc-red', icon: 'fa-microphone' },
        { label: 'Zeki Müren', query: 'Zeki Müren', color: 'bc-purple', icon: 'fa-gem' },
        { label: 'Ajda Pekkan', query: 'Ajda Pekkan', color: 'bc-orange', icon: 'fa-star' },
        { label: 'Duman', query: 'Duman', color: 'bc-blue', icon: 'fa-guitar' },
        { label: 'Mor ve Ötesi', query: 'Mor ve Ötesi', color: 'bc-indigo', icon: 'fa-guitar' },
        { label: 'Adamlar', query: 'Adamlar', color: 'bc-cyan', icon: 'fa-users' },
        { label: 'Hadise', query: 'Hadise', color: 'bc-red', icon: 'fa-user' },
        { label: 'Murat Boz', query: 'Murat Boz', color: 'bc-blue', icon: 'fa-user' },
        { label: 'Teoman', query: 'Teoman', color: 'bc-cyan', icon: 'fa-guitar' },
        { label: 'Barış Akarsu', query: 'Barış Akarsu', color: 'bc-orange', icon: 'fa-microphone' },
        { label: 'Barış Manço', query: 'Barış Manço', color: 'bc-blue', icon: 'fa-microphone' },
        { label: 'MFÖ', query: 'MFÖ', color: 'bc-yellow', icon: 'fa-users' },
        { label: 'Sertab Erener', query: 'Sertab Erener', color: 'bc-purple', icon: 'fa-user' },
        { label: 'Sıla', query: 'Sıla', color: 'bc-red', icon: 'fa-user' },
        { label: 'Haluk Levent', query: 'Haluk Levent', color: 'bc-green', icon: 'fa-guitar' },
        { label: 'Ebru Gündeş', query: 'Ebru Gündeş', color: 'bc-blue', icon: 'fa-microphone' },
        { label: 'Karadeniz Şarkıları', query: 'Karadeniz En İyi Şarkılar', color: 'bc-green', icon: 'fa-water' },
        { label: 'Türk Halk Müziği', query: 'Türk Halk Müziği En İyiler', color: 'bc-orange', icon: 'fa-guitar' },
        { label: 'Popüler Slow', query: 'Türkçe popüler slow şarkılar', color: 'bc-green', icon: 'fa-heart' },
        { label: "90'lar Türkçe", query: '90lar Türkçe Pop', color: 'bc-cyan', icon: 'fa-history' },
        { label: 'Anadolu Rock', query: 'Anadolu Rock En İyiler', color: 'bc-orange', icon: 'fa-guitar' },
        { label: 'Türk Sanat Müziği', query: 'Türk Sanat Müziği Klasikler', color: 'bc-indigo', icon: 'fa-music' },
        { label: 'Yeni Çıkanlar', query: '2026 Türkçe yeni çıkanlar', color: 'bc-indigo', icon: 'fa-bolt' },
        { label: 'En İyiler', query: 'Türkçe en iyi şarkılar', color: 'bc-yellow', icon: 'fa-trophy' },
        { label: 'Arabesk Damar', query: 'En Damar Arabesk Şarkılar', color: 'bc-red', icon: 'fa-tint' },
        { label: 'Deep Turkish', query: 'Turkish Deep House 2026', color: 'bc-purple', icon: 'fa-headphones' },
    ];

    container.innerHTML = `
      <div class="section-header" style="margin-top: 24px;">
        <h2  style="border-bottom: 1px solid #098235ff; color: #a4c2a7ff;">Hemen Göz At</h2>
      </div>
      <div class="browse-grid" id="searchSuggestions"></div>
    `;

    const grid = document.getElementById('searchSuggestions');
    suggestions.forEach(item => {
        const card = document.createElement('div');
        card.className = `browse-card ${item.color}`;
        card.innerHTML = `
        <h3>${item.label}</h3>
        <i class="fas ${item.icon}"></i>
      `;
        card.onclick = async () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = item.label;

                // Optimized: skip debounce and use cached results immediately if available
                const gridEl = document.getElementById('searchResults');
                if (gridEl) {
                    try {
                        gridEl.innerHTML = '<div class="loading-spinner visible"></div>';
                        const results = await performSearch(item.label, true);
                        state.setLastSearchResults(results);
                        gridEl.innerHTML = '';
                        if (results.length === 0) {
                            gridEl.innerHTML = '<div class="empty-state"><p>Sonuç bulunamadı</p></div>';
                        } else {
                            results.forEach(song => gridEl.appendChild(createSearchListItem(song)));
                        }
                        state.setCurrentSongList(results);
                    } catch (err) {
                        console.error('Suggestion click error:', err);
                    }
                }
            }
        };
        grid.appendChild(card);
    });
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

    // Initial suggestions
    renderSearchSuggestions(grid);

    attachSearchHandler(searchInput, grid, {
        onEmpty: () => {
            renderSearchSuggestions(grid);
            state.setCurrentSongList([]);
        },
    });

    state.setCurrentView('search');
}
