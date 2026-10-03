/**
 * .link — Owner-only promotional links message.
 *
 * Sends a professional promotional message with the owner's links.
 * Links are configured in settings.js -> promoLinks (NOT hardcoded here).
 * Any link left as '' in config is automatically hidden from the message.
 *
 * URL buttons ("Join Channel" / "Connect Bot") are attempted first;
 * if the device doesn't support them, plain clickable links are sent instead.
 */
const settings = require('../settings');

async function promolinksCommand(sock, from, msg, isOwner) {
    if (!isOwner) {
        await sock.sendMessage(from, { text: '❌ Ye command sirf bot owner ke liye hai.' }, { quoted: msg });
        return;
    }

    const links = (settings && settings.promoLinks) || {};
    const sections = [];
    const urlButtons = [];
    let btnIndex = 1;

    if (links.channel) {
        sections.push(`📢 *WhatsApp Channel:*\n${links.channel}`);
        urlButtons.push({ index: btnIndex++, urlButton: { displayText: '📢 Join Channel', url: links.channel } });
    }
    if (links.panel) {
        sections.push(`🤖 *Bot Connect / Pairing Panel:*\n${links.panel}`);
        urlButtons.push({ index: btnIndex++, urlButton: { displayText: '🤖 Connect Bot', url: links.panel } });
    }
    if (links.additional) {
        sections.push(`🔗 *Additional Link:*\n${links.additional}`);
    }
    if (links.support) {
        sections.push(`👥 *Support / Group:*\n${links.support}`);
    }

    const linksBlock = sections.length ? sections.join('\n\n') : '_(Links jald aa rahe hain)_';

    const message =
`📢 *HAMARE CHANNEL KO ZAROOR JOIN KAREIN!* 🚀

Yahan aapko WhatsApp Bots aur useful Android content regularly milta rahega.

✨ *Channel mein:*
• WhatsApp Bot & Multiple Bot Features
• Android Tips & Tricks
• CapCut Pro / Editing Resources
• Useful Apps & APKs
• New Tools & AI Updates
• Movies/Entertainment related updates
• Aur bohat si useful cheezen

👇 *Zaroori Links:*

${linksBlock}

❤️ *Channel Join karein aur latest updates miss na karein!*`;

    // Prefer URL buttons; fall back to plain clickable links if unsupported.
    if (urlButtons.length) {
        try {
            await sock.sendMessage(from, { text: message, templateButtons: urlButtons }, { quoted: msg });
            return;
        } catch (e) {
            console.error('[promolinks] URL buttons failed, falling back to plain links:', e.message);
        }
    }
    await sock.sendMessage(from, { text: message }, { quoted: msg });
}

module.exports = { promolinksCommand };
