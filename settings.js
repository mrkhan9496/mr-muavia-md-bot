module.exports = {
    giphyApiKey: process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC',

    // Owner details
    ownerNumber: process.env.OWNER_NUMBER || '923200799496',       // international format, no + or spaces
    ownerDisplayNumber: process.env.OWNER_DISPLAY_NUMBER || '03200799496', // local display format
    ownerName: process.env.OWNER_NAME || 'MR MUAVIA',

    // Bot identity
    botName: process.env.BOT_NAME || 'MR Muavia MD BOT',
    welcomeMessage: process.env.WELCOME_MESSAGE || 'welcome MUAVIA MD',

    // Branding assets
    logoUrl: process.env.LOGO_URL || 'https://raw.githubusercontent.com/mrkhan9496/mr-muavia-md-bot/main/public/logo.jpg',

    // WhatsApp channel (do not hardcode a JID here - it is resolved at runtime from this URL,
    // see lib/channel.js). Only the public invite URL belongs in config.
    channelUrl: process.env.CHANNEL_URL || 'https://whatsapp.com/channel/0029VbAYFuA7z4kXHVNHfM1Y',

    // Promotional links for the owner-only .link command (commands/promolinks.js).
    // EDIT THESE to your own links. Any link left as '' is automatically hidden.
    // Env vars (Railway Variables) override these values when set.
    promoLinks: {
        channel: process.env.PROMO_CHANNEL_LINK || 'https://whatsapp.com/channel/0029VbAYFuA7z4kXHVNHfM1Y',
        panel: process.env.PROMO_PANEL_LINK || 'https://mr-muavia-md-bot-production.up.railway.app/',
        additional: process.env.PROMO_ADDITIONAL_LINK || '',
        support: process.env.PROMO_SUPPORT_LINK || '',
    }
};
