/**
 * metaAIForward.js — Naveed-MD EXACT "Meta AI ✔️ • Status" header (2026-10-17)
 *
 * Raaz: Message ko `botForwardedMessage` type mein bhejo with
 * `forwardedAiBotMessageInfo` (Meta AI ka botJid)!
 * Normal contextInfo mein lagane se kaam NAHI karta — yehi ghalti hui thi!
 *
 * Technique: raoltech/baileys "Forwarded AI Bot Info (Meta AI style)"
 */
'use strict';

const META_AI_BOT_JID = '867051314767696@bot';

/**
 * Text ko Meta AI forwarded header ke saath bhejo.
 * Returns: raw message object for sock.relayMessage
 */
function buildMetaAITextMessage(text) {
    const { randomBytes } = require('crypto');
    return {
        messageContextInfo: {
            messageSecret: randomBytes(32)
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [
                        { messageType: 2, messageText: text }
                    ],
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid: META_AI_BOT_JID
                        },
                        forwardOrigin: 4
                    }
                }
            }
        }
    };
}

/**
 * sock.sendMessage ki jagah ye use karo for Meta AI header.
 * relayMessage use karta hai kyunki ye raw proto message hai.
 */
async function sendMetaAIMessage(sock, jid, text, opts = {}) {
    const msg = buildMetaAITextMessage(text);
    const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
    const waMsg = generateWAMessageFromContent(jid, msg, {
        userJid: sock.user.id,
        ...opts
    });
    await sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    return waMsg;
}

module.exports = { buildMetaAITextMessage, sendMetaAIMessage, META_AI_BOT_JID };
