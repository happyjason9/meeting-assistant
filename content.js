// ==========================================
// 1. 介面樣式 (CSS)
// ==========================================
const style = document.createElement('style');
style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap');
    
    #assistant-overlay {
        position: fixed; top: auto; left: auto; bottom: 20px; right: 20px; transform: none;
        width: 260px; padding: 20px;
        background: rgba(0, 0, 0, 0.7); 
        border: 1px solid rgba(255, 255, 255, 0.2); 
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); 
        color: white; border-radius: 16px; z-index: 999999;
        font-family: 'Noto Sans TC', sans-serif; text-align: center;
        display: flex; flex-direction: column; align-items: center;
        transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1); cursor: pointer;
    }

    #assistant-overlay.active-mode {
        top: 50%; left: 50%; bottom: auto; right: auto;
        transform: translate(-50%, -50%);
        width: 320px; padding: 30px 20px;
        background: rgba(0, 0, 0, 0.85);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
    }

    #assistant-overlay:hover { background: rgba(0, 0, 0, 0.85); }
    
    .mic-circle {
        position: relative;
        width: 60px; height: 60px; border-radius: 50%; 
        background-color: rgba(255, 255, 255, 0.1); 
        display: flex; align-items: center; justify-content: center; margin-bottom: 15px;
        transition: all 0.3s ease; 
        border: 3px solid transparent; 
    }
    
    #assistant-overlay.active-mode .mic-circle { width: 80px; height: 80px; margin-bottom: 20px; }

    /* 狀態光暈 */
    .mic-circle.listening { border-color: transparent; box-shadow: 0 0 15px rgba(40, 167, 69, 0.6); }
    .mic-circle.speaking { border-color: transparent; box-shadow: 0 0 15px rgba(255, 193, 7, 0.7); }
    .mic-circle.searching { border-color: #007bff; box-shadow: 0 0 15px rgba(0, 123, 255, 0.7); animation: pulse-blue 1.5s infinite; }
    
    .mic-icon svg { width: 32px; height: 32px; fill: #eee; transition: fill 0.3s; z-index: 2; }
    #assistant-overlay.active-mode .mic-icon svg { width: 40px; height: 40px; }

    .mic-circle.listening .mic-icon svg { fill: #28a745; }
    .mic-circle.speaking .mic-icon svg { fill: #ffc107; }
    .mic-circle.searching .mic-icon svg { fill: #007bff; }
    
    #assistant-status { font-size: 18px; font-weight: 700; margin-bottom: 5px; text-shadow: 0 2px 4px black; }
    #assistant-overlay.active-mode #assistant-status { font-size: 22px; margin-bottom: 10px; }

    #assistant-subtext { font-size: 13px; color: #ddd; min-height: 20px; line-height: 1.5; word-break: break-all; text-shadow: 0 1px 2px black; }
    #assistant-overlay.active-mode #assistant-subtext { font-size: 16px; min-height: 24px; }
    
    .meeting-odd { background-color: #ffffff !important; transition: background-color 0.3s; }
    .meeting-even { background-color: #f2f2f2 !important; transition: background-color 0.3s; }
    .meeting-hidden { display: none !important; }

    /* 螢光筆樣式 */
    mark.highlight-match {
        background-color: #ffeb3b;
        color: #000;
        font-weight: bold;
        padding: 0 2px;
        border-radius: 2px;
        box-shadow: 0 0 4px #ffeb3b;
    }

    @keyframes pulse-blue {
        0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(0, 123, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
    }

    /* --- 倒數圓環 --- */
    .progress-ring {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        transform: rotate(-90deg); pointer-events: none; display: none; z-index: 1;
    }

    .mic-circle.listening .progress-ring,
    .mic-circle.speaking .progress-ring { display: block; }

    .progress-ring__circle {
        fill: transparent; stroke-width: 4; stroke-linecap: round; transform-origin: center;
    }

    /* 綠燈：有 .counting 才跑動畫 (4秒) */
    .mic-circle.listening .progress-ring__circle { stroke: #28a745; stroke-dasharray: 239; stroke-dashoffset: 0; }
    .mic-circle.listening.counting .progress-ring__circle { animation: countdown 4s linear forwards; }

    /* 黃燈：一直跑動畫 (20秒) */
    .mic-circle.speaking .progress-ring__circle { stroke: #ffc107; stroke-dasharray: 239; stroke-dashoffset: 0; animation: countdown 20s linear forwards; }

    @keyframes countdown {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: 239; }
    }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.id = 'assistant-overlay';
overlay.innerHTML = `
    <div class="mic-circle" id="mic-indicator">
        <svg class="progress-ring" viewBox="0 0 80 80">
           <circle class="progress-ring__circle" r="38" cx="40" cy="40"/>
        </svg>
        <div class="mic-icon">
            <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
        </div>
    </div>
    <div id="assistant-status">啟動中...</div>
    <div id="assistant-subtext"></div>
`;
document.body.appendChild(overlay);

const micIndicator = overlay.querySelector('#mic-indicator');
const statusText = overlay.querySelector('#assistant-status');
const subText = overlay.querySelector('#assistant-subtext');

// ==========================================
// 2. 邏輯控制
// ==========================================
let currentState = 'idle';
let isRecognitionActive = false;
let watchdogTimer = null;
let isTranslateMode = false;

// 工具：重置圓環動畫
function resetRingAnimation() {
    const circle = document.querySelector('.progress-ring__circle');
    if (circle) {
        circle.style.animation = 'none';
        circle.offsetHeight; 
        circle.style.animation = null; 
    }
}

// 工具：清除表格上的螢光筆痕跡
function clearHighlights() {
    document.querySelectorAll('mark.highlight-match').forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.innerText), mark);
        parent.normalize(); 
    });
}

// 介面與語音文字：翻譯模式下用英文，否則中文
const I18N = {
    listening_status:   { zh: "聆聽中",            en: "Listening" },
    listening_sub:      { zh: "請說：我要找會議室", en: 'Say: "Find a meeting room"' },
    speaking_status:    { zh: "請說出查詢內容",     en: "Say your query" },
    speaking_sub:       { zh: "如：李組長、茶水、十點的會", en: "e.g. name, time, keyword" },
    searching_status:   { zh: "搜尋中...",          en: "Searching..." },
    searching_sub:      { zh: "資料篩選中...",       en: "Filtering..." },
    results_status:     { zh: "搜尋完成",            en: "Done" },
    error_status:       { zh: "暫停服務",            en: "Paused" },
    error_sub:          { zh: "請點擊重試",          en: "Click to retry" },
    say_query_prompt:   { zh: "請說出查詢條件",      en: "Please say your query" },
    timeout:            { zh: "操作逾時，已取消",     en: "Timed out, cancelled" },
    say_specific:       { zh: "請說具體一點...",     en: "Please be more specific..." },
    tell_time_keyword:  { zh: "請告訴我時間或關鍵字", en: "Tell me a time or keyword" },
    found_meetings:     { zh: (n) => `找到 ${n} 筆會議`, en: (n) => `Found ${n} meeting(s)` },
    not_found:          { zh: "找不到符合的資料",     en: "No matching results" },
    searching_for:      { zh: (k) => `搜尋：${k}`,    en: (k) => `Search: ${k}` },
};

function t(key, arg) {
    const entry = I18N[key];
    if (!entry) return '';
    const val = isTranslateMode ? entry.en : entry.zh;
    return typeof val === 'function' ? val(arg) : val;
}

function updateUI(state, customText) {
    currentState = state;
    micIndicator.className = 'mic-circle';
    const container = document.getElementById('assistant-overlay');

    if (state === 'listening') {
        container.classList.remove('active-mode');
        micIndicator.classList.add('listening');
        statusText.innerText = t('listening_status');
        subText.innerText = t('listening_sub');
    }
    else if (state === 'speaking') {
        container.classList.add('active-mode');
        micIndicator.classList.add('speaking');
        statusText.innerText = t('speaking_status');
        subText.innerText = t('speaking_sub');
    }
    else if (state === 'searching') {
        container.classList.add('active-mode');
        micIndicator.classList.add('searching');
        statusText.innerText = t('searching_status');
        subText.innerText = customText || t('searching_sub');
    }
    else if (state === 'showing_results') {
        container.classList.remove('active-mode');
        micIndicator.classList.add('listening');
        statusText.innerText = t('results_status');
        subText.innerText = customText;
    }
    else if (state === 'error') {
        container.classList.remove('active-mode');
        statusText.innerText = t('error_status');
        subText.innerText = customText || t('error_sub');
    }
}

// ==========================================
// 3. 語音辨識核心（直接在 content script 跑）
// ==========================================

let recognition = null;
let silenceTimer = null;
let lastTranscript = "";

function startListeningCountdown() {
    micIndicator.classList.remove('counting');
    void micIndicator.offsetWidth;
    micIndicator.classList.add('counting');

    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
        micIndicator.classList.remove('counting');
        subText.innerText = t('listening_sub');
    }, 4000);
}

function stopRecognition() {
    isRecognitionActive = false;
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
}

function startRecognition(_mode) {
    if (isRecognitionActive) return;

    if (!('webkitSpeechRecognition' in window)) {
        console.error('[語音助理] 此瀏覽器不支援 webkitSpeechRecognition');
        updateUI('error', '此瀏覽器不支援語音辨識');
        return;
    }

    isRecognitionActive = true;

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW';

    recognition.onstart = () => {
        console.log('[語音助理] onstart：語音辨識已啟動 state=' + currentState);
        lastTranscript = "";
        if (watchdogTimer) clearTimeout(watchdogTimer);

        if (currentState === 'idle' || currentState === 'listening') {
            updateUI('listening');
            micIndicator.classList.remove('counting');
            watchdogTimer = setTimeout(() => {
                if (currentState === 'listening' && isRecognitionActive) stopRecognition();
            }, 60000);
        } else if (currentState === 'speaking') {
            resetRingAnimation();
            watchdogTimer = setTimeout(() => {
                if (currentState === 'speaking' && isRecognitionActive) {
                    speakResult(t('timeout'), () => { resetToIdle(); });
                }
            }, 20000);
        }
    };

    recognition.onresult = (event) => {
        let currentTranscript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) isFinal = true;
        }
        console.log('[語音助理] onresult：', currentTranscript, 'isFinal=' + isFinal);

        if (currentState === 'listening') {
            if (currentTranscript.trim() !== "" && currentTranscript !== lastTranscript) {
                startListeningCountdown();
                lastTranscript = currentTranscript;
            }
        }

        // 翻譯模式下不顯示辨識到的中文語音文字，保持英文提示
        if (currentTranscript.trim() && !isTranslateMode) subText.innerText = currentTranscript;

        if (currentState === 'listening') {
            if (currentTranscript.includes("翻譯成英文") || currentTranscript.includes("翻譯英文")) {
                if (silenceTimer) clearTimeout(silenceTimer);
                if (isTranslating) return; // 翻譯進行中，忽略重複指令
                isTranslateMode = true;
                currentState = 'transitioning';
                stopRecognition();
                translateTableToEnglish(); // 立即整頁翻譯
            } else if (currentTranscript.includes("翻譯成中文") || currentTranscript.includes("翻譯中文") || currentTranscript.includes("顯示中文") || currentTranscript.includes("還原中文")) {
                if (silenceTimer) clearTimeout(silenceTimer);
                isTranslateMode = false;
                restoreOriginalText();
            } else if (currentTranscript.includes("找會議") || currentTranscript.includes("查詢") || currentTranscript.includes("查一下") || currentTranscript.includes("找一下")) {
                if (silenceTimer) clearTimeout(silenceTimer);
                triggerWakeUpFlow();
            }
        } else if (currentState === 'speaking') {
            if (isFinal && currentTranscript.trim().length > 0) {
                performSearch(currentTranscript);
            }
        }
    };

    recognition.onerror = (event) => {
        if (silenceTimer) clearTimeout(silenceTimer);
        micIndicator.classList.remove('counting');
        if (watchdogTimer) clearTimeout(watchdogTimer);
        isRecognitionActive = false;
        recognition = null;

        const error = event.error;
        console.error('[語音助理] onerror：', error);
        if (error === 'aborted' || error === 'no-speech') {
            if (['listening', 'speaking', 'showing_results'].includes(currentState)) {
                setTimeout(() => startRecognition(currentState), 500);
            }
        } else if (error === 'not-allowed' || error === 'service-not-allowed') {
            updateUI('error', '麥克風未授權，請點擊網址列鎖頭允許此網站使用麥克風');
        } else {
            updateUI('error');
        }
    };

    recognition.onend = () => {
        console.log('[語音助理] onend：辨識結束 state=' + currentState);
        if (silenceTimer) clearTimeout(silenceTimer);
        micIndicator.classList.remove('counting');
        if (watchdogTimer) clearTimeout(watchdogTimer);
        isRecognitionActive = false;
        recognition = null;

        if (['listening', 'speaking', 'showing_results'].includes(currentState)) {
            setTimeout(() => startRecognition(currentState), 300);
        }
    };

    try {
        recognition.start();
    } catch(e) {
        console.error('[語音助理] recognition.start() 失敗：', e);
        isRecognitionActive = false;
    }
}

let micPermissionGranted = false;

async function ensureMicPermission() {
    if (micPermissionGranted) return true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 立即釋放硬體，SpeechRecognition 會自己再開
        stream.getTracks().forEach(t => t.stop());
        micPermissionGranted = true;
        console.log('[語音助理] 已取得本網頁麥克風權限');
        return true;
    } catch (err) {
        console.error('[語音助理] getUserMedia 取得麥克風權限失敗：', err.name, err.message);
        updateUI('error', '請允許此網站使用麥克風（點網址列鎖頭）');
        return false;
    }
}

