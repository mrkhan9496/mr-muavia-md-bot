/**
 * .weather <city> — Live weather via Open-Meteo (free, no key).
 * Example: .weather Lahore
 */
const axios = require('axios');

const CODES = { 0: '☀️ Clear', 1: '🌤️ Mainly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast', 45: '🌫️ Foggy', 48: '🌫️ Foggy', 51: '🌦️ Drizzle', 61: '🌧️ Rain', 71: '🌨️ Snow', 80: '🌧️ Showers', 95: '⛈️ Thunderstorm' };

module.exports = async function (sock, chatId, msg, q) {
    const city = (q || '').trim();
    if (!city) {
        await sock.sendMessage(chatId, { text: '❌ Sheher ka naam likho:\n.weather Lahore' }, { quoted: msg });
        return;
    }
    try {
        const g = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
            params: { name: city, count: 1 }, timeout: 15000,
        });
        const place = g.data.results && g.data.results[0];
        if (!place) throw new Error('Sheher nahi mila');
        const w = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: { latitude: place.latitude, longitude: place.longitude, current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m', timezone: 'auto' },
            timeout: 15000,
        });
        const c = w.data.current;
        const desc = CODES[c.weather_code] || '🌡️';
        await sock.sendMessage(chatId, {
            text: `🌤️ *${place.name}, ${place.country}*\n\n${desc}\n🌡️ Temp: ${c.temperature_2m}°C\n💧 Humidity: ${c.relative_humidity_2m}%\n💨 Wind: ${c.wind_speed_10m} km/h`
        }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Weather nahi mil saka. Sheher ka naam check karo.' }, { quoted: msg });
    }
};
