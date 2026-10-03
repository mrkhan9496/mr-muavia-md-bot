/**
 * fonts2.js — Unicode font-style text transformers.
 * Usage: .font <text>, .font1 <text>, ... .font23 <text>
 * Each trigger rewrites the user's text in a genuinely distinct unicode style.
 * Characters with no mapping in a style are left unchanged.
 * Anyone can use these.
 */

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGIT = '0123456789';

/** Map a-z / A-Z / 0-9 onto contiguous unicode blocks, with overrides for
 *  letters that live at special codepoints (e.g. ℎ, ℭ, ℂ). */
function blockMap(lowerBase, upperBase, digitBase, lowerOv = {}, upperOv = {}) {
    const m = {};
    for (let i = 0; i < 26; i++) {
        const l = LOWER[i], u = UPPER[i];
        m[l] = lowerOv[l] || String.fromCodePoint(lowerBase + i);
        m[u] = upperOv[u] || String.fromCodePoint(upperBase + i);
    }
    if (digitBase != null) {
        for (let i = 0; i < 10; i++) m[DIGIT[i]] = String.fromCodePoint(digitBase + i);
    }
    return m;
}

const apply = (map, text) => [...text].map(c => map[c] || c).join('');
const combine = (text, mark) => [...text].map(c => /\s/.test(c) ? c : c + mark).join('');

/* ---- explicit maps for non-contiguous styles ---- */

const circledMap = (() => {
    const m = {};
    for (let i = 0; i < 26; i++) {
        m[LOWER[i]] = String.fromCodePoint(0x24D0 + i);
        m[UPPER[i]] = String.fromCodePoint(0x24B6 + i);
    }
    m['0'] = '⓪';
    for (let i = 1; i <= 9; i++) m[String(i)] = String.fromCodePoint(0x2460 + (i - 1));
    return m;
})();

const parenthesizedMap = (() => {
    const m = {};
    for (let i = 0; i < 26; i++) {
        const p = String.fromCodePoint(0x249C + i); // parenthesized exists for lowercase only
        m[LOWER[i]] = p;
        m[UPPER[i]] = p;
    }
    for (let i = 1; i <= 9; i++) m[String(i)] = String.fromCodePoint(0x2474 + (i - 1));
    return m;
})();

const squaredMap = (() => {
    const m = {};
    for (let i = 0; i < 26; i++) {
        const s = String.fromCodePoint(0x1F130 + i); // squared exists for uppercase only
        m[LOWER[i]] = s;
        m[UPPER[i]] = s;
    }
    return m;
})();

const flipMap = {
    a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ə', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ',
    j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ',
    s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
    A: '∀', B: 'B', C: 'Ɔ', D: 'D', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H',
    I: 'I', J: 'ᒿ', K: 'K', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ',
    Q: 'Q', R: 'ᴚ', S: 'S', T: '⊥', U: '∩', V: 'Λ', W: 'M', X: 'X',
    Y: '⅄', Z: 'Z',
    0: '0', 1: 'Ɩ', 2: 'ᄅ', 3: 'Ɛ', 4: 'ㄣ', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6'
};

const smallCapsMap = {
    a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
    j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
    s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
};

const superscriptMap = {
    a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ',
    j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', q: 'ᵠ', r: 'ʳ',
    s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
    0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹'
};

const subscriptMap = {
    a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ',
    o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
    0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉'
};

const fullwidthMap = blockMap(0xFF41, 0xFF21, 0xFF10);

