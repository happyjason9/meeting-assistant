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
        const fontUrl = chrome.runtime.getURL('assets/font/Iansui-Regular.woff2');
        const styleEl = document.createElement('style');
        styleEl.textContent =
            '@font-face {' +
            '  font-family: "Iansui";' +
            '  src: url("' + fontUrl + '") format("woff2");' +
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

    // 「承辦人」欄天生只有 7% 寬，三個字用預設 26px 表頭字級會擠不下、
    // 加上 nowrap 後直接溢出到旁欄。用表頭文字找出這一欄，單獨縮小字級，
    // 其他欄位（夠寬）維持原字級不受影響。
    function shrinkNarrowHeader(headerText) {
        const ths = Array.from(document.querySelectorAll('.tbl-header th'));
        const th = ths.find(function (t) { return t.textContent.trim() === headerText; });
        if (th) th.classList.add('th-narrow');
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
            // 換成圖示前先保留原始文字，供語音搜尋比對用（否則 innerText 只剩圖示 alt）
            if (cell.dataset.zh === undefined) cell.dataset.zh = cell.textContent;
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
    // 承辦人欄位語音開關：講「承辦人」顯示、「關閉承辦人」隱藏。
    //
    // 欄位是否存在於表格 DOM，取決於原站側邊選單「表單顯示選項」裡 #User
    // checkbox 的勾選狀態——這個設定是靠表單 POST 整頁送出的（見 Meeting.js
    // 沒有任何前端切換欄位的邏輯），不是單純 CSS 顯示/隱藏。開/關都統一走
    // 「勾選 #User + 提交表單 + 整頁重新渲染」，確保欄位移除/加回時，
    // 欄寬與版面是由伺服器端重新輸出、不會有殘留空隙或排版跑掉。
    // ========================================================================
    function submitOwnerColumnChange(visible) {
        const checkbox = document.getElementById('User');
        const submitBtn = document.getElementById('btn-select-host');
        const form = submitBtn && submitBtn.closest('form');
        if (!checkbox || !form) return false;

        if (checkbox.checked === visible) {
            // 勾選狀態已經是目標值，重新提交也不會有變化，直接放棄避免無意義 reload。
            return false;
        }
        checkbox.checked = visible;
        form.submit();
        return true;
    }

    window.__meetingBoardSetOwnerVisible = function (visible) {
        submitOwnerColumnChange(visible);
    };

    // ========================================================================
    // 會議狀態標記（灰/黃/綠/紅點 + 流光）
    // 灰＝尚未開始（開會前 15 分鐘以上）、黃＝即將開始（開會前 15 分鐘內，閃爍）、
    // 綠＝進行中（含流光）、紅＝已結束。只切換 class，不改文字/欄寬，
    // 對高度的影響極小；仍安排在暫停時段執行。
    // ========================================================================
    const SOON_THRESHOLD_MINS = 15;

    // 進行中會議的繞邊流光（樣式見 style.css .beam）。position:absolute 不佔版面，
    // 加在列的最後面，不影響 td:nth-child 的欄位索引（翻譯、事務準備圖示都靠它）。
    function syncBeam(row, on) {
        const beam = row.querySelector(':scope > .beam');
        if (on && !beam) {
            const el = document.createElement('span');
            el.className = 'beam';
            const spin = document.createElement('span');
            spin.className = 'beam-spin';
            el.appendChild(spin);
            row.appendChild(el);
        } else if (!on && beam) {
            beam.remove();
        }
    }

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
            syncBeam(row, state === 'active');
            if (state !== 'past') allPast = false;
        });

        // 側邊選單「顯示開過之會議」（#Display，value="1"）開啟時，表格本來就會
        // 刻意列出已結束的會議，此時「全部都是 past」是正常內容、不是沒會議，
        // 不該被空狀態圖片蓋掉；只有真的一列都沒有，或該設定關閉（預設）時
        // 全部過期，才視為空狀態。
        const displaySelect = document.getElementById('Display');
        const showingPastMeetings = displaySelect && displaySelect.value === '1';
        const isEmpty = rows.length === 0 || (allPast && !showingPastMeetings);
        setEmptyState(isEmpty);
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
    // 底部疾管署資訊輪播（左側，右側留給語音助手的「聆聽中」）
    //
    // 資料來源：疾管署「新聞稿」RSS（由 background.js 代抓，最新 10 則）。
    // 快取 1 小時：原站 Meeting.js 每 300 秒會整頁 reload，若每次載入都重抓，
    // 一天會打官網近 300 次。所以載入時先看快取時間，未滿 1 小時直接用快取，
    // 過期才重抓（新聞稿多在下午 2 點發布，最晚 1 小時內會出現在看板上）。
    // 抓取失敗時沿用上次成功的內容，網路短暫斷線時看板不會變空白。
    //
    // 一次顯示一則，停留時間依字數決定（見 tickerHoldMs），再淡入下一則。標題一行放不下的，
    // 加上 .is-long 改用小字、最多兩行（見 style.css）。
    // 輪播區是 position:fixed 獨立於表格，更新它不影響 .tbl-content 的 scrollHeight。
    // ========================================================================
    // 停留時間 = 基本時間（注意到、把視線移過來）+ 每字閱讀時間，限制在最短～最長之間。
    // 看板前的人多半是邊走邊瞄，閱讀速度抓得比坐著讀慢。
    const TICKER_HOLD_BASE_MS = 2000;
    const TICKER_HOLD_PER_CHAR_MS = 180;
    const TICKER_HOLD_MIN_MS = 4000;
    const TICKER_HOLD_MAX_MS = 12000;

    function tickerHoldMs(title) {
        const ms = TICKER_HOLD_BASE_MS + title.length * TICKER_HOLD_PER_CHAR_MS;
        return Math.min(Math.max(ms, TICKER_HOLD_MIN_MS), TICKER_HOLD_MAX_MS);
    }
    const TICKER_REFRESH_MS = 60 * 60 * 1000;

    let tickerViewport = null;
    let tickerShownKey = null;
    let tickerTimer = null;

    function buildTicker() {
        const el = document.createElement('div');
        el.id = 'epi-ticker';

        const label = document.createElement('div');
        label.className = 'epi-ticker-label';
        label.textContent = '疾管署資訊';

        tickerViewport = document.createElement('div');
        tickerViewport.className = 'epi-ticker-viewport';

        el.appendChild(label);
        el.appendChild(tickerViewport);
        document.body.appendChild(el);

        // 視窗大小改變時，重新判斷哪些標題需要縮成兩行
        window.addEventListener('resize', fitTickerItems);
        // content.js 翻譯／還原後文字長度改變，也要重新判斷（兩支 content script 共用同一個 isolated world）
        window.__meetingBoardRefitTicker = fitTickerItems;
    }

    // 逐段縮字：先以一般字級單行量測，超出寬度才標 .is-long（小字兩行），
    // 兩行還被截斷（內容高度超過可見高度）再加 .is-xlong（更小字三行）
    function fitTickerItems() {
        if (!tickerViewport) return;
        tickerViewport.querySelectorAll('.epi-ticker-item').forEach(function (el) {
            el.classList.remove('is-long', 'is-xlong');
            if (el.scrollWidth <= el.clientWidth + 1) return;
            el.classList.add('is-long');
            // 行高有小數（22px × 1.3），兩行剛好放滿時 scrollHeight 也會比 clientHeight 多 1px，
            // 真的多一行至少差 20px 以上，所以門檻放寬到 4px 避免誤判
            if (el.scrollHeight > el.clientHeight + 4) el.classList.add('is-xlong');
        });
    }

    // items: [{ date: '10/13', title: '...' }]
    function renderTicker(items) {
        const key = JSON.stringify(items);
        if (key === tickerShownKey) return;
        tickerShownKey = key;

        if (tickerTimer) clearTimeout(tickerTimer);
        tickerViewport.textContent = '';

        const els = items.map(function (it) {
            const item = document.createElement('div');
            item.className = 'epi-ticker-item';
            if (it.date) {
                const date = document.createElement('span');
                date.className = 'epi-ticker-date';
                date.textContent = it.date;
                item.appendChild(date);
            }
            // 標題獨立包一層 span，content.js 翻譯時只換這層文字、不動日期
            const title = document.createElement('span');
            title.className = 'epi-ticker-title';
            title.textContent = it.title;
            item.appendChild(title);
            tickerViewport.appendChild(item);
            return item;
        });

        // 等字體載入完再量寬度，否則換字體後寬度會變、判斷失準
        document.fonts.ready.then(fitTickerItems);

        // 通知 content.js：英文模式下要把新建的輪播內容翻成英文
        if (typeof window.__meetingBoardOnTickerRendered === 'function') {
            window.__meetingBoardOnTickerRendered();
        }

        let index = 0;
        els[0].classList.add('is-active');
        if (els.length < 2) return;

        // 每則停留時間不同，用 setTimeout 串接而非 setInterval。
        // 舊的先往上離場（0.3 秒），0.15 秒後新的從下方進場，兩者稍微重疊，交接不留空檔。
        function next() {
            const prev = els[index];
            prev.classList.remove('is-active');
            prev.classList.add('is-leaving');
            setTimeout(function () { prev.classList.remove('is-leaving'); }, 300);

            index = (index + 1) % els.length;
            const cur = els[index];
            setTimeout(function () { cur.classList.add('is-active'); }, 150);
            tickerTimer = setTimeout(next, tickerHoldMs(items[index].title));
        }
        tickerTimer = setTimeout(next, tickerHoldMs(items[0].title));
    }

    // RSS 的 guid 是發布時間（如 2026-10-13-14-00-00），取月/日顯示
    function itemsFromRss(text) {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        return Array.from(doc.querySelectorAll('item')).map(function (item) {
            const title = (item.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim();
            const guid = item.querySelector('guid')?.textContent || '';
            const m = guid.match(/^\d{4}-(\d{2})-(\d{2})/);
            const date = m ? Number(m[1]) + '/' + Number(m[2]) : '';
            return { date: date, title: title };
        }).filter(function (it) { return it.title.length > 0; });
    }

    // 抓取失敗：有舊內容就沿用；完全沒有內容時顯示提示，避免跑馬燈空白一條像壞掉。
    // 最常見原因是擴充功能的「網站存取權」只允許 meeting.cdc.gov.tw，
    // 沒有 www.cdc.gov.tw，background 的 fetch 會被擋（Failed to fetch）。
    function onTickerFail(reason) {
        console.warn('[跑馬燈] 抓取疾管署新聞稿 RSS 失敗：', reason,
            '｜請確認擴充功能的網站存取權包含 https://www.cdc.gov.tw');
        if (tickerShownKey === null) {
            renderTicker([{ date: '', title: '暫時無法取得疾管署最新新聞稿' }]);
        }
    }

    function refreshTicker() {
        try {
            chrome.runtime.sendMessage({ target: 'background', action: 'fetch_ticker' }, function (res) {
                if (chrome.runtime.lastError || !res) {
                    onTickerFail(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'background 沒有回應');
                    return;
                }
                if (res.ok) {
                    const items = itemsFromRss(res.text);
                    if (items.length) {
                        renderTicker(items);
                        chrome.storage.local.set({ tickerCache: items, tickerCachedAt: Date.now() });
                    } else {
                        onTickerFail('RSS 內容解析不到任何新聞稿');
                    }
                } else {
                    onTickerFail(res.error);
                }
            });
        } catch (e) {
            // 擴充功能重新載入後舊頁面的 chrome.runtime 會失效，忽略即可
        }
    }

    function startTicker() {
        buildTicker();
        // 先用快取立刻顯示，再去抓最新內容
        chrome.storage.local.get(['tickerCache', 'tickerCachedAt'], function (data) {
            const hasCache = data && Array.isArray(data.tickerCache) && data.tickerCache.length
                && typeof data.tickerCache[0] === 'object';
            if (hasCache) renderTicker(data.tickerCache);

            const age = Date.now() - (data.tickerCachedAt || 0);
            if (!hasCache || age >= TICKER_REFRESH_MS) refreshTicker();
        });
        setInterval(refreshTicker, TICKER_REFRESH_MS);
    }

    // ========================================================================
    // 自動滾動
    // 單一 requestAnimationFrame 迴圈，用時間增量位移（不受掉幀影響）。
    // 流程：停在頂端 → 平滑往下滾到底 → 停在底端 → 平滑滾回頂端 → 循環。
    // ========================================================================
    let phase = 'pauseTop';   // pauseTop | down | pauseBottom | up
    let phaseUntil = 0;       // 暫停狀態的結束時間戳
    let lastTs = 0;
    // 自己記住捲動位置（浮點數），不從 scrollTop 讀回來累加：
    // 每幀只移動零點幾 px，在像素比 1 的螢幕上 Chrome 會把 scrollTop 捨入成整數，
    // 「讀回來 + 0.5」每次都被捨回原值，畫面就永遠卡在頂端不動。
    let scrollPos = 0;
    // 起步／停止的緩衝：速度在 SCROLL_RAMP_S 秒內從 0 加到 SCROLL_PX_PER_SECOND，
    // 接近終點時以同樣的減速度煞停，不再瞬間起停。
    const SCROLL_RAMP_S = 0.8;
    let scrollSpeed = 0;

    function stepScrollSpeed(remaining, dt) {
        const accel = SCROLL_PX_PER_SECOND / SCROLL_RAMP_S;
        scrollSpeed = Math.min(
            scrollSpeed + accel * dt,                        // 加速中
            SCROLL_PX_PER_SECOND,                            // 等速巡航
            Math.sqrt(2 * accel * Math.max(remaining, 0))    // 剩餘距離剛好煞得停的速度
        );
        return Math.max(scrollSpeed, 2); // 保底 2px/s，避免最後一點距離慢到停不下來
    }

    // 語音搜尋顯示結果時由 content.js 呼叫：從頂端重新開始捲動（頂端只停 RESULT_PAUSE_TOP_MS），
    // 回傳「捲完全部結果並在底部稍停」所需的毫秒數，content.js 據此決定結果要停留多久。
    // 結果一個畫面放得下（不需要捲）時回傳 0。
    const RESULT_PAUSE_TOP_MS = 2000;
    const RESULT_PAUSE_BOTTOM_MS = 2000;
    window.__meetingBoardShowFromTop = function () {
        scrollPos = 0;
        scrollSpeed = 0;
        content.scrollTop = 0;
        phase = 'pauseTop';
        phaseUntil = performance.now() + RESULT_PAUSE_TOP_MS;

        const max = content.scrollHeight - content.clientHeight;
        if (max <= 0) return 0;
        // 等速段 + 起步／煞停各多出約半個緩衝時間
        return RESULT_PAUSE_TOP_MS + (max / SCROLL_PX_PER_SECOND) * 1000 + SCROLL_RAMP_S * 1000 + RESULT_PAUSE_BOTTOM_MS;
    };

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

        // scrollTop 被外部改過（手動捲動、語音搜尋重置表格），從實際位置接續
        if (Math.abs(content.scrollTop - scrollPos) > 2) {
            scrollPos = content.scrollTop;
        }

        switch (phase) {
            case 'pauseTop':
                if (ts >= phaseUntil) phase = 'down';
                break;

            case 'down':
                if (scrollPos >= max - 1) {
                    scrollPos = max;                   // 貼齊底部
                    content.scrollTop = scrollPos;
                    scrollSpeed = 0;
                    phase = 'pauseBottom';
                    phaseUntil = ts + PAUSE_AT_BOTTOM_MS;
                    onPause();
                } else {
                    scrollPos = Math.min(scrollPos + stepScrollSpeed(max - scrollPos, dt) * dt, max);
                    content.scrollTop = scrollPos;
                }
                break;

            case 'pauseBottom':
                if (ts >= phaseUntil) phase = 'up';
                break;

            case 'up':
                if (scrollPos <= 1) {
                    scrollPos = 0;                     // 貼齊頂部
                    content.scrollTop = 0;
                    scrollSpeed = 0;
                    phase = 'pauseTop';
                    phaseUntil = ts + PAUSE_AT_TOP_MS;
                    onPause();
                } else {
                    scrollPos = Math.max(scrollPos - stepScrollSpeed(scrollPos, dt) * dt, 0);
                    content.scrollTop = scrollPos;
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
    shrinkNarrowHeader('承辦人');
    updateActiveMeetings();

    phase = 'pauseTop';
    phaseUntil = performance.now() + PAUSE_AT_TOP_MS;
    requestAnimationFrame(frame);

    // 跑馬燈放在滾動啟動之後，且出錯也不影響看板本體
    try {
        startTicker();
    } catch (e) {
        console.warn('[跑馬燈] 啟動失敗：', e);
    }
})();