async function initRecognition() {
    if (isRecognitionActive) return;
    updateUI('listening');
    const ok = await ensureMicPermission();
    if (!ok) return;
    startRecognition('listening');
}

function triggerWakeUpFlow() {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }

    updateUI('speaking');
    // 先把狀態設為 transitioning，讓 ended 事件不會自動重啟
    currentState = 'transitioning';
    stopRecognition();

    const utterance = new SpeechSynthesisUtterance(t('say_query_prompt'));
    utterance.lang = isTranslateMode ? 'en-US' : 'zh-TW';

    let micStarted = false;
    const doStart = () => {
        if (!micStarted) {
            micStarted = true;
            currentState = 'speaking';
            updateUI('speaking');
            setTimeout(() => startRecognition('speaking'), 100);
        }
    };

    utterance.onend = () => doStart();
    setTimeout(doStart, 3000); // fallback

    try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } catch(e) {
        doStart();
    }
}

// --- 流程 2: 搜尋 ---
function performSearch(queryText) {
    currentState = 'searching'; // 先設定，避免 ended 事件觸發重啟
    stopRecognition();
    
    let rawKeywords = extractKeywords(queryText);
    const timeCheck = parseTimeFromSpeech(queryText);

    if (rawKeywords === "會議" || rawKeywords === "會議室" || rawKeywords === "討論" || rawKeywords === "") {
        rawKeywords = ""; 
    }

    if (rawKeywords.length < 1 && timeCheck === null) {
        updateUI('speaking', t('say_specific'));
        speakResult(t('tell_time_keyword'), () => {
            startRecognition('speaking');
        });
        return;
    }

    updateUI('searching', t('searching_for', rawKeywords || (timeCheck ? formatTime(timeCheck) : '')));

    clearHighlights();

    const count = filterMeetingTable(timeCheck, rawKeywords);

    let replyMsg = count > 0 ? t('found_meetings', count) : t('not_found');

    let hasReset = false;
    const forceReset = () => {
        if (hasReset) return;
        hasReset = true;
        // 還原全表顯示（翻譯模式下文字仍是英文，故回到完整英文列表）
        clearHighlights();
        resetTable();
        resetToIdle();
    };

    updateUI('showing_results', replyMsg);

    speakResult(replyMsg, () => { setTimeout(forceReset, 6000); });
    setTimeout(forceReset, 8000);
}

