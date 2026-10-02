/** .bored — Random activity idea when bored (Bored API, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://bored-api.appbrewery.com/random', { timeout: 15000 });
        await sock.sendMessage(chatId, { text: `🎯 *Bored? Try this:*\n\n${r.data.activity}\n\n👥 Participants: ${r.data.participants} | 📁 Type: ${r.data.type}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Idea nahi mila, dobara try karo.' }, { quoted: msg });
    }
};
