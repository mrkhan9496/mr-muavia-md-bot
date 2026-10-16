/**
 * viewOnceStore.js — View-once media storage (2026-10-16)
 *
 * Dusre bots ki tarah: view-once ATAY HI download karke STORE karo,
 * taake kholne ke BAAD bhi .vv se copy mil jaye!
 *
 * Storage: in-memory, per-chat last 5, 12 hours expiry, 50MB total cap.
 * (Heroku RAM limit ka khayal)
 */
'use strict';

const MAX_PER_CHAT = 5;
const EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB

// chatId -> [{ buffer, type, sender, timestamp, msgId, size }]
const store = new Map();
let totalBytes = 0;

function cleanup() {
    const now = Date.now();
    for (const [chatId, arr] of store) {
        const fresh = arr.filter(e => now - e.timestamp < EXPIRY_MS);
        // Remove expired bytes from total
        for (const e of arr) {
            if (now - e.timestamp >= EXPIRY_MS) totalBytes -= e.size;
        }
        if (fresh.length) store.set(chatId, fresh);
        else store.delete(chatId);
    }
}

function put(chatId, { buffer, type, sender, msgId }) {
    if (!buffer || !buffer.length) return;
    cleanup();

    const size = buffer.length;
    // Agar total cap exceed ho to sab se purana hatao
    while (totalBytes + size > MAX_TOTAL_BYTES && store.size) {
        let oldestChat = null, oldestTime = Infinity;
        for (const [cid, arr] of store) {
            if (arr.length && arr[0].timestamp < oldestTime) {
                oldestTime = arr[0].timestamp;
                oldestChat = cid;
            }
        }
        if (!oldestChat) break;
        const removed = store.get(oldestChat).shift();
        totalBytes -= removed.size;
        if (!store.get(oldestChat).length) store.delete(oldestChat);
    }

    if (!store.has(chatId)) store.set(chatId, []);
    const arr = store.get(chatId);
    arr.push({ buffer, type, sender, msgId, timestamp: Date.now(), size });
    totalBytes += size;
    // Sirf last N rakho
    while (arr.length > MAX_PER_CHAT) {
        const removed = arr.shift();
        totalBytes -= removed.size;
    }
}

/** Sab se recent view-once is chat ka (jo expire nahi hua) */
function getRecent(chatId) {
    cleanup();
    const arr = store.get(chatId);
    if (!arr || !arr.length) return null;
    return arr[arr.length - 1];
}

/** Kisi specific message ID ka view-once */
function getByMsgId(chatId, msgId) {
    cleanup();
    const arr = store.get(chatId);
    if (!arr || !msgId) return null;
    return arr.find(e => e.msgId === msgId) || null;
}

module.exports = { put, getRecent, getByMsgId };
