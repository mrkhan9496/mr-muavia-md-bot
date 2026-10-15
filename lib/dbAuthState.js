// Database-backed Baileys auth state (PostgreSQL).
//
// WHY: hosts like Render's free tier have an EPHEMERAL filesystem — auth_info/
// is wiped on every restart/sleep, logging every user out. Storing the
// WhatsApp session in Postgres (e.g. a free Neon database — no expiry, no
// credit card) keeps users logged in across restarts with ZERO change to the
// user flow: they still just enter their number, get a pairing code, and pair.
//
// Usage: set the DATABASE_URL env var. When it is absent, the bot falls back
// to the original file-based auth (auth_info/<userId>) — Termux unchanged.

const { initAuthCreds, BufferJSON, proto, useMultiFileAuthState } = require('@whiskeysockets/baileys');

let pool = null;

function getPool() {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    if (!pool) {
        const { Pool } = require('pg');
        pool = new Pool({
            connectionString: url,
            // Neon / managed Postgres require TLS
            ssl: { rejectUnauthorized: false },
            max: 3,
        });
        pool.on('error', (err) => console.error('[DB] pool error:', err.message));
    }
    return pool;
}

async function ensureTable() {
    const p = getPool();
    if (!p) return false;
    await p.query(`
        CREATE TABLE IF NOT EXISTS wa_sessions (
            user_id   TEXT PRIMARY KEY,
            creds     TEXT NOT NULL,
            keys_data TEXT NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    return true;
}

function serializeCreds(creds) {
    return JSON.stringify(creds, BufferJSON.replacer);
}
function serializeKeys(keysData) {
    return JSON.stringify(keysData, BufferJSON.replacer);
}
function parseCreds(text) {
    return JSON.parse(text, BufferJSON.reviver);
}
function parseKeys(text) {
    return JSON.parse(text || '{}', BufferJSON.reviver);
}

async function saveSessionRow(userId, creds, keysData) {
    const p = getPool();
    if (!p) return;
    try {
        await p.query(
            `INSERT INTO wa_sessions (user_id, creds, keys_data, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (user_id) DO UPDATE
             SET creds = EXCLUDED.creds, keys_data = EXCLUDED.keys_data, updated_at = now()`,
            [userId, serializeCreds(creds), serializeKeys(keysData)]
        );
    } catch (err) {
        console.error(`[DB] save session ${userId} failed:`, err.message);
    }
}

// Baileys-compatible { state, saveCreds }. Falls back to files when no DATABASE_URL.
async function getAuthState(userId, fileAuthPath) {
    if (!process.env.DATABASE_URL) {
        return useMultiFileAuthState(fileAuthPath);
    }
    try {
        await ensureTable();
        const p = getPool();
        let creds = null;
        let keysData = {};
        try {
            const r = await p.query('SELECT creds, keys_data FROM wa_sessions WHERE user_id = $1', [userId]);
            if (r.rows.length) {
                creds = parseCreds(r.rows[0].creds);
                keysData = parseKeys(r.rows[0].keys_data);
                console.log(`[DB] Loaded WhatsApp session for ${userId} from database.`);
            }
        } catch (err) {
            console.error(`[DB] load session ${userId} failed, starting fresh:`, err.message);
        }
        if (!creds) creds = initAuthCreds();

        const saveCreds = () => saveSessionRow(userId, creds, keysData);

        const state = {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = keysData[`${type}-${id}`];
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const category of Object.keys(data || {})) {
                        for (const id of Object.keys(data[category] || {})) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) keysData[key] = value;
                            else delete keysData[key];
                        }
                    }
                    await saveSessionRow(userId, creds, keysData);
                },
            },
        };
        return { state, saveCreds };
    } catch (err) {
        console.error('[DB] auth state init failed, falling back to files:', err.message);
        return useMultiFileAuthState(fileAuthPath);
    }
}

// User IDs that have a session stored in the DB (for boot-time restore).
async function listDbSessionUsers() {
    if (!process.env.DATABASE_URL) return [];
    try {
        await ensureTable();
        const r = await getPool().query('SELECT user_id FROM wa_sessions');
        return r.rows.map((row) => row.user_id);
    } catch (err) {
        console.error('[DB] list sessions failed:', err.message);
        return [];
    }
}

// Forget a session (logout / expired session cleanup).
async function clearDbSession(userId) {
    if (!process.env.DATABASE_URL) return;
    try {
        await getPool().query('DELETE FROM wa_sessions WHERE user_id = $1', [userId]);
        console.log(`[DB] Cleared WhatsApp session for ${userId}.`);
    } catch (err) {
        console.error(`[DB] clear session ${userId} failed:`, err.message);
    }
}

function usesDatabase() {
    return !!process.env.DATABASE_URL;
}

module.exports = { getAuthState, listDbSessionUsers, clearDbSession, usesDatabase, getPool };
