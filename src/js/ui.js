// =========================================
// MelodyStream — UI Module (v2)
// Card creation, section rendering, API calls
// =========================================

import * as state from './state.js';
import { isFavorite, toggleFavorite } from './favorites.js';

export function createMusicCard(song) {
  const card = document.createElement('div');
  card.className = 'music-card';
  card.setAttribute('aria-label', song.title);

  const favActive = isFavorite(song.videoId) ? 'active' : '';

  card.innerHTML = `
    <div class="card-image-wrapper">
      <img src="${song.thumbnail}" alt="${song.title}" loading="lazy">
      <div class="play-overlay">
        <i class="fas fa-play"></i>
      </div>
      <button class="favorite-btn ${favActive}" aria-label="Favorilere Ekle" data-video-id="${song.videoId}">
        <i class="fas fa-heart"></i>
      </button>
    </div>
    <h3>${song.title}</h3>
    <p>${song.channelTitle || 'Bilinmeyen Sanatçı'}</p>
  `;

  // Play on click
  card.addEventListener('click', () => {
    import('./navigation.js').then(nav => nav.showSongDetail(song));
  });

  // Favorite toggle
  const favBtn = card.querySelector('.favorite-btn');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(song);
      favBtn.classList.toggle('active', isFavorite(song.videoId));
    });
  }

  return card;
}

export function updateRecommendedMusicGrid() {
  const grid = document.getElementById('recommendedMusic');
  if (!grid) return;

  grid.innerHTML = '';
  state.recommendedMusic.forEach(song => {
    grid.appendChild(createMusicCard(song));
  });
}

// ─── Cache helpers ───────────────────────────────────────────
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota full */ }
}

export async function loadRecommendedMusic() {
  if (!state.YOUTUBE_API_KEY) {
    console.warn('YouTube API key bulunamadı!');
    return;
  }

  // ── Memory guard: already loaded this session ──
  if (state.recommendedMusic.length > 0) {
    updateRecommendedMusicGrid();
    return;
  }

  // ── 24-hour localStorage cache ──
  const cached = getCached('yt_recommended');
  if (cached) {
    state.setRecommendedMusic(cached);
    updateRecommendedMusicGrid();
    state.setCurrentSongList(cached);
    return;
  }

  try {
    const grid = document.getElementById('recommendedMusic');
    if (grid) grid.innerHTML = '<div class="loading-spinner visible"></div>';

    // 💡 playlistItems.list = 1 unit vs search.list = 100 units!
    // Using curated popular Turkish music playlist
    const TURKISH_MUSIC_PLAYLIST = 'PLNLbHIuMRoPNiHsLT7rD3hom4QsZqLmR0';
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${TURKISH_MUSIC_PLAYLIST}&key=${state.YOUTUBE_API_KEY}`
    );

    let songs = [];

    if (response.ok) {
      const data = await response.json();
      songs = data.items
        .filter(item => item.snippet.resourceId?.videoId)
        .map(item => ({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
          channelTitle: item.snippet.channelTitle,
          type: 'youtube',
        }));
    }

    // Fallback: if playlist fails, try a search (last resort, 100 units)
    if (songs.length === 0) {
      const fallback = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&regionCode=TR&maxResults=12&key=${state.YOUTUBE_API_KEY}&q=türkçe müzik 2026 popüler`
      );
      if (fallback.ok) {
        const data = await fallback.json();
        songs = data.items
          .filter(item => item.id.videoId)
          .map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            channelTitle: item.snippet.channelTitle,
            type: 'youtube',
          }));
      }
    }

    setCache('yt_recommended', songs);
    state.setRecommendedMusic(songs);
    updateRecommendedMusicGrid();
    state.setCurrentSongList(songs);
  } catch (err) {
    console.error('Önerilen müzik yükleme hatası:', err);
    const grid = document.getElementById('recommendedMusic');
    if (grid) grid.innerHTML = '<div class="error-message">Müzikler yüklenirken hata oluştu</div>';
  }
}

export async function loadPopularPlaylists() {
  if (!state.YOUTUBE_API_KEY) return;

  // ── Memory guard ──
  if (state.popularPlaylists.length > 0) {
    renderPopularPlaylists();
    return;
  }

  // ── 24-hour cache ──
  const cached = getCached('yt_playlists');
  if (cached) {
    state.setPopularPlaylists(cached);
    renderPopularPlaylists();
    return;
  }

  try {
    // Use hardcoded curated playlist IDs instead of search (1 unit vs 100 units per call!)
    const CURATED_PLAYLISTS = [
      { id: 'PLNLbHIuMRoPNiHsLT7rD3hom4QsZqLmR0', title: 'Türkçe Pop Hit', channelTitle: 'MelodyStream' },
      { id: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', title: 'En İyi Türk Müziği', channelTitle: 'MelodyStream' },
      { id: 'PL9EBBA1B9FA5F5F77', title: 'Türkçe Slow Şarkılar', channelTitle: 'YouTube Music' },
      { id: 'PLNLbHIuMRoPM43MjFCpCJqB3VTasMDX1j', title: 'Türkçe Rock', channelTitle: 'MelodyStream' },
      { id: 'PL6D6C5F4D4E0D32BD', title: 'Türkçe R&B', channelTitle: 'YouTube Music' },
      { id: 'PLynG8gQD-n8BMplEVZVsoYlaRgqzG1qc4', title: 'Yeni Türkçe Müzik', channelTitle: 'MelodyStream' },
    ];

    // Get thumbnails for each playlist using channels (1 unit each, cheap)
    const playlists = [];
    for (const pl of CURATED_PLAYLISTS) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${pl.id}&key=${state.YOUTUBE_API_KEY}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length > 0) {
          const item = data.items[0];
          playlists.push({
            id: pl.id,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
            channelTitle: item.snippet.channelTitle
          });
        } else {
          // If playlist not found, still add with fallback
          playlists.push({ ...pl, thumbnail: '/favicon.svg' });
        }
      }
    }

    setCache('yt_playlists', playlists);
    state.setPopularPlaylists(playlists);
    renderPopularPlaylists();
  } catch (err) {
    console.error('Popüler playlistler yüklenemedi:', err);
  }
}

