require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadContentFromMessage, jidNormalizedUser, Browsers, delay } = require('@whiskeysockets/baileys');
const P = require('pino');
const { OpenAI } = require('openai');
const settings = require('./settings');
const { getChannelContextInfo } = require('./lib/channel');
const { autoFollowChannel, maybeReactToChannelPost } = require('./lib/channelAuto');
const { getAuthState, listDbSessionUsers, clearDbSession } = require('./lib/dbAuthState');

// Import Commands
const commands = {
    song: require('./commands/song'),
    video: require('./commands/video'),
    kick: require('./commands/kick'),
    private: require('./commands/private'),
    public: require('./commands/public'),
    owner: require('./commands/owner'),
    ai: require('./commands/ai'),
    aichat: require('./commands/aichat'),
    movie: require('./commands/movie'),
    respect: require('./commands/respect'),
    aiimage: require('./commands/aiimage'),
    antilink: require('./commands/antilink'),
    anticall: require('./commands/anticall'),
    status: require('./commands/status'),
    antidelete: require('./commands/antidelete'),
    ping: require('./commands/ping'),
    autoreacts: require('./commands/autoreacts'),
    hidetag: require('./commands/hidetag'),
    tagall: require('./commands/tagall'),
    setname: require('./commands/setname'),
    insta: require('./commands/insta'),
    tiktok: require('./commands/tiktok'),
    dp: require('./commands/dp'),
    vv: require('./commands/vv'),
    savestatus: require('./commands/savestatus'),
    statusreact: require('./commands/statusreact'),
    funtext: require('./commands/funtext'),
    funrole: require('./commands/funrole'),
    audiofx: require('./commands/audiofx'),
    aialias: require('./commands/aialias'),
    corecmds: require('./commands/core'),
    stickercmds: require('./commands/sticker'),
    modcmds: require('./commands/moderation'),
    praytime: require('./commands/praytime'),
    tts: require('./commands/tts'),
    dlalias: require('./commands/dlalias'),

    joke: require('./commands/joke'),
    meme: require('./commands/meme'),
    groupinfo: require('./commands/groupinfo'),
    gdrive: require('./commands/gdrive'),
    mf: require('./commands/mf'),
    translate: require('./commands/translate').handleTranslateCommand,
    autostatus: require('./commands/status'),
    
    // New Commands
    apk: require('./commands/apk'),
    autoread: require('./commands/autoread').autoreadCommand,

    character: require('./commands/character'),
    emojimix: require('./commands/emojimix'),
    facebook: require('./commands/facebook'),
    hack: require('./commands/hack'),
    accept: require('./commands/accept'),
    kickoffline: require('./commands/kickoffline'),
    antistatus: require('./commands/antistatus'),

    // Group-management commands
    reject: require('./commands/reject'),
    requests: require('./commands/requests'),
    active: require('./commands/active'),
    poll: require('./commands/poll'),
    mute: require('./commands/groupsettings').muteCommand,
    unmute: require('./commands/groupsettings').unmuteCommand,
    lockgc: require('./commands/groupsettings').lockgcCommand,
    unlockgc: require('./commands/groupsettings').unlockgcCommand,
    groupstatus: require('./commands/groupsettings').groupstatusCommand,
    add: require('./commands/groupmembers').addCommand,
    promote: require('./commands/groupmembers').promoteCommand,
    demote: require('./commands/groupmembers').demoteCommand,
    updategname: require('./commands/groupmeta').updateGnameCommand,
    updategdesc: require('./commands/groupmeta').updateGdescCommand,
    gcpp: require('./commands/groupmeta').gcppCommand,
    link: require('./commands/groupinvite').linkCommand,
    revoke: require('./commands/groupinvite').revokeCommand,
    join: require('./commands/groupinvite').joinCommand,
    newgc: require('./commands/groupinvite').newgcCommand,
    out: require('./commands/groupinvite').outCommand,
    end: require('./commands/groupinvite').endCommand,
    tag: require('./commands/tagextra').tagCommand,
    tagadmins: require('./commands/tagextra').tagadminsCommand,
    deleteMsg: require('./commands/tagextra').deleteMsgCommand,
    autoreply: require('./commands/autoreply'),

    // Utility & fun commands (no API key needed)
    calc: require('./commands/calc'),
    flip: require('./commands/flip'),
    roll: require('./commands/roll'),
    '8ball': require('./commands/ball8'),
    morse: require('./commands/morse'),
    qr: require('./commands/qr'),
    shorturl: require('./commands/shorturl'),
    wiki: require('./commands/wiki'),
    define: require('./commands/define'),
    github: require('./commands/github'),
    uptime: require('./commands/uptime'),
    truth: require('./commands/truth'),
    dare: require('./commands/dare'),
    riddle: require('./commands/riddle'),
    wyr: require('./commands/wyr'),
    channelstatus: require('./commands/channelstatus'),
    findchannel: require('./commands/findchannel'),
    weather: require('./commands/weather'),
    quote: require('./commands/quote'),
    trivia: require('./commands/trivia'),
    catfact: require('./commands/catfact'),
    chucknorris: require('./commands/chucknorris'),
    currency: require('./commands/currency'),
    pokemon: require('./commands/pokemon'),
    agedetect: require('./commands/agedetect'),
    genderdetect: require('./commands/genderdetect'),
    nationality: require('./commands/nationality'),
    fact: require('./commands/fact'),
    wallpaper: require('./commands/wallpaper'),
    hp: require('./commands/hp'),
    ayah: require('./commands/ayah'),
    dog: require('./commands/dog'),
    advice: require('./commands/advice'),
    yesno: require('./commands/yesno'),
    bored: require('./commands/bored')
};


const { handleAutoread } = require('./commands/autoread');
const { handleStatusUpdate } = require('./commands/autostatus');
const { storeMessage, handleMessageRevocation } = require('./commands/antidelete');
const setprefixCommand = require('./commands/setprefix');
const { islamicCommand, getSettings: getIslamicSettings } = require('./commands/islamic');
const { IslamicScheduler } = require('./lib/islamicScheduler');
const pairCommand = require('./commands/pair');
const { handleAutoReply } = require('./commands/autoreply');
const { getToken, setToken, deleteToken, verifyToken, newToken } = require('./lib/sessionTokens');


const app = express();
const server = http.createServer(app);

// Telegram Bot Setup (used only to deliver pairing codes remotely; optional feature)
const tgToken = process.env.TELEGRAM_BOT_TOKEN || '';
let tgBot = null;
if (tgToken) {
    tgBot = new TelegramBot(tgToken, { polling: true });
} else {
    console.warn('[System] TELEGRAM_BOT_TOKEN not set in .env - Telegram pairing delivery is disabled. WhatsApp pairing via the web dashboard still works.');
    // Minimal no-op stub so the rest of the code can call tgBot.sendMessage(...) safely
    // without needing to null-check it everywhere.
    tgBot = { on: () => {}, sendMessage: async () => {} };
}

tgBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        await tgBot.sendMessage(chatId, `𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 ${settings.botName.toUpperCase()}\n\n𝗘𝗡𝗧𝗘𝗥 𝗬𝗢𝗨𝗥 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗡𝗨𝗠𝗕𝗘𝗥\n(Example: 923000000000)`);
        return;
    }

    if (/^\d+$/.test(text)) {
        const userId = chatId.toString();
        if (!sessions[userId]) {
            sessions[userId] = new BotSession(userId);
        }
        
        if (!botData.statusSettings[userId]) {
            botData.statusSettings[userId] = { 
                autoStatus: false,
                autoSeen: false,
                autoLike: false,
                autoDownload: false,
                isPublic: false
            };
            saveBotData();
        }

        await tgBot.sendMessage(chatId, "⏳ Requesting Pairing Code for " + text + "...");
        sessions[userId].tgChatId = chatId;
        await sessions[userId].initialize(text);
    }
});
const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

let openai = null;
if (process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1"
        });
    } catch (e) {}
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// SECURITY: serve ONLY the public/ asset directory (logo, etc.).
// Previously the whole project root was served, which exposed index.js,
// settings.js, lib/ and data/bot_data.json (session IDs) to the internet.
app.use('/public', express.static(path.join(__dirname, 'public')));

