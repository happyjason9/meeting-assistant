// background.js

// ── Offscreen document 管理 ──────────────────────────────
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function ensureOffscreenDocument() {
    // chrome.offscreen.getContexts 在部分 Chrome 版本不存在，改用 runtime.getContexts
    let hasDocument = false;
    try {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [OFFSCREEN_URL]
        });
        hasDocument = contexts.length > 0;
    } catch(e) {
        // getContexts 也不支援時，直接嘗試建立（重複建立會丟錯，catch 掉即可）
        hasDocument = false;
    }

    if (!hasDocument) {
        try {
            await chrome.offscreen.createDocument({
                url: OFFSCREEN_URL,
                reasons: ['USER_MEDIA'],
                justification: '語音辨識需要麥克風存取'
            });
        } catch(e) {
            // 已存在時 createDocument 會拋錯，忽略即可
        }
    }
}

// ── 訊息轉發 ─────────────────────────────────────────────
// content script → background → offscreen
// offscreen → background → content script (由 tabId 路由)

const contentTabs = new Set(); // 記錄所有活躍的 tab

chrome.tabs.onRemoved.addListener((tabId) => contentTabs.delete(tabId));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // 來自 content script，要控制語音辨識
    if (msg.target === 'background') {
        if (msg.action === 'start_recognition') {
            if (sender.tab) contentTabs.add(sender.tab.id);
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

        // 跑馬燈：抓疾管署「新聞稿」RSS。
        // 由 background 代抓是因為 content script 的 fetch 受網頁 CORS 限制
        // （cdc.gov.tw 沒有回 Access-Control-Allow-Origin），background 有 host_permissions 不受限。
        // 解析交給 content script 的 DOMParser（service worker 沒有 DOMParser）。
        else if (msg.action === 'fetch_ticker') {
            fetch('https://www.cdc.gov.tw/RSS/RssXml/Hh094B49-DRwe2RR4eFfrQ?type=1', { cache: 'no-store' })
                .then(res => {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.text();
                })
                .then(text => sendResponse({ ok: true, text: text }))
                .catch(e => sendResponse({ ok: false, error: String(e) }));
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

    // 來自 offscreen，轉發給所有活躍的 content tab
    if (msg.target === 'content') {
        contentTabs.forEach(tabId => {
            chrome.tabs.sendMessage(tabId, msg).catch(() => {
                contentTabs.delete(tabId); // 失效的 tab 移除
            });
        });
        return false;
    }
});
