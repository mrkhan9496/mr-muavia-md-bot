/**
 * .ayah — Random Quran ayah with Urdu translation (AlQuran Cloud, free, no key).
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const n = Math.floor(Math.random() * 6236) + 1;
        const r = await axios.get(`https://api.alquran.cloud/v1/ayah/${n}/ur.jalandhry`, { timeout: 15000 });
        const a = r.data.data;
        await sock.sendMessage(chatId, {
            text: `🕌 *Surah ${a.surah.englishName} (${a.surah.number}:${a.numberInSurah})*\n\n${a.text}`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Ayah nahi mil saki, dobara try karo.' }, { quoted: msg });
    }
};
