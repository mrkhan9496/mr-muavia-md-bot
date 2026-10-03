/**
 * Fun roleplay / family / action commands (KHANTHEHACKER-style FUN section).
 * Each trigger sends a short fun Roman-Urdu message. Usage: .hug, .dad, .rate 80, etc.
 * Randomized triggers (rate, coinflip, roll, flip, pick, lovetest, ship,
 * compatibility, dare, truth, repeat) are computed inside the handler.
 */
const RESPONSES = {
    // ---- personality / fun analysis ----
    character: "🎭 *Character Report:* Aap ka character certificate ban gaya — 100% masoom, 0% shareef! 😜",
    ringtone: "🔔 *Ringtone:* Tring tring! Aap ke liye special ringtone — 'utho, chai thandi ho rahi hai!' ☕",
    emix: "😜 *Emoji Mix:* 🐒+🍌 = Aap! Bilkul perfect combination! 😂",
    aura: "✨ *Aura Reading:* Aap ki aura se meethi biryani ki khushbu aa rahi hai! 🍛",
    roast: "🔥 *Halka Roast:* Aap ka dimagh WiFi ki tarah hai — signal kabhi kabhi ghaib ho jata hai! 😅",
    compliment: "🌹 *Compliment:* Aap ki smile se to andhera bhi roshan ho jaye! Stay awesome! 💖",
    technologia: "🤖 *Technologia:* Aap ka software update pending hai — version 'lazy 2.0' se 'active 3.0' par jao! 💻",

    // ---- love / rishta ----
    flirt: "😉 *Flirt Mode:* Kya aap ke paas map hai? Kyunki main aap ki baton mein kho gaya hun! 🗺️",
    runmureed: "💍 *Runmureed Certificate:* Mubarak ho! Aap officially biwi ke wafadar sipahi qarar paye! 🫡😂",
    marige: "💒 *Marige Bureau:* Aap ki shaadi ka rishta approve ho gaya — dulhan: neend, dulha: mobile! 📱😴",
    pickup: "💘 *Pickup Line:* Kya aap charger hain? Kyunki aap ke baghair meri battery low ho jati hai! 🔋",

    // ---- family (desi one-liners) ----
    dad: "👨 *Dad:* 'Beta, mere zamane mein...' — aur phir 2 ghante ki kahani shuru! 😂",
    mom: "👩 *Mom:* 'Khana khaya?' — ami ki ye line duniya ka sab se bara pyaar hai! 🍛❤️",
    son: "👦 *Son:* Ghar ka shehzada! Bas exam mein number bhi shehzadon wale lao! 📚",
    daughter: "👧 *Daughter:* Ghar ki rani! Papa ki jaan, mama ki shaan! 👑",
    boyfriend: "💑 *Boyfriend:* 'Jaan, 2 minute mein call karta hun' — wo 2 minute kabhi nahi aaye! 😜",
    girlfriend: "💃 *Girlfriend:* 'Mujhe kuch nahi chahiye' — matlab sab kuch chahiye! 😅",
    twin: "👯 *Twin:* Aap ka humshakal mil gaya! Ab dono mil kar sharartein karo! 😈",
    partner: "🤝 *Partner:* Crime mein partner ho ya chai mein — dosti pakki! ☕",
    bhai: "🧑‍🤝‍🧑 *Bhai:* Wo jo aakhri samosa cheen le, phir bhi jaan se pyaara! 🥟",
    bahan: "👭 *Bahan:* Almari se kapray churane wali, phir bhi sab se pyaari! 👗",
    wife: "👰 *Wife:* Ghar ki malika! Unki 'theek hai' ka matlab samjho to kamyab shohar! 😄",
    husband: "🤵 *Husband:* 'Haan ji, sun raha hun' — jabke dimagh match mein hota hai! 🏏",
    chacha: "🧔 *Chacha:* Har family function ki jaan! Jokes purane, maza naya! 🎤",
    chachi: "🧕 *Chachi:* Jinki biryani ka koi muqabla nahi! 🍛👌",
    nana: "👴 *Nana:* Kahaniyon ka khazana! Inki baton mein poora bachpan hai! 📖",
    nani: "👵 *Nani:* Jinke haath ke parathe duniya ki sab se bari naimat! 🫓❤️",
    mama: "🧑 *Mama:* 'Beta, mama ko bhool to nahi gaye?' — kabhi nahi mama! 🤗",
    mami: "👩‍🦰 *Mami:* Pyaar bhi, daant bhi — full package! 💝",
    bestfriend: "👯‍♂️ *Best Friend:* Wo jo tumhare raaz janta hai, phir bhi saath hai! 🔒",
    enemy: "😤 *Enemy:* Dushman bhi kehta hai — 'yaar, banda interesting hai!' 😎",
    crush: "😍 *Crush:* Dekha use to dil ne kaha — bas ab message ka wait hai! 💌",
    teacher: "👨‍🏫 *Teacher:* Jinki daant mein bhi pyaar chhupa hota hai! 📏",
    student: "🎒 *Student:* 'Sir, kal chhutti hai?' — har student ka national anthem! 🎶",
    rival: "⚔️ *Rival:* Muqabla sakht hai, lekin aap jeet ke hi rahoge! 🏆",

    // ---- roles ----
    bodyguard: "🛡️ *Bodyguard:* Aap ki hifazat ka zimma mere kandhon par! Koi parinda bhi par nahi maar sakta! 🦅",
    boss: "💼 *Boss:* 'Meeting 5 minute mein!' — aur meeting 2 ghante chalti hai! 😅",
    employee: "🧑‍💼 *Employee:* 'Sir, kaam ho gaya!' — matlab abhi shuru kiya hai! 😜",
    pet: "🐾 *Pet:* Sab se wafadar dost! Bina bole sab samajh jata hai! 🐶",
    servant: "🧹 *Servant:* Hukam karo aaka! Chai, pani ya khana — sab hazir! 🍽️",
    idol: "🌟 *Idol:* Aap ke fan duniya bhar mein! Autograph please! ✍️",
    fan: "📣 *Fan:* Aap ka sab se bara fan! Har post par like, har baat par wah! 👏",
    ghost: "👻 *Ghost:* Boo! Dar gaye na? Ghost bhi aap se dosti karna chahta hai! 😂",
    angel: "😇 *Angel:* Itne shareef ke farishte bhi notes lete hain! 📝",
    devil: "😈 *Devil:* Halki si shararat to banti hai! Lekin dil ka acha! 😜",
    king: "👑 *King:* Baadshah salamat tashreef laaye! Darbar mein khushi ki lehar! 🎺",
    queen: "👸 *Queen:* Malika-e-aaliya! Aap ke ek ishare par sab kaam ho jaye! 💎",
    slave: "⛓️ *Slave:* 'Jo hukam mere aaka!' — wafadari mein number one! 🙇",
    master: "🎩 *Master:* Ustaad-e-mohtaram! Aap se seekh kar hi to aage barhe hain! 📚",
    genius: "🧠 *Genius:* Einstein bhi aap se mashwara karta tha! (shayad) 😄",
    fool: "🤡 *Fool:* Bewaqoof nahi, dil ke saaf! Aur saaf dil walon se duniya chalti hai! 💛",
    rich: "💰 *Rich:* Paisa hi paisa! Kal kis ko treat de rahe ho? 😏",
    poor: "🫙 *Poor:* Jeb khaali, dil ameer! Yehi asli daulat hai! ❤️",

    // ---- actions (playful) ----
    cry: "😭 *Cry:* Rona dhona band karo! Ek chocolate khao, sab theek ho jayega! 🍫",
    cuddle: "🫂 *Cuddle:* Garam jhappi hazir hai! Dil halka, mood fresh! 💕",
    bully: "😤 *Bully:* Oye! Chhoton ko tang nahi karte! Pyaar se raho! 🤗",
    hug: "🤗 *Hug:* Ek zor daar jhappi aap ke naam! Feel the love! 💖",
    awoo: "🐺 *Awoo:* AWOOO! Chaand ko dekh kar aap ne dil jeet liya! 🌙",
    lick: "👅 *Lick:* Aap ne ice-cream ki tarah zindagi ko chat liya! 🍦",
    pat: "🐱 *Pat:* Sar par pyaar bhara haath — shabash, bohat acha kaam kiya! 👏",
    smug: "😏 *Smug:* Wo wali smile — 'mujhe sab pata hai' wali! 😎",
    bonk: "🔨 *Bonk:* BONK! Zyada hoshiyari nahi, samjhe? 😂",
    yeet: "🚀 *Yeet:* YEET! Saari tension ko door phenk diya! 💨",
    blush: "😊 *Blush:* Gaal laal ho gaye! Koi tareef kar gaya lagta hai! 🌸",
    handhold: "🤝 *Handhold:* Haath thaam liya! Ab saath kabhi nahi chhootega! 💞",
    highfive: "🙌 *High Five:* Chapak! Dosti ka sab se cool ishara! ✋",
    nom: "😋 *Nom:* Nom nom nom! Biryani hazam, mood garam! 🍛",
    wave: "👋 *Wave:* Hello hello! Door se hi pyaar bhej diya! 💌",
    smile: "😄 *Smile:* Muskurahat sab se khoobsurat gehna hai! Chamakti raho! ✨",
    wink: "😉 *Wink:* Aankh maar di! Raaz hamare darmiyan rahega! 🤫",
    happy: "😁 *Happy:* Khushi ke maare uchhal rahe ho! Yehi to zindagi hai! 🎉",
    glomp: "🦘 *Glomp:* Dhoom se jhappi! Sambhal ke, dil khush ho gaya! 💥",
    bite: "😬 *Bite:* Halka sa kaata! Matlab pyaar zyada hai! 🦷💕",
    poke: "👉 *Poke:* Pok pok! Dhyaan kidhar hai? Idhar dekho! 👀",
    cringe: "😖 *Cringe:* Uff, ye dekh kar to rooh kaanp gayi! 😅",
    dance: "💃 *Dance:* Nacho nacho! DJ ne beat drop kar di! 🎶🕺",
    kill: "🔫 *Kill:* Pew pew! Aap ne boriyat ko maar giraya! 😎",
    slap: "👋 *Slap:* CHATAAK! Ab hosh mein aao! 😂",
    kiss: "😘 *Kiss:* Pyaar bhara pappi! Meetha meetha! 💋",

    // ---- misc fun ----
    cgrt: "🎊 *Congrats:* Bohat bohat mubarak! Aap ne to kamal kar diya! 🥳",
    shapar: "🫳 *Shapar:* SHAPAR! Ek zor ka thappar — pyaar wala! 😂",
    bacha: "🧒 *Bacha:* Natkhat bacha! Shararton ka sartaaj, pyaar ka khazana! 🍬",
    bachi: "👧 *Bachi:* Pyaari si bachi! Gudiya jaisi muskaan, phool jaisi mehak! 🌸",
    shayari: "📜 *Shayari:*\nChai ke cup mein doobay khwab hain,\nAap ki baton mein ajeeb se jawab hain! ☕😄",
    motivate: "💪 *Motivate:*\nGirte hain shahsawar hi maidan-e-jang mein,\nKoshish karne walon ki kabhi haar nahi hoti! 🚀",

    // ---- gen-z / vibe check ----
    chad: "💪 *Chad!* Chad energy detected! Confidence level: 1000! Aap to alpha ho! 😎",
    delulu: "💭 *Delulu!* Delulu is the solulu! Khwaab dekho, poore karo — bas hadd mein! 😜",
    maincharacter: "🌟 *Main Character!* Aap apni kahani ke hero ho! Camera hamesha aap par! 🎬",
    npc: "🚶 *NPC!* Background character? Nahi! Aap to DLC wale special character ho! 🎮",
};

