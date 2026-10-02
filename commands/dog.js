/** .dog — Random cute dog photo (dog.ceo, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 15000 });
        await sock.sendMessage(chatId, { image: { url: r.data.message }, caption: '🐶 *Cute Dog!*\n\n.dog dobara bhejo, naya milega!' }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Dog nahi mila, dobara try karo.' }, { quoted: msg });
    }
};