// --- 關鍵字清洗 ---
function extractKeywords(text) {
    let cleanText = text.toLowerCase();
    
    // 1. CDC 專用糾錯
    cleanText = cleanText
        .replace(/一群/g, "疫情").replace(/一起/g, "疫情").replace(/一勤/g, "疫情")
        .replace(/玉情/g, "疫情").replace(/異情/g, "疫情").replace(/月琴/g, "疫情")
        .replace(/夜勤/g, "疫情").replace(/熱情/g, "疫情").replace(/預情/g, "疫情");

    // 茶水相關
    cleanText = cleanText
        .replace(/有茶水/g, "茶水")
        .replace(/準備茶水/g, "茶水")
        .replace(/要茶水/g, "茶水");

    // 2. 移除贅詞
    cleanText = cleanText
        .replace(/主持人/g, "").replace(/承辦人/g, "").replace(/主辦人/g, "")
        .replace(/是誰/g, "").replace(/是/g, "")
        .replace(/我要找/g, "").replace(/我想要找/g, "").replace(/幫我查/g, "").replace(/幫我找/g, "")
        .replace(/會議(?!室)/g, "") 
        .replace(/一下/g, "").replace(/那個/g, "").replace(/的/g, "")
        .replace(/時間/g, "").replace(/地點/g, "")
        .trim();
    
    // 3. 樓層轉換
    if (cleanText === "ef" || cleanText === "yf" || cleanText === "if") cleanText = "1f";
    if (cleanText === "erf" || cleanText === "arf") cleanText = "2f";
    if (cleanText === "sanf") cleanText = "3f";
    if (cleanText === "sif") cleanText = "4f";
    
    cleanText = cleanText.replace(/(\d+)樓/g, "$1f");
    const cnNums = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10};
    for (let k in cnNums) {
        cleanText = cleanText.replace(new RegExp(`${k}樓`, 'g'), `${cnNums[k]}f`);
    }
    
    return cleanText;
}

