// ============================================================================
// 會議看板重新設計 — 控制邏輯（滾動 + 版面處理）
//
// 設計原則：把「會改變版面高度的 DOM 操作」和「自動滾動」在時間上徹底分開。
//   1. 頁面載入時，先一次做完所有會影響高度的處理（欄寬對齊、清理地點括號、
//      標記進行中會議）。
//   2. 之後才啟動自動滾動迴圈。滾動進行期間，本腳本不再修改任何會影響
//      scrollHeight 的東西 —— 因此滾動全程 scrollHeight 是常數，到底判斷永遠準確。
//   3. 需要定期更新的只有「進行中會議」的紅/綠點與流光；這靠一個獨立的低頻
//      計時器處理，且只在捲動停在頂端／底部的「暫停時段」才動手，避免干擾滾動。
//
// 語音助手互動時（content.js 把 #assistant-overlay 加上 .active-mode，代表
// AI 正在回覆或正在顯示搜尋結果）會暫停本迴圈的滾動，避免畫面被捲走。
// ============================================================================

(function () {
    'use strict';

    // ---- 可調參數：滾動節奏 --------------------------------------------------
    const SCROLL_PX_PER_SECOND = 30;  // 滾動速度（每秒移動幾 px），越大越快
    const PAUSE_AT_TOP_MS      = 5000; // 到頂（含起始）停留時間
    const PAUSE_AT_BOTTOM_MS   = 5000; // 到底停留時間

    // ---- 常數 ---------------------------------------------------------------
    const TIME_RANGE = /(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/;
    const PAREN_NOTE = /[(（][^)）]*[)）]/g; // 半形 (…) 與全形 （…）

    const content = document.getElementById('tbl-content');
    if (!content) return;

    // ========================================================================
    // 自訂中文字體（芫荽體）：content script CSS 裡的相對路徑是相對於「網頁本身」
    // 解析的，不是相對於 extension 目錄，所以 @font-face 不能寫在 style.css，
    // 改用 chrome.runtime.getURL() 組出正確的 chrome-extension:// 路徑，
    // 動態插入一個 <style> 標籤。
    // ========================================================================
    (function loadCustomFont() {
        const fontUrl = chrome.runtime.getURL('assets/font/Iansui-Regular.ttf');
        const styleEl = document.createElement('style');
        styleEl.textContent =
            '@font-face {' +
            '  font-family: "Iansui";' +
            '  src: url("' + fontUrl + '") format("truetype");' +
            '  font-weight: 400;' +
            '  font-display: swap;' +
            '}';
        document.head.appendChild(styleEl);
    })();

    // ========================================================================
    // 接管滾動：強制關閉原站 Meeting.js 的自動滾動
    // ------------------------------------------------------------------------
    // Meeting.js 在 $(document).ready 時讀取 #ScrollSpeed 的值決定分支：
    //   - "0"：不啟動滾動，只在 300 秒後整頁 reload（不衝突，可接受）
    //   - 非 0：啟動自己的 setInterval 直接改 #tbl-content 的 scrollTop，
    //     會跟本檔案的 rAF 滾動迴圈同時搶同一個屬性，造成滾動忽快忽慢、
    //     判斷到底失準。
    // 因此不論使用者側邊選單原本選了什麼，一律強制設為 "0"，
    // 把滾動主導權完全交給本檔案。
    // ========================================================================
    const scrollSpeedEl = document.getElementById('ScrollSpeed');
    if (scrollSpeedEl) {
        scrollSpeedEl.value = '0';
    }

    // ========================================================================
    // 清除 Meeting.js 動態塞的 padding-right（滾動條寬度補償）
    // ------------------------------------------------------------------------
    // 原站邏輯：$(window).on('load resize', () => {
    //     scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
    //     $('.tbl-header').css({ 'padding-right': scrollWidth });
    // }).resize();
    // 這是原站用來補償滾動條寬度、讓表頭跟內容同寬的手法，但我們已經把
    // .tbl-content 的滾動條隱藏（不占版面寬度），且 .tbl-header/.tbl-content
    // 的 padding 完全由本 extension 的 CSS 控制，這段 inline style 只會
    // 干擾格線對齊，故直接清空並持續監控、一旦被寫回就立刻移除。
    // ========================================================================
    const tblHeaderEl = document.querySelector('.tbl-header');
    if (tblHeaderEl) {
        tblHeaderEl.style.paddingRight = '';
        new MutationObserver(function () {
            if (tblHeaderEl.style.paddingRight) {
                tblHeaderEl.style.paddingRight = '';
            }
        }).observe(tblHeaderEl, { attributes: true, attributeFilter: ['style'] });
    }

    // ========================================================================
    // 版面處理（只在啟動時做，之後不再改動高度）
    // ========================================================================

    // 表頭與內容是兩張獨立表格，欄寬各算各的會對不齊。
    // 把表頭欄寬比例轉成一組 grid 格線，同一份套到表頭列與每一條內容列，
    // 兩邊共用同一組隱形格線 → 欄位必然對齊（style.css 已把列設為 display:grid）。
    // 會議時間欄（第一欄）原站給的比例偏寬，這裡額外乘上縮減係數讓它窄一點，
    // 省下的空間會自動分配給其他欄位（grid fr 比例會依總和重新分配）。
    const TIME_COLUMN_SHRINK = 0.6;

    function syncColumnWidths() {
        const ths = Array.from(document.querySelectorAll('.tbl-header th'));
        if (!ths.length) return;

        const template = ths.map(function (th, index) {
            const fr = parseFloat(th.style.width) || 1;
            return (index === 0 ? fr * TIME_COLUMN_SHRINK : fr) + 'fr';
        }).join(' ');

        ths[0].parentElement.style.gridTemplateColumns = template;
        content.querySelectorAll('tbody tr').forEach(function (row) {
            if (row.cells.length === ths.length) {
                row.style.gridTemplateColumns = template;
            }
        });
    }

    // 會議地點欄（第 3 欄）常帶括號註記（如「(不開放外機關借用)」），看板上是雜訊。
    function cleanLocationNotes() {
        content.querySelectorAll('tbody tr').forEach(function (row) {
            const cell = row.cells && row.cells[2];
            if (cell && PAREN_NOTE.test(cell.textContent)) {
                cell.textContent = cell.textContent.replace(PAREN_NOTE, '').trim();
            }
        });
    }

    // 會議時間欄（第 1 欄）原站資料的 ~ 前後空白不對稱（例如右邊多一格半形），
    // 統一重新格式化成「HH:MM ~ HH:MM」，兩邊各一個空格。
    function normalizeTimeSpacing() {
        content.querySelectorAll('tbody tr').forEach(function (row) {
            const cell = row.cells && row.cells[0];
            const m = cell && cell.textContent.match(TIME_RANGE);
            if (m) {
                cell.textContent = m[1] + ':' + m[2] + ' ~ ' + m[3] + ':' + m[4];
            }
        });
    }

    // 「事務準備」欄（電腦/單槍/茶水...）改用 SVG 圖示呈現。
    // 欄位可能因側邊選單顯示設定而位移，故用表頭文字找出正確欄位索引；
    // 每個原本用逗號/換行分隔的項目各自轉成一個 <img> 圖示。
    const PREP_ICONS = [
        [/茶水/, 'mug'],
        [/電腦/, 'computer'],
        [/單槍/, 'projecter'],
        [/錄製視訊影像與剪報|視訊會議|視訊/, 'concall'],
        [/電話會議|電話/, 'phone'],
    ];

    function iconizePreparing() {
        const ths = Array.from(document.querySelectorAll('.tbl-header th'));
        const colIndex = ths.findIndex(function (th) {
            return th.textContent.trim() === '事務準備';
        });
        if (colIndex === -1) return;

        content.querySelectorAll('tbody tr').forEach(function (row) {
            const cell = row.cells && row.cells[colIndex];
            if (!cell) return;

            // 原站用 white-space: pre-wrap 呈現，多個項目其實是同一個文字節點
            // 內用 \n 換行分隔（不是 <br> 標籤），所以要用 textContent 依 \n 分行
            const lines = cell.textContent.split(/\r\n|\r|\n/);
            cell.innerHTML = '';
            cell.classList.add('prep-icons');

            lines.forEach(function (line) {
                const text = line.trim();
                if (!text) return;

                let iconName = null;
                for (let i = 0; i < PREP_ICONS.length; i++) {
                    if (PREP_ICONS[i][0].test(text)) {
                        iconName = PREP_ICONS[i][1];
                        break;
                    }
                }

                const wrap = document.createElement('span');
                wrap.className = 'prep-icon-item';
                if (iconName) {
                    const img = document.createElement('img');
                    img.className = 'prep-icon-img';
                    img.src = chrome.runtime.getURL('assets/icons/icon-svg/' + iconName + '.svg');
                    img.alt = text;
                    img.title = text;
                    wrap.appendChild(img);
                } else {
                    // 沒對到關鍵字的項目維持顯示原文字，不遺漏資訊
                    wrap.textContent = text;
                }
                cell.appendChild(wrap);
            });
        });
    }

    // ========================================================================
    // 會議狀態標記（灰/黃/綠/紅點 + 流光）
    // 灰＝尚未開始（開會前 15 分鐘以上）、黃＝即將開始（開會前 15 分鐘內，閃爍）、
    // 綠＝進行中（含流光）、紅＝已結束。只切換 class，不改文字/欄寬，
    // 對高度的影響極小；仍安排在暫停時段執行。
    // ========================================================================
    const SOON_THRESHOLD_MINS = 15;

    function updateActiveMeetings() {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        const rows = Array.from(content.querySelectorAll('tbody tr'));
        let allPast = true;

        rows.forEach(function (row) {
            const cell = row.cells && row.cells[0];
            const m = cell && cell.textContent.match(TIME_RANGE);
            let state = 'upcoming'; // upcoming(灰) | soon(黃) | active(綠) | past(紅)
            if (m) {
                const start = Number(m[1]) * 60 + Number(m[2]);
                const end = Number(m[3]) * 60 + Number(m[4]);
                if (nowMins >= end) {
                    state = 'past';
                } else if (nowMins >= start) {
                    state = 'active';
                } else if (start - nowMins <= SOON_THRESHOLD_MINS) {
                    state = 'soon';
                }
            }
            row.classList.toggle('meeting-now', state === 'active');
            row.classList.toggle('meeting-soon', state === 'soon');
            row.classList.toggle('meeting-past', state === 'past');
            if (state !== 'past') allPast = false;
        });

        setEmptyState(allPast);
    }

    // ========================================================================
    // 空狀態畫面：今日會議全部結束（或本來就沒有會議）時，用一張圖片
    // 取代空白的捲動區，避免看板看起來像壞掉。
    // ========================================================================
    let emptyStateEl = null;

    function buildEmptyState() {
        const el = document.createElement('div');
        el.id = 'empty-state-cyber';

        const img = document.createElement('img');
        img.className = 'empty-state-img';
        img.src = chrome.runtime.getURL('assets/photos/1000028552-removebg-preview.png');
        img.alt = '今日會議已全部結束';

        el.appendChild(img);
        return el;
    }

    function setEmptyState(show) {
        if (show) {
            if (!emptyStateEl) {
                emptyStateEl = buildEmptyState();
                content.parentElement.appendChild(emptyStateEl);
            }
            emptyStateEl.style.display = 'flex';
            content.style.display = 'none';
        } else {
            if (emptyStateEl) emptyStateEl.style.display = 'none';
            content.style.display = '';
        }
    }

    // ========================================================================
    // 自動滾動
    // 單一 requestAnimationFrame 迴圈，用時間增量位移（不受掉幀影響）。
    // 流程：停在頂端 → 平滑往下滾到底 → 停在底端 → 平滑滾回頂端 → 循環。
    // ========================================================================
    let phase = 'pauseTop';   // pauseTop | down | pauseBottom | up
    let phaseUntil = 0;       // 暫停狀態的結束時間戳
    let lastTs = 0;

    function isAssistantActive() {
        const overlay = document.getElementById('assistant-overlay');
        return !!overlay && overlay.classList.contains('active-mode');
    }

    function frame(ts) {
        requestAnimationFrame(frame);

        // dt 設上限：分頁切背景或嚴重掉幀後，rAF 間隔可能達數秒，
        // 不設限會讓恢復的那一幀瞬間跳一大段（忽快忽慢的元凶）。
        const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
        lastTs = ts;

        // 語音助手正在回覆/顯示結果時，整個狀態機原地凍結（連暫停倒數都不走），
        // 避免使用者還沒看完結果，計時就已經跑完並開始滾動。
        if (isAssistantActive()) {
            return;
        }

        // 空狀態畫面顯示中（今日會議已結束），沒有內容可滾，直接跳過。
        if (content.style.display === 'none') {
            return;
        }

        const max = content.scrollHeight - content.clientHeight;

        switch (phase) {
            case 'pauseTop':
                if (ts >= phaseUntil) phase = 'down';
                break;

            case 'down':
                if (content.scrollTop >= max - 1) {
                    content.scrollTop = max;           // 貼齊底部
                    phase = 'pauseBottom';
                    phaseUntil = ts + PAUSE_AT_BOTTOM_MS;
                    onPause();
                } else {
                    content.scrollTop += SCROLL_PX_PER_SECOND * dt;
                }
                break;

            case 'pauseBottom':
                if (ts >= phaseUntil) phase = 'up';
                break;

            case 'up':
                if (content.scrollTop <= 1) {
                    content.scrollTop = 0;             // 貼齊頂部
                    phase = 'pauseTop';
                    phaseUntil = ts + PAUSE_AT_TOP_MS;
                    onPause();
                } else {
                    content.scrollTop -= SCROLL_PX_PER_SECOND * dt;
                }
                break;
        }
    }

    // 每次進入暫停時段，順便刷新一次「進行中會議」標記。
    // 這是唯一在啟動後還會改 DOM 的地方，且刻意選在畫面靜止時執行。
    function onPause() {
        updateActiveMeetings();
    }

    // ========================================================================
    // 啟動
    // ========================================================================
    syncColumnWidths();
    cleanLocationNotes();
    normalizeTimeSpacing();
    iconizePreparing();
    updateActiveMeetings();

    phase = 'pauseTop';
    phaseUntil = performance.now() + PAUSE_AT_TOP_MS;
    requestAnimationFrame(frame);
})();
