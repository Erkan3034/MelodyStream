// =========================================
// MelodyStream — Playlist Module
// Playlist CRUD + sidebar rendering
// =========================================

import * as state from './state.js';

export function savePlaylists() {
    localStorage.setItem('playlists', JSON.stringify(state.playlists));
}

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

export function openCreatePlaylistModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal-content">
      <h3>Yeni Çalma Listesi</h3>
      <input id="playlistName" type="text" placeholder="Çalma listesi adı..." aria-label="Çalma listesi adı">
      <div class="modal-actions">
        <button class="btn-primary" id="createPlaylistBtn">Oluştur</button>
        <button class="btn-secondary" id="closeModalBtn">İptal</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);

    const input = document.getElementById('playlistName');
    input.focus();

    document.getElementById('closeModalBtn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    document.getElementById('createPlaylistBtn').onclick = () => {
        const name = input.value.trim();
        if (name) {
            state.playlists.push({
                id: Date.now().toString(),
                name,
                songs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            savePlaylists();
            renderPlaylistsSidebar();
            overlay.remove();
        }
    };

    // Enter key support
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('createPlaylistBtn').click();
    });
}

export function showPlaylistSongs(idx) {
    const pl = state.playlists[idx];
    if (!pl) return;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="section">
      <div class="section-header">
        <h2>🎵 ${pl.name}</h2>
      </div>
      <div class="music-grid" id="playlistSongs"></div>
    </div>
  `;

    const grid = document.getElementById('playlistSongs');
    if (pl.songs.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-music"></i>
        <p>Bu çalma listesinde henüz şarkı yok</p>
      </div>
    `;
    } else {
        import('./ui.js').then(ui => {
            pl.songs.forEach(song => {
                const card = ui.createMusicCard(song);
                grid.appendChild(card);
            });
        });
    }

    state.setCurrentView('playlist');
    state.setCurrentSongList([...pl.songs]);
}

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

    // Add click handlers for playlist buttons
    overlay.querySelectorAll('[data-playlist-idx]').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.playlistIdx);
            if (!state.playlists[idx].songs.some(s => s.videoId === state.currentSong.videoId)) {
                state.playlists[idx].songs.push(state.currentSong);
                state.playlists[idx].updatedAt = new Date().toISOString();
                savePlaylists();
            }
            overlay.remove();
        };
    });
}

export function deletePlaylist(playlistId) {
    const index = state.playlists.findIndex(p => p.id === playlistId);
    if (index !== -1) {
        state.playlists.splice(index, 1);
        savePlaylists();
        renderPlaylistsSidebar();
    }
}
