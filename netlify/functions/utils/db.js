// =========================================
// MelodyStream — Database Client (ES Module)
// =========================================

import pg from 'pg';

const { Pool } = pg;

let pool;

if (!pool) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
}

export default pool;
