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

export async function loadRecommendedMusic() {
  if (!state.YOUTUBE_API_KEY) {
    console.warn('YouTube API key bulunamadı!');
    return;
  }

  try {
    const grid = document.getElementById('recommendedMusic');
    if (grid) grid.innerHTML = '<div class="loading-spinner visible"></div>';

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&regionCode=TR&maxResults=12&key=${state.YOUTUBE_API_KEY}&q=türkçe müzik 2026 popüler`
    );

    if (!response.ok) throw new Error('Önerilen müzikler yüklenemedi');

    const data = await response.json();
    const songs = data.items
      .filter(item => item.id.videoId)
      .map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high.url,
        channelTitle: item.snippet.channelTitle,
        type: 'youtube',
      }));

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

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&q=türkçe pop müzik mix 2026&maxResults=6&key=${state.YOUTUBE_API_KEY}`
    );

    if (!response.ok) return;

    const data = await response.json();
    state.setPopularPlaylists(data.items.map(item => ({
      id: item.id.playlistId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high.url,
      channelTitle: item.snippet.channelTitle,
    })));

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
        </div>
        <div class="music-grid" id="playlistDetail"></div>
      </div>
    `;

    const grid = document.getElementById('playlistDetail');
    songs.forEach(song => {
      grid.appendChild(createMusicCard(song));
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
        <h2>⚡ Hızlı Erişim</h2>
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
      <div class="music-grid" id="favoriteMusic"></div>
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
