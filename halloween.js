// ============================================================================
// 萬聖節主題（樣式見 halloween.css）
//
// 只在節日期間生效：每年 10/24～11/1 在 <html> 加上 .theme-halloween，其餘日期什麼都不做。
// 原站每 300 秒整頁 reload，日期一過自動恢復原樣，不需要手動關。
// 測試或提早／延後關閉：把 HALLOWEEN_FORCE 改成 true／false（null = 依日期）。
//
// 必須排在 redesign.js 之前執行（manifest 的 js 順序）：redesign.js 啟動時就可能顯示
// 空狀態畫面，class 要先加好，萬聖節版空狀態才會套上。
// ============================================================================

(function () {
    'use strict';

    const HALLOWEEN_FORCE = null;

    const BAT_FIRST_DELAY_MS = 8000;           // 載入後第一群蝙蝠出現的時間
    const BAT_INTERVAL_MS = [15000, 35000];    // 之後每隔多久飛過一群
    const BAT_FLIGHT_MS = [6000, 8000];        // 飛越整個畫面的時間
    const BAT_SIZE_PX = [80, 120];             // 單隻寬度範圍
    const BAT_GROUP = [1, 3];                  // 一群幾隻
    const BAT_CARD_CHANCE = 0.5;               // 一群蝙蝠改在卡片區飛的機率（其餘在標題列）
    const BAT_Z_BEHIND = 0;                    // 卡片後面：在月亮霧氣（z 0，DOM 較前）之上、卡片區（z 1）之下
    const BAT_Z_FRONT = 5;                     // 卡片前面：在卡片之上、表頭（z 9）之下


    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const inSeason = (month === 10 && day >= 24) || (month === 11 && day <= 1);
    if (!(HALLOWEEN_FORCE === null ? inSeason : HALLOWEEN_FORCE)) return;

    document.documentElement.classList.add('theme-halloween');

    // ---- 月亮與薄霧：疊在背景與卡片之間（卡片的毛玻璃會把它們柔化） ----
    const sky = document.createElement('div');
    sky.className = 'halloween-sky';
    const asset = function (name) { return chrome.runtime.getURL('assets/halloween/' + name); };
    sky.innerHTML =
        '<div class="halloween-moon-halo"></div>' +
        '<div class="halloween-moon"></div>' +
        '<img class="halloween-tree halloween-tree-tall" alt="" src="' + asset('tree-tall.svg') + '">' +
        '<img class="halloween-tree halloween-tree-small" alt="" src="' + asset('tree-small.svg') + '">' +
        '<div class="halloween-fog halloween-fog-1"></div>' +
        '<div class="halloween-fog halloween-fog-2"></div>';
    document.body.appendChild(sky);


    // ---- 會議卡片上的南瓜燈（樣式見 halloween.css） ----
    // 依會議名稱算出固定的亂數：同一場會議每次 reload 結果相同，南瓜不會每 5 分鐘亂跳，
    // 但不同會議之間看起來沒有規律。
    const PUMPKIN_CHANCE = 0.4;            // 約四成卡片有南瓜
    const PUMPKIN_X = [8, 88];             // 左緣位置（卡片寬度 %）
    const PUMPKIN_SIZE = [34, 52];         // 寬度 px
    const PUMPKIN_TILT = [-12, 12];        // 傾斜角度
    const PUMPKIN_COLORS = ['rotten', 'black', 'purple']; // 陰森配色（樣式見 halloween.css）

    // 字串 → 一串 0~1 的固定亂數（FNV-1a 雜湊 + mulberry32）
    function seededRandom(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return function () {
            h = (h + 0x6D2B79F5) | 0;
            let t = Math.imul(h ^ (h >>> 15), 1 | h);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    document.querySelectorAll('.tbl-content tbody tr').forEach(function (row, index) {
        if (index === 0) return; // 第一張卡片上方空間不夠，南瓜會被捲動區頂端切掉
        const r = seededRandom(row.textContent.replace(/\s/g, ''));
        if (r() >= PUMPKIN_CHANCE) return;
        const lerp = function (range) { return range[0] + r() * (range[1] - range[0]); };
        row.style.setProperty('--pk-x', lerp(PUMPKIN_X).toFixed(1) + '%');
        row.style.setProperty('--pk-size', Math.round(lerp(PUMPKIN_SIZE)) + 'px');
        row.style.setProperty('--pk-tilt', lerp(PUMPKIN_TILT).toFixed(1) + 'deg');
        row.style.setProperty('--pk-delay', (-r() * 3.2).toFixed(2) + 's');
        // 顏色最後才抽：不改變已擺好的南瓜位置
        row.setAttribute('data-pumpkin', PUMPKIN_COLORS[Math.floor(r() * PUMPKIN_COLORS.length)]);
    });

    // ---- 蜘蛛網（只有網，沒有蜘蛛） ----
    // 約三成的卡片角落結一張小網。跟南瓜一樣依會議名稱決定，但用另一組亂數，兩者分佈互不相關。
    // 網加在列的最後面、絕對定位不佔格：不影響 td:nth-child 欄位索引（翻譯、搜尋都靠它）。
    // 左上角靠近會議時間文字，機率較低、網也較小
    const WEB_CHANCE = 0.4;
    const WEB_CORNERS = [['tr', 0.45, [64, 100]], ['br', 0.35, [64, 100]], ['tl', 0.2, [52, 70]]];

    document.querySelectorAll('.tbl-content tbody tr').forEach(function (row) {
        const r = seededRandom(row.textContent.replace(/\s/g, '') + '#web');
        if (r() >= WEB_CHANCE) return;
        let pick = r(), corner = WEB_CORNERS[0];
        for (let i = 0; i < WEB_CORNERS.length; i++) {
            if (pick < WEB_CORNERS[i][1]) { corner = WEB_CORNERS[i]; break; }
            pick -= WEB_CORNERS[i][1];
        }
        const web = document.createElement('img');
        web.className = 'card-web card-web-' + corner[0];
        web.alt = '';
        web.src = asset('web-corner.svg');
        web.style.width = Math.round(corner[2][0] + r() * (corner[2][1] - corner[2][0])) + 'px';
        row.appendChild(web);
    });

    // ---- 詭異藤蔓：約兩成卡片，從側邊爬下、繞過下方圓角、沿下緣蔓延 ----
    // 跟蜘蛛網一樣加在列的最後面、絕對定位不佔格。右下角已有網的卡片，藤蔓改爬左下角。
    const VINE_CHANCE = 0.3;
    const VINE_WIDTH = [300, 440];         // px（圖的比例固定，高度跟著縮放）

    document.querySelectorAll('.tbl-content tbody tr').forEach(function (row) {
        const r = seededRandom(row.textContent.replace(/\s/g, '') + '#vine');
        if (r() >= VINE_CHANCE) return;
        const side = (r() < 0.5 || row.querySelector('.card-web-br')) ? 'bl' : 'br';
        const vine = document.createElement('img');
        vine.className = 'card-vine card-vine-' + side;
        vine.alt = '';
        vine.src = asset('vine-corner.svg');
        vine.style.width = Math.round(VINE_WIDTH[0] + r() * (VINE_WIDTH[1] - VINE_WIDTH[0])) + 'px';
        row.appendChild(vine);
    });

    // ---- 蝙蝠：偶爾成群從標題列飛過 ----
    const BAT_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 64">' +
        '<g class="bat-wing bat-wing-l"><path d="M54 30 C42 16 22 10 4 18 C12 22 14 30 12 37 C20 31 26 33 30 40 C34 32 42 32 46 40 C48 34 52 34 54 38 Z" fill="#5b4380"/></g>' +
        '<g class="bat-wing bat-wing-r"><path d="M66 30 C78 16 98 10 116 18 C108 22 106 30 108 37 C100 31 94 33 90 40 C86 32 78 32 74 40 C72 34 68 34 66 38 Z" fill="#5b4380"/></g>' +
        '<path d="M53 16 L55 6 L58 13 L62 13 L65 6 L67 16 Z" fill="#6b5290"/>' +
        '<ellipse cx="60" cy="34" rx="8" ry="13" fill="#6b5290"/>' +
        '<circle cx="60" cy="20" r="7.5" fill="#6b5290"/>' +
        '<circle cx="57" cy="19" r="1.8" fill="#ffb347"/>' +
        '<circle cx="63" cy="19" r="1.8" fill="#ffb347"/>' +
        '</svg>';

    function rand(min, max) { return min + Math.random() * (max - min); }

    // 一群蝙蝠：同方向、前後錯開出發，大小與高度略不同；拍翅與起伏也錯開，不會整齊劃一
    function flyBats() {
        const cards = document.querySelector('.tbl-content');
        if (cards && Math.random() < BAT_CARD_CHANCE) flyBatsOverCards(cards);
        else flyBatsOverTitle();
    }

    function flyBatsOverTitle() {
        const titleBar = document.querySelector('.title-bar');
        const barHeight = titleBar ? titleBar.getBoundingClientRect().height : 110;
        const fromLeft = Math.random() < 0.5;
        const count = Math.floor(rand(BAT_GROUP[0], BAT_GROUP[1] + 1));
        const duration = rand(BAT_FLIGHT_MS[0], BAT_FLIGHT_MS[1]);
        for (let i = 0; i < count; i++) {
            const size = rand(BAT_SIZE_PX[0], BAT_SIZE_PX[1]);
            const yMax = Math.max(0, barHeight - size * 0.45);
            setTimeout(function () {
                flyBat(fromLeft, -6, yMax, size, duration * rand(0.92, 1.08), { swing: 40 });
            }, i * rand(350, 900));
        }
    }

    // 卡片區：每隻各自決定在卡片後面、前面，或中途穿過卡片（後→前、前→後）。
    // 卡片是半透明毛玻璃，後面的蝙蝠透過卡片是模糊的影子，飛到卡片間的縫隙才清楚。
    function flyBatsOverCards(cards) {
        const rect = cards.getBoundingClientRect();
        const fromLeft = Math.random() < 0.5;
        const count = Math.floor(rand(BAT_GROUP[0], BAT_GROUP[1] + 1));
        const duration = rand(BAT_FLIGHT_MS[0], BAT_FLIGHT_MS[1]) * 1.15;
        for (let i = 0; i < count; i++) {
            const mode = ['behind', 'front', 'weave'][Math.floor(Math.random() * 3)];
            // 後面的遠一點：小一點、飛慢一點
            const size = rand(BAT_SIZE_PX[0], BAT_SIZE_PX[1]) * (mode === 'behind' ? 0.75 : 1);
            const yMin = rect.top + 10;
            const yMax = Math.max(yMin, rect.bottom - size * 0.6);
            setTimeout(function () {
                flyBat(fromLeft, yMin, yMax, size, duration * rand(0.92, 1.08) * (mode === 'behind' ? 1.2 : 1),
                    { swing: 140, depth: mode });
            }, i * rand(500, 1400));
        }
    }

    // Catmull-Rom 曲線：穿過每個控制點的平滑曲線
    function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
    }

    // 蝙蝠飛行不是直線：忽高忽低、忽快忽慢地亂竄，身體跟著飛行方向傾斜
    // opts.swing：每段最多上下竄多少 px；opts.depth：卡片區的前後層次（標題列不用）
    function flyBat(fromLeft, yMin, yMax, size, duration, opts) {
        const w = window.innerWidth;
        const startX = fromLeft ? -size - 20 : w + 20;
        const endX = fromLeft ? w + 20 : -size - 20;
        const dir = fromLeft ? 1 : -1;

        const bat = document.createElement('div');
        bat.className = 'halloween-bat';
        bat.style.width = size + 'px';
        // 大蝙蝠拍得慢一點
        const flapDur = 0.24 + (size - BAT_SIZE_PX[0]) / (BAT_SIZE_PX[1] - BAT_SIZE_PX[0]) * 0.1;
        bat.style.setProperty('--flap-dur', flapDur.toFixed(3) + 's');
        bat.style.setProperty('--flap-delay', (-Math.random() * flapDur).toFixed(2) + 's');
        bat.innerHTML = '<div class="bat-bob">' + BAT_SVG + '</div>';
        document.body.appendChild(bat);

        // 控制點：x 大致等距但前後抖動（速度忽快忽慢），y 在標題列高度內隨機上下竄
        const CTRL = 7;
        const xs = [], ys = [];
        let yPrev = rand(yMin, yMax);
        for (let i = 0; i < CTRL; i++) {
            const p = i / (CTRL - 1);
            const jitter = (i === 0 || i === CTRL - 1) ? 0 : rand(-0.06, 0.06);
            xs.push(startX + (endX - startX) * (p + jitter));
            yPrev = Math.min(yMax, Math.max(yMin, yPrev + rand(-opts.swing, opts.swing)));
            ys.push(yPrev);
        }

        // 沿曲線取樣成關鍵影格，傾斜角度依前進方向（上升抬頭、下降低頭）
        const SAMPLES = 60;
        const pts = [];
        for (let k = 0; k <= SAMPLES; k++) {
            const f = k / SAMPLES * (CTRL - 1);
            const i = Math.min(CTRL - 2, Math.floor(f));
            const t = f - i;
            const at = function (arr, j) { return arr[Math.max(0, Math.min(CTRL - 1, j))]; };
            pts.push([
                catmullRom(at(xs, i - 1), at(xs, i), at(xs, i + 1), at(xs, i + 2), t),
                catmullRom(at(ys, i - 1), at(ys, i), at(ys, i + 1), at(ys, i + 2), t)
            ]);
        }
        // 前後層次：weave 在中段某處換層（z-index 是整數，換層發生在相鄰兩個取樣點之間）
        let zAt = null;
        if (opts.depth) {
            const behindFirst = opts.depth === 'behind' || (opts.depth === 'weave' && Math.random() < 0.5);
            const switchAt = opts.depth === 'weave' ? rand(0.35, 0.65) : 2;
            zAt = function (p) {
                return (p < switchAt) === behindFirst ? BAT_Z_BEHIND : BAT_Z_FRONT;
            };
        }
        const frames = pts.map(function (pt, k) {
            const a = pts[Math.max(0, k - 1)], b = pts[Math.min(SAMPLES, k + 1)];
            const dx = Math.abs(b[0] - a[0]) || 1;
            const tilt = Math.max(-22, Math.min(22, Math.atan2(b[1] - a[1], dx) * 180 / Math.PI * 0.8)) * dir;
            const frame = { transform: 'translate(' + pt[0].toFixed(1) + 'px,' + pt[1].toFixed(1) + 'px) rotate(' + tilt.toFixed(1) + 'deg)' };
            if (zAt) {
                // 在卡片後面時調亮：透過毛玻璃看到的是一團淡淡移動的影子，太暗會整隻消失
                frame.zIndex = zAt(k / SAMPLES);
                frame.filter = frame.zIndex === BAT_Z_BEHIND ? 'brightness(2.6)' : 'brightness(1)';
            }
            return frame;
        });

        const anim = bat.animate(frames, { duration: duration, easing: 'linear' });
        anim.onfinish = function () { bat.remove(); };
    }

    function scheduleBat(delay) {
        setTimeout(function () {
            if (!document.hidden) flyBats();
            scheduleBat(rand(BAT_INTERVAL_MS[0], BAT_INTERVAL_MS[1]));
        }, delay);
    }

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        scheduleBat(BAT_FIRST_DELAY_MS);
    }
})();
