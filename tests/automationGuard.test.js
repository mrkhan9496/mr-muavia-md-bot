/**
 * Tests for lib/automationGuard.js — run with: node tests/automationGuard.test.js
 * No network, no WhatsApp, no real groups. Pure logic tests.
 */
'use strict';
const assert = require('assert');
const g = require('../lib/automationGuard');

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' — ' + e.message); }
}

console.log('automationGuard tests:');

// 1. Kill switch via botData flag
t('emergency flag blocks automation', () => {
    const botData = {};
    assert.strictEqual(g.isAutomationKilled(botData), false);
    g.setEmergencyStop(botData, true);
    assert.strictEqual(g.isAutomationKilled(botData), true);
    g.setEmergencyStop(botData, false);
    assert.strictEqual(g.isAutomationKilled(botData), false);
});

// 2. Kill switch via env var
t('EMERGENCY_STOP=1 env forces kill', () => {
    process.env.EMERGENCY_STOP = '1';
    assert.strictEqual(g.isAutomationKilled({}), true);
    delete process.env.EMERGENCY_STOP;
    assert.strictEqual(g.isAutomationKilled({}), false);
});

// 3. Cross-session registry
t('bot sender detected after register', () => {
    g.registerBotNumber('923001234567@s.whatsapp.net');
    assert.strictEqual(g.isBotSender('923001234567@s.whatsapp.net'), true);
    assert.strictEqual(g.isBotSender('923009999999@s.whatsapp.net'), false);
    // LID-style suffix handled
    assert.strictEqual(g.isBotSender('923001234567:12@s.whatsapp.net'), true);
    g.unregisterBotNumber('923001234567@s.whatsapp.net');
    assert.strictEqual(g.isBotSender('923001234567@s.whatsapp.net'), false);
});

// 4. Rate limit: 30/min allowed, 31st blocked
t('rate limiter blocks bursts', () => {
    const uid = 'test-user-' + Date.now();
    for (let i = 0; i < 30; i++) assert.strictEqual(g.checkRateLimit(uid), true, 'action ' + i);
    assert.strictEqual(g.checkRateLimit(uid), false, '31st must be blocked');
});

// 5. Dedup: same msgId twice
t('dedup blocks reprocessing', () => {
    const uid = 'dedup-user-' + Date.now();
    assert.strictEqual(g.alreadyProcessed(uid, 'MSG123'), false);
    assert.strictEqual(g.alreadyProcessed(uid, 'MSG123'), true);
    assert.strictEqual(g.alreadyProcessed(uid, 'MSG456'), false);
});

// 6. Master gate: kill switch wins
t('gate blocks when killed', () => {
    const r = g.automationGate({ botData: { emergencyStop: true }, userId: 'u1', msgId: 'm1', senderJid: '999@s.whatsapp.net' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'emergency-stop');
});

// 7. Master gate: bot sender skipped
t('gate skips other bot sessions', () => {
    g.registerBotNumber('923001111111@s.whatsapp.net');
    const r = g.automationGate({ botData: {}, userId: 'u1', msgId: 'm2', senderJid: '923001111111@s.whatsapp.net' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'bot-sender');
    g.unregisterBotNumber('923001111111@s.whatsapp.net');
});

// 8. Master gate: normal user passes
t('gate allows normal user message', () => {
    const r = g.automationGate({ botData: {}, userId: 'u2', msgId: 'm3-' + Date.now(), senderJid: '923002222222@s.whatsapp.net' });
    assert.strictEqual(r.ok, true);
});

// 9. Reaction-loop scenario: 3 sessions, reaction storm
t('reaction storm contained: reactions never re-trigger', () => {
    // Simulate: session A reacts -> B sees reaction -> must SKIP (bot-sender)
    g.registerBotNumber('923001111111@s.whatsapp.net');
    g.registerBotNumber('923002222222@s.whatsapp.net');
    const reactionFromA = g.automationGate({
        botData: {}, userId: 'uid-B', msgId: 'react-1', senderJid: '923001111111@s.whatsapp.net'
    });
    assert.strictEqual(reactionFromA.ok, false, 'session B must not act on session A event');
    assert.strictEqual(reactionFromA.reason, 'bot-sender');
    g.unregisterBotNumber('923001111111@s.whatsapp.net');
    g.unregisterBotNumber('923002222222@s.whatsapp.net');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
