// =========================================
// MelodyStream — Playlists Function (Netlify)
// Handles user playlists persistence
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
        // GET /api/playlists — List all playlists with their songs
        if (event.httpMethod === 'GET') {
            const listsRes = await pool.query(
                'SELECT id, name, created_at FROM playlists WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );

            // Get songs for each playlist
            const playlists = await Promise.all(
                listsRes.rows.map(async (playlist) => {
                    const songsRes = await pool.query(
                        'SELECT video_id, title, thumbnail, channel_title FROM playlist_songs WHERE playlist_id = $1 ORDER BY added_at ASC',
                        [playlist.id]
                    );
                    return { ...playlist, songs: songsRes.rows };
                })
            );

            return { statusCode: 200, body: JSON.stringify(playlists) };
        }

        // POST /api/playlists — Create playlist or add a song
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (body.action === 'addSong') {
                const { playlistId, videoId, title, thumbnail, channelTitle } = body;
                await pool.query(
                    'INSERT INTO playlist_songs (playlist_id, video_id, title, thumbnail, channel_title) VALUES ($1, $2, $3, $4, $5)',
                    [playlistId, videoId, title, thumbnail, channelTitle]
                );
                return { statusCode: 201, body: JSON.stringify({ message: 'Şarkı eklendi' }) };
            }

            // Create new playlist
            const { name } = body;
            if (!name) return { statusCode: 400, body: JSON.stringify({ message: 'Playlist adı gerekli' }) };

            const res = await pool.query(
                'INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING id, name',
                [userId, name]
            );
            return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
        }

        // DELETE /api/playlists — Remove playlist or song from playlist
        if (event.httpMethod === 'DELETE') {
            const { playlistId, videoId } = JSON.parse(event.body);

            if (videoId) {
                // Remove specific song from playlist
                await pool.query('DELETE FROM playlist_songs WHERE playlist_id = $1 AND video_id = $2', [playlistId, videoId]);
                return { statusCode: 200, body: JSON.stringify({ message: 'Şarkı silindi' }) };
            }

            // Delete entire playlist
            await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, userId]);
            return { statusCode: 200, body: JSON.stringify({ message: 'Playlist silindi' }) };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Playlists Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Sunucu hatası' }) };
    }
};