// =========================================================
// pinyin-pro 套件整合
// =========================================================

function getPinyin(text) {
    if (typeof pinyinPro === 'undefined') {
        console.error("pinyin-pro 套件未載入");
        return text.split(''); 
    }
    return pinyinPro.pinyin(text, { 
        type: 'array', toneType: 'none', nonZh: 'consecutive' 
    });
}

function levenshteinDistance(arr1, arr2) {
    const matrix = [];
    for (let i = 0; i <= arr2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= arr1.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= arr2.length; i++) {
        for (let j = 1; j <= arr1.length; j++) {
            if (arr2[i - 1] === arr1[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, 
                    matrix[i][j - 1] + 1,     
                    matrix[i - 1][j] + 1      
                );
            }
        }
    }
    return matrix[arr2.length][arr1.length];
}

function calculateSimilarity(sourceText, keyword) {
    if (!keyword || !sourceText) return 0;
    
    const cleanSource = sourceText.toLowerCase().replace(/\s/g, "");
    const cleanKey = keyword.toLowerCase().replace(/\s/g, "");
    
    if (cleanKey.length === 0) return 0;
    if (cleanSource.includes(cleanKey)) return 1.0; 

    // 茶水不走拼音
    if (cleanKey === "茶水") return 0;

    const normalizePinyin = (p) => p.replace(/ng/g, 'n').replace(/zh/g, 'z').replace(/ch/g, 'c').replace(/sh/g, 's');
    
    const sourcePinyin = getPinyin(cleanSource).map(normalizePinyin);
    const keyPinyin = getPinyin(cleanKey).map(normalizePinyin);

    let minDistance = 999;
    if (keyPinyin.length > sourcePinyin.length) return 0;

    for (let i = 0; i <= sourcePinyin.length - keyPinyin.length; i++) {
        const segment = sourcePinyin.slice(i, i + keyPinyin.length);
        const dist = levenshteinDistance(segment, keyPinyin);
        if (dist < minDistance) minDistance = dist;
    }

    if (minDistance === 0) return 0.95; 
    if (minDistance === 1 && keyPinyin.length >= 3) return 0.8; 
    
    const lowWeightChars = ["會", "議", "室", "討", "論", "工", "作", "小", "組"];
    let totalWeight = 0;
    let hitWeight = 0;
    const keyChars = cleanKey.split("");
    keyChars.forEach(char => {
        const weight = lowWeightChars.includes(char) ? 0.3 : 1.0; 
        totalWeight += weight;
        if (cleanSource.includes(char)) hitWeight += weight;
    });

    return hitWeight / totalWeight;
}

