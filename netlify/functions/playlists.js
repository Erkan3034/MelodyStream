// =========================================
// MelodyStream — Playlists Function (Netlify, ESM)
// =========================================

import jwt from 'jsonwebtoken';
import pool from './utils/db.js';

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, headers, body: JSON.stringify({ message: 'Yetkisiz' }) };

    let userId;
    try {
        const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return { statusCode: 401, headers, body: JSON.stringify({ message: 'Geçersiz token' }) };
    }

    try {
        if (event.httpMethod === 'GET') {
            const listsRes = await pool.query(
                'SELECT id, name, created_at FROM playlists WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );
            const playlists = await Promise.all(
                listsRes.rows.map(async (pl) => {
                    const songs = await pool.query(
                        'SELECT video_id, title, thumbnail, channel_title FROM playlist_songs WHERE playlist_id = $1 ORDER BY added_at ASC',
                        [pl.id]
                    );
                    return { ...pl, songs: songs.rows };
                })
            );
            return { statusCode: 200, headers, body: JSON.stringify(playlists) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            if (body.action === 'addSong') {
                const { playlistId, videoId, title, thumbnail, channelTitle } = body;
                await pool.query(
                    'INSERT INTO playlist_songs (playlist_id, video_id, title, thumbnail, channel_title) VALUES ($1, $2, $3, $4, $5)',
                    [playlistId, videoId, title, thumbnail, channelTitle]
                );
                return { statusCode: 201, headers, body: JSON.stringify({ message: 'Şarkı eklendi' }) };
            }
            const { name } = body;
            if (!name) return { statusCode: 400, headers, body: JSON.stringify({ message: 'Playlist adı gerekli' }) };
            const res = await pool.query(
                'INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING id, name',
                [userId, name]
            );
            return { statusCode: 201, headers, body: JSON.stringify(res.rows[0]) };
        }

        if (event.httpMethod === 'DELETE') {
            const { playlistId, videoId } = JSON.parse(event.body);
            if (videoId) {
                await pool.query('DELETE FROM playlist_songs WHERE playlist_id = $1 AND video_id = $2', [playlistId, videoId]);
            } else {
                await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, userId]);
            }
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Silindi' }) };
        }

        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Playlists Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: 'Sunucu hatası: ' + error.message }) };
    }
};