/* ---- the 24 styles: trigger -> { label, fn } ---- */
const STYLES = {
    font:   { label: '𝐁𝐨𝐥𝐝 𝐒𝐞𝐫𝐢𝐟',          fn: t => apply(blockMap(0x1D41A, 0x1D400, 0x1D7CE), t) },
    font1:  { label: '𝘐𝘵𝘢𝘭𝘪𝘤 𝘚𝘦𝘳𝘪𝘧',        fn: t => apply(blockMap(0x1D44E, 0x1D434, null, { h: 'ℎ' }), t) },
    font2:  { label: '𝘽𝙤𝙡𝙙 𝙄𝙩𝙖𝙡𝙞𝙘',        fn: t => apply(blockMap(0x1D482, 0x1D468), t) },
    font3:  { label: '𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎',           fn: t => apply(blockMap(0x1D68A, 0x1D670, 0x1D7F6), t) },
    font4:  { label: '𝒮𝒸𝓇𝒾𝓅𝓉',               fn: t => apply(blockMap(0x1D4B6, 0x1D49C, null, {}, {
                      B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' }), t) },
    font5:  { label: '𝓑𝓸𝓵𝓭 𝓢𝓬𝓻𝓲𝓹𝓽',         fn: t => apply(blockMap(0x1D4EA, 0x1D4D0), t) },
    font6:  { label: '𝔉𝔯𝔞𝔨𝔱𝔲𝔯',              fn: t => apply(blockMap(0x1D51E, 0x1D504, null, {}, {
                      C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }), t) },
    font7:  { label: '𝕭𝖔𝖑𝖉 𝕱𝖗𝖆𝖐𝖙𝖚𝖗',       fn: t => apply(blockMap(0x1D586, 0x1D56C), t) },
    font8:  { label: '𝔻𝕠𝕦𝕓𝕝𝕖-𝕤𝕥𝕣𝕦𝕔𝕜',       fn: t => apply(blockMap(0x1D552, 0x1D538, 0x1D7D8, {}, {
                      C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }), t) },
    font9:  { label: '𝖲𝖺𝗇𝗌-𝗌𝖾𝗋𝗂𝖿',          fn: t => apply(blockMap(0x1D5BA, 0x1D5A0, 0x1D7E2), t) },
    font10: { label: '𝗕𝗼𝗹𝗱 𝗦𝗮𝗻𝘀-𝘀𝗲𝗿𝗶𝗳',  fn: t => apply(blockMap(0x1D5EE, 0x1D5D4, 0x1D7EC), t) },
    font11: { label: '𝘚𝘢𝘯𝘴-𝘴𝘦𝘳𝘪𝘧 𝘐𝘵𝘢𝘭𝘪𝘤', fn: t => apply(blockMap(0x1D622, 0x1D608), t) },
    font12: { label: '𝘚𝘢𝘯𝘴 𝘉𝘰𝘭𝘥 𝘐𝘵𝘢𝘭𝘪𝘤', fn: t => apply(blockMap(0x1D656, 0x1D63C), t) },
    font13: { label: 'Ⓒⓘⓡⓒⓛⓔⓓ',              fn: t => apply(circledMap, t) },
    font14: { label: '⒫⒜⒭⒠⒩⒯⒣⒠⒮⒤⒵⒠⒟',        fn: t => apply(parenthesizedMap, t) },
    font15: { label: '🄰🄱🄲 🅂🅀🅄🄰🅁🄴🄳',      fn: t => apply(squaredMap, t) },
    font16: { label: 'Ｆｕｌｌｗｉｄｔｈ',        fn: t => apply(fullwidthMap, t) },
    font17: { label: 'Upside-down',            fn: t => [...t].reverse().map(c => flipMap[c] || c).join('') },
    font18: { label: 'Sᴍᴀʟʟ Cᴀᴘs',            fn: t => apply(smallCapsMap, t) },
    font19: { label: 'ˢᵘᵖᵉʳˢᶜʳⁱᵖᵗ',           fn: t => apply(superscriptMap, t) },
    font20: { label: 'ₛᵤbₛcᵣᵢₚₜ',             fn: t => apply(subscriptMap, t) },
    font21: { label: 'Ｖａｐｏｒｗａｖｅ',        fn: t => [...t].map(c => fullwidthMap[c] || c).join(' ') },
    font22: { label: 'S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶', fn: t => combine(t, '̶') },
    font23: { label: 'U̲n̲d̲e̲r̲l̲i̲n̲e̲',       fn: t => combine(t, '̲') },
};

async function fonts2Command(sock, chatId, msg, q, trigger) {
    const text = (q || '').trim();
    if (!text) {
        await sock.sendMessage(chatId, {
            text: `✍️ *Font Style (.${trigger})*\n\nUsage: *.${trigger} <text>*\nExample: *.${trigger} hello world*\n\n24 styles available: *.font* to *.font23*`
        }, { quoted: msg });
        return;
    }
    const style = STYLES[trigger];
    if (!style) return;
    await sock.sendMessage(chatId, { text: style.fn(text) }, { quoted: msg });
}

fonts2Command.TRIGGERS = ['font',
    'font1', 'font2', 'font3', 'font4', 'font5', 'font6', 'font7', 'font8', 'font9',
    'font10', 'font11', 'font12', 'font13', 'font14', 'font15', 'font16', 'font17',
    'font18', 'font19', 'font20', 'font21', 'font22', 'font23'];

module.exports = fonts2Command;