// --- 表格過濾與螢光筆上色 ---
// 取得 cell 的原始中文（翻譯模式下 innerText 是英文，比對需用 dataset.zh）
function cellZh(cell) {
    return (cell && cell.dataset && cell.dataset.zh !== undefined) ? cell.dataset.zh : (cell ? cell.innerText : '');
}
// 取得整列的原始中文（用於關鍵字比對）
function rowZh(row) {
    return Array.from(row.querySelectorAll('td')).map(cellZh).join(' ');
}

function filterMeetingTable(targetMinute, keyword) {
    const rows = document.querySelectorAll('.tbl-content table tbody tr');
    let matchCount = 0;

    const floorMatch = keyword.match(/(\d+f)/);
    const requiredFloor = floorMatch ? floorMatch[0] : null;

    rows.forEach(row => {
        let isMatch = false;

        // 1. 時間比對
        if (targetMinute !== null) {
            const timeCell = row.querySelector('td:nth-child(1)');
            if (timeCell) {
                const parts = cellZh(timeCell).trim().split('~');
                if (parts.length >= 2) {
                    const startMin = parseTimeStr(parts[0]);
                    const endMin = parseTimeStr(parts[1]);
                    if (targetMinute >= startMin - 10 && targetMinute <= endMin + 10) isMatch = true;
                }
            }
        }

        // 2. 關鍵字比對（用原始中文）
        if (!isMatch && keyword.length > 0) {
            const rowText = rowZh(row).toLowerCase().replace(/\s/g, "");
            
            // 茶水專用
            if (keyword.includes("茶水")) {
                if (rowText.includes("茶水")) {
                    isMatch = true;
                }
            }
            // 樓層篩選
            else if (requiredFloor) {
                if (rowText.includes(requiredFloor)) isMatch = true;
            } 
            // 拼音搜尋
            else {
                const score = calculateSimilarity(rowText, keyword);
                const threshold = keyword.length <= 2 ? 0.95 : 0.7;
                if (score >= threshold) {
                    isMatch = true;
                }
            }
        }

        if (isMatch) {
            row.classList.remove('meeting-hidden');
            row.classList.remove('meeting-odd', 'meeting-even');
            matchCount++;
            if (matchCount % 2 === 1) { row.classList.add('meeting-odd'); } 
            else { row.classList.add('meeting-even'); }
            if (matchCount === 1) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 上色（翻譯模式下內容是英文，中文關鍵字無法對應，故跳過）
            if (keyword.length > 0 && !isTranslateMode) {
                row.querySelectorAll('td').forEach(cell => {
                    const cellText = cell.innerText;
                    if (cellText.includes(keyword)) {
                        const regex = new RegExp(`(${keyword})`, 'gi');
                        cell.innerHTML = cell.innerHTML.replace(regex, '<mark class="highlight-match">$1</mark>');
                    }
                });
            }

        } else {
            row.classList.add('meeting-hidden');
            row.classList.remove('meeting-odd', 'meeting-even');
        }
    });
    return matchCount;
}

