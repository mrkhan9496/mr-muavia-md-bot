/** .advice — Random life advice (Advice Slip, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://api.adviceslip.com/advice', { timeout: 15000 });
        await sock.sendMessage(chatId, { text: `💡 *Advice:*\n\n"${r.data.slip.advice}"` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Advice nahi mili, dobara try karo.' }, { quoted: msg });
    }
};