function renderPopularPlaylists() {
  const grid = document.getElementById('popularPlaylistsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  state.popularPlaylists.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'popular-playlist-card';
    card.innerHTML = `
      <img src="${pl.thumbnail}" alt="${pl.title}" loading="lazy">
      <h3>${pl.title}</h3>
      <p>${pl.channelTitle}</p>
    `;
    card.onclick = () => loadPlaylistDetail(pl.id);
    grid.appendChild(card);
  });
}

async function loadPlaylistDetail(playlistId) {
  if (!state.YOUTUBE_API_KEY) return;

  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  mainContent.innerHTML = '<div class="loading-spinner visible"></div>';

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=20&playlistId=${playlistId}&key=${state.YOUTUBE_API_KEY}`
    );

    if (!response.ok) throw new Error('Playlist yüklenemedi');
    const data = await response.json();

    const songs = data.items
      .filter(item => item.snippet.resourceId.videoId)
      .map(item => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || '',
        channelTitle: item.snippet.channelTitle,
        type: 'youtube',
      }));

    mainContent.innerHTML = `
      <div class="section">
        <div class="section-header">
          <h2>🎵 Playlist</h2>
          <span style="color:var(--ms-text-secondary);font-size:13px">${songs.length} şarkı</span>
        </div>
        <div class="search-results-list" id="playlistDetail"></div>
      </div>
    `;

    const list = document.getElementById('playlistDetail');
    import('./favorites.js').then(({ isFavorite, toggleFavorite }) => {
      songs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'search-list-item';
        const favActive = isFavorite(song.videoId) ? 'active' : '';
        item.innerHTML = `
          <img src="${song.thumbnail || '/favicon.svg'}" alt="${song.title}" loading="lazy">
          <div class="search-list-info">
            <h3>${song.title}</h3>
            <p>${song.channelTitle || 'Bilinmeyen Sanatçı'}</p>
          </div>
          <button class="favorite-btn ${favActive}" aria-label="Favori">
            <i class="fas fa-heart"></i>
          </button>
        `;
        item.onclick = () => import('./navigation.js').then(nav => nav.showSongDetail(song));
        const favBtn = item.querySelector('.favorite-btn');
        if (favBtn) {
          favBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(song);
            favBtn.classList.toggle('active', isFavorite(song.videoId));
          };
        }
        list.appendChild(item);
      });
    });

    state.setCurrentSongList(songs);
    state.setCurrentView('playlistDetail');
  } catch (err) {
    console.error('Playlist detay hatası:', err);
    mainContent.innerHTML = '<div class="error-message">Playlist yüklenirken hata oluştu</div>';
  }
}

export function renderHomeSection() {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <!-- Quick Access -->
    <div class="section" id="quickAccessSection" style="display: none;">
      <div class="section-header">
        <h2>Hızlı Erişim</h2>
      </div>
      <div class="music-grid" id="quickAccessGrid"></div>
    </div>

    <!-- Recommended -->
    <div class="section">
      <div class="section-header">
        <h2>🎧 Önerilen Müzikler</h2>
      </div>
      <div class="music-grid" id="recommendedMusic">
        <div class="loading-spinner visible"></div>
      </div>
    </div>

    <!-- Favorites -->
    <div class="section">
      <div class="section-header">
        <h2>❤️ Favorilerin</h2>
        <span class="see-all" id="seeAllFavorites">Tümünü Gör</span>
      </div>
      <div class="search-results-list" id="favoriteMusic"></div>
    </div>

    <!-- Popular Playlists -->
    <div class="section">
      <div class="section-header">
        <h2>🔥 Popüler Listeler</h2>
      </div>
      <div class="popular-playlists-grid" id="popularPlaylistsGrid">
        <div class="loading-spinner visible"></div>
      </div>
    </div>
  `;

  // Update favorites
  import('./favorites.js').then(fav => fav.updateFavoritesGrid());

  // Quick access (recent play history)
  if (state.playHistory.length > 0) {
    const quickSection = document.getElementById('quickAccessSection');
    const quickGrid = document.getElementById('quickAccessGrid');
    if (quickSection) quickSection.style.display = '';
    if (quickGrid) {
      const recentSongs = state.playHistory.slice(0, 6).map(h => h.song);
      recentSongs.forEach(song => quickGrid.appendChild(createMusicCard(song)));
    }
  }

  // Always load recommended & popular (don't wait for YouTube IFrame ready)
  loadRecommendedMusic();
  loadPopularPlaylists();

  // See all favorites
  const seeAllFav = document.getElementById('seeAllFavorites');
  if (seeAllFav) {
    seeAllFav.onclick = () => {
      import('./favorites.js').then(fav => fav.renderFavoritesSection());
    };
  }

  state.setCurrentView('home');
}
