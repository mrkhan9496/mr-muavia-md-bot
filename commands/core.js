/** Core commands: alive, help, ping2, fetch (KHANTHEHACKER-style MAIN section). */
const axios = require('axios');

async function alive(sock, chatId, msg) {
    const up = Math.floor(process.uptime());
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
    await sock.sendMessage(chatId, {
        text: `🤖 *MR MUAVIA MD BOT*\n\n✅ Bot zinda aur chal raha hai!\n⏱️ Uptime: ${h}h ${m}m\n📡 Speed: Active\n\nType .menu for all commands!`
    }, { quoted: msg });
}

async function help(sock, chatId, msg) {
    await sock.sendMessage(chatId, {
        text: `📖 *HELP*\n\nTamam commands dekhne ke liye likho:\n.menu\n\nKisi command ka tareeqa:\n.help <command>\n\nExample: .help sticker`
    }, { quoted: msg });
}

async function ping2(sock, chatId, msg) {
    const start = Date.now();
    const m = await sock.sendMessage(chatId, { text: '🏓 Pong...' }, { quoted: msg });
    const ms = Date.now() - start;
    await sock.sendMessage(chatId, { text: `🏓 *Pong!*\n⚡ Speed: ${ms}ms` }, { quoted: msg });
}

async function fetch(sock, chatId, msg, q) {
    const url = (q || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
        await sock.sendMessage(chatId, { text: '❌ Valid URL do!\nExample: .fetch https://example.com' }, { quoted: msg });
        return;
    }
    try {
        const r = await axios.get(url, { timeout: 15000, maxContentLength: 50000 });
        let text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
        if (text.length > 3000) text = text.slice(0, 3000) + '\n...[cut]';
        await sock.sendMessage(chatId, { text: `🌐 *Fetched:* ${url}\n\n${text}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ URL fetch nahi ho saki.' }, { quoted: msg });
    }
}

module.exports = { alive, help, ping2, fetch };
