/**
 * .age <name> — Fun: guess age from name (Agify, free, no key).
 * Example: .age Muavia
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const name = (q || '').trim();
    if (!name) {
        await sock.sendMessage(chatId, { text: '❌ Naam likho:\n.age Muavia' }, { quoted: msg });
        return;
    }
    try {
        const r = await axios.get('https://api.agify.io', { params: { name }, timeout: 15000 });
        await sock.sendMessage(chatId, { text: `🎂 *${r.data.name}* ki guess age: *${r.data.age} saal* 😄\n(Just for fun!)` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Try again later.' }, { quoted: msg });
    }
};
