// =========================================
// MelodyStream — Favorites Function (Netlify)
// Handles user favorites persistence
// =========================================

const jwt = require('jsonwebtoken');
const pool = require('./utils/db');

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ message: 'Yetkisiz' }) };

    const token = authHeader.replace('Bearer ', '');
    let userId;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Geçersiz token' }) };
    }

    try {
        if (event.httpMethod === 'GET') {
            const res = await pool.query('SELECT video_id, title, thumbnail, channel_title FROM favorites WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
            return { statusCode: 200, body: JSON.stringify(res.rows) };
        }

        if (event.httpMethod === 'POST') {
            const { videoId, title, thumbnail, channelTitle } = JSON.parse(event.body);
            const query = `
                INSERT INTO favorites (user_id, video_id, title, thumbnail, channel_title) 
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, video_id) DO NOTHING
            `;
            await pool.query(query, [userId, videoId, title, thumbnail, channelTitle]);
            return { statusCode: 201, body: JSON.stringify({ message: 'Eklendi' }) };
        }

        if (event.httpMethod === 'DELETE') {
            const { videoId } = JSON.parse(event.body);
            await pool.query('DELETE FROM favorites WHERE user_id = $1 AND video_id = $2', [userId, videoId]);
            return { statusCode: 200, body: JSON.stringify({ message: 'Silindi' }) };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Favorites Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Sunucu hatası' }) };
    }
};
