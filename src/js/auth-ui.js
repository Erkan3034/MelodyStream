// =========================================
// MelodyStream — Auth UI
// Login / Register / Profile View
// =========================================

import * as state from './state.js';
import { api } from './api.js';
import { loadFavoritesFromBackend } from './favorites.js';

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
    container.innerHTML = `
        <div class="section profile-section">
            <div class="section-header">
                <h2>👤 Profilim</h2>
            </div>
            <div class="profile-card">
                <div class="profile-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="profile-info">
                    <p class="profile-email">${state.user.email}</p>
                    <p class="profile-since">MelodyStream Üyesi</p>
                </div>
                <button id="logoutBtn" class="logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Çıkış Yap
                </button>
            </div>
            <div class="profile-stats">
                <div class="profile-stat">
                    <i class="fas fa-heart"></i>
                    <span>${state.favorites.length} Favori</span>
                </div>
                <div class="profile-stat">
                    <i class="fas fa-list"></i>
                    <span>${state.playlists.length} Liste</span>
                </div>
                <div class="profile-stat">
                    <i class="fas fa-clock"></i>
                    <span>${state.playHistory.length} Şarkı Dinlendi</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        api.logout();
        renderProfileSection();
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
    } catch {
        localStorage.removeItem('ms_auth_token');
    }
}
