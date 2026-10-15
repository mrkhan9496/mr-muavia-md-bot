// lib/botDataDb.js — Persist botData (all bot settings) in Postgres.
//
// WHY: hosts like Heroku have an EPHEMERAL filesystem — ./data/bot_data.json
// is wiped on every restart/redeploy, silently resetting EVERY setting
// (auto-react, antilink, Islamic automation, prefixes, etc.) to defaults.
// Storing botData in Postgres (Neon) keeps settings across restarts.
// Falls back to the local file when DATABASE_URL is absent (Termux).

const { getPool } = require('./dbAuthState');

async function ensureBotDataTable() {
    const p = getPool();
    if (!p) return false;
    await p.query(`
        CREATE TABLE IF NOT EXISTS bot_data (
            id INTEGER PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT bot_data_single_row CHECK (id = 1)
        )
    `);
    return true;
}

async function loadBotDataFromDb() {
    try {
        const p = getPool();
        if (!p) return null;
        await ensureBotDataTable();
        const r = await p.query('SELECT data FROM bot_data WHERE id = 1');
        if (r.rows.length && r.rows[0].data && typeof r.rows[0].data === 'object') {
            return r.rows[0].data;
        }
        return null;
    } catch (e) {
        console.error('[botDataDB] load failed:', e.message);
        return null;
    }
}

function saveBotDataToDb(data) {
    // Fire-and-forget: never block the bot on a settings write.
    (async () => {
        try {
            const p = getPool();
            if (!p) return;
            await ensureBotDataTable();
            await p.query(
                `INSERT INTO bot_data (id, data, updated_at) VALUES (1, $1, NOW())
                 ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
                [JSON.stringify(data)]
            );
        } catch (e) {
            console.error('[botDataDB] save failed:', e.message);
        }
    })();
}

module.exports = { loadBotDataFromDb, saveBotDataToDb };