const DARES = [
    "Apni sab se funny selfie yahin bhejo! 📸",
    "10 baar zor se bolo: 'Main sab se best hun!' 📢",
    "Apne favourite gaane ki 2 lines gaa kar voice note bhejo! 🎤",
    "Seedhe kharay ho kar 10 jumping jacks karo! 🏃",
    "Apne best friend ko 'tum meri jaan ho' ka message bhejo! 💌",
];

const TRUTHS = [
    "Tumhara sab se bara crush kaun hai? 😳",
    "Aakhri dafa kab roye thay aur kyun? 😢",
    "Wo ek jhoot jo tum ne ami/abu se bola? 🤫",
    "Tumhari sab se ajeeb aadat kya hai? 🤪",
    "Kis cheez se tumhein sab se zyada dar lagta hai? 👻",
];

const PICK_DEFAULTS = [
    "Biryani 🍛", "Chai ☕", "Neend 😴", "Mobile 📱",
    "Dost 🤝", "Barish 🌧️", "Long drive 🚗", "Ice cream 🍦",
];

function rand(n) { return Math.floor(Math.random() * n); }

async function funroleCommand(sock, chatId, msg, trigger, q) {
    const key = String(trigger || '').toLowerCase();
    const query = String(q || '').trim();
    let text = null;

    switch (key) {
        case 'rate': {
            const score = rand(101);
            text = `⭐ *Rate:* ${query ? `"${query}"` : 'Aap'} ko milte hain *${score}/100*! ${score >= 80 ? 'Kamal! 🔥' : score >= 50 ? 'Not bad! 😊' : 'Koshish jari rakho! 💪'}`;
            break;
        }
        case 'coinflip':
            text = `🪙 *Coin Flip:* *${Math.random() < 0.5 ? 'Heads' : 'Tails'}*! ${Math.random() < 0.5 ? 'Qismat chamki! ✨' : 'Agli baar sahi! 🍀'}`;
            break;
        case 'roll':
            text = `🎲 *Dice Roll:* *${rand(6) + 1}* aaya! ${'🎲'}`;
            break;
        case 'flip':
            text = `🔄 *Flip:* Sikka uchhala... *${Math.random() < 0.5 ? 'Chit' : 'Pat'}* gira! 🪙`;
            break;
        case 'pick': {
            let options = query ? query.split(/[,|]/).map(s => s.trim()).filter(Boolean) : [];
            if (options.length < 2) options = PICK_DEFAULTS;
            text = `🎯 *Pick:* Maine chuna — *${options[rand(options.length)]}*!`;
            break;
        }
        case 'lovetest': {
            const pct = rand(101);
            const names = query || 'Aap aur aap ka crush';
            text = `💘 *Love Test:* ${names} — *${pct}%* match! ${pct >= 80 ? 'Perfect jori! 💍' : pct >= 50 ? 'Baat ban sakti hai! 😉' : 'Dosti hi behtar hai! 🤝'}`;
            break;
        }
        case 'ship': {
            const pct = rand(101);
            const names = query || 'Aap + Crush';
            text = `🚢 *Ship:* ${names} — *${pct}%* compatible! ${pct >= 75 ? 'Shaadi pakki samjho! 💒' : 'Nazar lag na jaye! 🧿'}`;
            break;
        }
        case 'compatibility': {
            const pct = rand(101);
            text = `💞 *Compatibility:* ${query || 'Aap dono'} ki compatibility *${pct}%* hai! ${pct >= 70 ? 'Dil mil gaye! ❤️' : 'Thori mehnat darkar! 💪'}`;
            break;
        }
        case 'dare':
            text = `😈 *Dare:* ${DARES[rand(DARES.length)]}`;
            break;
        case 'truth':
            text = `🤔 *Truth:* ${TRUTHS[rand(TRUTHS.length)]}`;
            break;
        case 'repeat':
            text = query ? `🔁 *Repeat:* ${query}` : '🔁 *Repeat:* Kuch likho to repeat karun! Misal: .repeat hello';
            break;
        case 'shipname': {
            const parts = query.split(/[\s,+&x]+/).filter(Boolean);
            if (parts.length >= 2) {
                const a = parts[0], b = parts[1];
                const blended = a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2));
                text = `🚢 *Ship Name:* ${a} + ${b} = *${blended}*! Kya jori hai! 💕`;
            } else {
                text = '🚢 *Ship Name:* Do naam likho! Misal: .shipname Ahmed Ayesha';
            }
            break;
        }
        default:
            text = RESPONSES[key] || null;
    }

    if (!text) return;
    try {
        await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (e) {
        console.error('Funrole command error:', e.message);
    }
}

funroleCommand.TRIGGERS = [...new Set([...Object.keys(RESPONSES), 'rate', 'coinflip', 'roll', 'flip', 'pick', 'lovetest', 'ship', 'compatibility', 'dare', 'truth', 'repeat', 'shipname'])];

module.exports = funroleCommand;
