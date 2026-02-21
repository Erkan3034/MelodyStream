// =========================================
// MelodyStream — Auth UI
// Login / Register / Profile View
// =========================================

import * as state from './state.js';
import { api } from './api.js';
import { loadFavoritesFromBackend } from './favorites.js';
import { loadPlaylistsFromBackend, renderPlaylistsSidebar } from './playlist.js';

export function renderProfileSection() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    if (state.user) {
        renderUserProfile(mainContent);
    } else {
        renderAuthForms(mainContent);
    }

    state.setCurrentView('profile');
}

function renderUserProfile(container) {
    // \u2500\u2500 Compute stats from local state \u2500\u2500
    const totalSongs = state.playHistory.length;
    const estimatedMinutes = Math.round(totalSongs * 3.5); // avg 3.5 min/song
    const hours = Math.floor(estimatedMinutes / 60);
    const mins = estimatedMinutes % 60;
    const listenTime = hours > 0 ? `${hours}s ${mins}dk` : `${mins}dk`;

    // Top artists from history
    const artistCount = {};
    state.playHistory.forEach(h => {
        const a = h.song.channelTitle || 'Bilinmeyen';
        artistCount[a] = (artistCount[a] || 0) + 1;
    });
    const topArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Achievements
    const achievements = [];
    if (totalSongs >= 1) achievements.push({ icon: '🎵', label: 'İlk Şarkı', desc: 'İlk müziğini dinledin!' });
    if (totalSongs >= 10) achievements.push({ icon: '🎧', label: 'Müzik Keyfi', desc: '10+ şarkı dinledin' });
    if (totalSongs >= 50) achievements.push({ icon: '🔥', label: 'Müzik Delisi', desc: '50+ şarkı dinledin' });
    if (totalSongs >= 100) achievements.push({ icon: '🏆', label: 'Efsane', desc: '100+ şarkı dinledin!' });
    if (state.favorites.length >= 1) achievements.push({ icon: '❤️', label: 'İlk Favori', desc: 'İlk favorini ekledin' });
    if (state.favorites.length >= 10) achievements.push({ icon: '💎', label: 'Koleksiyoncu', desc: '10+ favori şarkın var' });
    if (state.playlists.length >= 1) achievements.push({ icon: '📋', label: 'DJ Başlangıç', desc: 'İlk listeni oluşturdun' });
    if (state.playlists.length >= 3) achievements.push({ icon: '🎼', label: 'Playlist Ustası', desc: '3+ liste oluşturdun' });
    if (achievements.length === 0) achievements.push({ icon: '🌱', label: 'Yeni Üye', desc: 'Müzik yolculuğuna hoş geldin!' });

    // Recent activity (last 5)
    const recentActivity = state.playHistory.slice(0, 5);

    // Email display name
    const displayName = state.user.email.split('@')[0];

    container.innerHTML = `
        <div class="profile-page">

            <!-- Header Card -->
            <div class="profile-hero">
                <div class="profile-hero-bg"></div>
                <div class="profile-hero-content">
                    <div class="profile-avatar-large">
                        <span>${displayName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="profile-hero-info">
                        <h2 class="profile-display-name">${displayName}</h2>
                        <p class="profile-email-small">${state.user.email}</p>
                        <span class="profile-badge-label">MelodyStream Üyesi</span>
                    </div>
                    <button id="logoutBtn" class="logout-btn">
                        <i class="fas fa-sign-out-alt"></i> Çıkış
                    </button>
                </div>
            </div>

            <!-- Stats Row -->
            <div class="profile-stats-row">
                <div class="profile-stat-card">
                    <div class="profile-stat-icon" style="color:#1db954">🎵</div>
                    <div class="profile-stat-value">${totalSongs}</div>
                    <div class="profile-stat-label">Şarkı Dinlendi</div>
                </div>
                <div class="profile-stat-card">
                    <div class="profile-stat-icon">⏱️</div>
                    <div class="profile-stat-value">${listenTime}</div>
                    <div class="profile-stat-label">Dinleme Süresi</div>
                </div>
                <div class="profile-stat-card">
                    <div class="profile-stat-icon" style="color:#e91e63">❤️</div>
                    <div class="profile-stat-value">${state.favorites.length}</div>
                    <div class="profile-stat-label">Favori</div>
                </div>
                <div class="profile-stat-card">
                    <div class="profile-stat-icon" style="color:#ff9800">📋</div>
                    <div class="profile-stat-value">${state.playlists.length}</div>
                    <div class="profile-stat-label">Liste</div>
                </div>
            </div>

            <!-- Achievements -->
            <div class="section">
                <div class="section-header"><h2>🏅 Başarılar</h2></div>
                <div class="achievements-grid">
                    ${achievements.map(a => `
                        <div class="achievement-card">
                            <span class="achievement-icon">${a.icon}</span>
                            <div class="achievement-info">
                                <strong>${a.label}</strong>
                                <span>${a.desc}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Top Artists -->
            ${topArtists.length > 0 ? `
            <div class="section">
                <div class="section-header"><h2>🎤 En Çok Dinlediğin Sanatçılar</h2></div>
                <div class="top-artists-list">
                    ${topArtists.map(([artist, count], i) => `
                        <div class="top-artist-item">
                            <span class="top-artist-rank">#${i + 1}</span>
                            <div class="top-artist-bar-wrap">
                                <div class="top-artist-name">${artist}</div>
                                <div class="top-artist-bar">
                                    <div class="top-artist-fill" style="width:${Math.round((count / topArtists[0][1]) * 100)}%"></div>
                                </div>
                            </div>
                            <span class="top-artist-count">${count} şarkı</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- Recent Activity -->
            ${recentActivity.length > 0 ? `
            <div class="section">
                <div class="section-header"><h2>🕐 Son Aktivite</h2></div>
                <div class="recent-activity-list">
                    ${recentActivity.map(item => {
        const d = new Date(item.playedAt);
        const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        return `
                        <div class="activity-item" data-video-id="${item.song.videoId}">
                            <img src="${item.song.thumbnail || '/favicon.svg'}" alt="${item.song.title}" loading="lazy">
                            <div class="activity-info">
                                <strong>${item.song.title}</strong>
                                <span>${item.song.channelTitle || 'Bilinmeyen'}</span>
                            </div>
                            <span class="activity-time">${dateStr} ${timeStr}</span>
                        </div>`;
    }).join('')}
                </div>
            </div>` : ''}

        </div>
    `;

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        api.logout();
        renderProfileSection();
    });

    // Click on activity to play
    container.querySelectorAll('.activity-item').forEach(el => {
        el.addEventListener('click', () => {
            const h = recentActivity.find(a => a.song.videoId === el.dataset.videoId);
            if (h) import('./navigation.js').then(nav => nav.showSongDetail(h.song));
        });
    });
}

function renderAuthForms(container) {
    container.innerHTML = `
        <div class="section auth-section">
            <div class="auth-container">
                <div class="auth-logo">
                    <div class="logo-icon">♪</div>
                    <h2>MelodyStream</h2>
                </div>

                <div class="auth-tabs">
                    <button class="auth-tab active" data-auth-tab="login">Giriş Yap</button>
                    <button class="auth-tab" data-auth-tab="register">Kayıt Ol</button>
                </div>

                <!-- Login Form -->
                <form id="loginForm" class="auth-form active">
                    <div class="form-group">
                        <label for="loginEmail">E-posta</label>
                        <input type="email" id="loginEmail" placeholder="ornek@mail.com" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="loginPassword">Şifre</label>
                        <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password" required>
                    </div>
                    <p id="loginError" class="auth-error hidden"></p>
                    <button type="submit" class="auth-submit-btn">
                        <i class="fas fa-sign-in-alt"></i> Giriş Yap
                    </button>
                </form>

                <!-- Register Form -->
                <form id="registerForm" class="auth-form">
                    <div class="form-group">
                        <label for="registerEmail">E-posta</label>
                        <input type="email" id="registerEmail" placeholder="ornek@mail.com" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="registerPassword">Şifre</label>
                        <input type="password" id="registerPassword" placeholder="En az 6 karakter" autocomplete="new-password" required>
                    </div>
                    <div class="form-group">
                        <label for="registerPasswordConfirm">Şifre Tekrar</label>
                        <input type="password" id="registerPasswordConfirm" placeholder="Şifreyi tekrar girin" autocomplete="new-password" required>
                    </div>
                    <p id="registerError" class="auth-error hidden"></p>
                    <button type="submit" class="auth-submit-btn">
                        <i class="fas fa-user-plus"></i> Kayıt Ol
                    </button>
                </form>

                <p class="auth-note">Favorilerin ve listeler buluta kayıt olur</p>
            </div>
        </div>
    `;

    initAuthTabs();
    initLoginForm();
    initRegisterForm();
}

function initAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.authTab}Form`)?.classList.add('active');
        });
    });
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Giriş yapılıyor...';
        errorEl.classList.add('hidden');

        try {
            await api.login(email, password);
            await loadFavoritesFromBackend();
            await loadPlaylistsFromBackend();
            renderProfileSection();
        } catch (err) {
            errorEl.textContent = err.message || 'Giriş başarısız';
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Giriş Yap';
        }
    });
}

