// =========================================
// MelodyStream — API Helper
// Handles communication with the backend
// =========================================

import * as state from './state.js';

const API_BASE = '/api';

async function request(endpoint, options = {}) {
    const token = localStorage.getItem('ms_auth_token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Bir hata oluştu');
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

export const api = {
    // Auth
    async login(email, password) {
        const data = await request('/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'login', email, password })
        });
        localStorage.setItem('ms_auth_token', data.token);
        state.setUser(data.user);
        return data;
    },

    async register(email, password) {
        const data = await request('/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'register', email, password })
        });
        localStorage.setItem('ms_auth_token', data.token);
        state.setUser(data.user);
        return data;
    },

    logout() {
        localStorage.removeItem('ms_auth_token');
        state.setUser(null);
    },

    // Favorites
    async getFavorites() {
        return request('/favorites', { method: 'GET' });
    },

    async addFavorite(song) {
        return request('/favorites', {
            method: 'POST',
            body: JSON.stringify(song)
        });
    },

    async removeFavorite(videoId) {
        return request('/favorites', {
            method: 'DELETE',
            body: JSON.stringify({ videoId })
        });
    },

    // Playlists
    async getPlaylists() {
        return request('/playlists', { method: 'GET' });
    },

    async createPlaylist(name) {
        return request('/playlists', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    }
};
