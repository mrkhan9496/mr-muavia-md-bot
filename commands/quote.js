/** .quote — Random inspirational quote (DummyJSON, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://dummyjson.com/quotes/random', { timeout: 15000 });
        await sock.sendMessage(chatId, { text: `💬 "${r.data.quote}"\n\n— *${r.data.author}*` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Quote nahi mil saka, dobara try karo.' }, { quoted: msg });
    }
};
