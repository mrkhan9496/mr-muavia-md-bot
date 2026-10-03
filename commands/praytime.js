/** .praytime [city] — Namaz ke auqat (Aladhan API, free, no key). Default: Lahore. */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const city = (q || '').trim() || 'Lahore';
    try {
        const r = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Pakistan&method=1`, { timeout: 15000 });
        const t = r.data.data.timings;
        const fmt = (x) => x.split(' ')[0];
        await sock.sendMessage(chatId, {
            text: `🕌 *Namaz Times — ${city}*\n📅 ${r.data.data.date.readable}\n\n🌅 Fajr: ${fmt(t.Fajr)}\n🌞 Sunrise: ${fmt(t.Sunrise)}\n☀️ Dhuhr: ${fmt(t.Dhuhr)}\n🌤️ Asr: ${fmt(t.Asr)}\n🌇 Maghrib: ${fmt(t.Maghrib)}\n🌙 Isha: ${fmt(t.Isha)}`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Prayer time nahi mil saka. City ka naam check karo.' }, { quoted: msg });
    }
};