const BOT_VERSION = require('./package.json').version || '1.0.0';
const SERVER_START_TIME = Date.now();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The connect flow (pairing code / QR entry) lives in the same single-page dashboard as '/' -
// it's just an alias so the URL matches what people expect to type/share.
app.get('/connect', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Full dashboard view - same SPA shell; the socket.io connection inside it already reports
// live per-session status. Kept as its own route per the requested site structure.
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Liveness/readiness check for Heroku and uptime monitors. Deliberately exposes nothing
// beyond "is the process up" - no keys, no session data, no logs.
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
        timestamp: new Date().toISOString()
    });
});

// Public branding/config for the dashboard. Non-sensitive only: bot name,
// owner display number, channel URL and logo path come from settings.js
// (env-overridable). Never expose secrets, API keys or session data here.
app.get('/api/config', (req, res) => {
    res.json({
        botName: settings.botName,
        ownerName: settings.ownerName,
        ownerDisplayNumber: settings.ownerDisplayNumber,
        channelUrl: settings.channelUrl,
        logoUrl: '/public/logo.jpg',
        version: BOT_VERSION
    });
});

// Aggregate, non-sensitive bot status: counts only, never numbers/JIDs/credentials/logs.
app.get('/api/status', (req, res) => {
    const activeSessions = Object.values(sessions).filter(s => s.isConnected).length;
    res.json({
        botName: settings.botName,
        version: BOT_VERSION,
        uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
        activeSessions,
        totalSessions: Object.keys(sessions).length,
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        features: {
            islamicAutoPost: true,
            aiAssistant: !!process.env.OPENAI_API_KEY,
            downloader: true,
            antiDelete: true,
            autoReply: true
        }
    });
});

const AUTH_DIR = './auth_info';
const DATA_FILE = './data/bot_data.json';
fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync('./data');

let botData = { antilinkGroups: {}, totalBots: 0, registeredBots: [], statusSettings: {}, antiDelete: {}, userNames: {}, antiCall: {}, inactiveGroups: {}, prefixSettings: {}, islamicSettings: {}, antiStatusGroups: {}, aiSettings: {}, autoReadSettings: {}, autoReplySettings: {}, aiChat: {} };
if (fs.existsSync(DATA_FILE)) {
    try { botData = fs.readJsonSync(DATA_FILE); } catch (e) {}
}
// Backfill keys that may not exist in a data file saved by an older version of the bot
if (!botData.inactiveGroups) botData.inactiveGroups = {};
if (!botData.antilinkGroups) botData.antilinkGroups = {};
if (!botData.antiStatusGroups) botData.antiStatusGroups = {};
if (!botData.prefixSettings) botData.prefixSettings = {};
if (!botData.islamicSettings) botData.islamicSettings = {};
if (!botData.antiDelete) botData.antiDelete = {};
if (!botData.aiSettings) botData.aiSettings = {};
if (!botData.autoReadSettings) botData.autoReadSettings = {};
if (!botData.autoReplySettings) botData.autoReplySettings = {};

// MIGRATION: Convert old global antilink/inactive/antiStatus to per-userId format
function migratePerUserData() {
    const legacyUserId = 'legacy_global';
    let migrated = false;
    if (botData.antilinkGroups && Object.keys(botData.antilinkGroups).some(k => k.endsWith('@g.us'))) {
        const oldData = { ...botData.antilinkGroups };
        botData.antilinkGroups = { [legacyUserId]: oldData };
        migrated = true;
    }
    if (botData.inactiveGroups && Object.keys(botData.inactiveGroups).some(k => k.endsWith('@g.us'))) {
        const oldData = { ...botData.inactiveGroups };
        botData.inactiveGroups = { [legacyUserId]: oldData };
        migrated = true;
    }
    if (botData.antiStatusGroups && Object.keys(botData.antiStatusGroups).some(k => k.endsWith('@g.us'))) {
        const oldData = { ...botData.antiStatusGroups };
        botData.antiStatusGroups = { [legacyUserId]: oldData };
        migrated = true;
    }
    if (migrated) {
        saveBotData();
        console.log('[Migration] Per-userId group settings migration completed.');
    }
}
migratePerUserData();

function saveBotData() {
    fs.writeJsonSync(DATA_FILE, botData);
}

const sessions = {}; 
const userSockets = {}; 
const messageLogs = {}; 

// Load existing sessions on startup (from auth_info/ files, plus the database
// when DATABASE_URL is set — see lib/dbAuthState.js).
async function loadExistingSessions() {
    try {
        const userIds = new Set();
        // 1) File-based sessions (Termux / hosts with a persistent filesystem)
        try {
            const authDirs = await fs.readdir(AUTH_DIR);
            for (const userId of authDirs) {
                const authPath = path.join(AUTH_DIR, userId);
                try {
                    const stats = await fs.stat(authPath);
                    if (stats.isDirectory() && fs.existsSync(path.join(authPath, 'creds.json'))) {
                        userIds.add(userId);
                    }
                } catch (e) {}
            }
        } catch (e) {}
        // 2) Database sessions (Render + DATABASE_URL, e.g. free Neon Postgres)
        for (const userId of await listDbSessionUsers()) userIds.add(userId);

        for (const userId of userIds) {
            console.log(`[System] Found existing session for: ${userId}. Initializing...`);
            if (!sessions[userId]) {
                sessions[userId] = new BotSession(userId);
                // Start initialization without a pairing number (it will use existing creds)
                sessions[userId].initialize().catch(err => {
                    console.error(`[System] Failed to auto-initialize session ${userId}:`, err.message);
                });
            }
        }
    } catch (err) {
        console.error('[System] Error loading existing sessions:', err.message);
    }
}

