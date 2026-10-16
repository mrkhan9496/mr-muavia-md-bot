/**
 * automationGuard.js — permanent safeguards against automated message floods.
 *
 * Created 2026-10-16 after a critical production incident: 3 bot sessions in
 * one WhatsApp group reacted to each other's reactions in an infinite loop,
 * flooding the group with empty bubbles until members started leaving.
 *
 * Provides:
 *  1. EMERGENCY KILL SWITCH — `isAutomationKilled(botData)` returns true when
 *     process.env.EMERGENCY_STOP === '1' OR botData.emergencyStop === true.
 *     When killed, ALL automated outbound actions (auto-react, auto-reply,
 *     AutoAI, view-once auto-forward, channel auto-react) must stop.
 *     Owner command: .emergency on|off
 *  2. CROSS-SESSION SENDER REGISTRY — every connected session registers its
 *     own WhatsApp number here. Auto-features must skip messages whose sender
 *     is a known bot session, so sessions can never trigger each other.
 *  3. PER-SESSION RATE LIMIT — bounds automated outbound actions per session
 *     (default 30/min). A burst beyond the limit is dropped + logged, so even
 *     an unforeseen loop cannot flood a chat.
 *  4. DEDUP — remembers recently auto-processed message IDs per session so
 *     one incoming event is never actioned twice.
 */

'use strict';

// ---- 1. Emergency kill switch ---------------------------------------------
function isAutomationKilled(botData) {
    if (process.env.EMERGENCY_STOP === '1') return true;
    try { return botData && botData.emergencyStop === true; } catch { return false; }
}

function setEmergencyStop(botData, on) {
    if (!botData) return false;
    botData.emergencyStop = !!on;
    return true;
}

// ---- 2. Cross-session sender registry --------------------------------------
// Stores normalized bare numbers (e.g. "923001234567") of every connected
// bot session in this process.
const botNumbers = new Set();

function normalizeNumber(jidOrNumber) {
    return String(jidOrNumber || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function registerBotNumber(jidOrNumber) {
    const n = normalizeNumber(jidOrNumber);
    if (n) botNumbers.add(n);
}

function unregisterBotNumber(jidOrNumber) {
    botNumbers.delete(normalizeNumber(jidOrNumber));
}

/** True if this sender JID belongs to one of OUR bot sessions. */
function isBotSender(jid) {
    const n = normalizeNumber(jid);
    return !!n && botNumbers.has(n);
}

// ---- 3. Per-session rate limiter --------------------------------------------
// Sliding window: max ACTIONS_PER_WINDOW automated actions per WINDOW_MS.
const WINDOW_MS = 60 * 1000;
const ACTIONS_PER_WINDOW = 30;
const windows = new Map(); // userId -> array of timestamps

function checkRateLimit(userId) {
    const now = Date.now();
    let arr = windows.get(userId);
    if (!arr) { arr = []; windows.set(userId, arr); }
    while (arr.length && now - arr[0] > WINDOW_MS) arr.shift();
    if (arr.length >= ACTIONS_PER_WINDOW) return false; // over limit: drop
    arr.push(now);
    return true;
}

// ---- 4. Dedup ----------------------------------------------------------------
const DEDUP_MS = 5 * 60 * 1000;
const seen = new Map(); // userId -> Map<msgId, timestamp>

function alreadyProcessed(userId, msgId) {
    if (!msgId) return false;
    let m = seen.get(userId);
    if (!m) { m = new Map(); seen.set(userId, m); }
    const now = Date.now();
    if (m.has(msgId)) return true;
    m.set(msgId, now);
    // opportunistic cleanup
    if (m.size > 2000) {
        for (const [k, t] of m) { if (now - t > DEDUP_MS) m.delete(k); }
    }
    return false;
}

/**
 * Master gate for automated (non-command) outbound actions.
 * Returns { ok: true } or { ok: false, reason }.
 */
function automationGate({ botData, userId, msgId, senderJid }) {
    if (isAutomationKilled(botData)) return { ok: false, reason: 'emergency-stop' };
    if (senderJid && isBotSender(senderJid)) return { ok: false, reason: 'bot-sender' };
    if (msgId && alreadyProcessed(userId, msgId)) return { ok: false, reason: 'duplicate' };
    if (!checkRateLimit(userId)) return { ok: false, reason: 'rate-limit' };
    return { ok: true };
}

module.exports = {
    isAutomationKilled,
    setEmergencyStop,
    registerBotNumber,
    unregisterBotNumber,
    isBotSender,
    normalizeNumber,
    checkRateLimit,
    alreadyProcessed,
    automationGate,
    // exposed for tests
    _botNumbers: botNumbers,
};
