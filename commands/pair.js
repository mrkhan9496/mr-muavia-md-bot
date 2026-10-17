// commands/pair.js
// Pair a WhatsApp number via pairing code. Owner-only.
// Creates a new BotSession and initiates pairing.

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 2026-10-18 FIX: Per-number cooldown for .pair command (matches web pairing behavior).
// Configurable: change PAIR_COOLDOWN_MS to adjust. Web uses 60000 (60s).
const PAIR_COOLDOWN_MS = 60000;

// Atomic lock set: prevents concurrent initialize() calls for the same number.
// The isInitializing check alone has a race — two requests can both pass the
// check before either sets the flag. This Set closes that gap.
const _pairLocks = new Set();

// 2026-10-18: Storm protection — kal raat 10-12 ajnabiyon ne mil kar .pair storm
// banaya tha (alag-alag numbers). Per-number cooldown usay nahi rokta, is liye 2 aur limits:
//   (1) GLOBAL: poore bot par 10 min mein max 5 pairing codes (WhatsApp-side abuse-flag se bachao)
//   (2) REQUESTER: ek sender 5 min mein sirf 1 .pair (owner exempt — legit re-pairing)
const GLOBAL_PAIR_MAX = 5;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;
const REQUESTER_COOLDOWN_MS = 5 * 60 * 1000;
const _globalPairRequests = [];       // timestamps (ms) of recent code requests, sliding window
const _requesterLastPair = new Map(); // senderJid -> last .pair timestamp

function normalizeNumber(input) {
    let num = input.replace(/[^0-9]/g, '');
    if (num.startsWith('0')) num = num.slice(1);
    if (!num.startsWith('9')) {
        // Try to detect country code or assume Pakistan if starts with 3
        if (num.startsWith('3')) num = '92' + num;
    }
    return num;
}

