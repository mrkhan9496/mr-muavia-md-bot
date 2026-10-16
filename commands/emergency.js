/**
 * .emergency on|off — GLOBAL EMERGENCY KILL SWITCH (owner only).
 *
 * When ON, ALL automated outbound actions stop immediately across every
 * session in this process:
 *   - auto-react (group + channel)
 *   - AI auto-reply / per-chat AutoAI (.aion) / greeting auto-reply
 *   - view-once auto-forward
 * Manual commands (.menu, .ping, downloads, etc.) keep working.
 *
 * State is persisted in botData.emergencyStop (survives restarts via DB).
 * The env var EMERGENCY_STOP=1 forces it ON regardless of the flag.
 */
const automationGuard = require('../lib/automationGuard');

async function emergencyCommand(sock, chatId, message, isOwner, botData, saveBotData, userId, args) {
    if (!isOwner) {
        return sock.sendMessage(chatId, { text: '❌ Ye command sirf owner ke liye hai!' }, { quoted: message });
    }
    const action = (args[0] || '').toLowerCase();
    if (action === 'on' || action === 'enable' || action === 'stop') {
        automationGuard.setEmergencyStop(botData, true);
        if (saveBotData) saveBotData();
        return sock.sendMessage(chatId, {
            text: '🚨 *EMERGENCY STOP ON*\n\nTamam automatic actions (auto-react, auto-reply, AutoAI, view-once forward) **foran band**. Manual commands kaam karte rahenge.\n\nWapas on karne ke liye: *.emergency off*'
        }, { quoted: message });
    }
    if (action === 'off' || action === 'disable' || action === 'start') {
        if (process.env.EMERGENCY_STOP === '1') {
            return sock.sendMessage(chatId, {
                text: '⚠️ EMERGENCY_STOP=1 env var set hai — pehle usay hatao, phir *.emergency off* chalega.'
            }, { quoted: message });
        }
        automationGuard.setEmergencyStop(botData, false);
        if (saveBotData) saveBotData();
        return sock.sendMessage(chatId, {
            text: '✅ *EMERGENCY STOP OFF*\n\nAutomatic actions dobara chalu ho gayi hain.'
        }, { quoted: message });
    }
    const cur = automationGuard.isAutomationKilled(botData);
    return sock.sendMessage(chatId, {
        text: `🚨 *Emergency Stop:* ${cur ? '🔴 ON (sab auto actions band)' : '🟢 OFF (normal)'}\n\nUse: *.emergency on* / *.emergency off*`
    }, { quoted: message });
}

module.exports = emergencyCommand;
