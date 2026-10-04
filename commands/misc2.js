/**
 * misc2.js — MISC command batch 2 (group/settings/utility/main/search/other/tools).
 *
 * Signature (parent wires into dispatcher):
 *   await misc2Command(sock, chatId, msg, q, trigger, ctx)
 *   ctx = { isOwner, isAdmin, botData, saveBotData, userId }
 *
 * Every case is wrapped in try/catch and never throws.
 * Permissions: admin-only cases check ctx.isAdmin, owner-only check ctx.isOwner.
 */

const axios = require('axios');
const yts = require('yt-search');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

try { ffmpeg.setFfmpegPath(ffmpegStatic); } catch (e) { /* ffmpeg optional */ }

// ---------------------------------------------------------------- helpers

async function reply(sock, chatId, msg, text) {
    await sock.sendMessage(chatId, { text }, { quoted: msg });
}

const isGroup = (chatId) => chatId.endsWith('@g.us');

function quotedCtx(msg) {
    // Check multiple paths: extendedTextMessage (text reply), imageMessage/videoMessage
    // with caption (media reply), and ephemeralMessage wrappers.
    const m = msg.message || {};
    // Unwrap ephemeralMessage if present
    const inner = m.ephemeralMessage?.message || m;
    return inner.extendedTextMessage?.contextInfo
        || inner.imageMessage?.contextInfo
        || inner.videoMessage?.contextInfo
        || null;
}

function parseOnOff(q) {
    const v = (q || '').trim().toLowerCase();
    if (['on', 'enable', '1', 'yes'].includes(v)) return true;
    if (['off', 'disable', '0', 'no'].includes(v)) return false;
    return null;
}

function normNum(input) {
    if (!input) return null;
    const digits = String(input).replace(/[^0-9]/g, '');
    if (digits.length < 7) return null;
    return digits + '@s.whatsapp.net';
}

async function downloadQuotedMedia(sock, msg) {
    const ctx = quotedCtx(msg);
    const quoted = ctx?.quotedMessage;
    if (!quoted) return null;
    try {
        const dlMsg = { key: { ...msg.key, id: ctx.stanzaId }, message: quoted };
        const buf = await sock.downloadMediaMessage(dlMsg);
        return { buf, type: Object.keys(quoted)[0], mimetype: quoted[Object.keys(quoted)[0]]?.mimetype };
    } catch (e) { return null; }
}

async function downloadMsgMedia(sock, msg) {
    // direct media in the command message itself
    const mtype = Object.keys(msg.message || {})[0];
    if (mtype === 'imageMessage' || mtype === 'videoMessage' || mtype === 'audioMessage') {
        try {
            const buf = await sock.downloadMediaMessage(msg);
            return { buf, type: mtype, mimetype: msg.message[mtype]?.mimetype };
        } catch (e) { return null; }
    }
    return null;
}

function channelInviteCode(link) {
    if (!link) return null;
    const m = String(link).match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/i);
    return m ? m[1] : null;
}

async function resolveNewsletterJid(sock, link) {
    const code = channelInviteCode(link);
    if (!code) return { error: '❌ Channel link ghalat hai!\nExample: .follow https://whatsapp.com/channel/XXXX' };
    if (typeof sock.newsletterMetadata !== 'function')
        return { error: '❌ Is Baileys version mein channel API nahi hai.' };
    const meta = await sock.newsletterMetadata('invite', code);
    if (!meta || !meta.id) return { error: '❌ Channel nahi mila, link check karo.' };
    return { jid: meta.id, name: meta.name || 'Channel' };
}

function fmtUptime(sec) {
    sec = Math.floor(sec);
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600),
          m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
}

// ---------------------------------------------------------------- main

