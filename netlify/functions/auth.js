// =========================================
// MelodyStream — Auth Function (Netlify)
// Handles login and registration
// =========================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./utils/db');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { action, email, password } = JSON.parse(event.body);

        if (!email || !password) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Email ve şifre gereklidir' }) };
        }

        if (action === 'register') {
            const hashedPassword = await bcrypt.hash(password, 10);
            const query = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email';
            const values = [email, hashedPassword];

            const res = await pool.query(query, values);
            const user = res.rows[0];

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

            return {
                statusCode: 201,
                body: JSON.stringify({ user, token })
            };
        } else if (action === 'login') {
            const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = res.rows[0];

            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                return { statusCode: 401, body: JSON.stringify({ message: 'Hatalı email veya şifre' }) };
            }

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

            return {
                statusCode: 200,
                body: JSON.stringify({
                    user: { id: user.id, email: user.email },
                    token
                })
            };
        }

        return { statusCode: 400, body: JSON.stringify({ message: 'Geçersiz eylem' }) };
    } catch (error) {
        console.error('Auth Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Sunucu hatası' }) };
    }
};