async function pairCommand(sock, from, msg, isOwner, args, sessions, BotSession) {
    const sub = args[0]?.toLowerCase();

    // Owner-only: session management subcommands
    if (sub === 'status' || sub === 'list' || sub === 'remove' || sub === 'delete' || sub === 'logout') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Ye command sirf owner ke liye hai!' }, { quoted: msg });
        }
    }

    // .pair status - show all paired sessions
    if (sub === 'status' || sub === 'list') {
        const sessionList = Object.values(sessions).map(s => {
            const status = s.isConnected ? '✅ Connected' : '⏳ Not connected';
            return `• ${s.userId} — ${status}`;
        });
        const text = sessionList.length > 0 
            ? `📱 *Paired Devices:*\n\n${sessionList.join('\n')}`
            : '❌ No paired devices found.';
        return await sock.sendMessage(from, { text }, { quoted: msg });
    }

    // .pair remove NUMBER
    if (sub === 'remove' || sub === 'delete' || sub === 'logout') {
        const targetNum = args[1];
        if (!targetNum) {
            return await sock.sendMessage(from, { text: '❌ Usage: .pair remove <number>' }, { quoted: msg });
        }
        const userId = normalizeNumber(targetNum);
        if (sessions[userId]) {
            try {
                if (sessions[userId].sock) await sessions[userId].sock.logout();
            } catch (e) {}
            const authPath = require('path').join('./auth_info', userId);
            if (require('fs-extra').existsSync(authPath)) {
                require('fs-extra').removeSync(authPath);
            }
            delete sessions[userId];
            return await sock.sendMessage(from, { text: `✅ Device ${userId} removed successfully.` }, { quoted: msg });
        } else {
            return await sock.sendMessage(from, { text: `❌ Device ${userId} not found.` }, { quoted: msg });
        }
    }

    // .pair NUMBER (main pairing flow) — PUBLIC: koi bhi apna number pair kar sakta hai
    const rawNumber = args[0];
    if (!rawNumber) {
        const usage = `📱 *Pair Command:*\n\n.pair <number> — Apna WhatsApp number pair karo\nExample: .pair 923001234567`;
        const ownerExtra = isOwner ? `\n\n*Owner:*\n.pair status — Paired devices\n.pair remove <number> — Device hatao` : '';
        return await sock.sendMessage(from, { text: usage + ownerExtra }, { quoted: msg });
    }

    const userId = normalizeNumber(rawNumber);
    if (!/^\d{10,15}$/.test(userId)) {
        return await sock.sendMessage(from, { text: '❌ Invalid number format. Use international format with country code.\nExample: .pair 923001234567' }, { quoted: msg });
    }

    // Check if already connected
    if (sessions[userId] && sessions[userId].isConnected) {
        return await sock.sendMessage(from, { text: `⚠️ Number ${userId} is already connected.` }, { quoted: msg });
    }

    // 2026-10-18 FIX: Per-number cooldown (matches web pairing behavior).
    // Prevents hammering WhatsApp with rapid successive pairing requests.
    if (sessions[userId] && sessions[userId]._lastPairRequestAt
        && Date.now() - sessions[userId]._lastPairRequestAt < PAIR_COOLDOWN_MS) {
        const waitS = Math.ceil((PAIR_COOLDOWN_MS - (Date.now() - sessions[userId]._lastPairRequestAt)) / 1000);
        return await sock.sendMessage(from, { text: `⏳ Thora wait karein — ${waitS} second baad dobara try karein.` }, { quoted: msg });
    }

    // 2026-10-18: GLOBAL throttle — 10 min mein max 5 codes, poore bot par.
    // Kal raat jaisa storm (kayi log, alag-alag numbers) sirf isi se rukta hai.
    // Owner par bhi lagu — WhatsApp ko farq nahi parta request kaun bhej raha hai.
    const nowTs = Date.now();
    while (_globalPairRequests.length && nowTs - _globalPairRequests[0] > GLOBAL_WINDOW_MS) {
        _globalPairRequests.shift();
    }
    if (_globalPairRequests.length >= GLOBAL_PAIR_MAX) {
        return await sock.sendMessage(from, { text: `⏳ Bot abhi busy hai — pairing requests zyada aa rahi hain. Kuch minute baad dobara try karein.` }, { quoted: msg });
    }

    // 2026-10-18: Per-requester cooldown — ek sender 5 min mein 1 .pair.
    // Ek banda kayi numbers ke liye spam nahi kar sakta. Owner exempt (legit re-pairing).
    const senderJid = (msg.key && (msg.key.participant || msg.key.remoteJid)) || from;
    if (!isOwner) {
        const lastReq = _requesterLastPair.get(senderJid) || 0;
        if (nowTs - lastReq < REQUESTER_COOLDOWN_MS) {
            const waitM = Math.ceil((REQUESTER_COOLDOWN_MS - (nowTs - lastReq)) / 60000);
            return await sock.sendMessage(from, { text: `⏳ Aap ne abhi ek code liya tha — ${waitM} minute baad dobara try karein.` }, { quoted: msg });
        }
    }
    // Map ko behad barhne se roko — purani entries saaf karo
    if (_requesterLastPair.size > 1000) {
        for (const [jid, ts] of _requesterLastPair) {
            if (nowTs - ts > REQUESTER_COOLDOWN_MS) _requesterLastPair.delete(jid);
        }
    }

    // 2026-10-18 FIX: Atomic lock — prevents concurrent initializations for the same number.
    // Closes the race where two simultaneous .pair requests both pass the isInitializing check.
    if (_pairLocks.has(userId)) {
        return await sock.sendMessage(from, { text: `⏳ Pairing for ${userId} is already in progress. Please wait.` }, { quoted: msg });
    }

    // Check if pairing is already in progress (session-level flag)
    if (sessions[userId] && sessions[userId].isInitializing) {
        return await sock.sendMessage(from, { text: `⏳ Pairing for ${userId} is already in progress. Please wait.` }, { quoted: msg });
    }

    // Acquire lock before starting
    _pairLocks.add(userId);
    // 2026-10-18: quota record — saare gates pass honay par hi count karo
    // (jo request WhatsApp tak pohanchi hi nahi, wo quota nahi khayegi)
    _globalPairRequests.push(Date.now());
    _requesterLastPair.set(senderJid, Date.now());

    await sock.sendMessage(from, { text: `⏳ Code ban raha hai...` }, { quoted: msg });

    try {
        // Create session if not exists
        if (!sessions[userId]) {
            sessions[userId] = new BotSession(userId);
        }

        // Set up a one-time listener to capture the pairing code
        let pairingCode = null;
        let pairingError = null;

        const originalSendLog = sessions[userId].sendLog;
        sessions[userId].sendLog = function(message, type = 'info') {
            if (message.includes('Pairing Code:')) {
                const match = message.match(/Pairing Code:\s*(.+)/);
                if (match) pairingCode = match[1].trim();
            }
            if (type === 'error' && message.includes('Pairing error')) {
                pairingError = message;
            }
            return originalSendLog.call(this, message, type);
        };

        // Start initialization with pairing number
        await sessions[userId].initialize(userId);

        // Restore original sendLog
        sessions[userId].sendLog = originalSendLog;

        if (pairingError) {
            return await sock.sendMessage(from, { text: `❌ Pairing failed: ${pairingError}` }, { quoted: msg });
        }

        if (pairingCode) {
            // Send ONLY the clean code for easy copying (no extra text)
            return await sock.sendMessage(from, { text: pairingCode }, { quoted: msg });
        } else {
            // If no pairing code was captured (maybe already registered or using QR)
            return await sock.sendMessage(from, { text: `⏳ Pairing initiated for ${userId}.\nIf a pairing code was not generated, the device may be connecting via QR or already registered.` }, { quoted: msg });
        }
    } catch (e) {
        console.error('[Pair Command] Error:', e.message);
        return await sock.sendMessage(from, { text: `❌ Pairing failed: ${e.message}` }, { quoted: msg });
    } finally {
        // 2026-10-18 FIX: Always release the atomic lock, even on error.
        // Without this, a crashed pairing would permanently block the number.
        _pairLocks.delete(userId);
    }
}

module.exports = pairCommand;
