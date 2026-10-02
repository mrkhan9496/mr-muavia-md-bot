/**
 * .nationality <name> — Fun: guess nationality from name (Nationalize, free, no key).
 * Example: .nationality Ahmed
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const name = (q || '').trim();
    if (!name) {
        await sock.sendMessage(chatId, { text: '❌ Naam likho:\n.nationality Ahmed' }, { quoted: msg });
        return;
    }
    try {
        const r = await axios.get('https://api.nationalize.io', { params: { name }, timeout: 15000 });
        const top = (r.data.country || []).slice(0, 3);
        if (!top.length) throw new Error('none');
        const lines = top.map(c => `🌍 ${c.country_id} (${Math.round(c.probability * 100)}%)`);
        await sock.sendMessage(chatId, { text: `*${r.data.name}* ki possible nationality:\n\n${lines.join('\n')}\n(Just for fun!)` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Try again later.' }, { quoted: msg });
    }
};