async function misc2Command(sock, chatId, msg, q, trigger, ctx) {
    const { isOwner, isAdmin, botData, saveBotData, userId } = ctx || {};
    const query = (q || '').trim();

    const needOwner = async () => {
        if (!isOwner) { await reply(sock, chatId, msg, '❌ Ye command sirf *owner* use kar sakta hai.'); return false; }
        return true;
    };
    const needAdmin = async () => {
        if (!isGroup(chatId)) { await reply(sock, chatId, msg, '❌ Ye command sirf *group* mein chalti hai.'); return false; }
        if (!isAdmin && !isOwner) { await reply(sock, chatId, msg, '❌ Sirf *group admin* use kar sakta hai.'); return false; }
        return true;
    };

    try {
        switch (trigger) {

            // ============================ GROUP ============================

            case 'del': {
                if (!(await needAdmin())) return;
                const ctxInfo = quotedCtx(msg);
                const quotedId = ctxInfo?.stanzaId;
                const quotedParticipant = ctxInfo?.participant;
                if (!quotedId) { await reply(sock, chatId, msg, '❌ Jis message ko delete karna hai us par *reply* kar ke .del likho.'); return; }
                try {
                    await sock.sendMessage(chatId, {
                        delete: { remoteJid: chatId, fromMe: false, id: quotedId, participant: quotedParticipant }
                    });
                } catch (e) {
                    await reply(sock, chatId, msg, '❌ Delete nahi ho saka. Bot ko admin banao aur dobara try karo.');
                }
                return;
            }

            case 'everyone': {
                if (!(await needAdmin())) return;
                const meta = await sock.groupMetadata(chatId);
                const members = meta.participants || [];
                if (!members.length) { await reply(sock, chatId, msg, '❌ Members nahi mile.'); return; }
                const mentions = members.map(p => p.id);
                const list = members.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n');
                await sock.sendMessage(chatId, {
                    text: `📢 *${meta.subject || 'Group'} — Sab ko tag*\n\n${list}`,
                    mentions
                }, { quoted: msg });
                return;
            }

            case 'gcinfo': {
                if (!isGroup(chatId)) { await reply(sock, chatId, msg, '❌ Ye command sirf group mein chalti hai.'); return; }
                const meta = await sock.groupMetadata(chatId);
                const members = meta.participants || [];
                const admins = members.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
                const created = meta.creation ? new Date(meta.creation * 1000).toLocaleString() : 'N/A';
                await reply(sock, chatId, msg,
                    `🏷️ *Group Info*\n\n` +
                    `📌 Naam: ${meta.subject || 'N/A'}\n` +
                    `🆔 ID: ${meta.id}\n` +
                    `👥 Members: ${members.length} (Admins: ${admins.length})\n` +
                    `📅 Bana: ${created}\n` +
                    `📝 Desc: ${(meta.desc || 'koi description nahi').slice(0, 200)}`
                );
                return;
            }

            // ============================ SEARCH / INFO ============================

            case 'yts': {
                if (!query) { await reply(sock, chatId, msg, '❌ Search text likho!\nExample: .yts naat sharif'); return; }
                await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } });
                const r = await yts(query);
                const videos = (r.videos || []).slice(0, 5);
                if (!videos.length) { await reply(sock, chatId, msg, '❌ Koi result nahi mila.'); return; }
                const text = `🔍 *YouTube Search:* ${query}\n\n` + videos.map((v, i) =>
                    `${i + 1}. *${v.title}*\n   ⏱ ${v.timestamp || '?'} | 👁 ${v.views || '?'} | 📺 ${v.author?.name || '?'}\n   🔗 ${v.url}`
                ).join('\n\n');
                await reply(sock, chatId, msg, text);
                return;
            }

            case 'npm': {
                const pkg = query.split(/\s+/)[0];
                if (!pkg) { await reply(sock, chatId, msg, '❌ Package naam likho!\nExample: .npm express'); return; }
                const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`, { timeout: 15000 });
                const d = res.data;
                const latest = d['dist-tags']?.latest || '?';
                const v = d.versions?.[latest] || {};
                await reply(sock, chatId, msg,
                    `📦 *NPM:* ${d.name}\n\n` +
                    `🔖 Latest: v${latest}\n` +
                    `📝 ${d.description || 'No description'}\n` +
                    `👤 Author: ${v.author?.name || d.author?.name || '?'}\n` +
                    `📜 License: ${v.license || '?'}\n` +
                    `🔗 https://www.npmjs.com/package/${encodeURIComponent(d.name)}`
                );
                return;
            }

            case 'id': {
                const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
                await reply(sock, chatId, msg,
                    `🆔 *Chat Info*\n\n💬 Chat JID: ${chatId}\n👤 Sender: ${sender || '?'}\n🤖 Bot: ${sock.user?.id || '?'}`
                );
                return;
            }

            case 'getlid': {
                const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
                const isLid = String(sender || '').includes('@lid');
                await reply(sock, chatId, msg,
                    `🪪 *Sender ID Info*\n\n` +
                    `📌 JID: ${sender || '?'}\n` +
                    `🔎 Type: ${isLid ? 'LID address (@lid)' : 'Phone-number JID (@s.whatsapp.net)'}\n` +
                    `💬 Chat: ${chatId}`
                );
                return;
            }

            case 'getbio': {
                const ctxInfo = quotedCtx(msg);
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const target = ctxInfo?.participant || mentioned ||
                    (isGroup(chatId) ? (msg.key.participant || msg.participant) : chatId);
                if (!target) { await reply(sock, chatId, msg, '❌ Kisi par reply/mention kar ke .getbio likho.'); return; }
                const res = await sock.fetchStatus(target);
                const st = Array.isArray(res) ? res[0] : res;
                await reply(sock, chatId, msg,
                    `📝 *Bio*\n\n👤 @${String(target).split('@')[0]}\n💭 ${st?.status || 'koi bio set nahi'}`,
                );
                return;
            }

            case 'getprivacy':
            case 'privacy': {
                if (!(await needOwner())) return;
                const p = await sock.fetchPrivacySettings();
                const lines = Object.entries(p || {}).map(([k, v]) =>
                    `• ${k}: *${typeof v === 'object' ? JSON.stringify(v) : v}*`
                ).join('\n');
                await reply(sock, chatId, msg, `🔐 *Privacy Settings*\n\n${lines || 'koi data nahi'}\n\n_(read-only — WhatsApp inhein sirf phone se change karne deta hai)_`);
                return;
            }

            case 'blocklist': {
                if (!(await needOwner())) return;
                const list = await sock.fetchBlocklist();
                if (!list || !list.length) { await reply(sock, chatId, msg, '✅ Blocklist khaali hai — koi blocked number nahi.'); return; }
                await reply(sock, chatId, msg,
                    `🚫 *Blocked Numbers (${list.length})*\n\n` +
                    list.map((j, i) => `${i + 1}. +${String(j).split('@')[0]}`).join('\n')
                );
                return;
            }

            // ============================ SUDO ============================

            case 'sudo': {
                if (!(await needOwner())) return;
                const jid = normNum(query);
                if (!jid) { await reply(sock, chatId, msg, '❌ Number likho!\nExample: .sudo 923001234567'); return; }
                if (!botData.sudo) botData.sudo = [];
                if (botData.sudo.includes(jid)) { await reply(sock, chatId, msg, '⚠️ Ye number pehle se sudo hai.'); return; }
                botData.sudo.push(jid);
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Sudo add ho gaya:* +${jid.split('@')[0]}`);
                return;
            }

            case 'delsudo': {
                if (!(await needOwner())) return;
                const jid = normNum(query);
                if (!jid || !botData.sudo?.length) { await reply(sock, chatId, msg, '❌ Number likho!\nExample: .delsudo 923001234567'); return; }
                const i = botData.sudo.indexOf(jid);
                if (i === -1) { await reply(sock, chatId, msg, '⚠️ Ye number sudo list mein nahi hai.'); return; }
                botData.sudo.splice(i, 1);
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Sudo hata diya:* +${jid.split('@')[0]}`);
                return;
            }

            case 'listsudo': {
                if (!(await needOwner())) return;
                const list = botData.sudo || [];
                if (!list.length) { await reply(sock, chatId, msg, '📋 Sudo list khaali hai.'); return; }
                await reply(sock, chatId, msg,
                    `👑 *Sudo List (${list.length})*\n\n` +
                    list.map((j, i) => `${i + 1}. +${String(j).split('@')[0]}`).join('\n')
                );
                return;
            }

            // ============================ PRESENCE FLAGS ============================

            case 'recording':
            case 'autotyping':
            case 'online': {
                if (!(await needOwner())) return;
                const val = parseOnOff(query);
                if (val === null) {
                    const cur = botData.presence || {};
                    await reply(sock, chatId, msg,
                        `🎙️ *Presence Settings*\n\n` +
                        `• recording: ${cur.recording ? '✅' : '❌'}\n` +
                        `• autotyping: ${cur.typing ? '✅' : '❌'}\n` +
                        `• online: ${cur.online ? '✅' : '❌'}\n\n` +
                        `Use: .${trigger} on / .${trigger} off`
                    );
                    return;
                }
                if (!botData.presence) botData.presence = {};
                if (trigger === 'recording') botData.presence.recording = val;
                if (trigger === 'autotyping') botData.presence.typing = val;
                if (trigger === 'online') botData.presence.online = val;
                saveBotData();
                // apply immediately on this chat as well
                try {
                    const presence = trigger === 'recording' ? 'recording' : trigger === 'autotyping' ? 'composing' : 'available';
                    await sock.sendPresenceUpdate(val ? presence : 'paused', chatId);
                } catch (e) { /* non-fatal */ }
                await reply(sock, chatId, msg, `${val ? '✅' : '❌'} *${trigger}* ${val ? 'ON' : 'OFF'}`);
                return;
            }

            case 'autoreact': {
                if (!(await needOwner())) return;
                const val = parseOnOff(query);
                if (!botData.statusSettings) botData.statusSettings = {};
                if (!botData.statusSettings[userId]) botData.statusSettings[userId] = {};
                if (val === null) {
                    const cur = !!botData.statusSettings[userId].autoReact;
                    await reply(sock, chatId, msg,
                        `💫 *Auto-React:* ${cur ? '✅ ON' : '❌ OFF'}\n\nUse: .autoreact on / .autoreact off\n_(har message par random emoji react)_`
                    );
                    return;
                }
                botData.statusSettings[userId].autoReact = val;
                saveBotData();
                await reply(sock, chatId, msg,
                    `${val ? '✅' : '❌'} *Auto-React ${val ? 'ON' : 'OFF'}*\n_(reconnect ke baad apply hoga)_`
                );
                return;
            }

            // ============================ BOT SETTINGS (owner) ============================

            case 'mode': {
                if (!(await needOwner())) return;
                const m = query.toLowerCase();
                if (!['public', 'private', 'self'].includes(m)) {
                    await reply(sock, chatId, msg,
                        `⚙️ *Mode:* ${botData.mode || 'public'}\n\nUse: .mode public / .mode private / .mode self`
                    );
                    return;
                }
                botData.mode = m;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Bot mode:* ${m}`);
                return;
            }

            case 'botname': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, `🤖 *Bot name:* ${botData.botName || 'set nahi'}\n\nUse: .botname <naya naam>`); return; }
                botData.botName = query;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Bot name set:* ${query}`);
                return;
            }

            case 'ownername': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, `👑 *Owner name:* ${botData.ownerName || 'set nahi'}\n\nUse: .ownername <naam>`); return; }
                botData.ownerName = query;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Owner name set:* ${query}`);
                return;
            }

            case 'description': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, `📝 *Bot description:* ${botData.botDescription || 'set nahi'}\n\nUse: .description <text>`); return; }
                botData.botDescription = query;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Bot description set!*`);
                return;
            }

            case 'stickername': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, `🏷️ *Sticker pack name:* ${botData.stickerPack || 'set nahi'}\n\nUse: .stickername <naam>`); return; }
                botData.stickerPack = query;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Sticker pack name set:* ${query}`);
                return;
            }

            // ============================ WELCOME / GOODBYE ============================
            // NOTE: flags/messages yahan store hote hain. index.js mein
            // group-participants.update hook lagna baqi hai jo inhein parh kar
            // welcome/goodbye bheje.

            case 'welcome': {
                if (!(await needAdmin())) return;
                const val = parseOnOff(query);
                if (!botData.welcome) botData.welcome = {};
                if (!botData.welcome[chatId]) botData.welcome[chatId] = {};
                if (val === null) {
                    const w = botData.welcome[chatId];
                    await reply(sock, chatId, msg,
                        `👋 *Welcome:* ${w.enabled ? '✅ ON' : '❌ OFF'}\n` +
                        `💬 Message: ${w.message || 'default'}\n\n` +
                        `Use: .welcome on/off | .setwelcome <text>\n` +
                        `_{user} aur {group} placeholders supported_`
                    );
                    return;
                }
                botData.welcome[chatId].enabled = val;
                saveBotData();
                await reply(sock, chatId, msg, `${val ? '✅' : '❌'} *Welcome ${val ? 'ON' : 'OFF'}*`);
                return;
            }

            case 'setwelcome': {
                if (!(await needAdmin())) return;
                if (!query) { await reply(sock, chatId, msg, '❌ Welcome message likho!\nExample: .setwelcome Welcome {user} to {group} 🎉'); return; }
                if (!botData.welcome) botData.welcome = {};
                if (!botData.welcome[chatId]) botData.welcome[chatId] = {};
                botData.welcome[chatId].message = query;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Welcome message set!*\n\n${query}`);
                return;
            }

            case 'goodbye': {
                if (!(await needAdmin())) return;
                const val = parseOnOff(query);
                if (!botData.goodbye) botData.goodbye = {};
                if (!botData.goodbye[chatId]) botData.goodbye[chatId] = {};
                if (val === null) {
                    const g = botData.goodbye[chatId];
                    await reply(sock, chatId, msg,
                        `👋 *Goodbye:* ${g.enabled ? '✅ ON' : '❌ OFF'}\n` +
                        `💬 Message: ${g.message || 'default'}\n\n` +
                        `Use: .goodbye on/off | .setgoodbye <text>`
                    );
                    return;
                }
                botData.goodbye[chatId].enabled = val;
                saveBotData();
                await reply(sock, chatId, msg, `${val ? '✅' : '❌'} *Goodbye ${val ? 'ON' : 'OFF'}*`);
                return;
            }

            case 'setgoodbye': {
                if (!(await needAdmin())) return;
                if (!query) { await reply(sock, chatId, msg, '❌ Goodbye message likho!\nExample: .setgoodbye Allah Hafiz {user} 👋'); return; }
                if (!botData.goodbye) botData.goodbye = {};
                if (!botData.goodbye[chatId]) botData.goodbye[chatId] = {};
                botData.goodbye[chatId].message = query;
                saveBotData();
                await reply(sock, chatId, msg, `✅ *Goodbye message set!*\n\n${query}`);
                return;
            }

            // ============================ PROFILE (owner) ============================

            case 'botdp':
            case 'fullpp': {
                if (!(await needOwner())) return;
                const media = await downloadQuotedMedia(sock, msg) || await downloadMsgMedia(sock, msg);
                if (!media || !media.buf || !media.buf.length) {
                    await reply(sock, chatId, msg, '❌ Kisi *photo* par reply kar ke ye command use karo!');
                    return;
                }
                if (!media.type.includes('image')) {
                    await reply(sock, chatId, msg, '❌ Sirf *photo* par reply karo (video nahi).');
                    return;
                }
                await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
                await sock.updateProfilePicture(sock.user.id, media.buf);
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                await reply(sock, chatId, msg, `✅ *Bot ki DP update ho gayi!* ${trigger === 'fullpp' ? '(full photo)' : ''}`);
                return;
            }

            case 'updatebio': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, '❌ Bio text likho!\nExample: .updatebio MR MUAVIA MD BOT 🤖'); return; }
                await sock.updateProfileStatus(query);
                await reply(sock, chatId, msg, `✅ *Bot bio update ho gayi!*\n\n${query}`);
                return;
            }

            // ============================ CHANNEL FOLLOW ============================

            case 'follow':
            case 'follow2': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, '❌ Channel link do!\nExample: .follow https://whatsapp.com/channel/XXXX'); return; }
                const r = await resolveNewsletterJid(sock, query);
                if (r.error) { await reply(sock, chatId, msg, r.error); return; }
                await sock.newsletterFollow(r.jid);
                await reply(sock, chatId, msg, `✅ *Channel follow ho gaya!*\n\n📢 ${r.name}`);
                return;
            }

            case 'unfollow':
            case 'unfollow2': {
                if (!(await needOwner())) return;
                if (!query) { await reply(sock, chatId, msg, '❌ Channel link do!\nExample: .unfollow https://whatsapp.com/channel/XXXX'); return; }
                const r = await resolveNewsletterJid(sock, query);
                if (r.error) { await reply(sock, chatId, msg, r.error); return; }
                await sock.newsletterUnfollow(r.jid);
                await reply(sock, chatId, msg, `✅ *Channel unfollow ho gaya!*\n\n📢 ${r.name}`);
                return;
            }

            // ============================ FORWARD ============================

            case 'forward': {
                if (!(await needOwner())) return;
                const ctxInfo = quotedCtx(msg);
                const quoted = ctxInfo?.quotedMessage;
                if (!quoted) { await reply(sock, chatId, msg, '❌ Jis message ko forward karna hai us par *reply* kar ke .forward <number> likho.'); return; }
                const target = normNum(query);
                if (!target) { await reply(sock, chatId, msg, '❌ Target number likho!\nExample: .forward 923001234567'); return; }
                const fwd = JSON.parse(JSON.stringify(quoted));
                const mtype = Object.keys(fwd)[0];
                fwd[mtype].contextInfo = { ...(fwd[mtype].contextInfo || {}), forwardingScore: 1, isForwarded: true };
                await sock.sendMessage(target, fwd);
                await reply(sock, chatId, msg, `✅ *Forward ho gaya* → +${target.split('@')[0]}`);
                return;
            }

            // ============================ CONVERT ============================

            case 'convert': {
                const fmt = query.toLowerCase();
                if (!['mp3', 'mp4'].includes(fmt)) {
                    await reply(sock, chatId, msg, '❌ Format likho!\nExample: .convert mp3  (audio/video → mp3)\nExample: .convert mp4  (video → mp4)');
                    return;
                }
                const media = await downloadQuotedMedia(sock, msg) || await downloadMsgMedia(sock, msg);
                if (!media || !media.buf || !media.buf.length) {
                    await reply(sock, chatId, msg, '❌ Kisi *audio/video* par reply kar ke .convert use karo!');
                    return;
                }
                if (fmt === 'mp3' && media.type === 'imageMessage') {
                    await reply(sock, chatId, msg, '❌ Photo ko mp3 mein convert nahi kar sakte!');
                    return;
                }
                const id = crypto.randomBytes(8).toString('hex');
                const inExt = (media.mimetype || '').split('/')[1]?.split(';')[0] || 'bin';
                const inPath = path.join('/tmp', `conv_${id}_in.${inExt}`);
                const outPath = path.join('/tmp', `conv_${id}_out.${fmt}`);
                try {
                    await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
                    await fs.promises.writeFile(inPath, media.buf);
                    await new Promise((resolve, reject) => {
                        let cmd = ffmpeg(inPath);
                        if (fmt === 'mp3') cmd = cmd.toFormat('mp3').audioCodec('libmp3lame');
                        else cmd = cmd.toFormat('mp4').videoCodec('libx264').audioCodec('aac').outputOptions('-pix_fmt yuv420p', '-movflags +faststart');
                        cmd.on('end', resolve).on('error', reject).save(outPath);
                    });
                    const out = await fs.promises.readFile(outPath);
                    if (fmt === 'mp3') {
                        await sock.sendMessage(chatId, { audio: out, mimetype: 'audio/mpeg' }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { video: out, mimetype: 'video/mp4' }, { quoted: msg });
                    }
                    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                } catch (e) {
                    await reply(sock, chatId, msg, '❌ Convert nahi ho saka, dobara try karo.');
                } finally {
                    for (const p of [inPath, outPath]) {
                        try { if (fs.existsSync(p)) await fs.promises.unlink(p); } catch (e) { /* ignore */ }
                    }
                }
                return;
            }

            default:
                return; // unknown trigger — dispatcher shouldn't route here
        }
    } catch (e) {
        try { await reply(sock, chatId, msg, '❌ Kuch ghalat ho gaya, dobara try karo.'); } catch (e2) { /* ignore */ }
    }
}

module.exports = misc2Command;
module.exports.TRIGGERS = [
    // group
    'del', 'everyone', 'gcinfo',
    // search / info
    'yts', 'npm', 'id', 'getlid', 'getbio', 'getprivacy', 'privacy', 'blocklist',
    // sudo
    'sudo', 'delsudo', 'listsudo',
    // presence
    'recording', 'autotyping', 'online', 'autoreact',
    // bot settings
    'mode', 'botname', 'ownername', 'description', 'stickername',
    // welcome / goodbye
    'welcome', 'setwelcome', 'goodbye', 'setgoodbye',
    // profile
    'botdp', 'fullpp', 'updatebio',
    // channel
    'follow', 'follow2', 'unfollow', 'unfollow2',
    // tools
    'forward', 'convert',
];