function parseTimeFromSpeech(text) {
    // 明確說「上午」才算上午，否則 1~6 點自動視為下午（公司上班 7:00~18:00）
    let isAM = text.includes("上午") || text.includes("早上") || text.includes("凌晨");
    let isPM = text.includes("下午") || text.includes("晚上") || text.includes("晚間");

    function adjustHour(hour) {
        if (isAM) return hour; // 明確說上午，不調整
        if (isPM && hour < 12) return hour + 12; // 明確說下午
        // 沒說上午也沒說下午：1~6 點判為下午，7~12 點維持原值
        if (hour >= 1 && hour <= 6) return hour + 12;
        return hour;
    }

    let match = text.match(/(\d{1,2})[:點](\d{0,2})/);
    if (!match) {
        const cnNums = {'一':1, '兩':2, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '十一':11, '十二':12};
        for (let key in cnNums) {
            if (text.includes(key + "點")) {
                let hour = adjustHour(cnNums[key]);
                return hour * 60;
            }
        }
        return null;
    }
    let hour = adjustHour(parseInt(match[1]));
    let minute = parseInt(match[2]) || 0;
    if (text.includes("半")) minute = 30;
    return hour * 60 + minute;
}

function parseTimeStr(str) {
    const parts = str.trim().split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatTime(min) {
    let h = Math.floor(min/60);
    let m = min%60;
    return `${h}:${m.toString().padStart(2,'0')}`;
}

function resetTable() {
    const rows = document.querySelectorAll('.tbl-content table tbody tr');
    rows.forEach(row => {
        row.classList.remove('meeting-hidden');
        row.classList.remove('meeting-odd', 'meeting-even');
    });
}

function speakResult(text, callback) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isTranslateMode ? 'en-US' : 'zh-TW';
    utterance.onend = callback;
    utterance.onerror = () => { if(callback) callback(); };
    window.speechSynthesis.speak(utterance);
}

function resetToIdle() {
    updateUI('listening');
    setTimeout(initRecognition, 500);
}

// ==========================================
// 翻譯功能
// ==========================================
let translatedItems = []; // 記錄 { node, original } 以便還原
let isTranslating = false; // 防止重複觸發翻譯

