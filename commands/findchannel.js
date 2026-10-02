/**
 * .findchannel <channel invite link>
 * Link do -> channel ki JID (ID) le lo.
 * Alag standalone command — kisi existing file mein mix nahi.
 *
 * Example:
 *   .findchannel https://whatsapp.com/channel/0029VbAYFuA7z4kXHVNHfM1Y
 */
const settings = require('../settings');
const { extractInviteCode } = require('../lib/channel');

async function findchannelCommand(sock, from, msg, q) {
    const raw = (q || '').trim();

    if (!raw) {
        await sock.sendMessage(from, {
            text: '❌ Link do, ID le lo!\n\n' +
                  'Usage:\n.findchannel <channel link>\n\n' +
                  'Example:\n.findchannel https://whatsapp.com/channel/0029VbAYFuA7z4kXHVNHfM1Y\n\n' +
                  'Apna link: WhatsApp → channel kholo → Share → Copy link'
        }, { quoted: msg });
        return;
    }

    // link se invite code nikalo; agar seedha code diya ho to wohi use karo
    let code = extractInviteCode(raw);
    if (!code) {
        const bare = raw.replace(/[^A-Za-z0-9]/g, '');
        if (bare.length >= 16) code = bare; // asal invite codes ~22 chars hote hain
    }
    if (!code) {
        await sock.sendMessage(from, { text: '❌ Ye valid channel link nahi lag raha. Dobara copy kar ke bhejo.' }, { quoted: msg });
        return;
    }

    await sock.sendMessage(from, { text: '🔍 Channel dhoond raha hun...' }, { quoted: msg });

    try {
        if (typeof sock.newsletterMetadata !== 'function') {
            throw new Error('Baileys version channel lookup support nahi karta.');
        }
        const meta = await sock.newsletterMetadata('invite', code);
        const jid = meta && (meta.id || (meta.result && meta.result.id));
        const name = (meta && meta.thread_metadata && meta.thread_metadata.name && meta.thread_metadata.name.text)
            || (meta && meta.name) || '';
        if (!jid) throw new Error('JID nahi mili.');

        let text = '✅ *Channel mil gaya!*\n\n';
        if (name) text += `📢 Naam: *${name}*\n`;
        text += `🆔 ID: ${jid}`;
        await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(from, {
            text: '❌ Channel nahi mili: ' + (e.message || e) + '\nLink sahi copy kar ke dobara try karo.'
        }, { quoted: msg });
    }
}

module.exports = findchannelCommand;
