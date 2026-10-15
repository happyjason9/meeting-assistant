# 🎙️ 會議室語音查詢助手 (Meeting Room Voice Assistant)

![Version](https://img.shields.io/badge/version-1.0-blue.svg)
![Chrome Extension](https://img.shields.io/badge/platform-Chrome_Extension-googlechrome.svg)
![OS](https://img.shields.io/badge/os-linux%2C%20win-pink.svg)
![Status](https://img.shields.io/badge/status-Active-success.svg)

這是一個專為 CDC 內部會議系統設計的 Chrome 擴充功能。透過 **Web Speech API** 實現語音控制，讓使用者能以免持方式快速查詢會議資訊、地點、時間，並支援模糊搜尋與特定事項（如：茶水）篩選。

## ✨ 主要功能

- **🗣️ 語音喚醒與控制**：
  - 支援自然語言指令，例如：「幫我找李組長」、「查詢七樓會議室」。
  
- **🔍 智慧模糊搜尋**：
  - 整合 `pinyin-pro` 套件，支援 **中文拼音模糊比對**（即使發音不標準也能找到）。

- **☕ 特定事項篩選**：
  - 支援關鍵字偵測（如：「茶水」、「事物準備」），快速過濾出有提供茶水的會議。

- **🌐 語音翻譯**：
  - 說「翻譯成英文」整頁翻成英文（需在擴充功能選項頁設定 Gemini API Key），說「翻譯成中文」還原。

- **🖥️ 會議看板重新設計**（僅 meeting.cdc.gov.tw）：
  - 深色紫色玻璃風、會議狀態燈號、事務準備圖示、自動滾動。
  - 底部輪播「疾管署資訊」（疾管署新聞稿 RSS），右側為語音助手。

## 🛠️ 技術架構

- **JavaScript (ES6+)**：核心邏輯。
- **Web Speech API**：`webkitSpeechRecognition` (語音轉文字) & `SpeechSynthesisUtterance` (文字轉語音)。
- **[pinyin-pro](https://github.com/zh-lx/pinyin-pro)**：輕量級中文轉拼音工具，用於強化搜尋精準度。
- **Chrome Extension Manifest V3**：符合最新的擴充功能規範。

## 🚀 安裝說明

由於本工具為內部使用，未上架 Chrome 商店，請依照以下步驟安裝：

1.  **下載專案**：將本專案資料夾下載至電腦：

    <div align="center">
        <img src=".github/image/meeting_folder.png" width="300" alt="圖片說明">
    </div>
    <br>
2.  **開啟擴充功能管理頁面**：
    - 在 Chrome 瀏覽器網址列輸入 `chrome://extensions/`。
    <br>
3.  **開啟開發人員模式**：
    - 點擊右上角的「開發人員模式 (Developer mode)」開關。
    <div align="center">
        <img src=".github/image/Developer_mode.png" width="300" alt="圖片說明">
    </div>
    <br><br>

4.  **載入擴充功能**：
    - 點擊左上角的「載入未封裝項目 (Load unpacked)」。
    <div align="center">
        <img src=".github/image/Load_unpacked.png" width="300" alt="圖片說明">
    </div>
    <br>

    - 選擇本專案的資料夾。
    <div align="center">
        <img src=".github/image/Select_folder.png" width="500" alt="圖片說明">
    </div>
    <br>

    - 在All Extensions會看到會議室語音助理 (基礎版) 1.0，請打開它右下角的開關。
    <div align="center">
        <img src=".github/image/All_extensions.png" width="500" alt="圖片說明">
    </div>
    <br><br>
5.  **進入會議網頁**：
    
    點選會議網址：https://meeting.cdc.gov.tw/Meeting/Meeting ，側邊選單點開來記得把滾動速度調整成『**不滾動**』。
    <div align="center">
        <img src=".github/image/dont_scroll.png" width="800" alt="圖片說明">
    </div>
    <br><br>
    
    開啟右上角的拼圖圖示：
    
    1. 點選會議是語音助理右側的三點
    2. 點選『This can read and change site data』
    3. 點選『On meeting.cdc.gov.tw』
    <div align="center">
        <img src=".github/image/open_extension.png" width="500" alt="圖片說明">
    </div>

    4. 若是有跳出是否開啟麥克風權限，選『Allow』
    <br><br>

    **加入疾管署官網的存取權**（看板底部的「疾管署資訊」需要讀取官網的新聞稿 RSS，少了這步會顯示「暫時無法取得疾管署最新新聞稿」）：

    1. 網址列輸入 `chrome://extensions/`，在會議室語音助理按『詳細資料 (Details)』
    2. 找到『網站存取權 (Site access)』，在『特定網站 (On specific sites)』按『新增 (Add)』
    3. 輸入 `https://www.cdc.gov.tw`，按『新增』
    <br><br>

6. **完成！** 回到會議系統頁面重新整理即可使用(右下角會顯示小助手視窗，請用滑鼠點一下啟用)。
    <div align="center">
        <img src=".github/image/final.png" width="800" alt="圖片說明">
    </div>

## 📖 使用指南

### 1. 喚醒助手
點擊畫面右下角的麥克風圖示，或直接對著麥克風說：
> 「我要找會議室」

### 2. 語音指令範例
當助手進入「請說出會議地點或關鍵字」狀態時，你可以說：

| 查詢類型 | 語音指令範例 | 說明 |
| :--- | :--- | :--- |
| **找人名** | 「署長」、「陳佳何」 | 盡量講大聲、清楚 |
| **會議名稱**| 「EPIS討論會議」、「傳染病防治」| 不用完整說出來，會找關鍵字 |
| **找地點** | 「七樓會議室」、「10樓」 | 自動轉換樓層數字 |
| **找時間** | 「早上十點半的會」、「下午兩點」 | 自動過濾前後 10 分鐘的會議 |
| **找事項** | 「茶水」、「電腦」 | 篩選有填寫茶水或是電腦的會議 |

### 3. 其他語音指令
在「聆聽中」狀態直接說：

| 指令 | 說明 |
| :--- | :--- |
| 「翻譯成英文」、「英文」、「English」 | 表格與底部疾管署資訊翻成英文；頁面自動重新整理後仍維持英文 |
| 「翻譯成中文」、「中文」、「Chinese」 | 還原成中文 |
| 「承辦人」／「關閉承辦人」 | 顯示／隱藏承辦人欄位 |

### 4. 英文模式（說「翻譯成英文」後）
畫面翻成英文，中文、英文語音都能查詢，用哪一句喚醒就用哪個語言問答：

| 指令 | 說明 |
| :--- | :--- |
| 「Find a meeting room」 | 英文喚醒，接著用英文說要找什麼，如「Director Lee」、「meetings at 2 pm」、「seventh floor」，以英文回答 |
| 「我要找會議室」 | 中文喚醒，照常用中文查詢、中文回答 |
| 「翻譯成中文」、「中文」、「Chinese」、「Switch to Chinese」 | 還原中文 |

單獨說「中文」「英文」「Chinese」「English」時，要是一句很短的話才會切換（中文 5 字以內、英文 20 個字母以內），旁人聊天提到「英文課」不會誤觸發。

英文查詢的語音先由瀏覽器轉成文字，再把這句英文連同今天的會議清單（文字）送給 Gemini，從清單中挑出對應的中文關鍵字，最後用原本的中文搜尋比對（需設定 Gemini API Key）。

## 📂 專案結構

```text
.
├─ README.md            # 專案說明文件
├─ manifest.json        # 擴充功能設定檔
├─ background.js        # 代抓疾管署新聞稿 RSS
├─ content.js           # 語音助理主要邏輯（辨識、搜尋、翻譯）
├─ redesign.js          # 會議看板重新設計（版面、自動滾動、疾管署資訊輪播）
├─ style.css            # 會議看板樣式
├─ options.html/.js     # 選項頁（麥克風權限、Gemini API Key）
├─ pinyin-pro.js        # 拼音套件
├─ assets/              # 字體、事務準備圖示、空狀態圖片
└─ docs/                # 看板重新設計的功能保留清單
```