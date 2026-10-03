/**
 * Downloader aliases (KHANTHEHACKER-style DOWNLOAD section).
 * All route to the existing working downloaders.
 */
module.exports = {
    TRIGGERS_TIKTOK: ['tiktok2', 'tiktok3', 'ttmp3', 't', 'tsticker', 'tiktoksearch', 'tiktoksearch2'],
    TRIGGERS_IG: ['igdl', 'igdl2', 'igdl3', 'igmp3'],
    TRIGGERS_AUDIO: ['mp3', 'audio'],
};

async function dlAlias(sock, chatId, msg, q, trigger, commands) {
    if (module.exports.TRIGGERS_TIKTOK.includes(trigger)) {
        return await commands.tiktok(sock, chatId, msg, q);
    }
    if (module.exports.TRIGGERS_IG.includes(trigger)) {
        return await commands.insta(sock, chatId, msg, q);
    }
    if (module.exports.TRIGGERS_AUDIO.includes(trigger)) {
        // audio extraction via song command
        return await commands.song(sock, chatId, msg, q);
    }
}
module.exports.dlAlias = dlAlias;
