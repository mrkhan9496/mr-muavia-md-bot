/** .trivia — Random trivia question + answer (Open Trivia DB, free, no key). */
const axios = require('axios');

function clean(s) {
    return String(s || '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://opentdb.com/api.php', { params: { amount: 1 }, timeout: 15000 });
        const t = r.data.results[0];
        await sock.sendMessage(chatId, {
            text: `🧠 *Trivia* (${clean(t.category)})\n\n❓ ${clean(t.question)}\n\n💡 Jawab: ||${clean(t.correct_answer)}||`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Trivia nahi mil saka, dobara try karo.' }, { quoted: msg });
    }
};
