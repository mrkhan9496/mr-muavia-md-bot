/**
 * .gs — Group Status (2026-10-16)
 * Group ki info + is group mein bot ki settings ek saath.
 * Public command (koi bhi use kar sakta hai).
 */
async function gsCommand(sock, chatId, msg, botData, userId) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ Ye command sirf group mein kaam karti hai!' }, { quoted: msg });
        return;
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];
        const admins = participants.filter(p => p.admin);
        const owner = meta.owner || meta.subjectOwner || (participants.find(p => p.admin === 'superadmin')?.id) || null;

        // Is group mein bot ki settings
        const uid = userId;
        const on = (v) => v ? '✅ ON' : '❌ OFF';
        const antilink = botData.antilinkGroups?.[uid]?.[chatId];
        const antistatus = botData.antiStatusGroups?.[uid]?.[chatId];
        const welcome = botData.welcome?.[uid]?.[chatId];
        const goodbye = botData.goodbye?.[uid]?.[chatId];
        const inactive = botData.inactiveGroups?.[uid]?.[chatId];

        let pp;
        try { pp = await sock.profilePictureUrl(chatId, 'image'); } catch { pp = null; }

        const text =
            `📊 *GROUP STATUS*\n\n` +
            `📛 *Name:* ${meta.subject}\n` +
            `👥 *Members:* ${participants.length}\n` +
            `🛡️ *Admins:* ${admins.length}\n` +
            `👑 *Owner:* ${owner ? '@' + owner.split('@')[0] : 'N/A'}\n` +
            `📝 *Desc:* ${(meta.desc || 'Koi description nahi').toString().slice(0, 80)}\n\n` +
            `🤖 *BOT SETTINGS (is group):*\n` +
            `🔗 Antilink: ${antilink ? `✅ ON (${antilink})` : '❌ OFF'}\n` +
            `📵 Antistatus: ${on(antistatus)}\n` +
            `👋 Welcome: ${on(welcome)}\n` +
            `👋 Goodbye: ${on(goodbye)}\n` +
            `💤 Bot active: ${on(!inactive)}\n\n` +
            `> *© POWERED BY MR MUAVIA MD BOT*`;

        const mentions = owner ? [owner] : [];
        if (pp) {
            await sock.sendMessage(chatId, { image: { url: pp }, caption: text, mentions }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text, mentions }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: `❌ Group status nahi mil saka: ${e.message || 'error'}` }, { quoted: msg });
    }
}

module.exports = gsCommand;
