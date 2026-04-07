// offscreen.js — 在 offscreen document 內跑 webkitSpeechRecognition
// 透過 chrome.runtime.sendMessage 與 background/content 溝通

let recognition = null;
let isActive = false;
let currentMode = 'listening'; // 'listening' | 'speaking'

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    if (msg.action === 'start') {
        currentMode = msg.mode || 'listening';
        startRecognition();
        sendResponse({ ok: true });
    }
    else if (msg.action === 'stop') {
        stopRecognition();
        sendResponse({ ok: true });
    }
    return true;
});

function send(payload) {
    chrome.runtime.sendMessage({ target: 'content', ...payload });
}

function startRecognition() {
    if (isActive) return;

    if (!recognition) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-TW';

        recognition.onstart = () => {
            isActive = true;
            send({ action: 'recognition_started', mode: currentMode });
        };

        recognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) isFinal = true;
            }
            send({ action: 'result', transcript, isFinal, mode: currentMode });
        };

        recognition.onerror = (event) => {
            isActive = false;
            send({ action: 'error', error: event.error, mode: currentMode });
        };

        recognition.onend = () => {
            isActive = false;
            send({ action: 'ended', mode: currentMode });
        };
    }

    try {
        recognition.start();
    } catch(e) {
        // 若已在運行中則忽略
    }
}

function stopRecognition() {
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
    isActive = false;
}
