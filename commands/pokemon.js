/**
 * .pokemon <name> — Pokémon info + picture (PokéAPI, free, no key).
 * Example: .pokemon pikachu
 */
const axios = require('axios');

module.exports = async function (sock, chatId, msg, q) {
    const name = (q || '').trim().toLowerCase();
    if (!name) {
        await sock.sendMessage(chatId, { text: '❌ Pokémon ka naam likho:\n.pokemon pikachu' }, { quoted: msg });
        return;
    }
    try {
        const r = await axios.get('https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(name), { timeout: 15000 });
        const p = r.data;
        const types = p.types.map(t => t.type.name).join(', ');
        const img = p.sprites.other['official-artwork'].front_default || p.sprites.front_default;
        const caption = `⚡ *${p.name.toUpperCase()}* (#${p.id})\n\n📏 Height: ${p.height / 10}m\n⚖️ Weight: ${p.weight / 10}kg\n✨ Type: ${types}`;
        if (img) {
            await sock.sendMessage(chatId, { image: { url: img }, caption }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Pokémon nahi mila. Naam check karo.' }, { quoted: msg });
    }
};
