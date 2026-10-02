/** .catfact — Random cat fact (catfact.ninja, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://catfact.ninja/fact', { timeout: 15000 });
        await sock.sendMessage(chatId, { text: `🐱 *Cat Fact:*\n\n${r.data.fact}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Cat fact nahi mil saka, dobara try karo.' }, { quoted: msg });
    }
};
