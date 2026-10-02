/**
 * .wallpaper — Random beautiful HD wallpaper (Lorem Picsum / Unsplash, free, no key).
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg) {
    try {
        const r = await axios.get('https://picsum.photos/1080/1920', {
            maxRedirects: 5, responseType: 'arraybuffer', timeout: 25000,
        });
        await sock.sendMessage(chatId, {
            image: Buffer.from(r.data), mimetype: 'image/jpeg',
            caption: '🖼️ *Random Wallpaper*\n\n.wallpaper dobara bhejo, nayi milegi!'
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Wallpaper nahi mil saka, dobara try karo.' }, { quoted: msg });
    }
};
