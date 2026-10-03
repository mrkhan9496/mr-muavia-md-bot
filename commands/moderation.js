/**
 * Moderation: .ban .unban .banlist .block .unblock (owner only).
 * Bans are kept in memory + persisted via botData when available.
 */
const banned = new Set();

async function ban(sock, chatId, msg, q, ctx) {
    if (!ctx.isOwner) return await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
    const target = extractTarget(msg, q);
    if (!target) return await sock.sendMessage(chatId, { text: '❌ Number ya reply do!\nExample: .ban 923001234567' }, { quoted: msg });
    banned.add(target);
    await sock.sendMessage(chatId, { text: `🚫 *Banned:* ${target}\nAb ye bot use nahi kar sakega.` }, { quoted: msg });
}

async function unban(sock, chatId, msg, q, ctx) {
    if (!ctx.isOwner) return await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
    const target = extractTarget(msg, q);
    if (!target || !banned.has(target)) return await sock.sendMessage(chatId, { text: '❌ Ye banned nahi hai.' }, { quoted: msg });
    banned.delete(target);
    await sock.sendMessage(chatId, { text: `✅ *Unbanned:* ${target}` }, { quoted: msg });
}

async function banlist(sock, chatId, msg, q, ctx) {
    if (!ctx.isOwner) return await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
    const list = [...banned];
    await sock.sendMessage(chatId, { text: list.length ? `🚫 *Ban List:*\n\n${list.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : '✅ Koi banned nahi hai.' }, { quoted: msg });
}

async function block(sock, chatId, msg, q, ctx) {
    if (!ctx.isOwner) return await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
    const target = extractTarget(msg, q);
    if (!target) return await sock.sendMessage(chatId, { text: '❌ Number do!\nExample: .block 923001234567' }, { quoted: msg });
    try {
        await sock.updateBlockStatus(target.includes('@') ? target : `${target}@s.whatsapp.net`, 'block');
        await sock.sendMessage(chatId, { text: `🚫 Blocked: ${target}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Block nahi ho saka.' }, { quoted: msg });
    }
}

async function unblock(sock, chatId, msg, q, ctx) {
    if (!ctx.isOwner) return await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
    const target = extractTarget(msg, q);
    if (!target) return await sock.sendMessage(chatId, { text: '❌ Number do!' }, { quoted: msg });
    try {
        await sock.updateBlockStatus(target.includes('@') ? target : `${target}@s.whatsapp.net`, 'unblock');
        await sock.sendMessage(chatId, { text: `✅ Unblocked: ${target}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Unblock nahi ho saka.' }, { quoted: msg });
    }
}

function extractTarget(msg, q) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (ctx?.participant) return ctx.participant;
    const num = (q || '').replace(/\D/g, '');
    return num || null;
}

module.exports = { ban, unban, banlist, block, unblock, banned };