const toBold = (text) => {
    const boldChars = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

class BotSession {
    constructor(userId) {
        this.userId = userId;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = botData.aiSettings?.[userId] || false;
        this.autoReact = botData.statusSettings[userId]?.autoReact || false;
        this.isPublic = botData.statusSettings[userId]?.isPublic || false; 
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.userChats = {}; 
        this.lastConnectMessageTime = null;
        this.islamicScheduler = null;
    }

    getPrefix() {
        return botData.prefixSettings?.[this.userId] || '.';
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = userSockets[this.userId];
        if (socketId) io.to(socketId).emit('console', logEntry);
        console.log(`[${this.userId}] ${message}`);
    }



    sendConnectionStatus() {
        const socketId = userSockets[this.userId];
        if (socketId) {
            io.to(socketId).emit('connection-status', {
                connected: this.isConnected,
                user: this.userId
            });
        }
        io.emit('total-active', Object.values(sessions).filter(s => s.isConnected).length);
    }

    async getAIResponse(userJid, userMessage) {
        if (!openai) return "❌ AI is not configured.";
        try {
            const completion = await openai.chat.completions.create({
                model: process.env.AI_MODEL || "gpt-3.5-turbo",
                messages: [{ role: "system", content: "Helpful assistant." }, { role: "user", content: userMessage }],
                max_tokens: 150
            });
            return completion.choices[0].message.content.trim();
        } catch (error) {
            return "❌ AI Error: " + error.message;
        }
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    // Send keep-alive message once per hour (60 minutes) to own DM only
                    // This message is only sent to the bot's own number as requested
                    await this.sock.sendMessage(botNumber, { 
                        text: `${settings.botName.toUpperCase()} 𝗜𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 🚀\n\n_24/7 Active System Working..._` 
                    });
                    this.sendLog("24/7 Keep-alive message sent to own DM. ✅", "success");
                } catch (e) {
                    this.sendLog("Keep-alive failed: " + e.message, "error");
                }
            }
        }, 60 * 60 * 1000); // Once per hour
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) {
            this.sendLog("Initialization already in progress...", "info");
            return;
        }
        this.isInitializing = true;
        try {
            const { version } = await fetchLatestBaileysVersion();
            // Auth state: Postgres (DATABASE_URL) on hosts with ephemeral
            // filesystems (e.g. Render), files (auth_info/) otherwise (Termux).
            const { state, saveCreds } = await getAuthState(this.userId, this.authPath);
            
            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: P({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                markOnlineOnConnect: true,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true, // Needed for some state sync
                retryRequestDelayMs: 5000,
                maxMsgRetryCount: 5,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => {
                    if (messageLogs[key.id]) {
                        return { conversation: messageLogs[key.id].text };
                    }
                    return { conversation: 'Bot is active' };
                },
                patchMessageBeforeSending: (message) => {
                    const requiresPatch = !!(
                        message.buttonsMessage ||
                        message.templateMessage ||
                        message.listMessage
                    );
                    if (requiresPatch) {
                        return {
                            viewOnceMessage: {
                                message: {
                                    messageContextInfo: {
                                        deviceListMetadata: {},
                                        deviceListMetadataVersion: 2
                                    },
                                    ...message
                                }
                            }
                        };
                    }
                    return message;
                },

                generateHighQualityLinkPreview: true,
            });

            // Global reply branding: every text reply from any command carries
            // the bot name. Skips reactions, media messages, and anything that
            // already carries a POWERED BY line (menu, downloaders, etc.).
            const _origSendMessage = this.sock.sendMessage.bind(this.sock);
            this.sock.sendMessage = async (jid, content, options) => {
                try {
                    if (content && typeof content === 'object' && typeof content.text === 'string'
                        && !content.react && !/POWERED BY/i.test(content.text)) {
                        content = { ...content, text: content.text + '\n\n> *© POWERED BY MR MUAVIA MD BOT*' };
                    }
                } catch {}
                return _origSendMessage(jid, content, options);
            };

            if (pairingNumber && !state.creds.registered) {
                if (!this.sock.authState.creds.registered) {
                    await delay(3000);
                    try {
                        let code = await this.sock.requestPairingCode(pairingNumber);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        this.sendLog(`🔑 Pairing Code: ${code}`, 'success');
                        
                        // Send to Telegram if chat ID exists
                        if (this.tgChatId) {
                            await tgBot.sendMessage(this.tgChatId, "🔑 𝗬𝗢𝗨𝗥 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗖𝗢𝗗𝗘: " + code + "\n\n_Enter this code in your WhatsApp to connect._");
                        }

                        const socketId = userSockets[this.userId];
                        if (socketId) io.to(socketId).emit('pairing-code', code);
                    } catch (err) {
                        this.sendLog(`❌ Pairing error: ${err.message}`, 'error');
                        if (this.tgChatId) {
                            await tgBot.sendMessage(this.tgChatId, "❌ Pairing Error: " + err.message);
                        }
                    }
                }
            }

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('call', async (calls) => {
                if (botData.antiCall[this.userId]) {
                    for (const call of calls) {
                        if (call.status === 'offer') {
                            try {
                                await this.sock.rejectCall(call.id, call.from);
                                await this.sock.sendMessage(call.from, { text: "⚠️ *ANTI-CALL:* I don't accept calls. Please send a message instead." });
                            } catch (e) {}
                        }
                    }
                }
            });



            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;
                
                await Promise.all(m.messages.map(async (msg) => {
                    // Check for decryption errors
                    if (msg.messageStubType === 1 || msg.messageStubType === 2) {
                        this.sendLog('Received an undecryptable message. This might be due to a session conflict.', 'warning');
                    }

                    // Channel auto-react: if this is a post on the bot's own channel,
                    // react to it and skip the normal command pipeline.
                    try {
                        if (await maybeReactToChannelPost(this.sock, msg, (t, l) => this.sendLog(t, l))) return;
                    } catch (e) { /* never break message flow */ }

                    try {
                        const from = msg.key.remoteJid;
                        const isMe = msg.key.fromMe;
                        const isGroup = from.endsWith('@g.us');
                        const isStatus = from === 'status@broadcast';
                        
                        const messageContent = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
                        if (!messageContent) return;
                        
                        let type = Object.keys(messageContent)[0];
                        const text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();

                        // Handle Autoread, Autotyping, Autorecording
                        if (!isMe && !isStatus) {
                            await handleAutoread(this.sock, msg, botData, this.userId);
                            await storeMessage(msg, botData, this.userId);
                        }

                        if (msg.message?.protocolMessage?.type === 0) {
                            await handleMessageRevocation(this.sock, msg, botData, this.userId);
                            return;
                        }

                        const msgId = msg.key.id;
                        if (this.processedMessages.has(msgId)) return;
                        this.processedMessages.add(msgId);
                        if (this.processedMessages.size > 1000) this.processedMessages.delete(this.processedMessages.values().next().value);



                        if (!isStatus) {
                            let logEntry = { text, type };
                            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                                try {
                                    const mContent = messageContent[type];
                                    if (mContent && (mContent.directPath || mContent.url)) {
                                        const stream = await downloadContentFromMessage(mContent, type.replace('Message', ''));
                                        let buffer = Buffer.from([]);
                                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                                        logEntry.buffer = buffer;
                                    }
                                } catch (e) {}
                            }
                            logEntry.pushName = msg.pushName || 'User';
                            messageLogs[msgId] = logEntry;
                            if (Object.keys(messageLogs).length > 2000) delete messageLogs[Object.keys(messageLogs)[0]];
                        }

                        if (this.autoReact && !isMe && !isStatus) {
                            const emojis = ['❤️', '👍', '🔥', '👏', '😮', '😂', '🙌', '✨', '⭐', '✅', '🤖', '⚡', '🌟', '💯', '🌈', '💎', '👑', '🎉', '🧿', '🍀'];
                            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            try { await this.sock.sendMessage(from, { react: { text: randomEmoji, key: msg.key } }); } catch (e) {}
                        }

                        // AI Auto-Reply
                        if (this.aiEnabled && !isMe && !isStatus && !isGroup && text && !text.startsWith('.')) {
                            try {
                                const aiResponse = await this.getAIResponse(from, text);
                                await this.sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
                            } catch (e) {
                                console.error("AI Auto-Reply Error:", e);
                            }
                        }

                        // Per-chat Auto AI mode (.aion) — works in private AND group chats
                        // where explicitly enabled. Skipped for commands and own messages.
                        if (!isMe && !isStatus && text && !text.startsWith('.') && !text.startsWith(this.getPrefix())) {
                            try {
                                await commands.aichat.handleAutoAI(this.sock, msg, from, text, botData, saveBotData, this.userId, this);
                            } catch (e) {
                                console.error("Per-chat AutoAI Error:", e);
                            }
                        }

                        // Lightweight greeting Auto-Reply (Salam/Hi/Thanks/etc.) - only for plain
                        // messages that are not commands, so it never interferes with existing
                        // command processing. Skipped when AI auto-reply already handled this
                        // message (private chat, AI on) to avoid double-replying.
                        const prefixForAutoReply = this.getPrefix();
                        if (!isMe && !isStatus && text && !text.startsWith(prefixForAutoReply) &&
                            !(this.aiEnabled && !isGroup)) {
                            try {
                                await handleAutoReply(this.sock, msg, botData, this.userId, text, isMe, isStatus);
                            } catch (e) {
                                console.error("Auto-Reply Error:", e);
                            }
                        }

                        if (isStatus && !isMe) {
                            await handleStatusUpdate(this.sock, m, botData, this.userId);
                            return;
                        }

                        const botNumber = jidNormalizedUser(this.sock.user.id);
                        const sender = msg.key.participant || from;
                        const isOwner = isMe || sender.includes(botNumber.split('@')[0]);
                        let isAdmin = isOwner;
                        if (!isAdmin && isGroup) {
                            try {
                                const groupMetadata = await this.sock.groupMetadata(from);
                                const participant = groupMetadata.participants.find(p => p.id === sender);
                                isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                            } catch (e) {
                                isAdmin = false;
                            }
                        }
                        const cmd = text.toLowerCase();
                        const args = text.split(' ').slice(1);
                        const q = args.join(' ');

                        if (isGroup && botData.antiStatusGroups?.[this.userId]?.[from] && !isAdmin) {
                            const isStatus = msg.message?.protocolMessage?.type === 0 || 
                                           msg.message?.viewOnceMessage || 
                                           msg.message?.viewOnceMessageV2 ||
                                           msg.message?.viewOnceMessageV2Extension ||
                                           (text && (text.includes('whatsapp.com/channel/') || text.includes('status@broadcast')));
                            
                            // Check if it's a status share (forwarded status or status link)
                            if (msg.message?.forwardingScore > 0 || isStatus) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    return;
                                } catch (e) {}
                            }
                        }

                        if (isGroup && botData.antilinkGroups?.[this.userId]?.[from] && !isAdmin) {
                            const linkPatterns = [/chat.whatsapp.com\//i, /http:\/\//i, /https:\/\//i, /www\./i, /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i];
                            if (linkPatterns.some(pattern => pattern.test(text))) {
                                try {
                                    const mode = botData.antilinkGroups?.[this.userId]?.[from];
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (mode === 'kick') await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                } catch (e) {}
                                return;
                            }
                        }

                        if (!this.isPublic && !isOwner) return;

                        const prefix = this.getPrefix();
                        if (cmd.startsWith(prefix)) {
                            const commandName = cmd.slice(prefix.length).split(' ')[0];

                            // A group can be turned off with ".active off" - while inactive it
                            // only responds to ".active" so an admin can always turn it back on.
                            if (isGroup && botData.inactiveGroups?.[this.userId]?.[from] && commandName !== 'active') {
                                return;
                            }

                            (async () => {
                                try {
                                    switch (commandName) {
                                        case 'menu':
                                            const loadEmojis = ['⏳', '⌛', '🚀', '✨'];
                                            for (const emoji of loadEmojis) await this.sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
                                            const customName = botData.userNames[this.userId] || msg.pushName || 'User';

                                            // Menu is built as sections; owner/admin-only sections and lines
                                            // are only appended when the requester actually has that permission,
                                            // so regular users never even see commands they can't run.
                                            // Style: boxed sections with ✦ bullets (KHANTHEHACKER-style layout,
                                            // our own MR MUAVIA branding).
                                            const menuSections = [];
                                            const mSec = (title, cmds) => {
                                                const body = cmds.filter(Boolean).map(c => `┃ ✦ ${c}`).join('\n');
                                                if (!body) return;
                                                menuSections.push(
                                                    `╭━━━〔 ⚡ *${title}* 〕━━━┈⊷\n` +
                                                    body + '\n' +
                                                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷`
                                                );
                                            };

                                            mSec('ᴍᴀɪɴ', [
                                                '.menu',
                                                '.ping',
                                                '.runtime',
                                                '.uptime',
                                                '.owner',
                                            ]);

                                            mSec('ᴀɪ', [
                                                '.ai [query]',
                                                '.chatgpt',
                                                '.gpt',
                                                '.gpt5',
                                                '.gemini',
                                                '.bard',
                                                '.ask',
                                                '.bot',
                                                '.deepseek',
                                                '.copilot',
                                                '.codeai',
                                                '.felo',
                                                '.brainai',
                                                '.claudeai',
                                                '.metai',
                                                '.perplexity',
                                                '.jawad',
                                                '.dj',
                                                '.professor',
                                                '.comedy',
                                                '.studyai',
                                                '.aiimage (prompt)',
                                                '.ai on/off',
                                            ]);

                                            mSec('ᴅᴏᴡɴʟᴏᴀᴅ', [
                                                '.tiktok',
                                                '.tiktok2',
                                                '.tiktok3 (url)',
                                                '.insta',
                                                '.igdl',
                                                '.igdl2',
                                                '.igdl3 (url)',
                                                '.facebook (url)',
                                                '.song (name)',
                                                '.video (name)',
                                                '.apk (name)',
                                                '.gdrive (url)',
                                                '.mf (url)',
                                                '.movie (name)',
                                            ]);

                                            mSec('ᴀᴜᴅɪᴏ', [
                                                '.bass',
                                                '.deep',
                                                '.smooth',
                                                '.fat (reply audio)',
                                                '.slow',
                                                '.fast',
                                                '.nightcore',
                                                '.chipmunk',
                                                '.robot',
                                                '.radio',
                                                '.demon',
                                                '.baby',
                                                '.reverse',
                                                '.earrape',
                                                '.blown',
                                                '.tupai',
                                                '.tomp3',
                                                '.toptt (reply audio)',
                                                '.tts (text)',
                                            ]);

                                            mSec('ғᴜɴ ᴛᴇxᴛ', [
                                                '.ishqmeter',
                                                '.andhaishq',
                                                '.lafzmohabbat',
                                                '.pehlinazar',
                                                '.dillagi',
                                                '.khoobsurat',
                                                '.dhadkan',
                                                '.pehlaakhat',
                                                '.ziddidil',
                                                '.yaadaata',
                                                '.taubatauba',
                                                '.pehlamuhabbat',
                                                '.gulabbhejo',
                                                '.aankhein',
                                                '.shayarban',
                                                '.jaan',
                                                '.qismatwala',
                                                '.jhoothpyaar',
                                                '.nazarutarao',
                                                '.romanticbakwaas',
                                                '.dilkhol',
                                                '.tangkarna',
                                                '.smilechurao',
                                                '.mohabbatteri',
                                                '.perfectmatch',
                                                '.raazkhola',
                                                '.taqdir',
                                                '.personalitytest',
                                                '.superpower',
                                                '.pastlife',
                                                '.darksecret',
                                                '.celebmatch',
                                                '.lifebattery',
                                                '.desimom',
                                                '.desidad',
                                                '.khanajudge',
                                                '.rishtaaunt',
                                                '.shadiprediction',
                                                '.stresslevel',
                                                '.motivationalslap',
                                                '.pizzaorbiryani',
                                                '.emotionaldamage',
                                                '.pakfact',
                                                '.storygenerate',
                                                '.botroast',
                                                '.weeklyreport',
                                                '.soulcolor',
                                                '.desiwisdom',
                                                '.kindness',
                                                '.newcmds',
                                                '.compliment2',
                                                '.naammatlab',
                                                '.numbergame',
                                                '... +120 more! Try any!',
                                            ]);

                                            mSec('ɢʀᴏᴜᴘ', [
                                                '.kick (reply/number)',
                                                '.mute',
                                                '.unmute',
                                                '.tagall',
                                                '.tagadmins',
                                                '.tag',
                                                ...(isAdmin ? ['.hidetag'] : []),
                                                '.groupstatus',
                                                '.ginfo',
                                                ...(isAdmin ? ['.gcpp (reply image)', '.updategname', '.updategdesc'] : []),
                                                '.link',
                                                '.invite',
                                                ...(isAdmin ? ['.poll Q? | Opt1 | Opt2'] : []),
                                                '.accept',
                                                '.acceptall',
                                                '.active [on/off]',
                                                ...(isOwner ? ['.newgc name | numbers', '.join (link)', '.out', '.end confirm'] : []),
                                            ]);

                                            mSec('ғᴜɴ', [
                                                '.joke',
                                                '.chucknorris',
                                                '.quote',
                                                '.fact',
                                                '.catfact',
                                                '.trivia',
                                                '.weather (city)',
                                                '.currency 100 USD to PKR',
                                                '.pokemon (name)',
                                                '.age (name)',
                                                '.gender (name)',
                                                '.nationality (name)',
                                                '.wallpaper',
                                                '.hp (name)',
                                                '.ayah',
                                                '.dog',
                                                '.advice',
                                                '.yesno [sawal]',
                                                '.bored',
                                                '.meme',
                                                '.8ball (question)',
                                                '.truth',
                                                '.dare',
                                                '.riddle',
                                                '.wyr',
                                                '.character (mention)',
                                                '.dad',
                                                '.mom',
                                                '.bhai',
                                                '.bahan',
                                                '.wife',
                                                '.husband',
                                                '.bestfriend',
                                                '.enemy',
                                                '.crush',
                                                '.teacher',
                                                '.king',
                                                '.queen',
                                                '.boss',
                                                '.hero',
                                                '.angel',
                                                '.devil',
                                                '.hug',
                                                '.slap',
                                                '.kiss',
                                                '.pat',
                                                '.poke',
                                                '.dance',
                                                '.roast',
                                                '.compliment',
                                                '.lovetest',
                                                '.ship',
                                                '.pickup',
                                                '.flirt',
                                                '.shayari',
                                                '.motivate',
                                                '.emojimix (e1+e2)',
                                                '.flip',
                                                '.coinflip',
                                                '.roll [NdM]',
                                                '.dice',
                                                '.dp',
                                                '.hack',
                                            ]);

                                            mSec('ʀᴇsᴘᴇᴄᴛ', [
                                                '.respect',
                                                '.salute',
                                                '.salam',
                                                '.adab',
                                                '.jazakallah',
                                                '.shukria',
                                                '.thankyou',
                                                '.sorry',
                                                '.maafi',
                                                '.tazeem',
                                                '.izzat',
                                                '.qadr',
                                                '.ehtram',
                                                '.mashallah',
                                                '.subhanallah',
                                                '.barkatein',
                                                '.duain',
                                                '.rahmat',
                                                '.naimat',
                                                '.congratulations',
                                                '.mubarak',
                                                '.badhai',
                                                '.tahseen',
                                                '.afreen',
                                                '.wah',
                                                '.legend',
                                                '.hero',
                                                '.superstar',
                                                '.rockstar',
                                                '.champion',
                                                '.boss',
                                                '.king',
                                                '.queen',
                                                '.gem',
                                                '.diamond',
                                                '.genius',
                                                '.mentor',
                                                '.awesome',
                                                '.wonderful',
                                                '.fantastic',
                                                '.perfect',
                                                '.blessed',
                                            ]);

                                            mSec('ᴜᴛɪʟɪᴛʏ', [
                                                '.sticker (reply image)',
                                                '.attp (text)',
                                                '.alive',
                                                '.help',
                                                '.ping2',
                                                '.fetch (url)',
                                                '.praytime [city]',
                                                '.calc (expression)',
                                                '.morse (text)',
                                                '.qr (text)',
                                                '.shorturl (link)',
                                                '.tinyurl',
                                                '.wiki (topic)',
                                                '.define (word)',
                                                '.translate (text)',
                                                '.github (username)',
                                                '.channelstatus',
                                                '.findchannel (channel link)',
                                            ]);

                                            mSec('ɪsʟᴀᴍɪᴄ', [
                                                '.islamic [on/off/setup]',
                                                '.islamic status',
                                                '.islamic addgroup',
                                                '.islamic removegroup',
                                            ]);

                                            mSec('ᴘʀᴏᴛᴇᴄᴛɪᴏɴ', [
                                                '.antilink [on/off]',
                                            ]);

                                            mSec('ᴍᴏᴅᴇʀᴀᴛɪᴏɴ', [
                                                '.ban',
                                                '.unban (number)',
                                            ]);

                                            mSec('sᴇᴛᴛɪɴɢs', [
                                                '.autoreply [on/off]',
                                                '.autoreacts [on/off]',
                                                '.autoread [on/off]',
                                                '.status [seen/like]',
                                                '.save [number]',
                                                ...(isOwner ? ['.statusreact (emojis)'] : []),
                                                ...(isAdmin ? ['.setprefix (char)', '.setname (name)'] : []),
                                                '.private',
                                                '.public',
                                                ...(isOwner ? ['.pair (number)'] : []),
                                            ]);

                                            // Header box (KHANTHEHACKER-style info header, our branding)
                                            const _up = Math.floor(process.uptime());
                                            const _uh = Math.floor(_up / 3600), _um = Math.floor((_up % 3600) / 60), _us = _up % 60;
                                            const _uptimeStr = `${_uh} hours, ${_um} minutes, ${_us} seconds`;
                                            const _cmdCount = menuSections.reduce((n, s) => n + (s.match(/┃ ✦/g) || []).length, 0);
                                            const menuText =
                                                `╭━━━〔 🌟 *${settings.botName.toUpperCase()}* 🌟 〕━━━┈⊷\n` +
                                                `┃\n` +
                                                `┃ 👤 *ᴏᴡɴᴇʀ:* ${settings.ownerName}\n` +
                                                `┃ ⚙️ *ᴘʀᴇғɪx:* ${this.getPrefix()}\n` +
                                                `┃ ⏱️ *ᴜᴘᴛɪᴍᴇ:* ${_uptimeStr}\n` +
                                                `┃ 📊 *ᴄᴏᴍᴍᴀɴᴅs:* ${_cmdCount}\n` +
                                                `┃ 🛡️ *ᴍᴏᴅᴇ:* ${this.isPublic ? 'public' : 'private'}\n` +
                                                `┃ 🏷️ *ᴠᴇʀsɪᴏɴ:* 2.0.0\n` +
                                                `┃\n` +
                                                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
                                                menuSections.join('\n') + '\n\n' +
                                                `> *© POWERED BY ${settings.ownerName.toUpperCase()}*`;
                                            // Resolve the real channel JID from the invite link (never guessed) so the
                                            // "View channel" context can be attached. If it can't be resolved for any
                                            // reason, menuChannelContext is just {} and the menu still sends normally.
                                            let menuChannelContext = {};
                                            try {
                                                menuChannelContext = await getChannelContextInfo(this.sock);
                                            } catch (e) {}
                                            // Menu image: prefer the local logo file (public/logo.jpg) so it never
                                            // depends on an external image host; fall back to the remote logo URL.
                                            let menuImage = null;
                                            try {
                                                const localLogo = path.join(__dirname, 'public', 'logo.jpg');
                                                if (fs.existsSync(localLogo)) menuImage = fs.readFileSync(localLogo);
                                            } catch (e) {}
                                            try {
                                                if (menuImage) {
                                                    await this.sock.sendMessage(from, { image: menuImage, caption: menuText, ...menuChannelContext });
                                                } else {
                                                    await this.sock.sendMessage(from, { image: { url: settings.logoUrl }, caption: menuText, ...menuChannelContext });
                                                }
                                            } catch (e) {
                                                try {
                                                    await this.sock.sendMessage(from, { text: menuText, ...menuChannelContext });
                                                } catch (e2) {
                                                    // Last-resort fallback: plain text, no image, no context - bot must never crash on menu
                                                    await this.sock.sendMessage(from, { text: menuText });
                                                }
                                            }
                                            break;
                                        case 'ping': await commands.ping(this.sock, from, msg); break;
                                        case 'owner': await commands.owner(this.sock, from, msg); break;
                                        case 'ai': case 'chatgpt': case 'gemini': case 'ask': await commands.ai(this.sock, from, msg, isAdmin, this, args, botData, saveBotData); break;
                                        case 'aion': await commands.aichat.aionCommand(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId); break;
                                        case 'aioff': await commands.aichat.aioffCommand(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId); break;
                                        case 'aiclear': await commands.aichat.aiclearCommand(this.sock, from, msg, botData, saveBotData, this.userId); break;
                                        case 'antilink': await commands.antilink(this.sock, from, msg, isAdmin, botData, saveBotData, args, this.userId); break;
                                        case 'anticall': await commands.anticall(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'antidelete': await commands.antidelete(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'status': 
                                        case 'autostatus': await commands.autostatus(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'autoreacts': await commands.autoreacts(this.sock, from, msg, isAdmin, this, args, botData, saveBotData); break;
                                        case 'autoreply': await commands.autoreply(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'kick': await commands.kick(this.sock, from, msg, isAdmin, args); break;
                                        case 'private': 
                                            await commands.private(this.sock, from, msg, isAdmin, this); 
                                            if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                            botData.statusSettings[this.userId].isPublic = false;
                                            saveBotData();
                                            break;
                                        case 'public': 
                                            await commands.public(this.sock, from, msg, isAdmin, this); 
                                            if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                            botData.statusSettings[this.userId].isPublic = true;
                                            saveBotData();
                                            break;
                                        case 'hidetag': await commands.hidetag(this.sock, from, msg, isAdmin, q); break;
                                        case 'tagall': await commands.tagall(this.sock, from, msg, isAdmin, q); break;
                                        case 'setname': await commands.setname(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, q); break;
                                        case 'insta': case 'ig': await commands.insta(this.sock, from, msg, q); break;
                                        case 'tiktok': await commands.tiktok(this.sock, from, msg, q); break;
                                        case 'song': await commands.song(this.sock, from, msg); break;
                                        case 'video': await commands.video(this.sock, from, msg); break;
                                        case 'joke': await commands.joke(this.sock, from, msg); break;
                                        case 'meme': await commands.meme(this.sock, from, msg); break;
                                        case 'movie': case 'film': await commands.movie(this.sock, from, msg, q); break;
                                        case 'aiimage': case 'imagine': case 'aimage': await commands.aiimage(this.sock, from, msg, q); break;

                                        case 'ishqmeter': case 'andhaishq': case 'lafzmohabbat': case 'pehlinazar': case 'dillagi': case 'khoobsurat': case 'dhadkan': case 'pehlaakhat': case 'ziddidil': case 'yaadaata': case 'taubatauba': case 'pehlamuhabbat': case 'wafaimtihaan': case 'donokikahani': case 'gulabbhejo': case 'aankhein': case 'shayarban': case 'dushmandost': case 'tangkarna': case 'smilechurao': case 'jaan': case 'qismatwala': case 'jhoothpyaar': case 'siyaanibaat': case 'mohabbatqarz': case 'nazarutarao': case 'romanticbakwaas': case 'aashiqanaaward': case 'mohabbatteri': case 'dilkhol': case 'gussapyaar': case 'jasoos': case 'tangaphanda': case 'muftadvice': case 'nakhrebaaz': case 'anokhapyaar': case 'bhaaggaya': case 'khushnaseebi': case 'ronewala': case 'waqtguzarna': case 'chandsa': case 'dostyadildar': case 'galatfehmi': case 'perfectmatch': case 'raazkhola': case 'mohabbatdarjaa': case 'dua': case 'khwaabon': case 'akela': case 'bewafa': case 'chakkar': case 'ullubana': case 'taalibajao': case 'neendurai': case 'chatpata': case 'waitingroom': case 'taj': case 'lafangaa': case 'chocolatewala': case 'baatkaatna': case 'palat': case 'gaanasunao': case 'haaththamna': case 'chuprahna': case 'phoolonkahaar': case 'ghoordekhna': case 'bahaana': case 'tarkeeb': case 'hassichhupa': case 'mobileband': case 'pagalpancert': case 'donobaat': case 'kaanpakadna': case 'taqdir': case 'kapkapi': case 'taarifcommit': case 'captioncontest': case 'zyadasocha': case 'ghazab': case 'onlinedekhna': case 'dushmankadushman': case 'buraanamano': case 'mirrormirror': case 'mahero': case 'natkhat': case 'pareshan': case 'interview': case 'kheltamam': case 'rishtapakka': case 'pyaardukaan': case 'zabaansambhlo': case 'jhootawada': case 'sonawala': case 'gossip': case 'funnyrishtedar': case 'aankheband': case 'alvidanahi': case 'personalitytest': case 'superpower': case 'pastlife': case 'darksecret': case 'celebmatch': case 'lifebattery': case 'desimom': case 'desidad': case 'khanajudge': case 'rishtaaunt': case 'challenge': case 'friendtype': case 'pakoraweather': case 'result': case 'cricketcomm': case 'shadiprediction': case 'stresslevel': case 'motivationalslap': case 'wikifact': case 'animepersonality': case 'weathermood': case 'taunt': case 'gharkawifi': case 'lovecalc2': case 'problems': case 'mildroast': case 'wisdomcookie': case 'monsterenergy': case 'socialmedia': case 'whatanimal': case 'typingspeed': case 'nightowl': case 'pizzaorbiryani': case 'emotionaldamage': case 'complainbox': case 'numbergame': case 'coinflip': case 'naammatlab': case 'compliment2': case 'examseason': case 'pakfact': case 'storygenerate': case 'botroast': case 'weeklyreport': case 'soulcolor': case 'desiwisdom': case 'kindness': case 'newcmds': await commands.funtext(this.sock, from, msg, commandName); break;
                                        case 'character': case 'ringtone': case 'emix': case 'aura': case 'roast': case 'compliment': case 'technologia': case 'flirt': case 'runmureed': case 'marige': case 'pickup': case 'dad': case 'mom': case 'son': case 'daughter': case 'boyfriend': case 'girlfriend': case 'twin': case 'partner': case 'bhai': case 'bahan': case 'wife': case 'husband': case 'chacha': case 'chachi': case 'nana': case 'nani': case 'mama': case 'mami': case 'bestfriend': case 'enemy': case 'crush': case 'teacher': case 'student': case 'rival': case 'bodyguard': case 'boss': case 'employee': case 'pet': case 'servant': case 'idol': case 'fan': case 'ghost': case 'angel': case 'devil': case 'king': case 'queen': case 'slave': case 'master': case 'genius': case 'fool': case 'rich': case 'poor': case 'cry': case 'cuddle': case 'bully': case 'hug': case 'awoo': case 'lick': case 'pat': case 'smug': case 'bonk': case 'yeet': case 'blush': case 'handhold': case 'highfive': case 'nom': case 'wave': case 'smile': case 'wink': case 'happy': case 'glomp': case 'bite': case 'poke': case 'cringe': case 'dance': case 'kill': case 'slap': case 'kiss': case 'cgrt': case 'shapar': case 'bacha': case 'bachi': case 'shayari': case 'motivate': await commands.funrole(this.sock, from, msg, commandName, q); break;
                                        case 'deep': case 'smooth': case 'fat': case 'tupai': case 'blown': case 'radio': case 'robot': case 'chipmunk': case 'nightcore': case 'earrape': case 'bass': case 'reverse': case 'slow': case 'fast': case 'baby': case 'demon': case 'tomp3': case 'toptt': await commands.audiofx(this.sock, from, msg, commandName); break;
                                        case 'deepseek': case 'gpt5': case 'copilot': case 'codeai': case 'bot': case 'gpt': case 'felo': case 'bard': case 'brainai': case 'claudeai': case 'metai': case 'perplexity': case 'jawad': case 'dj': case 'professor': case 'comedy': case 'studyai': await commands.aialias(this.sock, from, msg, q, commandName); break;
                                        case 'alive': await commands.corecmds.alive(this.sock, from, msg); break;
                                        case 'help': await commands.corecmds.help(this.sock, from, msg); break;
                                        case 'ping2': await commands.corecmds.ping2(this.sock, from, msg); break;
                                        case 'fetch': await commands.corecmds.fetch(this.sock, from, msg, q); break;
                                        case 'sticker': await commands.stickercmds.sticker(this.sock, from, msg, q); break;
                                        case 'attp': await commands.stickercmds.attp(this.sock, from, msg, q); break;
                                        case 'ban': await commands.modcmds.ban(this.sock, from, msg, q, {isOwner}); break;
                                        case 'unban': await commands.modcmds.unban(this.sock, from, msg, q, {isOwner}); break;
                                        case 'banlist': await commands.modcmds.banlist(this.sock, from, msg, q, {isOwner}); break;
                                        case 'block': await commands.modcmds.block(this.sock, from, msg, q, {isOwner}); break;
                                        case 'unblock': await commands.modcmds.unblock(this.sock, from, msg, q, {isOwner}); break;
                                        case 'praytime': await commands.praytime(this.sock, from, msg, q); break;
                                        case 'tts': await commands.tts(this.sock, from, msg, q); break;
                                        case 'tiktok2': case 'tiktok3': case 'ttmp3': case 't': case 'igdl': case 'igdl2': case 'igdl3': case 'igmp3': case 'mp3': case 'audio': await commands.dlalias.dlAlias(this.sock, from, msg, q, commandName, commands); break;
                                        case 'statusreact': await commands.statusreact.statusreact(this.sock, from, msg, q, {botData, saveBotData, userId: this.userId, isOwner}); break;
                                        case 'save': case 'savestatus': await commands.savestatus.saveStatus(this.sock, from, msg, q, {isOwner}); break;
                                        case 'respect': case 'salute': case 'salam': case 'adab': case 'jazakallah': case 'shukria': case 'thankyou': case 'sorry': case 'maafi': case 'tazeem': case 'izzat': case 'qadr': case 'ahsan': case 'mehrbani': case 'nawaz': case 'salaam': case 'tasleem': case 'shandar': case 'zabardast': case 'kamaal': case 'lajawab': case 'mashallah': case 'subhanallah': case 'barkatein': case 'duain': case 'khidmat': case 'ehtram': case 'appreciation': case 'proud': case 'grateful': case 'karam': case 'inayat': case 'lutf': case 'mihr': case 'shafqat': case 'rahmat': case 'naimat': case 'congratulations': case 'mubarak': case 'badhai': case 'tahseen': case 'afreen': case 'wah': case 'khushi': case 'dilse': case 'legend': case 'hero': case 'superstar': case 'rockstar': case 'champion': case 'boss': case 'king': case 'queen': case 'gem': case 'diamond': case 'precious': case 'valuable': case 'deserving': case 'inspiration': case 'rolemodel': case 'mentor': case 'genius': case 'talent': case 'skillful': case 'awesome': case 'wonderful': case 'fantastic': case 'excellence': case 'perfect': case 'blessed': await commands.respect(this.sock, from, msg, commandName); break;
                                        case 'vv': await commands.vv(this.sock, from, msg); break;
                                        case 'dp': await commands.dp(this.sock, from, msg); break;
                                        case 'groupinfo': await commands.groupinfo(this.sock, from, msg); break;
                                        case 'kickoffline': await commands.kickoffline(this.sock, from, msg, isAdmin, botData, saveBotData, args); break;
                                        case 'antistatus': await commands.antistatus(this.sock, from, msg, isAdmin, botData, saveBotData, args, this.userId); break;
                                        case 'gdrive': await commands.gdrive(this.sock, from, msg, q); break;
                                        case 'mf': await commands.mf(this.sock, from, msg, q); break;
                                        case 'translate': case 'trt': await commands.translate(this.sock, from, msg, q); break;
                                        
                                        // New Command Handlers
                                        case 'apk': await commands.apk(this.sock, from, msg); break;
                                        case 'autoread': await commands.autoread(this.sock, from, msg, isOwner, botData, saveBotData, this.userId, args); break;

                                        case 'character': await commands.character(this.sock, from, msg); break;
                                        case 'emojimix': await commands.emojimix(this.sock, from, msg); break;
                                        case 'facebook': case 'fb': await commands.facebook(this.sock, from, msg); break;
                                        case 'hack': await commands.hack(this.sock, from, msg); break;
                                        case 'accept': await commands.accept(this.sock, from, msg, isAdmin, args); break;
                                        case 'acceptall': await commands.accept(this.sock, from, msg, isAdmin, []); break;
                                        case 'reject': await commands.reject(this.sock, from, msg, isAdmin, args); break;
                                        case 'rejectall': await commands.reject(this.sock, from, msg, isAdmin, []); break;
                                        case 'requests': await commands.requests(this.sock, from, msg, isAdmin); break;
                                        case 'active': await commands.active(this.sock, from, msg, isAdmin, botData, saveBotData, args, this.userId); break;
                                        case 'poll': await commands.poll(this.sock, from, msg, isAdmin, q); break;
                                        case 'mute': await commands.mute(this.sock, from, msg, isAdmin); break;
                                        case 'unmute': await commands.unmute(this.sock, from, msg, isAdmin); break;
                                        case 'lockgc': await commands.lockgc(this.sock, from, msg, isAdmin); break;
                                        case 'unlockgc': await commands.unlockgc(this.sock, from, msg, isAdmin); break;
                                        case 'groupstatus': await commands.groupstatus(this.sock, from, msg, isAdmin, botData); break;
                                        case 'add': await commands.add(this.sock, from, msg, isAdmin, args); break;
                                        case 'promote': await commands.promote(this.sock, from, msg, isAdmin, args); break;
                                        case 'demote': await commands.demote(this.sock, from, msg, isAdmin, args); break;
                                        case 'updategname': await commands.updategname(this.sock, from, msg, isAdmin, q); break;
                                        case 'updategdesc': await commands.updategdesc(this.sock, from, msg, isAdmin, q); break;
                                        case 'gcpp': await commands.gcpp(this.sock, from, msg, isAdmin); break;
                                        case 'link': case 'invite': await commands.link(this.sock, from, msg, isAdmin); break;
                                        case 'revoke': await commands.revoke(this.sock, from, msg, isAdmin); break;
                                        case 'join': await commands.join(this.sock, from, msg, isOwner, q); break;
                                        case 'newgc': await commands.newgc(this.sock, from, msg, isOwner, q); break;
                                        case 'out': await commands.out(this.sock, from, msg, isOwner); break;
                                        case 'end': await commands.end(this.sock, from, msg, isOwner, q); break;
                                        case 'tag': await commands.tag(this.sock, from, msg, isAdmin, q); break;
                                        case 'tagadmins': await commands.tagadmins(this.sock, from, msg, isAdmin, q); break;
                                        case 'delete': await commands.deleteMsg(this.sock, from, msg, isAdmin); break;
                                        case 'ginfo': await commands.groupinfo(this.sock, from, msg); break;
                                        // Utility & fun commands
                                        case 'calc': case 'calculator': await commands.calc(this.sock, from, msg, q); break;
                                        case 'flip': case 'coinflip': await commands.flip(this.sock, from, msg); break;
                                        case 'roll': case 'dice': await commands.roll(this.sock, from, msg, q); break;
                                        case '8ball': await commands['8ball'](this.sock, from, msg, q); break;
                                        case 'morse': await commands.morse(this.sock, from, msg, q); break;
                                        case 'qr': case 'qrcode': await commands.qr(this.sock, from, msg, q); break;
                                        case 'shorturl': case 'tinyurl': await commands.shorturl(this.sock, from, msg, q); break;
                                        case 'wiki': case 'wikipedia': await commands.wiki(this.sock, from, msg, q); break;
                                        case 'define': case 'dictionary': case 'meaning': await commands.define(this.sock, from, msg, q); break;
                                        case 'github': case 'gh': await commands.github(this.sock, from, msg, q); break;
                                        case 'uptime': case 'runtime': await commands.uptime(this.sock, from, msg); break;
                                        case 'truth': await commands.truth(this.sock, from, msg); break;
                                        case 'dare': await commands.dare(this.sock, from, msg); break;
                                        case 'riddle': await commands.riddle(this.sock, from, msg); break;
                                        case 'wyr': case 'wouldyourather': await commands.wyr(this.sock, from, msg); break;
                                        case 'channelstatus': case 'chstatus': await commands.channelstatus(this.sock, from, msg); break;
                                        case 'findchannel': await commands.findchannel(this.sock, from, msg, q); break;
                                        case 'weather': await commands.weather(this.sock, from, msg, q); break;
                                        case 'quote': await commands.quote(this.sock, from, msg); break;
                                        case 'trivia': await commands.trivia(this.sock, from, msg); break;
                                        case 'catfact': await commands.catfact(this.sock, from, msg); break;
                                        case 'chucknorris': case 'chuck': await commands.chucknorris(this.sock, from, msg); break;
                                        case 'currency': case 'rate': await commands.currency(this.sock, from, msg, q); break;
                                        case 'pokemon': await commands.pokemon(this.sock, from, msg, q); break;
                                        case 'age': await commands.agedetect(this.sock, from, msg, q); break;
                                        case 'gender': await commands.genderdetect(this.sock, from, msg, q); break;
                                        case 'nationality': await commands.nationality(this.sock, from, msg, q); break;
                                        case 'fact': await commands.fact(this.sock, from, msg); break;
                                        case 'wallpaper': await commands.wallpaper(this.sock, from, msg); break;
                                        case 'hp': await commands.hp(this.sock, from, msg, q); break;
                                        case 'ayah': await commands.ayah(this.sock, from, msg); break;
                                        case 'dog': await commands.dog(this.sock, from, msg); break;
                                        case 'advice': await commands.advice(this.sock, from, msg); break;
                                        case 'yesno': await commands.yesno(this.sock, from, msg, q); break;
                                        case 'bored': await commands.bored(this.sock, from, msg); break;
                                        case 'pair': await pairCommand(this.sock, from, msg, isOwner, args, sessions, BotSession); break;
                                        case 'setprefix': await setprefixCommand(this.sock, from, msg, isAdmin, botData, saveBotData, this.userId, args); break;
                                        case 'islamic': case 'islamicstatus': case 'islamictest':
                                            await islamicCommand(this.sock, from, msg, isAdmin, isOwner, botData, saveBotData, this.userId, args, q, this);
                                            break;
                                    }
                                } catch (e) {
                                    this.sendLog(`Command error (${commandName}): ` + e.message, 'error');
                                }
                            })();
                        }
                    } catch (e) {
                        console.error('Message Processing Error:', e);
                    }
                }));
            });

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    const socketId = userSockets[this.userId];
                    if (socketId) io.to(socketId).emit('qr', qr);
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    this.isConnected = false;
                    this.isInitializing = false;
                    this.sendLog(`Connection closed. Reconnecting: ${shouldReconnect}`, 'warning');
                    this.sendConnectionStatus();
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;
                    
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        this.sendLog('Session expired or logged out. Clearing auth data to allow fresh pairing...', 'error');
                        try {
                            await clearDbSession(this.userId);
                            if (fs.existsSync(this.authPath)) {
                                // Keep a backup just in case, but clear the current one
                                const backupPath = `${this.authPath}_backup_${Date.now()}`;
                                fs.moveSync(this.authPath, backupPath);
                                this.sendLog(`Corrupted session backed up to ${backupPath}`, 'info');
                            }
                        } catch (e) {
                            if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath);
                        }
                        delete sessions[this.userId];
                        this.sendConnectionStatus();
                    } else if (statusCode === DisconnectReason.restartRequired || statusCode === DisconnectReason.connectionLost || statusCode === 428) {
                        this.sendLog(`Connection issue (${statusCode}). Restarting in 3s...`, 'warning');
                        setTimeout(() => this.initialize(), 3000);
                    } else if (statusCode === 515) {
                        this.sendLog('Stream error. Reconnecting immediately...', 'warning');
                        this.initialize();
                    } else {
                        this.sendLog(`Connection closed (${statusCode}). Reconnecting in 5s...`, 'info');
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.isInitializing = false;
                    this.sendLog('Connected successfully! ✅', 'success');
                    this.sendConnectionStatus();
                    this.startActiveCheck();

                    // Start Islamic scheduler if enabled
                    const isSettings = getIslamicSettings(botData, this.userId);
                    if (isSettings.enabled) {
                        if (this.islamicScheduler) this.islamicScheduler.stop();
                        this.islamicScheduler = new IslamicScheduler(this.userId, this.sock, () => getIslamicSettings(botData, this.userId));
                        this.islamicScheduler.start();
                    }

                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    const botName = botData.userNames[this.userId] || (this.sock.user && this.sock.user.name) || this.userId;
                    
                    if (this.tgChatId) {
                        await tgBot.sendMessage(this.tgChatId, "✅ 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬!\n\nYour bot is now active.");
                    }

                    // Bot online report removed as per user request to avoid spam in groups
                    // Only internal logs will show connection status
                    this.sendLog(`Bot ${botName} is online.`, 'success');

                    
                    setTimeout(async () => {
                        try {
                            await this.sock.query({
                                tag: 'iq',
                                attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                                content: [{ tag: 'status', attrs: {}, content: Buffer.from(`IM USING BEST BOT ${settings.botName.toUpperCase()}`, 'utf-8') }]
                            });
                            this.sendLog("Bio updated successfully! ✅", "success");
                        } catch (e) {
                            this.sendLog("Bio update failed: " + e.message, "error");
                        }
                    }, 5000);

                    // Only send connection message if it's the first connection or a significant reconnect
                    if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                        try {
                            const caption =
`━━━━━━━━━━━━━━━━━━━━━
🎭 M̷R̷ ̷M̷U̷A̷V̷I̷A̷ ̷M̷D̷ ̷B̷O̷T 🎭
━━━━━━━━━━━━━━━━━━━━━

✅ *Successfully Connected!*

🤖 Your WhatsApp bot is now *online* and ready to use.

📋 Type *.menu* to see all commands.
⚡ Enjoy the fastest MD bot experience!

> ━━━ Powered by MR MUAVIA ━━━`;
                            const logoPath = path.join(__dirname, 'public', 'logo.jpg');
                            if (fs.existsSync(logoPath)) {
                                await this.sock.sendMessage(botNumber, { image: fs.readFileSync(logoPath), caption });
                            } else {
                                await this.sock.sendMessage(botNumber, { text: caption });
                            }
                            this.lastConnectMessageTime = Date.now();
                        } catch (e) {
                            this.sendLog('Connect message failed: ' + e.message, 'error');
                        }
                    }

                    // Auto-follow the bot's own WhatsApp channel on every connect
                    autoFollowChannel(this.sock, (t, l) => this.sendLog(t, l)).catch(() => {});
                }
            });

        } catch (err) {
            this.isInitializing = false;
            this.sendLog(`Initialization failed: ${err.message}. Retrying in 10s...`, 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }
}

io.on('connection', (socket) => {
    // SECURITY: userId arrives from the client and is used to build filesystem
    // paths (auth_info/<userId>) and to key sessions. Never trust it raw —
    // allow only a safe charset so a malicious client cannot escape the auth
    // directory (path traversal) or pollute the session map.
    const sanitizeUserId = (raw) => {
        const s = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        return s.length >= 3 ? s : null;
    };

    // Payloads may arrive as the legacy plain string or as { userId, number, token }.
    const normalizePayload = (p) => {
        if (typeof p === 'string') return { userId: p };
        if (p && typeof p === 'object') return { userId: p.userId, number: p.number, token: p.token };
        return {};
    };

    // Ownership check: every management action must present the owner token
    // that was issued when this userId was paired. Returns the sanitized
    // userId on success, null otherwise.
    const authorize = async (rawId, token) => {
        const userId = sanitizeUserId(rawId);
        if (!userId) return null;
        const ok = await verifyToken(userId, token);
        return ok ? userId : null;
    };
    const authDenied = (msg) => {
        socket.emit('auth-error', { message: msg + ' Please pair again from this browser to manage your session.' });
    };

    socket.on('set-user', async (payload) => {
        const { userId: rawId, token } = normalizePayload(payload);
        const userId = await authorize(rawId, token);
        if (!userId) { authDenied('This session is not linked to this browser.'); return; }
        userSockets[userId] = socket.id;
        if (!sessions[userId]) sessions[userId] = new BotSession(userId);
        sessions[userId].sendConnectionStatus();
    });

    socket.on('pair-request', async (payload) => {
        const { userId: rawId, number, token } = normalizePayload(payload);
        const userId = sanitizeUserId(rawId);
        if (!userId) return;
        const digits = String(number || '').replace(/\D/g, '');
        if (!digits) return;

        // An already-CONNECTED session can only be touched by its owner.
        // Without a valid token we refuse — otherwise anyone who knows (or
        // guesses) a number could hijack or disturb someone else's session.
        if (sessions[userId] && sessions[userId].isConnected) {
            const authed = await authorize(userId, token);
            if (!authed) { authDenied('This WhatsApp number is already connected from another browser.'); return; }
            sessions[userId].sendConnectionStatus();
            return;
        }

        // New (or disconnected) pairing: the owner token is issued now and the
        // browser stores it. Proof of number ownership happens when the pairing
        // code is entered inside the real WhatsApp app — only the number's
        // owner can do that, so issuing the token here is safe.
        const ownerToken = newToken();
        await setToken(userId, ownerToken);
        socket.emit('pairing-token', { userId, token: ownerToken });
        userSockets[userId] = socket.id;

        if (!sessions[userId]) {
            if (!botData.statusSettings[userId]) {
                // By default all commands are off as per user request
                botData.statusSettings[userId] = {
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: false
                };
                saveBotData();
            }
            sessions[userId] = new BotSession(userId);
        }
        await sessions[userId].initialize(digits);
    });

    socket.on('logout', async (payload) => {
        // CRITICAL: logout used to accept any userId with no proof of
        // ownership, so any visitor could disconnect anyone else's WhatsApp.
        // Now the owner token is mandatory.
        const { userId: rawId, token } = normalizePayload(payload);
        const userId = await authorize(rawId, token);
        if (!userId) { authDenied('Logout not authorized for this session.'); return; }
        if (sessions[userId]) {
            if (sessions[userId].sock) {
                try { await sessions[userId].sock.logout(); } catch (e) {}
            }
            await clearDbSession(userId);
            await deleteToken(userId);
            const authPath = path.join(AUTH_DIR, userId);
            if (fs.existsSync(authPath)) fs.removeSync(authPath);
            delete sessions[userId];
            io.emit('total-active', Object.values(sessions).filter(s => s.isConnected).length);
            const socketId = userSockets[userId];
            if (socketId) io.to(socketId).emit('connection-status', { connected: false, user: userId });
        }
    });

    socket.on('disconnect', () => {
        for (const userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-load sessions (files on Termux, database on Render — see lib/dbAuthState.js).
    // No SESSION_ID copy-paste needed: users pair once via pairing code and the
    // session persists in the database across restarts.
    loadExistingSessions();
    
    // Anti-Sleep Mechanism
    const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
    if (APP_URL) {
        setInterval(async () => {
            try {
                await axios.get(APP_URL);
                console.log("Anti-Sleep Ping: Server is active. ⚡");
            } catch (e) {
                console.log("Anti-Sleep Ping: " + e.message);
            }
        }, 5 * 60 * 1000); // Ping every 5 minutes
    }
});
