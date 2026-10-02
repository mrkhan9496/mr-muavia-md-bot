/** .fact — Random useless-but-true fact (free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: 15000 });
        await sock.sendMessage(chatId, { text: `💡 *Did you know?*\n\n${r.data.text}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Fact nahi mil saka, dobara try karo.' }, { quoted: msg });
    }
};
