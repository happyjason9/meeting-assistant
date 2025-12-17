// 1. 介面樣式 (CSS)
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
        width: 60px; height: 60px; border-radius: 50%; 
        background-color: rgba(255, 255, 255, 0.1); 
        display: flex; align-items: center; justify-content: center; margin-bottom: 15px;
        transition: all 0.3s ease; border: 3px solid transparent;
    }
    
    #assistant-overlay.active-mode .mic-circle { width: 80px; height: 80px; margin-bottom: 20px; }

    .mic-circle.listening { border-color: #28a745; box-shadow: 0 0 15px rgba(40, 167, 69, 0.6); }
    .mic-circle.speaking { border-color: #ffc107; box-shadow: 0 0 15px rgba(255, 193, 7, 0.7); }
    .mic-circle.searching { border-color: #007bff; box-shadow: 0 0 15px rgba(0, 123, 255, 0.7); animation: pulse-blue 1.5s infinite; }
    
    .mic-icon svg { width: 32px; height: 32px; fill: #eee; transition: fill 0.3s; }
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

    @keyframes pulse-blue {
        0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(0, 123, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
    }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.id = 'assistant-overlay';
overlay.innerHTML = `
    <div class="mic-circle" id="mic-indicator">
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

// 2. 邏輯控制
let recognition = null;
let currentState = 'idle'; 
let isRecognitionActive = false;
let watchdogTimer = null; // 看門狗計時器

function updateUI(state, customText) {
    currentState = state;
    micIndicator.className = 'mic-circle';
    const container = document.getElementById('assistant-overlay');

    if (state === 'listening') {
        container.classList.remove('active-mode');
        micIndicator.classList.add('listening');
        statusText.innerText = "聆聽中";
        subText.innerText = "請說：我要找會議室";
    } 
    else if (state === 'speaking') {
        container.classList.add('active-mode');
        micIndicator.classList.add('speaking');
        statusText.innerText = "請說出查詢內容";
        subText.innerText = "如：李組長、茶水、十點的會";
    } 
    else if (state === 'searching') {
        container.classList.add('active-mode');
        micIndicator.classList.add('searching');
        statusText.innerText = "搜尋中...";
        subText.innerText = customText || "資料篩選中...";
    }
    else if (state === 'showing_results') {
        container.classList.remove('active-mode');
        micIndicator.classList.add('listening');
        statusText.innerText = "搜尋完成";
        subText.innerText = customText;
    }
    else if (state === 'error') {
        container.classList.remove('active-mode');
        statusText.innerText = "暫停服務";
        subText.innerText = "請點擊重試";
    }
}

// 3. 語音辨識核心
function initRecognition() {
    if (!('webkitSpeechRecognition' in window)) return;
    if (recognition && isRecognitionActive) return;

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW';

    recognition.onstart = () => {
        isRecognitionActive = true;
        if (currentState === 'idle' || currentState === 'listening') {
            updateUI('listening');
            
            // 每 10 秒重置一次，防止卡死
            if (watchdogTimer) clearTimeout(watchdogTimer);
            watchdogTimer = setTimeout(() => {
                if (currentState === 'listening' && isRecognitionActive) {
                    console.log("Watchdog: Auto-resetting recognition...");
                    recognition.stop(); 
                }
            }, 10000); 
        }
    };

    recognition.onresult = (event) => {
        // 重置看門狗
        if (currentState === 'listening' && watchdogTimer) {
             clearTimeout(watchdogTimer);
             watchdogTimer = setTimeout(() => {
                if (currentState === 'listening' && isRecognitionActive) recognition.stop();
            }, 8000); 
        }

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        if(transcript.trim()) subText.innerText = transcript;

        if (currentState === 'listening') {
            if (transcript.includes("找會議") || transcript.includes("查詢") || transcript.includes("查一下") || transcript.includes("找一下")) {
                triggerWakeUpFlow();
            }
        } else if (currentState === 'speaking') {
            if (event.results[event.results.length - 1].isFinal) {
                if(transcript.trim().length > 0) {
                    performSearch(transcript);
                }
            }
        }
    };

    recognition.onerror = (event) => {
        if (watchdogTimer) clearTimeout(watchdogTimer);
        if (event.error === 'aborted' || event.error === 'no-speech') {
            isRecognitionActive = false;
            if (['listening', 'speaking', 'showing_results'].includes(currentState)) {
                setTimeout(() => { try{recognition.start()}catch(e){} }, 500);
            }
            return;
        }
        if (event.error === 'not-allowed') {
            isRecognitionActive = false;
        } else {
            updateUI('error');
            isRecognitionActive = false;
        }
    };

    recognition.onend = () => {
        if (watchdogTimer) clearTimeout(watchdogTimer);
        isRecognitionActive = false;
        if (['listening', 'speaking', 'showing_results'].includes(currentState)) {
            try { recognition.start(); } catch(e) {}
        }
    };

    updateUI('listening');
    try { recognition.start(); } catch(e) {}
}

function triggerWakeUpFlow() {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
    
    updateUI('speaking');
    if (recognition) { recognition.onend = null; recognition.stop(); isRecognitionActive = false; }

    const utterance = new SpeechSynthesisUtterance("請說出查詢條件");
    utterance.lang = 'zh-TW';
    
    let micStarted = false;
    utterance.onend = () => {
        if (!micStarted) {
            micStarted = true;
            setTimeout(() => { try { recognition.start(); } catch(e) {} }, 800);
        }
    };
    setTimeout(() => {
        if (!micStarted) {
            micStarted = true;
            try { recognition.start(); } catch(e) {}
        }
    }, 2000);

    try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } catch(e) { 
        if (!micStarted) { micStarted = true; try { recognition.start(); } catch(e) {} }
    }
}

// --- 流程 2: 搜尋 ---
function performSearch(queryText) {
    if (recognition) { recognition.onend = null; recognition.stop(); isRecognitionActive = false; }
    
    let rawKeywords = extractKeywords(queryText);
    const timeCheck = parseTimeFromSpeech(queryText);

    if (rawKeywords === "會議" || rawKeywords === "會議室" || rawKeywords === "討論" || rawKeywords === "") {
        rawKeywords = ""; 
    }

    if (rawKeywords.length < 1 && timeCheck === null) {
        updateUI('speaking', '請說具體一點...');
        speakResult("請告訴我時間或關鍵字", () => {
            try { recognition.start(); } catch(e) {}
        });
        return;
    }

    updateUI('searching', `搜尋：${rawKeywords || (timeCheck ? formatTime(timeCheck) : '')}`);
    
    const count = filterMeetingTable(timeCheck, rawKeywords);

    let replyMsg = count > 0 ? `找到 ${count} 筆會議` : "找不到符合的資料";

    let hasReset = false;
    const forceReset = () => {
        if(!hasReset) { hasReset = true; resetTable(); resetToIdle(); }
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

    // 【新增】茶水相關詞彙轉換
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

// 使用 pinyin-pro 套件

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

    // 茶水不走拼音，直接回傳0 (交給 filterMeetingTable 處理)
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

// --- 表格過濾 ---
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
                const parts = timeCell.innerText.trim().split('~');
                if (parts.length >= 2) {
                    const startMin = parseTimeStr(parts[0]);
                    const endMin = parseTimeStr(parts[1]);
                    if (targetMinute >= startMin - 10 && targetMinute <= endMin + 10) isMatch = true;
                }
            }
        }

        // 2. 關鍵字比對 (如果還沒選上，且有關鍵字)
        if (!isMatch && keyword.length > 0) {
            const rowText = row.innerText.toLowerCase().replace(/\s/g, "");
            
            // 【新增】茶水專用：精確比對
            if (keyword.includes("茶水")) {
                if (rowText.includes("茶水")) {
                    isMatch = true;
                }
            }
            // 樓層篩選
            else if (requiredFloor) {
                if (rowText.includes(requiredFloor)) isMatch = true;
            } 
            // 一般模糊搜尋
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
        } else {
            row.classList.add('meeting-hidden');
            row.classList.remove('meeting-odd', 'meeting-even');
        }
    });
    return matchCount;
}

function parseTimeFromSpeech(text) {
    let isPM = text.includes("下午") || text.includes("晚上") || text.includes("晚間");
    let match = text.match(/(\d{1,2})[:點](\d{0,2})/); 
    if (!match) {
        const cnNums = {'一':1, '兩':2, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '十一':11, '十二':12};
        for (let key in cnNums) {
            if (text.includes(key + "點")) {
                let hour = cnNums[key];
                if (isPM && hour < 12) hour += 12;
                return hour * 60;
            }
        }
        return null;
    }
    let hour = parseInt(match[1]);
    let minute = parseInt(match[2]) || 0;
    if (text.includes("半")) minute = 30;
    if (isPM && hour < 12) hour += 12;
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
    utterance.lang = 'zh-TW';
    utterance.onend = callback;
    utterance.onerror = () => { if(callback) callback(); };
    window.speechSynthesis.speak(utterance);
}

function resetToIdle() {
    updateUI('listening');
    setTimeout(initRecognition, 500);
}

// 自動滾動(記得網頁上內建的滾動要關掉，它會一直刷新頁面害我錄音錄到一半直接重來)
let scrollDirection = 1;
let isPausing = false;
let frameCount = 0; 

function initSafeScroll() {
    const nativeScrollSelect = document.getElementById('ScrollSpeed');
    if (nativeScrollSelect) {
        nativeScrollSelect.value = "0";
        nativeScrollSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    requestAnimationFrame(customScrollLoop);
}

function customScrollLoop() {
    if (currentState !== 'listening' && currentState !== 'idle') {
        requestAnimationFrame(customScrollLoop);
        return;
    }
    if (isPausing) {
        requestAnimationFrame(customScrollLoop);
        return;
    }

    frameCount++;
    if (frameCount % 2 !== 0) {
        requestAnimationFrame(customScrollLoop);
        return;
    }

    const target = document.getElementById('tbl-content');
    if (target) {
        target.scrollTop += (1 * scrollDirection);

        if (scrollDirection === 1) { 
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 50) {
                triggerTurnAround(-1);
            }
        } 
        else { 
            if (target.scrollTop <= 0) {
                triggerTurnAround(1);
            }
        }
    }
    requestAnimationFrame(customScrollLoop);
}

function triggerTurnAround(newDirection) {
    isPausing = true;
    setTimeout(() => {
        scrollDirection = newDirection;
        isPausing = false;
    }, 2000); 
}

setInterval(() => {
    const nativeScrollSelect = document.getElementById('ScrollSpeed');
    if (nativeScrollSelect && nativeScrollSelect.value !== "0") {
        nativeScrollSelect.value = "0";
        nativeScrollSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}, 5000);

setTimeout(initRecognition, 500);
setTimeout(initSafeScroll, 1000);
overlay.addEventListener('click', initRecognition);