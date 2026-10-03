/**
 * AI model aliases (batch 2) — all route to the main AI engine via apiManager.ai.
 * Every alias takes the user's question and gets a real answer from the AI backend;
 * no hardcoded or faked responses.
 * Triggers: 136 model-name aliases (see LABELS keys).
 */
const apiManager = require('../lib/apiManager');

const LABELS = {
    ai21: '🤖 AI21', alpaca: '🦙 Alpaca', apex: '🔺 Apex',
    assistant: '🤖 Assistant', bloom: '🌸 BLOOM', bloomz: '🌸 BLOOMZ',
    brain: '🧠 Brain', chatgpt35: '🧠 ChatGPT 3.5', chatgpt4: '🧠 ChatGPT 4',
    chatgpt4o: '🧠 ChatGPT 4o', chatgpt4turbo: '🧠 ChatGPT 4 Turbo',
    chatgptelite: '🧠 ChatGPT Elite', chatgptplus: '🧠 ChatGPT Plus',
    claude: '🤖 Claude', claude1: '🤖 Claude 1', claude2: '🤖 Claude 2',
    claude3: '🤖 Claude 3', claude35: '🤖 Claude 3.5',
    claude35haiku: '🤖 Claude 3.5 Haiku', claude35sonnet: '🤖 Claude 3.5 Sonnet',
    claude37: '🤖 Claude 3.7', claude37sonnet: '🤖 Claude 3.7 Sonnet',
    claude3haiku: '🤖 Claude 3 Haiku', claude3opus: '🤖 Claude 3 Opus',
    claude3sonnet: '🤖 Claude 3 Sonnet', claude4: '🤖 Claude 4',
    claude4opus: '🤖 Claude 4 Opus', claude4sonnet: '🤖 Claude 4 Sonnet',
    claudehaiku: '🤖 Claude Haiku', claudeinstant: '🤖 Claude Instant',
    claudeopus: '🤖 Claude Opus', claudesonnet: '🤖 Claude Sonnet',
    codegen: '⌨️ CodeGen', codet5: '⌨️ CodeT5', codex: '⌨️ Codex',
    command: '🤖 Command', deepseekchat: '🔍 DeepSeek Chat',
    deepseekcoder: '🔍 DeepSeek Coder', deepseekcoder2: '🔍 DeepSeek Coder 2',
    deepseekllm: '🔍 DeepSeek LLM', deepseekmath: '🔍 DeepSeek Math',
    deepseekr1: '🔍 DeepSeek R1', deepseekv2: '🔍 DeepSeek V2',
    deepseekv3: '🔍 DeepSeek V3', deepseekvl: '🔍 DeepSeek VL',
    dolly: '🤖 Dolly', elite: '⭐ Elite', elitecopilot: '💻 EliteCopilot',
    elitegpt: '🧠 EliteGPT', falcon: '🦅 Falcon', flant5: '🤖 Flan-T5',
    gemini15: '✨ Gemini 1.5', gemini15flash: '✨ Gemini 1.5 Flash',
    gemini15pro: '✨ Gemini 1.5 Pro', gemini20: '✨ Gemini 2.0',
    gemini20flash: '✨ Gemini 2.0 Flash', gemini25: '✨ Gemini 2.5',
    gemini25flash: '✨ Gemini 2.5 Flash', gemini25pro: '✨ Gemini 2.5 Pro',
    gemininano: '✨ Gemini Nano', geminipro: '✨ Gemini Pro',
    geminiultra: '✨ Gemini Ultra', gpt3: '🧠 GPT-3',
    gpt35turbo: '🧠 GPT-3.5 Turbo', gpt4: '🧠 GPT-4', gpt4all: '🧠 GPT4All',
    gpt4o: '🧠 GPT-4o', gpt4omini: '🧠 GPT-4o mini', gpt4turbo: '🧠 GPT-4 Turbo',
    gpt4vision: '🧠 GPT-4 Vision', gpt5mini: '🧠 GPT-5 mini', gptj: '🧠 GPT-J',
    gptneo: '🧠 GPT-Neo', grammar: '✍️ Grammar', grok: '✖️ Grok',
    grok1: '✖️ Grok 1', grok15: '✖️ Grok 1.5', grok2: '✖️ Grok 2',
    grok2mini: '✖️ Grok 2 mini', grok3: '✖️ Grok 3', grok3mini: '✖️ Grok 3 mini',
    grok4: '✖️ Grok 4', grokbeta: '✖️ Grok Beta', grokvision: '✖️ Grok Vision',
    hugging: '🤗 Hugging', jurassic: '🦕 Jurassic', kimi: '🌙 Kimi',
    llama2: '🦙 LLaMA 2', llama3: '🦙 LLaMA 3', lumin: '💡 Lumin',
    mathgpt: '🔢 MathGPT', maxai: '⚡ MaxAI', mistral: '🌬️ Mistral',
    mixtral: '🌬️ Mixtral', mscopilot: '💻 MSCopilot', neo: '🤖 Neo',
    nova: '🌟 Nova', o1: '🧠 o1', o1mini: '🧠 o1-mini',
    o1preview: '🧠 o1-preview', o3: '🧠 o3', o3mini: '🧠 o3-mini',
    o4: '🧠 o4', omega: 'Ω Omega', openassist: '🤖 OpenAssist',
    orca: '🐋 Orca', palm: '🌴 PaLM', palm2: '🌴 PaLM 2', phi2: '🤖 Phi-2',
    proai: '⭐ ProAI', pulse: '💓 Pulse', quantum: '⚛️ Quantum',
    qwen: '🌊 Qwen', qwen15: '🌊 Qwen 1.5', qwen2: '🌊 Qwen 2',
    qwen25: '🌊 Qwen 2.5', qwen3: '🌊 Qwen 3', qwencoder: '🌊 Qwen Coder',
    qwenmath: '🌊 Qwen Math', qwenmax: '🌊 Qwen Max', qwenplus: '🌊 Qwen Plus',
    qwenturbo: '🌊 Qwen Turbo', qwenvl: '🌊 Qwen VL', redpajama: '🤖 RedPajama',
    smart: '🧠 Smart', solar: '☀️ Solar', starcoder: '⭐ StarCoder',
    starlin: '⭐ Starlin', talkai: '💬 TalkAI', ultra: '⚡ Ultra',
    vertex: '🔷 Vertex', vicuna: '🤖 Vicuna', wizard: '🧙 Wizard',
    yi: '🤖 Yi', yi34b: '🤖 Yi 34B', zenith: '🌟 Zenith'
};

async function aiAlias2Command(sock, chatId, msg, q, trigger) {
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

module.exports = aiAlias2Command;
module.exports.TRIGGERS = Object.keys(LABELS);
