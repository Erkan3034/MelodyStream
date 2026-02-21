// =========================================
// MelodyStream — Playlist Module
// Playlist CRUD + sidebar rendering
// Dual-mode: backend (logged in) | localStorage (guest)
// =========================================

import * as state from './state.js';
import { api } from './api.js';

// ── Persistence helpers ───────────────────────────────────────

export function savePlaylists() {
  localStorage.setItem('playlists', JSON.stringify(state.playlists));
}

/** Load playlists from backend when user is logged in. */
export async function loadPlaylistsFromBackend() {
  if (!state.user) return;
  try {
    const raw = await api.getPlaylists();
    // Normalise DB rows → local shape
    const playlists = raw.map(pl => ({
      id: String(pl.id),
      name: pl.name,
      createdAt: pl.created_at,
      songs: (pl.songs || []).map(s => ({
        videoId: s.video_id,
        title: s.title,
        thumbnail: s.thumbnail,
        channelTitle: s.channel_title,
        type: 'youtube',
      })),
    }));
    state.setPlaylists(playlists);
    savePlaylists(); // keep localStorage in sync
    renderPlaylistsSidebar();
  } catch (err) {
    console.error('Playlist yükleme hatası:', err);
  }
}

// ── Sidebar rendering ─────────────────────────────────────────

export function renderPlaylistsSidebar() {
  const section = document.querySelector('.playlist-section');
  if (!section) return;

  section.innerHTML = `<h3>Çalma Listeleri</h3>`;

  state.playlists.forEach((pl, idx) => {
    const div = document.createElement('div');
    div.className = 'playlist-item';
    div.innerHTML = `<i class="fas fa-music"></i> ${pl.name}`;
    div.setAttribute('aria-label', `Çalma Listesi: ${pl.name}`);
    div.onclick = () => showPlaylistSongs(idx);
    section.appendChild(div);
  });

  const newBtn = document.createElement('div');
  newBtn.className = 'playlist-item';
  newBtn.innerHTML = '<i class="fas fa-plus"></i> Yeni Liste Oluştur';
  newBtn.setAttribute('aria-label', 'Çalma Listesi Oluştur');
  newBtn.onclick = openCreatePlaylistModal;
  section.appendChild(newBtn);
}

// ── Create playlist ───────────────────────────────────────────

export function openCreatePlaylistModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Yeni Çalma Listesi</h3>
      <input id="playlistName" type="text" placeholder="Çalma listesi adı..." aria-label="Çalma listesi adı">
      <p id="playlistModalError" class="auth-error hidden"></p>
      <div class="modal-actions">
        <button class="btn-primary" id="createPlaylistBtn">Oluştur</button>
        <button class="btn-secondary" id="closeModalBtn">İptal</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('playlistName');
  const errorEl = document.getElementById('playlistModalError');
  input.focus();

  document.getElementById('closeModalBtn').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const doCreate = async () => {
    const name = input.value.trim();
    if (!name) return;

    const btn = document.getElementById('createPlaylistBtn');
    btn.disabled = true;
    btn.textContent = 'Oluşturuluyor...';

    if (state.user) {
      // ── Backend sync ──
      try {
        const created = await api.createPlaylist(name);
        const newPl = {
          id: String(created.id),
          name: created.name,
          createdAt: new Date().toISOString(),
          songs: [],
        };
        state.playlists.push(newPl);
        savePlaylists();
        renderPlaylistsSidebar();
        overlay.remove();
      } catch (err) {
        errorEl.textContent = err.message || 'Liste oluşturulamadı';
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Oluştur';
      }
    } else {
      // ── Local-only for guests ──
      state.playlists.push({
        id: Date.now().toString(),
        name,
        songs: [],
        createdAt: new Date().toISOString(),
      });
      savePlaylists();
      renderPlaylistsSidebar();
      overlay.remove();
    }
  };

  document.getElementById('createPlaylistBtn').onclick = doCreate;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
}

// ── Show playlist songs ───────────────────────────────────────

export function showPlaylistSongs(idx) {
  const pl = state.playlists[idx];
  if (!pl) return;

  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div class="section">
      <div class="section-header">
        <h2>🎵 ${pl.name}</h2>
        <span style="color:var(--ms-text-secondary);font-size:13px">${pl.songs.length} şarkı</span>
      </div>
      <div class="search-results-list" id="playlistSongs"></div>
    </div>
  `;

  const list = document.getElementById('playlistSongs');
  if (pl.songs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-music"></i>
        <p>Bu çalma listesinde henüz şarkı yok</p>
      </div>
    `;
  } else {
    import('./favorites.js').then(({ isFavorite, toggleFavorite }) => {
      pl.songs.forEach(song => {
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
  }

  state.setCurrentView('playlist');
  state.setCurrentSongList([...pl.songs]);
}

// ── Add song to playlist ──────────────────────────────────────

export function openAddToPlaylistModal() {
  if (!state.currentSong) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let listHtml = '';
  if (state.playlists.length === 0) {
    listHtml = '<p style="color: var(--ms-text-muted); text-align: center; padding: 16px 0;">Hiç çalma listen yok.</p>';
  } else {
    listHtml = state.playlists.map((pl, idx) => `
      <button class="btn-secondary" style="width: 100%; margin-bottom: 8px;" data-playlist-idx="${idx}">
        <i class="fas fa-music"></i> ${pl.name}
      </button>
    `).join('');
  }

  overlay.innerHTML = `
    <div class="modal-content">
      <h3>Çalma Listesine Ekle</h3>
      ${listHtml}
      <button class="btn-secondary" id="closeAddModalBtn" style="width: 100%; margin-top: 4px;">İptal</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('closeAddModalBtn').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.querySelectorAll('[data-playlist-idx]').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.playlistIdx);
      const pl = state.playlists[idx];
      const song = state.currentSong;

      // Deduplicate
      if (pl.songs.some(s => s.videoId === song.videoId)) {
        overlay.remove();
        return;
      }

      if (state.user) {
        // ── Backend sync ──
        try {
          await api.addSongToPlaylist(pl.id, song);
        } catch (err) {
          console.error('Şarkı eklenemedi:', err);
        }
      }

      // Always update local state too
      pl.songs.push(song);
      savePlaylists();
      overlay.remove();
    };
  });
}

// ── Delete playlist ───────────────────────────────────────────

export async function deletePlaylist(playlistId) {
  const index = state.playlists.findIndex(p => p.id === String(playlistId));
  if (index === -1) return;

  if (state.user) {
    try {
      await api.deletePlaylist(playlistId);
    } catch (err) {
      console.error('Playlist silinemedi:', err);
    }
  }

  state.playlists.splice(index, 1);
  savePlaylists();
  renderPlaylistsSidebar();
}
