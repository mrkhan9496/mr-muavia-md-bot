/** .tts [text] — Text ko voice mein badlo (Google TTS, free, no key). */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const text = (q || '').trim();
    if (!text) {
        await sock.sendMessage(chatId, { text: '❌ Text likho!\nExample: .tts Assalam o Alaikum' }, { quoted: msg });
        return;
    }
    if (text.length > 200) {
        await sock.sendMessage(chatId, { text: '❌ Text 200 characters se kam ho!' }, { quoted: msg });
        return;
    }
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ur&client=tw-ob`;
        const r = await axios.get(url, {
            responseType: 'arraybuffer', timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        await sock.sendMessage(chatId, { audio: Buffer.from(r.data), mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Voice nahi ban saki.' }, { quoted: msg });
    }
};
