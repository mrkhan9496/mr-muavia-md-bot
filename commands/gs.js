/**
 * .gs — Group Status (2026-10-16)
 * Group par status lagao — jaise profile par status lagta hai!
 *
 * .gs <text>  — Group status set karo (admin/owner)
 * .gs          — Group ka status dekho (sab ke liye)
 * .gs clear    — Status hatao (admin/owner)
 */
async function gsCommand(sock, chatId, msg, botData, saveBotData, userId, args, isAdmin, isOwner) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ Ye command sirf group mein kaam karti hai!' }, { quoted: msg });
        return;
    }
    if (!botData.groupStatus) botData.groupStatus = {};
    if (!botData.groupStatus[userId]) botData.groupStatus[userId] = {};

    const text = (args || []).join(' ').trim();

    // --- Set / clear (admin/owner only) ---
    if (text) {
        if (!isAdmin && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Group status sirf admin laga sakta hai!' }, { quoted: msg });
            return;
        }
        if (text.toLowerCase() === 'clear' || text.toLowerCase() === 'delete' || text.toLowerCase() === 'hatao') {
            delete botData.groupStatus[userId][chatId];
            if (saveBotData) saveBotData();
            await sock.sendMessage(chatId, { text: '🗑️ *Group status hata diya gaya!*' }, { quoted: msg });
            return;
        }
        if (text.length > 300) {
            await sock.sendMessage(chatId, { text: '❌ Status 300 characters se zyada nahi ho sakta!' }, { quoted: msg });
            return;
        }
        const sender = msg.key.participant || chatId;
        botData.groupStatus[userId][chatId] = {
            text,
            setBy: sender.split('@')[0],
            setAt: Date.now(),
        };
        if (saveBotData) saveBotData();
        await sock.sendMessage(chatId, {
            text: `✅ *Group status set ho gaya!*\n\n📌 ${text}\n\n> *© POWERED BY MR MUAVIA MD BOT*`
        }, { quoted: msg });
        return;
    }

    // --- View (sab ke liye) ---
    const st = botData.groupStatus[userId][chatId];
    if (!st) {
        await sock.sendMessage(chatId, {
            text: `📌 *Group Status:*\n\n_Koi status set nahi hai._\n\nSet karne ke liye (admin):\n.gs <apna status text>`
        }, { quoted: msg });
        return;
    }
    const date = new Date(st.setAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
    await sock.sendMessage(chatId, {
        text: `📌 *GROUP STATUS*\n\n${st.text}\n\n👤 Set by: @${st.setBy}\n🕐 ${date}\n\n> *© POWERED BY MR MUAVIA MD BOT*`,
        mentions: [st.setBy + '@s.whatsapp.net'],
    }, { quoted: msg });
}

module.exports = gsCommand;
