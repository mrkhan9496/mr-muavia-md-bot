/** .yesno [question] — Fun yes/no answer with GIF (yesno.wtf, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    try {
        const r = await axios.get('https://yesno.wtf/api', { timeout: 15000 });
        const ans = r.data.answer === 'yes' ? '✅ YES!' : '❌ NO!';
        await sock.sendMessage(chatId, { image: { url: r.data.image }, caption: `${ans}${q ? `\n\n❓ Sawal: ${q.trim()}` : ''}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Try again later.' }, { quoted: msg });
    }
};
