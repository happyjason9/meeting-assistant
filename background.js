// background.js

// ── Offscreen document 管理 ──────────────────────────────
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function ensureOffscreenDocument() {
    const existing = await chrome.offscreen.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [OFFSCREEN_URL]
    });
    if (existing.length === 0) {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_URL,
            reasons: ['USER_MEDIA'],
            justification: '語音辨識需要麥克風存取'
        });
    }
}

// ── 訊息轉發 ─────────────────────────────────────────────
// content script → background → offscreen
// offscreen → background → content script (由 tabId 路由)

let contentTabId = null; // 記錄要回傳的 tab

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // 來自 content script，要控制語音辨識
    if (msg.target === 'background') {
        if (msg.action === 'start_recognition') {
            contentTabId = sender.tab ? sender.tab.id : null;
            ensureOffscreenDocument().then(() => {
                chrome.runtime.sendMessage({
                    target: 'offscreen',
                    action: 'start',
                    mode: msg.mode
                });
            });
            sendResponse({ ok: true });
        }
        else if (msg.action === 'stop_recognition') {
            chrome.runtime.sendMessage({
                target: 'offscreen',
                action: 'stop'
            });
            sendResponse({ ok: true });
        }

        // 錄音儲存（原有功能）
        else if (msg.action === 'save_record') {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const folderName = "Meeting_Records";
            chrome.downloads.download({
                url: msg.audioData,
                filename: `${folderName}/audio_${timestamp}.webm`,
                saveAs: false
            });
            chrome.downloads.download({
                url: msg.textData,
                filename: `${folderName}/text_${timestamp}.txt`,
                saveAs: false
            });
            sendResponse({ ok: true });
        }
        return true;
    }

    // 來自 offscreen，轉發給 content script
    if (msg.target === 'content') {
        if (contentTabId !== null) {
            chrome.tabs.sendMessage(contentTabId, msg);
        } else {
            // fallback：廣播給所有 tab
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
                });
            });
        }
        return false;
    }
});
