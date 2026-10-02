/**
 * .gender <name> — Fun: guess gender from name (Genderize, free, no key).
 * Example: .gender Sara
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const name = (q || '').trim();
    if (!name) {
        await sock.sendMessage(chatId, { text: '❌ Naam likho:\n.gender Sara' }, { quoted: msg });
        return;
    }
    try {
        const r = await axios.get('https://api.genderize.io', { params: { name }, timeout: 15000 });
        const g = r.data.gender === 'male' ? '👨 Male' : r.data.gender === 'female' ? '👩 Female' : '❓ Unknown';
        await sock.sendMessage(chatId, { text: `${g} — *${r.data.name}* (${Math.round((r.data.probability || 0) * 100)}% sure)\n(Just for fun!)` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Try again later.' }, { quoted: msg });
    }
};
