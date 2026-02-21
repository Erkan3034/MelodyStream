// =========================================
// MelodyStream — Auth Function (Netlify, ESM)
// =========================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './utils/db.js';

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { action, email, password } = JSON.parse(event.body);

        if (!email || !password) {
            return { statusCode: 400, headers, body: JSON.stringify({ message: 'Email ve şifre gereklidir' }) };
        }

        if (action === 'register') {
            // Check if email already exists
            const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existing.rows.length > 0) {
                return { statusCode: 409, headers, body: JSON.stringify({ message: 'Bu email zaten kayıtlı' }) };
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const res = await pool.query(
                'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
                [email, hashedPassword]
            );
            const user = res.rows[0];
            const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

            return { statusCode: 201, headers, body: JSON.stringify({ user, token }) };
        }

        if (action === 'login') {
            const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = res.rows[0];

            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                return { statusCode: 401, headers, body: JSON.stringify({ message: 'Hatalı email veya şifre' }) };
            }

            const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ user: { id: user.id, email: user.email }, token })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ message: 'Geçersiz eylem' }) };
    } catch (error) {
        console.error('Auth Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: 'Sunucu hatası: ' + error.message }) };
    }
};
