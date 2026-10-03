/**
 * audiofx.js — Audio effects for MR MUAVIA MD BOT.
 * Reply to an audio/voice note with one of:
 * .bass .slow .fast .nightcore .chipmunk .robot .reverse .earrape
 * .deep .demon .baby .smooth .fat .blown .radio .tupai .tomp3 .toptt
 */
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegStatic);

const FILTERS = {
    bass: 'bass=g=10',
    slow: 'atempo=0.7',
    fast: 'atempo=1.4',
    nightcore: 'atempo=1.25,aresample=48000,asetrate=48000*1.25',
    chipmunk: 'asetrate=44100*1.5,aresample=44100',
    robot: 'afftdn,aresample=44100,aformat=channel_layouts=mono',
    reverse: 'areverse',
    earrape: 'volume=8',
    deep: 'asetrate=44100*0.8,aresample=44100',
    demon: 'asetrate=44100*0.6,aresample=44100,vibrato=f=6.5',
    baby: 'asetrate=44100*1.8,aresample=44100',
    smooth: 'lowpass=f=1000',
    fat: 'bass=g=15,volume=1.5',
    blown: 'volume=4,acrusher=level_in=8:level_out=18:bits=8:mode=log',
    radio: 'highpass=f=500,lowpass=f=3000',
    tupai: 'asetrate=44100*1.4,aresample=44100,vibrato=f=8'
};

const LABELS = {
    bass: 'Bass Boost 🔊', slow: 'Slow Motion 🐢', fast: 'Fast ⚡',
    nightcore: 'Nightcore 🌃', chipmunk: 'Chipmunk 🐿️', robot: 'Robot 🤖',
    reverse: 'Reverse ⏪', earrape: 'Earrape 📢', deep: 'Deep 🕳️',
    demon: 'Demon 😈', baby: 'Baby 👶', smooth: 'Smooth 🎧',
    fat: 'Fat Bass 🥁', blown: 'Blown 💥', radio: 'Radio 📻',
    tupai: 'Tupai 🐿️', tomp3: 'MP3 🎵', toptt: 'Voice Note 🎙️'
};

function extFor(mimetype) {
    const m = (mimetype || '').toLowerCase();
    if (m.includes('ogg') || m.includes('opus')) return 'ogg';
    if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
    if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
    return 'bin';
}

async function audiofxCommand(sock, chatId, msg, trigger) {
    const t = (trigger || '').toLowerCase().trim();

    if (!FILTERS[t] && t !== 'tomp3' && t !== 'toptt') {
        return await sock.sendMessage(chatId, {
            text: '❌ Ghalat effect! Reply karo audio par: .bass .slow .fast .nightcore .chipmunk .robot .reverse .earrape .deep .demon .baby .smooth .fat .blown .radio .tupai .tomp3 .toptt'
        }, { quoted: msg });
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const audioMsg = quoted?.audioMessage;
    if (!audioMsg) {
        return await sock.sendMessage(chatId, {
            text: '❌ Kisi audio/voice note par reply kar ke ye command use karo!'
        }, { quoted: msg });
    }

    const id = crypto.randomBytes(8).toString('hex');
    const inPath = path.join('/tmp', `audiofx_${id}_in.${extFor(audioMsg.mimetype)}`);
    const outExt = t === 'toptt' ? 'ogg' : 'mp3';
    const outPath = path.join('/tmp', `audiofx_${id}_out.${outExt}`);

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        const stream = await downloadContentFromMessage(audioMsg, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        if (!buffer.length) throw new Error('empty audio buffer');
        await fsPromises.writeFile(inPath, buffer);

        await new Promise((resolve, reject) => {
            let cmd = ffmpeg(inPath);
            if (t === 'tomp3') {
                cmd = cmd.toFormat('mp3').audioCodec('libmp3lame');
            } else if (t === 'toptt') {
                cmd = cmd.toFormat('ogg').audioCodec('libopus');
            } else {
                cmd = cmd.audioFilters(FILTERS[t]).toFormat('mp3').audioCodec('libmp3lame');
            }
            cmd.on('end', resolve).on('error', reject).save(outPath);
        });

        const outBuffer = await fsPromises.readFile(outPath);
        if (t === 'toptt') {
            await sock.sendMessage(chatId, { audio: outBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { audio: outBuffer, mimetype: 'audio/mpeg' }, { quoted: msg });
        }
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    } catch (e) {
        await sock.sendMessage(chatId, {
            text: '❌ Audio effect lagate waqt error aaya, dobara try karo!'
        }, { quoted: msg });
    } finally {
        for (const p of [inPath, outPath]) {
            try { if (fs.existsSync(p)) await fsPromises.unlink(p); } catch (e) { /* ignore */ }
        }
    }
}

audiofxCommand.FILTERS = FILTERS;
audiofxCommand.LABELS = LABELS;

module.exports = audiofxCommand;
