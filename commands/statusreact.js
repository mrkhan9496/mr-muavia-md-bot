/**
 * .statusreact — Set custom emojis for auto status reactions.
 * Usage: .statusreact 🎭💙🗿👀🤍💓
 *        .statusreact off — back to default
 * Owner only.
 */

async function statusreact(sock, chatId, msg, q, ctx) {
    const { botData, saveBotData, userId, isOwner } = ctx;
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
        return;
    }

    if (!botData.statusSettings[userId]) botData.statusSettings[userId] = {};
    const settings = botData.statusSettings[userId];

    const input = (q || '').trim();

    if (!input) {
        const current = settings.statusEmojis || ['❤️', '🔥', '✨', '✅', '🙌', '🌟'];
        await sock.sendMessage(chatId, {
            text: `🎭 *Status React Emojis*\n\nCurrent: ${current.join(' ')}\n\nSet karne ke liye:\n.statusreact 🎭💙🗿👀🤍💓\n\nDefault wapas:\n.statusreact off`
        }, { quoted: msg });
        return;
    }

    if (input.toLowerCase() === 'off') {
        delete settings.statusEmojis;
        saveBotData();
        await sock.sendMessage(chatId, { text: '✅ Status emojis default par wapas!' }, { quoted: msg });
        return;
    }

    // Extract emojis from input
    const emojis = [...input.matchAll(/\p{Extended_Pictographic}/gu)].map(m => m[0]);
    if (emojis.length === 0) {
        await sock.sendMessage(chatId, { text: '❌ Koi emoji nahi mila!\nExample: .statusreact 🎭💙🗿' }, { quoted: msg });
        return;
    }

    settings.statusEmojis = emojis;
    saveBotData();
    await sock.sendMessage(chatId, {
        text: `✅ *Status react emojis set!*\n\n${emojis.join(' ')}\n\nAb status par yehi emojis react honge! 🎉`
    }, { quoted: msg });
}

module.exports = { statusreact };
