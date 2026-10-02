/**
 * .hp <name> — Harry Potter character info + photo (HP API, free, no key).
 * Example: .hp harry
 */
const axios = require('axios');

let cache = null, cacheAt = 0;

async function getCharacters() {
    if (cache && Date.now() - cacheAt < 3600000) return cache;
    const r = await axios.get('https://hp-api.onrender.com/api/characters', { timeout: 25000 });
    cache = r.data; cacheAt = Date.now();
    return cache;
}

module.exports = async function (sock, chatId, msg, q) {
    const name = (q || '').trim().toLowerCase();
    if (!name) {
        await sock.sendMessage(chatId, { text: '❌ Character ka naam likho:\n.hp harry' }, { quoted: msg });
        return;
    }
    try {
        const chars = await getCharacters();
        const c = chars.find(x => x.name.toLowerCase().includes(name));
        if (!c) throw new Error('not found');
        const text = `⚡ *${c.name}*\n\n🏰 House: ${c.house || '—'}\n🧙 Species: ${c.species || '—'}\n🧬 Ancestry: ${c.ancestry || '—'}\n👁️ Eyes: ${c.eyeColour || '—'}\n💇 Hair: ${c.hairColour || '—'}\n🎂 Born: ${c.dateOfBirth || '—'}\n${c.wizard ? '✨ Wizard' : ''}`;
        if (c.image) {
            await sock.sendMessage(chatId, { image: { url: c.image }, caption: text }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Character nahi mila. Naam check karo.' }, { quoted: msg });
    }
};