// 翻譯模式下注入 CSS 縮小表格字體，避免英文排版爆欄
let translateStyleEl = null;
function applyTranslateStyle() {
    if (translateStyleEl) return;
    translateStyleEl = document.createElement('style');
    translateStyleEl.id = 'translate-mode-style';
    translateStyleEl.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap');
        .tbl-header table th,
        .tbl-content table td {
            font-family: 'Noto Sans', sans-serif !important;
            word-break: break-word !important;
        }
    `;
    document.head.appendChild(translateStyleEl);
}
function removeTranslateStyle() {
    if (translateStyleEl) {
        translateStyleEl.remove();
        translateStyleEl = null;
    }
}

async function translateTableToEnglish() {
    const { translateApiKey } = await chrome.storage.local.get('translateApiKey');
    if (!translateApiKey) {
        updateUI('error', 'No API Key — set it in extension options');
        setTimeout(resetToIdle, 4000);
        return;
    }

    isTranslating = true;
    updateUI('searching', 'Translating...');

    // 套用縮小字體的 CSS，避免英文排版爆欄
    applyTranslateStyle();

    // 先把全表所有 td 的原始中文備份到 dataset.zh（含時間欄、隱藏列），供搜尋比對使用
    document.querySelectorAll('.tbl-content table tbody td').forEach(td => {
        if (td.dataset.zh === undefined) td.dataset.zh = td.innerText;
    });

    const cells = [];

    // 1. 標題列：只翻頁面標題（.tbl-title = 「本日會議」）
    //    .logo-title 已有英文副標「Taiwan Centers for Disease Control」，直接隱藏中文文字節點即可
    document.querySelectorAll('.logo-title').forEach(el => {
        const firstText = el.firstChild;
        if (firstText && firstText.nodeType === Node.TEXT_NODE && firstText.textContent.trim()) {
            if (!translatedItems.some(item => item.node === firstText)) {
                translatedItems.push({ node: firstText, original: firstText.textContent });
            }
            firstText.textContent = ''; // 隱藏中文機關名稱，保留英文副標
        }
    });
    document.querySelectorAll('.tbl-title').forEach(el => {
        if (el.innerText.trim()) cells.push(el);
    });

    // 2. 表頭欄位名稱
    document.querySelectorAll('.tbl-header table thead th').forEach(th => {
        if (th.innerText.trim()) cells.push(th);
    });

    // 3. 表格內容：2=名稱, 3=地點, 4=主持人, 5=備註（略過時間欄）
    //    翻譯全部列（含目前隱藏的），這樣搜尋後顯示出來也是英文
    document.querySelectorAll('.tbl-content table tbody tr').forEach(row => {
        [2, 3, 4, 5].forEach(nth => {
            const td = row.querySelector(`td:nth-child(${nth})`);
            // 用 dataset.zh（原始中文）判斷是否有內容，避免已翻譯過的列被誤判
            if (td && (td.dataset.zh || td.innerText).trim()) cells.push(td);
        });
    });

    if (cells.length === 0) {
        updateUI('showing_results', 'No content to translate');
        setTimeout(resetToIdle, 3000);
        return;
    }

    // 翻譯輸入一律用原始中文：文字節點用 textContent，表格 td 用 dataset.zh，其餘用 innerText
    const getText = (el) => {
        if (el.nodeType === Node.TEXT_NODE) return el.textContent.trim();
        if (el.dataset && el.dataset.zh !== undefined) return el.dataset.zh.trim();
        return el.innerText.trim();
    };
    const texts = cells.map(getText);

    // Fallback 順序：3.1 Flash Lite → 3.1 Flash → 2.5 Flash Lite → 2.5 Flash → 2.5 Pro
    const MODEL_FALLBACKS = [
        { id: 'gemini-3.1-flash-lite', jsonMode: true },
        { id: 'gemini-3.1-flash',      jsonMode: true },
        { id: 'gemini-2.5-flash-lite', jsonMode: true },
        { id: 'gemini-2.5-flash',      jsonMode: true },
        { id: 'gemini-2.5-pro',        jsonMode: true },
    ];

    const prompt = `You are a translation engine. Translate each string in this JSON array from Traditional Chinese to English. ` +
        `Keep numbers, codes, room numbers (e.g. 7F, B1F) and names as-is. ` +
        `Output MUST be a valid JSON array of exactly ${texts.length} strings, same order. ` +
        `Do NOT add any text, explanation, or markdown fences. Output only the raw JSON array.\n\n` +
        JSON.stringify(texts);

    const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

    const parseTranslations = (raw, expectedLen) => {
        let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        let result = tryParse(cleaned);
        if (Array.isArray(result)) return result;
        // 掃描所有 [...] 候選，從最後往前找長度相符的
        const candidates = cleaned.match(/\[[^\[\]]*\]/g) || [];
        for (let i = candidates.length - 1; i >= 0; i--) {
            const arr = tryParse(candidates[i]);
            if (Array.isArray(arr) && arr.length === expectedLen) return arr;
        }
        for (let i = candidates.length - 1; i >= 0; i--) {
            const arr = tryParse(candidates[i]);
            if (Array.isArray(arr)) return arr;
        }
        return null;
    };

    let translations = null;

    try {
        for (const model of MODEL_FALLBACKS) {
            console.log('[語音助理] 嘗試模型：', model.id);
            const genConfig = model.jsonMode
                ? { temperature: 0, responseMimeType: 'application/json' }
                : { temperature: 0 };

            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${translateApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: genConfig
                    })
                }
            );
            const data = await resp.json();

            // 429 = 用量超過，換下一個模型
            if (resp.status === 429) {
                console.warn('[語音助理] 模型用量已達上限，切換至下一個：', model.id);
                continue;
            }

            if (!resp.ok || data.error) {
                console.error('[語音助理] API 錯誤：', resp.status, JSON.stringify(data));
                const reason = data.error ? data.error.message : `HTTP ${resp.status}`;
                updateUI('error', 'Translate failed: ' + reason);
                isTranslating = false;
                setTimeout(resetToIdle, 6000);
                return;
            }

            const raw = (data.candidates && data.candidates[0] && data.candidates[0].content
                && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
                && data.candidates[0].content.parts[0].text) || '';
            console.log('[語音助理] 模型回傳 (' + model.id + ')：', raw);

            translations = parseTranslations(raw, texts.length);
            if (Array.isArray(translations)) break; // 成功，跳出迴圈

            console.warn('[語音助理] 解析失敗，換下一個模型');
        }

        if (!Array.isArray(translations)) {
            console.error('[語音助理] 所有模型都失敗');
            updateUI('error', 'Translate failed — all models exhausted');
            isTranslating = false;
            setTimeout(resetToIdle, 5000);
            return;
        }

        if (!Array.isArray(translations)) {
            console.error('[語音助理] 無法解析模型回傳：', raw);
            updateUI('error', 'Translate failed — bad response');
            setTimeout(resetToIdle, 5000);
            return;
        }

        cells.forEach((el, i) => {
            const isText = el.nodeType === Node.TEXT_NODE;
            // 原文一律用原始中文（td 用 dataset.zh），避免重複翻譯時記到英文
            const original = isText ? el.textContent
                : (el.dataset && el.dataset.zh !== undefined ? el.dataset.zh : el.innerText);
            // 記錄原文以便還原（避免重複記錄）
            if (!translatedItems.some(item => item.node === el)) {
                translatedItems.push({ node: el, original });
            }
            const translated = translations[i] || original;
            if (isText) el.textContent = translated;
            else el.innerText = translated;
        });

        isTranslating = false;
        updateUI('showing_results', 'Translated');
        // 翻完回到聆聽，讓使用者接著講「我要找會議室」
        setTimeout(resetToIdle, 1500);
    } catch (err) {
        isTranslating = false;
        console.error('[語音助理] 翻譯失敗：', err);
        updateUI('error', 'Translation failed — check API Key');
        setTimeout(resetToIdle, 4000);
    }
}

function restoreOriginalText() {
    translatedItems.forEach(({ node, original }) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = original;
        else node.innerText = original;
    });
    translatedItems = [];
    // 清除中文備份
    document.querySelectorAll('.tbl-content table tbody td').forEach(td => {
        delete td.dataset.zh;
    });
    // 移除翻譯模式的縮字 CSS
    removeTranslateStyle();
    // 還原被搜尋隱藏的列、清除螢光筆
    clearHighlights();
    resetTable();
    // isTranslateMode 已為 false，更新回中文聆聽介面
    updateUI('listening');
}


// ==========================================
// 自動滾動由 redesign.js 接管，此處只確保原站的滾動速度設定維持關閉
// ==========================================
setInterval(() => {
    const nativeScrollSelect = document.getElementById('ScrollSpeed');
    if (nativeScrollSelect && nativeScrollSelect.value !== "0") {
        nativeScrollSelect.value = "0";
        nativeScrollSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}, 5000);

setTimeout(initRecognition, 500);
overlay.addEventListener('click', initRecognition);