function initRegisterForm() {
    const form = document.getElementById('registerForm');
    const errorEl = document.getElementById('registerError');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerPasswordConfirm').value;

        if (password !== confirm) {
            errorEl.textContent = 'Şifreler eşleşmiyor';
            errorEl.classList.remove('hidden');
            return;
        }

        if (password.length < 6) {
            errorEl.textContent = 'Şifre en az 6 karakter olmalıdır';
            errorEl.classList.remove('hidden');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kayıt yapılıyor...';
        errorEl.classList.add('hidden');

        try {
            await api.register(email, password);
            await loadFavoritesFromBackend();
            await loadPlaylistsFromBackend();
            renderProfileSection();
        } catch (err) {
            errorEl.textContent = err.message || 'Kayıt başarısız';
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Kayıt Ol';
        }
    });
}

// Restore session from localStorage on app start
export function restoreSession() {
    const token = localStorage.getItem('ms_auth_token');
    if (!token) return;

    try {
        // Decode JWT payload (no signature check on client)
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check if token is still valid
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            localStorage.removeItem('ms_auth_token');
            return;
        }
        // Restore minimal user state from token
        state.setUser({ id: payload.userId, email: payload.email || '' });
        // Sync data from backend in background
        loadFavoritesFromBackend().catch(() => { });
        loadPlaylistsFromBackend().then(() => renderPlaylistsSidebar()).catch(() => { });
    } catch {
        localStorage.removeItem('ms_auth_token');
    }
}
