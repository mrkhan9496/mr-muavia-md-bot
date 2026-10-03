// commands/pair.js
// Pair a WhatsApp number via pairing code. Owner-only.
// Creates a new BotSession and initiates pairing.

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

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
    if (!isOwner) {
        return await sock.sendMessage(from, { text: '❌ Only the bot owner can use the pairing command.' }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

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

    // .pair NUMBER (main pairing flow)
    const rawNumber = args[0];
    if (!rawNumber) {
        return await sock.sendMessage(from, { text: `📱 *Pair Command Usage:*\n\n` +
            `.pair <number> — Pair a new WhatsApp number\n` +
            `.pair status / .pair list — Show all paired devices\n` +
            `.pair remove <number> — Remove a paired device\n\n` +
            `Example: .pair 923001234567`
        }, { quoted: msg });
    }

    const userId = normalizeNumber(rawNumber);
    if (!/^\d{10,15}$/.test(userId)) {
        return await sock.sendMessage(from, { text: '❌ Invalid number format. Use international format with country code.\nExample: .pair 923001234567' }, { quoted: msg });
    }

    // Check if already connected
    if (sessions[userId] && sessions[userId].isConnected) {
        return await sock.sendMessage(from, { text: `⚠️ Number ${userId} is already connected.` }, { quoted: msg });
    }

    // Check if pairing is already in progress
    if (sessions[userId] && sessions[userId].isInitializing) {
        return await sock.sendMessage(from, { text: `⏳ Pairing for ${userId} is already in progress. Please wait.` }, { quoted: msg });
    }

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
    }
}

module.exports = pairCommand;
