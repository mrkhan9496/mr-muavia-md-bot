/**
 * AI model aliases — all route to the main AI engine (KHANTHEHACKER-style AI section).
 * Triggers: deepseek, gpt5, copilot, codeai, bot, gpt, felo, bard, brainai,
 *            claudeai, metai, perplexity, jawad, dj, professor, comedy, studyai
 */
const apiManager = require('../lib/apiManager');

const LABELS = {
    deepseek: '🔍 DeepSeek', gpt5: '🧠 GPT-5', copilot: '💻 Copilot',
    codeai: '⌨️ CodeAI', bot: '🤖 Bot', gpt: '🧠 GPT',
    felo: '🔎 Felo', bard: '📝 Bard', brainai: '🧠 BrainAI',
    claudeai: '🤖 ClaudeAI', metai: 'Ⓜ️ MetaAI', perplexity: '🔮 Perplexity',
    jawad: '👨‍💻 JawadAI', dj: '🎧 DJ', professor: '🎓 Professor',
    comedy: '😂 ComedyAI', studyai: '📚 StudyAI'
};

async function aiAliasCommand(sock, chatId, msg, q, trigger) {
    const label = LABELS[trigger] || '🤖 AI';
    const prompt = (q || '').trim();
    if (!prompt) {
        await sock.sendMessage(chatId, { text: `❌ Sawal likho!\nExample: .${trigger} Pakistan ki capital kya hai?` }, { quoted: msg });
        return;
    }
    try {
        await sock.sendMessage(chatId, { react: { text: '⌛', key: msg.key } });
        const res = await apiManager.ai(prompt);
        const answer = res.text || res;
        await sock.sendMessage(chatId, { text: `${label}\n\n${answer}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ AI jawab nahi de saka, dobara try karo.' }, { quoted: msg });
    }
}

module.exports = aiAliasCommand;
module.exports.TRIGGERS = Object.keys(LABELS);
