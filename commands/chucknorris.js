/** .chucknorris — Random Chuck Norris joke (free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://api.chucknorris.io/jokes/random', { timeout: 15000 });
        await sock.sendMessage(chatId, { text: `💪 *Chuck Norris:*\n\n${r.data.value}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Joke nahi mil saka, dobara try karo.' }, { quoted: msg });
    }
};
