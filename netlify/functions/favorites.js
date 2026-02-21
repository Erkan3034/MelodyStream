// =========================================
// MelodyStream — Favorites Function (Netlify, ESM)
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
            const res = await pool.query(
                'SELECT video_id, title, thumbnail, channel_title FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );
            return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
        }

        if (event.httpMethod === 'POST') {
            const { videoId, title, thumbnail, channelTitle } = JSON.parse(event.body);
            await pool.query(
                `INSERT INTO favorites (user_id, video_id, title, thumbnail, channel_title)
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, video_id) DO NOTHING`,
                [userId, videoId, title, thumbnail, channelTitle]
            );
            return { statusCode: 201, headers, body: JSON.stringify({ message: 'Eklendi' }) };
        }

        if (event.httpMethod === 'DELETE') {
            const { videoId } = JSON.parse(event.body);
            await pool.query('DELETE FROM favorites WHERE user_id = $1 AND video_id = $2', [userId, videoId]);
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Silindi' }) };
        }

        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Favorites Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: 'Sunucu hatası: ' + error.message }) };
    }
};
