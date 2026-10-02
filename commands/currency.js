/**
 * .currency — Live currency converter (open.er-api.com, free, no key).
 * Examples:
 *   .currency 100 USD to PKR
 *   .currency USD
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const raw = (q || '').trim().toUpperCase();
    const m = raw.match(/^([\d.]+)?\s*([A-Z]{3})(?:\s+TO\s+([A-Z]{3}))?$/);
    if (!m) {
        await sock.sendMessage(chatId, { text: '❌ Aise likho:\n.currency 100 USD to PKR\n.currency USD' }, { quoted: msg });
        return;
    }
    const amount = parseFloat(m[1] || '1');
    const from = m[2], to = m[3] || null;
    try {
        const r = await axios.get('https://open.er-api.com/v6/latest/' + from, { timeout: 15000 });
        const rates = r.data.rates;
        if (to) {
            if (!rates[to]) throw new Error('currency nahi mili');
            const val = (amount * rates[to]).toFixed(2);
            await sock.sendMessage(chatId, { text: `💱 *${amount} ${from} = ${val} ${to}*\n\n1 ${from} = ${rates[to]} ${to}` }, { quoted: msg });
        } else {
            const picks = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'].filter(c => c !== from && rates[c]);
            const lines = picks.map(c => `1 ${from} = ${rates[c]} ${c}`);
            await sock.sendMessage(chatId, { text: `💱 *${from} rates:*\n\n${lines.join('\n')}` }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Rate nahi mil saka. Currency code check karo (jaise USD, PKR).' }, { quoted: msg });
    }
};
