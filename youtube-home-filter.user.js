// ==UserScript==
// @name         YouTube Home Filter: Industrial Standard
// @namespace    https://github.com/bgtsai/youtube-home-filter
// @version      12.29.0
// @description  過濾 YouTube 首頁影片，支援多種影片類型、年齡、已看等條件，並提供白名單、快速回饋按鈕等功能。
// @author       BGTsai, Gemini Vibe Coding
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      www.youtube.com
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @license      MIT
// @homepageURL  https://github.com/bgtsai/youtube-home-filter
// @supportURL   https://github.com/bgtsai/youtube-home-filter/issues
// @downloadURL  https://raw.githubusercontent.com/bgtsai/youtube-home-filter/main/youtube-home-filter.user.js
// @updateURL    https://raw.githubusercontent.com/bgtsai/youtube-home-filter/main/youtube-home-filter.user.js
// ==/UserScript==

(function () {
    "use strict";
    /* eslint-disable no-multi-spaces */

    // Firefox + Tampermonkey 的 sandbox 隔離：用 unsafeWindow 存取頁面真實 window
    const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // ── Trusted Types 相容層 ────────────────────────────────────
    // Chrome 在 YouTube 上強制啟用 Trusted Types，直接對 innerHTML 賦值字串會被擋下。
    // 此函式建立一個允許直通的 policy；Firefox 不支援 trustedTypes，直接回傳原字串。
    const _trustedHTML = (() => {
        try {
            const tt = (typeof trustedTypes !== 'undefined') ? trustedTypes
                     : (typeof unsafeWindow !== 'undefined') ? unsafeWindow.trustedTypes
                     : null;
            const policy = tt?.createPolicy('ytfilter#html', { createHTML: s => s });
            return policy ? (s) => policy.createHTML(s) : (s) => s;
        } catch(e) {
            return (s) => s;
        }
    })();

    /* 核心常數定義 */
    const MUSIC_PATH_D  = "M5.5 1.383V6.88a2.25 2.25 0 101 1.871V4.6l2.743 1.647a.5.5 0 00.757-.43V3.485a.5.5 0 00-.243-.429l-3.5-2.1a.5.5 0 00-.757.427Z";
    const MEMBER_PATH_D = "M6 .5a5.5 5.5 0 100 11 5.5 5.5 0 000-11Zm.27 2.045.906 1.837 2.027.295a.3.3 0 01.166.511l-1.467 1.43.346 2.019a.3.3 0 01-.435.316L6 8l-1.813.953a.3.3 0 01-.435-.316l.346-2.019-1.467-1.43a.3.3 0 01.166-.511l2.027-.295.907-1.837a.3.3 0 01.539 0Z";

    // SVG Icons
    const SHIELD_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 22s8-4 8-10V5l-8-3V22z" fill="currentColor" stroke="none"/></svg>`;
    const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    // 漏斗圖示：置中於 24x24 畫布（頂 Y:4、底 Y:20、寬 18px、柄寬 4px）
    const FILTER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;">
        <polygon points="3 4 21 4 14 12 14 20 10 20 10 12" fill="currentColor" stroke="none"/>
    </svg>`;

    // 頻道 hover 加入按鈕：圓形底色 + 白色外框 + 白色十字（白名單與片名過濾共用）
    // 圓縮小至 r=10.2 為 2.8px 外框留空間；外框、十字粗細統一 stroke-width=2.8
    const ADD_AVATAR_SVG = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10.2" fill="currentColor" stroke="white" stroke-width="2.8"/><line x1="12" y1="6.5" x2="12" y2="17.5" stroke="white" stroke-width="2.8" stroke-linecap="round"/><line x1="6.5" y1="12" x2="17.5" y2="12" stroke="white" stroke-width="2.8" stroke-linecap="round"/></svg>`;

    // 快速動作按鈕的 SVG 圖示（使用 YouTube 原生 path 保持視覺一致性）
    const QA_ICON_ALREADY_WATCHED = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor" style="display:block;pointer-events:none;"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm0 2a9 9 0 110 18A9 9 0 0112 3z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const QA_ICON_NOT_INTERESTED  = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor" style="display:block;pointer-events:none;"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 018.246 12.605L4.755 6.661A8.99 8.99 0 0112 3ZM3.754 8.393l15.491 8.944A9 9 0 013.754 8.393Z"/></svg>`;
    const QA_ICON_DONT_LIKE       = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor" style="display:block;pointer-events:none;"><path d="m11.31 2 .392.007c1.824.06 3.61.534 5.223 1.388l.343.189.27.154c.264.152.56.24.863.26l.13.004H20.5a1.5 1.5 0 011.5 1.5V11.5a1.5 1.5 0 01-1.5 1.5h-1.79l-.158.013a1 1 0 00-.723.512l-.064.145-2.987 8.535a1 1 0 01-1.109.656l-1.04-.174a4 4 0 01-3.251-4.783L10 15H5.938a3.664 3.664 0 01-3.576-2.868A3.682 3.682 0 013 9.15l-.02-.088A3.816 3.816 0 014 5.5v-.043l.008-.227a2.86 2.86 0 01.136-.664l.107-.28A3.754 3.754 0 017.705 2h3.605ZM7.705 4c-.755 0-1.425.483-1.663 1.2l-.032.126a.818.818 0 00-.01.131v.872l-.587.586a1.816 1.816 0 00-.524 1.465l.038.23.02.087.21.9-.55.744a1.686 1.686 0 00-.321 1.18l.029.177c.17.76.844 1.302 1.623 1.302H10a2.002 2.002 0 011.956 2.419l-.623 2.904-.034.208a2.002 2.002 0 001.454 2.139l.206.045.21.035 2.708-7.741A3.001 3.001 0 0118.71 11H20V6.002h-1.79a3 3 0 01-1.5-.401l-.214-.123-.286-.158a10.002 10.002 0 00-4.61-1.316L11.31 4H7.705Z"/></svg>`;
    const QA_ICON_DONT_RECOMMEND  = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor" style="display:block;pointer-events:none;"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm4 8H8a1 1 0 000 2h8a1 1 0 000-2Z"/></svg>`;

    /* ============================================================
     * [語系開發者指引] 新增語系的完整說明
     * ============================================================
     *
     * 想新增一種語系，只需要做以下兩件事，不需要修改程式碼的任何其他地方：
     *
     * ── 步驟一：在 LOCALES_MASTER 新增一個語系物件 ──────────────
     *
     *   以 `en` 物件為範本，複製並翻譯所有鍵值。
     *
     *   鍵名規則：
     *   - 物件的 key（例如 'en'、'zh'、'ja'）必須和瀏覽器語言標籤吻合。
     *     自動偵測邏輯會用 String.startsWith() 來比對
     *     document.documentElement.lang（例如 "ja"、"ja-JP"）。
     *   - `langName` 填寫該語言的母語名稱（例如 "日本語"），
     *     這是顯示在語言選單裡的文字。
     *
     *   特殊鍵說明：
     *   - `liveMatch` / `podcastMatch` / `mixMatch` / `playlistMatch`
     *     以字串形式儲存（例如 `'watching'`、`'正在觀看'`），getMsg() 回傳前統一轉為 RegExp（加 i flag）。
     *     請根據目標語言版本的 YouTube 介面實際出現的文字來撰寫。
     *   - 時間單位以 flat key 儲存：`unitSecondLabel`/`unitSecondMatch`…`unitYearLabel`/`unitYearMatch`。
     *     Match 同樣為字串，getMsg() 回傳前轉為 RegExp，並重建 `timeMatch`。
     *     用來解析「3 天前」「2 週前」等時間文字，請同樣對應目標語言的 YouTube 介面。
     *   - `qaNoticeWaited` 是一個函式：(s) => `...${s}...`，s 是秒數。
     *
     * ── 步驟二：在 THEMES_MASTER 的每個佈景主題新增 label ────────
     *
     *   THEMES_MASTER 位於 LOCALES_MASTER 的下方（搜尋 [3.1]）。
     *   每個佈景主題的 `label` 物件需要新增對應語系的翻譯，例如：
     *
     *     dark: {
     *         label: { en: "Dark", zh: "深色模式", ja: "ダークモード" },
     *         ...
     *     }
     *
     *   `auto` 主題（自動偵測）也需要新增。
     *
     *   ── 附註：新增佈景主題 ──────────────────────────────────────
     *
     *   若要新增一個全新的佈景主題，在 THEMES_MASTER 加入新物件即可。
     *   結構如下：
     *
     *     myTheme: {
     *         label: { en: "My Theme", zh: "我的主題" },
     *         autoMatch: () => <條件>,   // 可選。有此函式且回傳 true 時，
     *                                    // auto 模式會自動選用此主題。
     *                                    // 省略則此主題不參與 auto 偵測。
     *                                    // 比對順序依照 THEMES_MASTER 的物件順序，
     *                                    // 第一個符合的主題勝出。
     *         colors: { ...所有 CSS 變數... }
     *     }
     *
     * ============================================================ */

    const LOCALES_MASTER = {
        en: {
            langName        : "English",
            hideOver        : "Hide videos older than:",
            optRegular      : "Hide Regular Videos",
            optLive         : "Hide Live",
            optUpcoming     : "Hide Upcoming",
            optMusic        : "Hide Music",
            optMember       : "Hide Members-only",
            optPodcast      : "Hide Podcast",
            optMix          : "Hide Mixes",
            optPlaylist     : "Hide Playlists",
            optWatched      : "Hide Watched",
            optTheme        : "Theme",
            optHideOld      : "Hide Videos Older Than",
            optHideOldSub   : "Videos older than",
            advancedSettings: "Advanced Settings",
            advSecAppearance: "Appearance",
            advSecBehavior  : "Behavior",
            advSecFeedback  : "Video Feedback Buttons",
            statusOn        : "Filtering...",
            statusOff       : "Filter OFF",
            actionEnable    : "OFF",
            actionDisable   : "ON",
            toggleTipEnable : "Click to enable filter",
            toggleTipDisable: "Click to disable filter",
            statusSearching : "Restocking...",
            statusRefreshing: "Refreshing...",
            statusLimit     : "Hit Limit",
            refreshTip      : "Refresh Homepage",
            closePanel      : "Close Settings",
            wlTitleMusic    : "Music Filter Whitelist",
            wlDescMusic     : "Channels here will NOT be hidden by Music filter.",
            wlTitleMember   : "Member Filter Whitelist",
            wlDescMember    : "Channels here will NOT be hidden by Member filter.",
            wlHoverHint     : "💡 Hover over a video and click the + on the channel avatar to quickly add a channel.",
            wlPlaceholder   : "Enter channel name...",
            wlAdd           : "Add",
            wlTipMusic      : "Manage Music Whitelist",
            wlTipMember     : "Manage Member Whitelist",
            wlQuickAdd      : "Add to Whitelist",
            wlQuickRemove   : "Remove from Whitelist",
            wdTitle         : "Watched Filter Settings",
            wdDesc          : "Hide video if ANY condition is met:",
            wdTip           : "Adjust Watched Thresholds",
            wdLabelPct      : "Progress >",
            wdLabelSec      : "Watched >",
            wdUnitPct       : "%",
            wdUnitSec       : "s",
            // Panel & UI labels (previously scattered in functions)
            generalTitle    : "General",
            settingsOpen    : "Settings Open",
            settingsClose   : "Click to close settings",
            settingsOpenTip : "Open Settings",
            advBack         : "Back",
            advNewTab       : "Open in New Tab",
            advInterceptTT  : "Enhanced Tooltips",
            advGrid         : "Cards per Row",
            advReset        : "Reset All Settings",
            advResetTip     : "Whitelists will not be cleared",
            advFeedback     : "Video Feedback Buttons",
            qaLabelWatched  : "Already Watched",
            qaLabelNotInt   : "Not Interested",
            qaLabelDontLike : "Don't Like",
            qaLabelDontRec  : "Don't Recommend Channel",
            // QA notice messages (previously in QA_ACTION_LABEL / QA_MSG_* constants)
            qaActWatched    : "Already watched",
            qaActNotInt     : "Not interested",
            qaActDontLike   : "Don't like",
            qaActDontRec    : "Don't recommend channel",
            qaNoticeRemoved : "Video removed",
            qaNoticePending : "Processing",
            qaNoticeFailed  : "Failed",
            qaNoticeRetry   : "Retry",
            qaNoticeUndo    : "Undo",
            qaNoticeWaited  : (s) => `Waited ${s}s`,
            // --- Custom Language strings ---
            labelCustomLang     : 'Custom Language',
            labelCustomLangSub  : 'User-defined translations',
            labelCustomMatch    : 'Custom Filter Keywords',
            labelCustomMatchSub : 'Custom detection keywords for video types',
            ckEditBtn           : 'Edit…',
            ckTitle             : '▶ Custom Filter Keywords',
            ckColCurrent        : 'Current rule',
            ckColCustom         : 'Custom keyword',
            ckNoticeHigh        : 'These keywords take priority over language defaults and custom language settings.',
            ckBtnReset          : 'Reset All',
            ckBtnImport         : 'Import',
            ckBtnExport         : 'Export',
            ckBtnCancel         : 'Cancel',
            ckBtnSave           : 'Save',
            ckPlaceholder       : 'Leave empty to use default',
            ckImportTitle       : 'Keywords Imported',
            ckImportOkBtn       : 'OK',
            ckImportErrorTitle  : 'Import Failed',
            ckImportErrorDesc   : 'The file could not be read. Please check that it is a valid JSON keywords file.',
            ckHelpTitle         : 'Keyword Format',
            ckHelpClose         : 'Close',
            ckHelpBody          : `Supports plain text or regex:\n· Plain text: podcast  (case-insensitive partial match)\n· Regex: /podcast|radio/i\n\nLeave a field empty to use the language default.\nThese settings override both built-in and custom language keywords.`,
            clTitle             : 'Custom Language Editor',
            clLangCodeLabel     : 'Language code',
            clLangCodePlaceholder: 'e.g. zh, ja, ko',
            clRefLangLabel      : 'Reference language',
            clTransTargetLabel  : 'Translating into',
            clTransTargetPH     : 'e.g. zh, ja, ko',
            clSearchPH          : 'Search fields…',
            clSearchBtn         : 'Search',
            clCustomOption      : 'Custom',
            clGroupUi           : 'Interface text',
            clGroupUiNote       : 'Labels and messages shown in the filter panel UI.',
            clGroupDetection    : 'Detection keywords',
            clGroupDetectionNote: 'Lower priority than {link}.',
            clGroupDetectionLink: 'Custom Filter Keywords',
            clSwitchTitle       : 'Unsaved changes',
            clSwitchDesc        : 'You have unsaved changes.\nSave before switching?',
            clSwitchDiscard     : 'Discard & Switch',
            clSwitchSave        : 'Save & Switch',
            clSwitchCancel      : 'Cancel',
            clGroupUnitLabels   : 'Time unit labels',
            clGroupUnitLabelsNote: 'Display names for time units in the "Hide videos older than" dropdown.',
            clColRef            : 'English (reference)',
            clColTranslation    : 'Translation',
            clBtnClearAll       : 'Clear All',
            clBtnImport         : 'Import',
            clBtnExport         : 'Export',
            clBtnCancel         : 'Cancel',
            clBtnSave           : 'Save',
            clEditBtn           : 'Edit…',
            clImportTitle       : 'Language File Imported',
            clImportUnknown     : 'Unknown keys — ignored',
            clImportMissing     : 'Missing keys — English fallback',
            clImportSafeNote    : 'This will not affect normal usage.',
            clImportOkBtn       : 'OK',
            clImportErrorTitle  : 'Import Failed',
            clImportErrorDesc   : 'The file could not be read. Please check that it is a valid JSON language file.',
            clClearStep1Title   : 'Export before clearing?',
            clClearStep1Desc    : 'Your translation data will be permanently deleted. Would you like to export a backup first?',
            clClearExportBtn    : 'Export & Continue',
            clClearSkipBtn      : 'Just Clear',
            clClearCancelBtn    : 'Cancel',
            clClearStep2Title   : '⚠ Clear Custom Language',
            clClearStep2Desc    : 'This will permanently delete all your translation data. This action cannot be undone.',
            clClearConfirmBtn   : 'Clear All',
            // --- Video Title Filter Blacklist ---
            optTitleFilter        : "Hide Video Title Filter",
            tfTitle               : "Video Title Filter",
            tfDesc                : "Hides videos whose title matches any rule below. Supports Regex —",
            tfDescLink            : "click here for help",
            tfPlaceholder         : "Keyword or /regex/flags",
            tfChannelPlaceholder  : "Channel (blank = all)",
            tfAdd                 : "Add",
            tfSave                : "Save",
            tfCancel              : "Cancel",
            tfTip                 : "Manage Video Title Filter",
            tfAvatarTip           : "Fill channel name",
            tfHoverHint           : "💡 Hover over a video and click the + on the channel avatar to fill in the channel name.",
            tfHelpTitle           : "How to use",
            tfHelpClose           : "Close",
            tfHelpBody            : `<b>Pattern</b> (required)<br>
                                     Plain keyword (case-insensitive) or regex wrapped in <code>/&nbsp;/</code>.<br>
                                     Example: <code>news</code> or <code>/politics|election/i</code><br><br>
                                     <b>Channel</b> (optional)<br>
                                     Leave blank to apply the rule to all channels.<br>
                                     You can type the name directly, or hover over a video and click the funnel icon to fill it in automatically.<br><br>
                                     <b>Regular expression syntax</b><br>
                                     Format: <code>/pattern/flags</code> — use <code>|</code> for OR, <code>^</code> for start-of-title, <code>.*</code> for any text.<br><br>
                                     <u>Example 1 — OR condition:</u><br>
                                     <code>/politics|election/i</code><br>
                                     Hides titles containing "politics" <i>or</i> "election".<br><br>
                                     <u>Example 2 — specific channel only:</u><br>
                                     Pattern: <code>/^Live.*(Q&amp;A|chat)/i</code> · Channel: <code>SomeChannel</code><br>
                                     Hides live Q&amp;A or chat titles from that channel only.<br><br>
                                     <u>Example 3 — date-like pattern:</u><br>
                                     <code>/\\d{4}[-\\/]\\d{1,2}[-\\/]\\d{1,2}/</code><br>
                                     Hides titles containing a date like 2025-01-01.<br><br>
                                     ⚠ Rules with invalid regex syntax are ignored and shown with a warning.`,
            liveMatch       : 'watching',
            podcastMatch    : 'podcast',
            mixMatch        : 'mix|and more',
            playlistMatch   : 'playlist',
            unitSecondLabel : 'Seconds',  unitSecondMatch : 'second',
            unitMinuteLabel : 'Minutes',  unitMinuteMatch : 'minute',
            unitHourLabel   : 'Hours',    unitHourMatch   : 'hour',
            unitDayLabel    : 'Days',     unitDayMatch    : 'day',
            unitWeekLabel   : 'Weeks',    unitWeekMatch   : 'week',
            unitMonthLabel  : 'Months',   unitMonthMatch  : 'month',
            unitYearLabel   : 'Years',    unitYearMatch   : 'year'
        },
        zh: {
            langName        : "繁體中文",
            hideOver        : "隱藏影片早於:",
            optRegular      : "隱藏 一般影片",
            optLive         : "隱藏 直播影片",
            optUpcoming     : "隱藏 待播影片",
            optMusic        : "隱藏 音樂影片",
            optMember       : "隱藏 會員限定",
            optPodcast      : "隱藏 Podcast",
            optMix          : "隱藏 合輯混音",
            optPlaylist     : "隱藏 播放清單",
            optWatched      : "隱藏 已看影片",
            optTheme        : "面板主題",
            optHideOld      : "隱藏 影片早於",
            optHideOldSub   : "影片早於",
            advancedSettings: "進階設定",
            advSecAppearance: "外觀",
            advSecBehavior  : "行為",
            advSecFeedback  : "影片回饋按鈕",
            statusOn        : "過濾中...",
            statusOff       : "過濾已關閉",
            actionEnable    : "已關閉",
            actionDisable   : "已開啟",
            toggleTipEnable : "點擊開啟過濾",
            toggleTipDisable: "點擊關閉過濾",
            statusSearching : "內容補充中...",
            statusRefreshing: "重新整理中...",
            statusLimit     : "暫無更多內容",
            refreshTip      : "重新整理首頁",
            closePanel      : "關閉設定",
            wlTitleMusic    : "音樂過濾白名單",
            wlDescMusic     : "此名單內的頻道將<span class='wl-desc-emphasis'>不會</span>被音樂過濾規則隱藏。",
            wlTitleMember   : "會員過濾白名單",
            wlDescMember    : "此名單內的頻道將<span class='wl-desc-emphasis'>不會</span>被會員過濾規則隱藏。",
            wlHoverHint     : "💡 將滑鼠移到頻道圖示上，點擊 + 可快速加入頻道名稱。",
            wlPlaceholder   : "輸入頻道名稱...",
            wlAdd           : "新增",
            wlTipMusic      : "管理音樂白名單",
            wlTipMember     : "管理會員白名單",
            wlQuickAdd      : "加入白名單",
            wlQuickRemove   : "移除白名單",
            wdTitle         : "已看影片過濾設定",
            wdDesc          : "符合以下任一條件即隱藏：",
            wdTip           : "調整已看判定標準",
            wdLabelPct      : "觀看進度超過",
            wdLabelSec      : "觀看時間超過",
            wdUnitPct       : "%",
            wdUnitSec       : "秒",
            // 面板 & UI 文字（原本散落在各函式中）
            generalTitle    : "一般設定",
            settingsOpen    : "設定已開啟",
            settingsClose   : "點擊關閉設定",
            settingsOpenTip : "開啟設定",
            advBack         : "返回",
            advNewTab       : "影片/頻道 開新分頁",
            advInterceptTT  : "增強 Tooltips",
            advGrid         : "每行卡片數量",
            advReset        : "重置所有設定",
            advResetTip     : "白名單不會被刪除",
            advFeedback     : "影片回饋按鈕",
            qaLabelWatched  : "已看過",
            qaLabelNotInt   : "不感興趣",
            qaLabelDontLike : "不喜歡",
            qaLabelDontRec  : "不要推薦此頻道",
            // QA 通知文字（原本在 QA_ACTION_LABEL / QA_MSG_* 常數中）
            qaActWatched    : "已看過",
            qaActNotInt     : "不感興趣",
            qaActDontLike   : "不喜歡",
            qaActDontRec    : "不要推薦此頻道",
            qaNoticeRemoved : "影片已移除",
            qaNoticePending : "處理中",
            qaNoticeFailed  : "傳送失敗",
            qaNoticeRetry   : "重試",
            qaNoticeUndo    : "復原",
            qaNoticeWaited  : (s) => `已等待 ${s} 秒`,
            // --- 自訂語系字串 ---
            labelCustomLang     : '自訂語系',
            labelCustomLangSub  : '使用者自訂介面翻譯',
            labelCustomMatch    : '自訂 篩選字詞',
            labelCustomMatchSub : '自訂 各影片類型的偵測關鍵字',
            ckEditBtn           : '編輯…',
            ckTitle             : '▶ 自訂篩選字詞',
            ckColCurrent        : '目前套用的規則',
            ckColCustom         : '自訂字詞',
            ckNoticeHigh        : '此處設定的字詞優先權最高，會覆蓋語系內建及自訂語系的偵測關鍵字。',
            ckBtnReset          : '重置全部',
            ckBtnImport         : '匯入',
            ckBtnExport         : '匯出',
            ckBtnCancel         : '取消',
            ckBtnSave           : '儲存',
            ckPlaceholder       : '留空則使用語系預設',
            ckImportTitle       : '字詞已匯入',
            ckImportOkBtn       : '確定',
            ckImportErrorTitle  : '匯入失敗',
            ckImportErrorDesc   : '無法讀取檔案，請確認這是有效的 JSON 字詞檔案。',
            ckHelpTitle         : '字詞格式說明',
            ckHelpClose         : '關閉',
            ckHelpBody          : `支援純文字或正規表達式：\n· 純文字：podcast（不分大小寫的部分比對）\n· 正規表達式：/podcast|radio/i\n\n留空欄位表示沿用語系預設值。\n此設定的優先權高於內建語系及自訂語系的偵測關鍵字。`,
            clTitle             : '自訂語系編輯器',
            clLangCodeLabel     : '語言代號',
            clLangCodePlaceholder: '例如 zh、ja、ko',
            clRefLangLabel      : '參考語言',
            clTransTargetLabel  : '翻譯目標語言',
            clTransTargetPH     : '例如 zh、ja、ko',
            clSearchPH          : '搜尋欄位…',
            clSearchBtn         : '搜尋',
            clCustomOption      : '自訂語系',
            clGroupUi           : '介面文字',
            clGroupUiNote       : '篩選面板中顯示的標籤與訊息文字。',
            clGroupDetection    : '偵測關鍵字',
            clGroupDetectionNote: '優先權低於「{link}」的設定。',
            clGroupDetectionLink: '自訂 篩選字詞',
            clSwitchTitle       : '尚未儲存',
            clSwitchDesc        : '你有尚未儲存的修改。\n離開前是否要儲存？',
            clSwitchDiscard     : '捨棄並前往',
            clSwitchSave        : '儲存並前往',
            clSwitchCancel      : '取消',
            clGroupUnitLabels   : '時間單位標籤',
            clGroupUnitLabelsNote: '「隱藏影片早於」下拉選單中的時間單位顯示名稱。',
            clColRef            : '英文（參考）',
            clColTranslation    : '翻譯',
            clBtnClearAll       : '清除全部',
            clBtnImport         : '匯入',
            clBtnExport         : '匯出',
            clBtnCancel         : '取消',
            clBtnSave           : '儲存',
            clEditBtn           : '編輯…',
            clImportTitle       : '語系檔案已匯入',
            clImportUnknown     : '未知的項目 — 已忽略',
            clImportMissing     : '缺少的項目 — 將以英文替補',
            clImportSafeNote    : '這不會影響正常使用。',
            clImportOkBtn       : '確定',
            clImportErrorTitle  : '匯入失敗',
            clImportErrorDesc   : '無法讀取檔案，請確認這是有效的 JSON 語系檔案。',
            clClearStep1Title   : '清除前要先匯出嗎？',
            clClearStep1Desc    : '您的翻譯資料將被永久刪除。是否要先匯出備份？',
            clClearExportBtn    : '匯出並繼續',
            clClearSkipBtn      : '僅直接清除',
            clClearCancelBtn    : '取消',
            clClearStep2Title   : '⚠ 清除自訂語系',
            clClearStep2Desc    : '這將永久刪除所有翻譯資料，此操作無法復原。',
            clClearConfirmBtn   : '清除全部',
            // --- 影片片名過濾黑名單 ---
            optTitleFilter      : "隱藏 片名過濾",
            tfTitle               : "影片片名過濾",
            tfDesc                : "片名符合以下任一規則的影片將被隱藏。支援 Regex —",
            tfDescLink            : "點此查看說明",
            tfPlaceholder         : "關鍵字 或 /正規表達式/",
            tfChannelPlaceholder  : "頻道名稱（空白＝所有頻道）",
            tfAdd                 : "新增",
            tfSave                : "儲存",
            tfCancel              : "取消",
            tfTip                 : "管理片名過濾",
            tfAvatarTip           : "填入頻道名稱",
            tfHoverHint           : "💡 將滑鼠移到頻道圖示上，點擊 + 可自動填入頻道名稱。",
            tfHelpTitle           : "使用說明",
            tfHelpClose           : "關閉",
            tfHelpBody            : `<b>過濾條件</b>（必填）<br>
                                     直接輸入關鍵字（不分大小寫），或以 <code>/&nbsp;/</code> 包裹的正規表達式。<br>
                                     範例：<code>新聞</code> 或 <code>/政治|選舉/i</code><br><br>
                                     <b>指定頻道</b>（選填）<br>
                                     留空表示對所有頻道套用此規則。<br>
                                     可直接輸入頻道名稱，或將滑鼠移到首頁影片上，點擊漏斗圖示自動填入。<br><br>
                                     <b>正規表達式語法</b><br>
                                     格式：<code>/規則/修飾子</code>，常用：<code>|</code> 代表「或」，<code>^</code> 代表開頭，<code>.*</code> 代表任意文字。<br><br>
                                     <u>範例一 — OR 條件：</u><br>
                                     <code>/政治|選舉/</code><br>
                                     隱藏片名含「政治」<i>或</i>「選舉」的影片。<br><br>
                                     <u>範例二 — 指定頻道：</u><br>
                                     條件：<code>/^直播.*(聊天|問答)/i</code> · 頻道：<code>某頻道</code><br>
                                     只隱藏「某頻道」中以「直播」開頭且含「聊天」或「問答」的片名。<br><br>
                                     <u>範例三 — 日期格式：</u><br>
                                     <code>/\\d{4}[-\\/]\\d{1,2}[-\\/]\\d{1,2}/</code><br>
                                     隱藏片名含類似日期（2025-01-01）格式的影片。<br><br>
                                     ⚠ 正規表達式格式有誤的規則會被略過並以警示標示。`,
            liveMatch       : '正在觀看',
            podcastMatch    : '播客|podcast',
            mixMatch        : '合輯|和其他藝人',
            playlistMatch   : '播放清單',
            unitSecondLabel : '秒',    unitSecondMatch : '秒',
            unitMinuteLabel : '分鐘',  unitMinuteMatch : '分',
            unitHourLabel   : '小時',  unitHourMatch   : '小時',
            unitDayLabel    : '天',    unitDayMatch    : '天|日',
            unitWeekLabel   : '週',    unitWeekMatch   : '週|周',
            unitMonthLabel  : '月',    unitMonthMatch  : '月',
            unitYearLabel   : '年',    unitYearMatch   : '年'
        }
    };

    /* ── 常數：YouTube 原生主題 attribute 名稱 ── */
    const YT_DARK_ATTR = 'dark';

    /* ── 常數：GM 儲存 key ── */
    const STORAGE_KEY_CFG    = 'tm-yt-filter-cfg';
    const STORAGE_KEY_POS_WL = 'panel-pos-wl';
    const STORAGE_KEY_POS_WD = 'panel-pos-wd';
    const STORAGE_KEY_POS_CL = 'panel-pos-cl';
    const STORAGE_KEY_POS_TF = 'panel-pos-tf';
    const STORAGE_KEY_POS_CK = 'panel-pos-ck';
    const STORAGE_KEY_CUSTOM_LANG = 'tm-yt-filter-custom-lang';

    /* ── 常數：YouTube QA Tooltip 主題 key ── */
    const YT_TOOLTIP_DARK  = 'dark';
    const YT_TOOLTIP_LIGHT = 'light';

    /* ── QA 區域 Tooltip 配色（跟隨 YouTube 原生深/淺主題，與我們的主題無關）── */
    const QA_TOOLTIP_CFGS = {
        dark:  { fill: '#e8e8e8', textColor: '#111111', strokeColor: 'rgba(0,0,0,0.18)', strokeWidth: 1, shadowColor: '#000000', shadowOpacity: '0.40', shadowDy: '2', shadowStd: '4' },
        light: { fill: '#282828', textColor: '#f1f1f1', strokeColor: null,                strokeWidth: 0, shadowColor: '#000000', shadowOpacity: '0.30', shadowDy: '2', shadowStd: '4' },
    };

    /* [3.1] 高內聚力主題定義系統 ----------------------------------------------------------- */
    /* 新增語系時，請同步在每個佈景主題的 label 物件加入對應翻譯。詳見上方 [語系開發者指引]。 */
    /* 新增主題時，請在該主題加上 tooltip 欄位，以及選填的 autoMatch 函式。                  */
    const THEMES_MASTER = {
        auto: { label: { en: "Auto", zh: "自動偵測" } },
        dark: {
            label: { en: "Dark", zh: "深色模式" },
            // auto 模式下的自動偵測條件。第一個回傳 true 的主題會被選中。
            autoMatch: () => document.documentElement.hasAttribute(YT_DARK_ATTR),
            tooltip: { fill: '#e8e8e8', textColor: '#111111', strokeColor: 'rgba(0,0,0,0.18)', strokeWidth: 1, shadowColor: '#000000', shadowOpacity: '0.40', shadowDy: '2', shadowStd: '4' },
            colors: {
                '--t-pill-bg-on': 'rgba(20, 20, 20, 0.95)',
                '--t-pill-hover-on': 'rgba(45, 45, 45, 0.95)',
                '--t-pill-bg-off': 'rgba(45, 45, 45, 0.9)',
                '--t-pill-hover-off': 'rgba(85, 85, 85, 0.95)',
                '--t-pill-text': '#eee',
                '--t-pill-border': '#444',
                '--t-panel-bg': 'rgba(30, 30, 30, 0.98)',
                '--t-panel-border': '#3d3d3d',
                '--t-panel-shadow': 'rgba(0,0,0,0.6)',
                '--t-text-main': '#ddd',
                '--t-text-muted': '#aaa',
                '--t-divider': '#333',
                '--t-btn-bg': '#333',
                '--t-btn-hover': '#444',
                '--t-btn-text': '#aaa',
                '--t-btn-text-hover': '#fff',
                '--t-input-bg': '#222',
                '--t-input-text': '#fff',
                '--t-close-hover-bg': 'rgba(255, 255, 255, 0.15)',
                '--t-switch-bg': '#444',
                '--t-switch-on': '#3478F6',
                '--t-switch-knob': '#bbb',
                '--t-switch-knob-on': '#fff',
                '--t-dot-active': '#4CAF50',
                '--t-dot-limit': '#5FBBDD',
                '--t-dot-off': '#888',
                '--t-dot-anim-speed': '1.2s',
                '--t-dot-min-opacity': '0.3',
                '--t-dot-filter-on': 'none',
                '--t-dot-filter-off': 'none',
                '--t-dot-shadow-on': 'none',
                '--t-dot-shadow-off': 'none',
                '--t-wl-highlight': 'rgba(52, 199, 89, 0.25)',
                '--t-wl-badge-bg': '#3478F6',
                '--t-wl-badge-active': '#4CAF50',
                '--t-card-border': 'rgba(255,255,255,0.20)',
                '--t-card-bg': 'rgba(255,255,255,0.06)',
                '--t-card-divider': 'rgba(255,255,255,0.07)',
                '--t-switch-border': 'rgba(255,255,255,0.15)',
                '--t-switch-border-on': 'rgba(52,120,246,0.6)',
                '--t-input-border': '#444',
                '--t-switch-on-text': '#fff',
                '--t-switch-knob-on-shadow': 'none',
                '--t-nav-color': '#aaa',
                '--t-primary-shadow': 'none',
                '--t-primary-hover-shadow': 'inset 0 0 0 1px rgba(255,255,255,0.45)',
                '--t-danger-bg':           'rgba(255,75,55,0.12)',
                '--t-danger-text':         '#ff6b55',
                '--t-danger-border':       'rgba(255,75,55,0.25)',
                '--t-danger-hover-bg':     'rgba(255,75,55,0.22)',
                '--t-danger-hover-border': 'rgba(255,75,55,0.50)'
            }
        },
        light: {
            label: { en: "Light", zh: "淺色模式" },
            // auto 模式下的自動偵測條件。dark 已不符合時，此條件成立作為 fallback。
            autoMatch: () => !document.documentElement.hasAttribute(YT_DARK_ATTR),
            tooltip: { fill: '#222222', textColor: '#eeeeee', strokeColor: null, strokeWidth: 0, shadowColor: '#000000', shadowOpacity: '0.25', shadowDy: '2', shadowStd: '4' },
            colors: {
                '--t-pill-bg-on': 'rgba(252, 252, 252, 0.97)',
                '--t-pill-hover-on': 'rgba(240, 240, 240, 0.97)',
                '--t-pill-bg-off': 'rgba(252, 252, 252, 0.97)',
                '--t-pill-hover-off': 'rgba(240, 240, 240, 0.97)',
                '--t-pill-text': '#111',
                '--t-pill-border': '#ddd',
                '--t-panel-bg': 'rgba(252, 252, 252, 0.98)',
                '--t-panel-border': '#ddd',
                '--t-panel-shadow': 'rgba(0,0,0,0.15)',
                '--t-text-main': '#111',
                '--t-text-muted': '#666',
                '--t-divider': '#e0e0e0',
                '--t-btn-bg': '#e8e8e8',
                '--t-btn-hover': '#d0d0d0',
                '--t-btn-text': '#555',
                '--t-btn-text-hover': '#111',
                '--t-input-bg': '#fff',
                '--t-input-text': '#111',
                '--t-close-hover-bg': 'rgba(0, 0, 0, 0.07)',
                '--t-switch-bg': '#ccc',
                '--t-switch-on': '#3478F6',
                '--t-switch-knob': '#fff',
                '--t-switch-knob-on': '#fff',
                '--t-dot-active': '#4CAF50',
                '--t-dot-limit': '#5FBBDD',
                '--t-dot-off': '#888',
                '--t-dot-anim-speed': '1.5s',
                '--t-dot-min-opacity': '0.4',
                '--t-dot-filter-on': 'none',
                '--t-dot-filter-off': 'none',
                '--t-dot-shadow-on': '0 0 10px rgba(76, 175, 80, 0.8)',
                '--t-dot-shadow-off': '0 0 0px rgba(76, 175, 80, 0)',
                '--t-wl-highlight': 'rgba(52, 199, 89, 0.2)',
                '--t-wl-badge-bg': '#3478F6',
                '--t-wl-badge-active': '#4CAF50',
                '--t-card-border': 'rgba(0,0,0,0.15)',
                '--t-card-bg': 'rgba(0,0,0,0.04)',
                '--t-card-divider': 'rgba(0,0,0,0.08)',
                '--t-switch-border': 'rgba(0,0,0,0.18)',
                '--t-switch-border-on': 'rgba(52,120,246,0.5)',
                '--t-input-border': '#ccc',
                '--t-switch-on-text': '#fff',
                '--t-switch-knob-on-shadow': 'none',
                '--t-nav-color': '#666',
                '--t-primary-shadow': 'none',
                '--t-primary-hover-shadow': '0 0 0 1.5px rgba(52,120,246,0.2)',
                '--t-danger-bg':           'rgba(255,75,55,0.12)',
                '--t-danger-text':         '#ff6b55',
                '--t-danger-border':       'rgba(255,75,55,0.25)',
                '--t-danger-hover-bg':     'rgba(255,75,55,0.22)',
                '--t-danger-hover-border': 'rgba(255,75,55,0.50)'
            }
        },
        cyberpunk: {
            label: { en: "Cyberpunk", zh: "賽博龐克" },
            tooltip: { fill: 'rgba(10,2,15,0.97)', textColor: '#0ff', strokeColor: '#0ff', strokeWidth: 1, shadowColor: '#0ff', shadowOpacity: '0.90', shadowDy: '0', shadowStd: '2' },
            colors: {
                '--t-pill-bg-on': 'rgba(10, 2, 15, 0.97)',
                '--t-pill-hover-on': 'rgba(0, 40, 40, 0.97)',
                '--t-pill-bg-off': 'rgba(10, 2, 15, 0.97)',
                '--t-pill-hover-off': 'rgba(0, 40, 40, 0.97)',
                '--t-pill-text': '#0ff',
                '--t-pill-border': '#0ff',
                '--t-panel-bg': 'rgba(10, 2, 15, 0.98)',
                '--t-panel-border': '#0ff',
                '--t-panel-shadow': '0 0 20px rgba(0, 255, 255, 0.3)',
                '--t-text-main': '#fff',
                '--t-text-muted': '#f0a',
                '--t-divider': '#0a3333',
                '--t-btn-bg': '#001a1a',
                '--t-btn-hover': '#0ff',
                '--t-btn-text': '#0ff',
                '--t-btn-text-hover': '#000',
                '--t-input-bg': '#000',
                '--t-input-text': '#0ff',
                '--t-close-hover-bg': 'rgba(0, 255, 255, 0.15)',
                '--t-switch-bg': '#003333',
                '--t-switch-on': '#0ff',
                '--t-switch-knob': 'rgba(0,255,255,0.55)',
                '--t-switch-knob-on': '#0d3232',
                '--t-dot-active': '#0f0',
                '--t-dot-limit': '#ff0',
                '--t-dot-off': '#555',
                '--t-dot-anim-speed': '0.7s',
                '--t-dot-min-opacity': '0.6',
                '--t-dot-filter-on': 'brightness(1.5)',
                '--t-dot-filter-off': 'brightness(0.5)',
                '--t-dot-shadow-on': '0 0 8px #0f0, 0 0 16px #0f0',
                '--t-dot-shadow-off': 'none',
                '--t-wl-highlight': 'rgba(0, 255, 255, 0.2)',
                '--t-wl-badge-bg': '#0ff',
                '--t-wl-badge-active': '#0f0',
                '--t-card-border': 'rgba(0, 255, 255, 0.35)',
                '--t-card-bg': 'rgba(0, 255, 255, 0.06)',
                '--t-card-divider': 'rgba(0, 255, 255, 0.12)',
                '--t-switch-border': 'rgba(0, 255, 255, 0.5)',
                '--t-switch-border-on': 'rgba(0, 255, 255, 0.8)',
                '--t-input-border': 'rgba(0, 255, 255, 0.4)',
                '--t-switch-on-text': '#001a1a',
                '--t-switch-knob-on-shadow': '0 0 6px rgba(0,255,255,0.5)',
                '--t-nav-color': '#f0a',
                '--t-primary-shadow': '0 0 8px rgba(0,255,255,0.4)',
                '--t-primary-hover-shadow': '0 0 16px rgba(0,255,255,0.8), 0 0 32px rgba(0,255,255,0.3)',
                '--t-danger-bg': 'rgba(255,75,55,0.12)',
                '--t-danger-text': '#ff6b55',
                '--t-danger-border': 'rgba(255,75,55,0.30)',
                '--t-danger-hover-bg': 'rgba(255,75,55,0.22)',
                '--t-danger-hover-border': 'rgba(255,75,55,0.50)'
            }
        }
    };

    const UNIT_SECONDS = {
        'second'           : 1,
        'minute'           : 60,
        'hour'             : 3600,
        'day'              : 86400,
        'week'             : 604800,
        'month'            : 2592000,
        'year'             : 31536000
    };

    const FETCH_TIMEOUT_MS = 6000;
    const MIN_VIDEO_COUNT  = 100;
    const GRID_SELECTOR    = "ytd-rich-item-renderer";
    const TIME_SELECTOR    = "yt-content-metadata-view-model span, .inline-metadata-item, #metadata-line span";

    /* ============================================================
     * [YouTube DOM 選擇器集中管理]
     * 所有針對 YouTube 頁面 DOM 的 CSS 選擇器統一在此定義。
     * YouTube 改版後只需修改這一個地方，不必在腳本各處逐一搜尋。
     * ============================================================ */
    const YT_SELECTORS = {
        // ── 影片卡片結構 ────────────────────────────────────────
        richGridRenderer  : 'ytd-rich-grid-renderer',
        richItemRenderer  : 'ytd-rich-item-renderer',        // 同 GRID_SELECTOR
        browse            : 'ytd-browse',
        lockupViewModel   : 'yt-lockup-view-model',
        metadataViewModel : 'yt-lockup-metadata-view-model',

        // ── 標題 ────────────────────────────────────────────────
        // ⚠ YouTube 在 2025 年將 class 命名從 kebab-case 改為 camelCase，
        //   若再度失效請在此更新，例如改回 'h3.yt-lockup-metadata-view-model__heading-reset'
        videoTitleH3      : 'h3.ytLockupMetadataViewModelHeadingReset',
        videoTitleLink    : 'a#video-title-link',

        // ── 頻道 / 頭像 ─────────────────────────────────────────
        channelName       : 'ytd-channel-name',
        channelLinkAt     : 'a[href^="/@"]',
        channelLinkId     : 'a[href^="/channel/"]',
        channelLinkMeta   : '.yt-content-metadata-view-model__metadata-row a',
        // ⚠ 頭像容器：camelCase 版為主，舊版 #avatar 作備用 fallback
        avatarContainer   : '.ytLockupMetadataViewModelAvatar',
        avatarContainerFB : '#avatar',

        // ── 選單按鈕 ────────────────────────────────────────────
        // ⚠ 同上，camelCase 命名；舊版為 '.yt-lockup-metadata-view-model__menu-button'
        menuButton        : '.ytLockupMetadataViewModelMenuButton',

        // ── 徽章 / 直播標記 ─────────────────────────────────────
        badges            : 'ytd-badge-supported-renderer, .badge-style-type-live-now-alternate, yt-badge-shape[aria-label]',
        badgeText         : '.yt-badge-shape__text',

        // ── 觀看進度條 ───────────────────────────────────────────
        progressBar       : 'yt-thumbnail-overlay-progress-bar-view-model .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',

        // ── 頁面頂端 Logo（重新整理用）──────────────────────────
        topbarLogo        : 'ytd-topbar-logo-renderer a',
        topbarLogoFB      : 'a#logo',

        // ── 影片連結（用於 QA hover 判斷）───────────────────────
        videoLinkWatch    : 'a[href^="/watch?v="]',
        videoLinkShorts   : 'a[href^="/shorts/"]',

        // ── 預約影片偵測（DOM 元素存在即為預約，語言無關）──────
        // 預約影片卡片上會出現 toggle-button（即「Notify me」/「通知我」按鈕），
        // 以 lockup-attachments-view-model 作為範圍限制，避免誤判其他卡片
        upcomingButton    : 'lockup-attachments-view-model toggle-button-view-model',
    };

    // ── 點擊新分頁排除清單 ──────────────────────────────
    // handleLinkClick 不應政截以下元素的點擊（讓它們在原分頁正常作用）。
    // 必須在 YT_SELECTORS 宣告結束後才能組合，因為需要引用 YT_SELECTORS.menuButton。
    YT_SELECTORS.linkClickExclusions =
        '.qa-btn-row, '            +   // 我們注入的 QA 快速動作按鈕列
        '.wl-avatar-container, '   +   // 我們注入的白名單頭像按鈕
        '.qa-feedback-notice, '    +   // QA 通知卡片（含復原按鈕）
        '.yt-lockup-metadata-view-model__menu-button, ' +   // YouTube 三點選單（舊版 kebab-case，保留作 fallback）
        YT_SELECTORS.menuButton + ', ' +                    // YouTube 三點選單（新版 camelCase）
        'yt-flexible-actions-view-model';                   // YouTube 原生動作按鈕（「通知我」等）

    const defaultConfig = {
        enabled            : true,
        value              : 3,
        unit               : 'month',
        lang               : 'auto',
        theme              : 'auto',
        whitelistMusic     : [],
        whitelistMember    : [],
        hideRegular        : false,
        hideLive           : false,
        hideUpcoming       : false,
        hideMusic          : false,
        hideMember         : false,
        hidePodcast        : false,
        hideMix            : false,
        hidePlaylist       : false,
        hideWatched        : false,
        hideTitleFilter    : false,
        titleFilterList    : [],
        watchedPercent     : 3,
        watchedSeconds     : 15,
        qaShowAlreadyWatched   : false,
        qaShowNotInterested    : false,
        qaShowDontLike         : true,
        qaShowDontRecommend    : true,
        hideOldEnabled         : true,
        openLinksInNewTab      : true,
        enhancedTooltips       : true,
        gridColumnsEnabled     : true,
        gridColumnsValue       : 4,
        useCustomLang          : false,
        useCustomMatch         : false,
        customMatchPatterns    : {}
    };

    let config             = { ...defaultConfig, ...GM_getValue(STORAGE_KEY_CFG, {}) };

    // Validate fields that require type/value checks beyond simple defaults
    if (!Array.isArray(config.whitelistMusic))  config.whitelistMusic  = [];
    if (!Array.isArray(config.whitelistMember)) config.whitelistMember = [];
    if (!Array.isArray(config.titleFilterList)) config.titleFilterList = [];
    if (!config.unit || !UNIT_SECONDS[config.unit]) config.unit = 'month';
    if (typeof config.value !== 'number' || config.value <= 0) config.value = 3;
    if (typeof config.gridColumnsValue !== 'number' || config.gridColumnsValue < 3 || config.gridColumnsValue > 10) config.gridColumnsValue = 4;

    let isFetching         = false;
    let hasReachedLimit    = false;
    let isRefreshing       = false;
    let maxPillWidth       = 0;   // 所有語系、所有狀態中膠囊的最大寬度，用於底部 spacer 計算
    let activeWhitelistMode = null;
    let tfEditIndex         = -1;   // -1 = 新增模式；≥0 = 正在編輯該索引的規則
    let lastCalculatedLang = null;
    let isCustomLangOpen  = false;
    let isCustomMatchOpen = false;

    // 白名單 Set 快取，提供 O(1) 查找效能；每次 config 變更時重建
    let musicWhitelistSet  = new Set(config.whitelistMusic);
    let memberWhitelistSet = new Set(config.whitelistMember);
    // 本次頁面工作階段的手動移除清單（使用者透過快速反饋按鈕主動移除的影片 ID）
    // 僅存在於記憶體中，頁面重新載入後自動清除
    const manuallyRemovedIds = new Set();
    // MutationObserver 的 debounce 計時器
    let processTimer       = null;

    const TIME_UNIT_KEYS = ['Second','Minute','Hour','Day','Week','Month','Year'];

    Object.keys(LOCALES_MASTER).forEach(langKey => {
        const d = LOCALES_MASTER[langKey];
        if (!d.unitSecondMatch) return; // auto entry has no units
        d.timeMatch = new RegExp(
            TIME_UNIT_KEYS.map(u => d[`unit${u}Match`]).filter(Boolean).join('|')
        );
    });

    const isHomePage    = () => window.location.pathname === '/' || window.location.pathname === '/index';

    /* ============================================================
     * [5.0] 自製 Tooltip 系統
     *
     * 架構：
     *   - buildTooltipPath()   : 計算膠囊＋三角箭頭的 SVG path
     *   - makeSVGTooltip()     : 根據文字與配色產生 SVG 元素
     *   - QA_TOOLTIP_CFGS      : QA 區域配色（跟隨 YouTube 原生深/淺主題）
     *   - tooltipCache         : { panel: Map<text,SVGEl>, qa: Map<text,SVGEl> }
     *                            語系確定後預先算好，主題切換時只更新顏色
     *   - buildTooltipCache()  : 預先計算所有 tooltip SVG（語系變更時呼叫）
     *   - applyTooltipColors() : 主題變更時更新 SVG 顏色屬性（不重算形狀）
     *   - showTooltip()        : mouseenter 時定位並顯示
     *   - hideTooltip()        : mouseleave / click 時淡出隱藏
     *   - bindTooltip()        : 將事件綁定到按鈕（需有 data-tooltip 屬性）
     * ============================================================ */

    // ── SVG path 產生器 ─────────────────────────────────────────
    // 膠囊（圓角矩形）+ 向下三角箭頭，合為單一 path
    function buildTooltipPath(w, h, r, aw, ah, ax) {
        const aLeft  = ax - aw / 2;
        const aRight = ax + aw / 2;
        return [
            `M ${r} 0`,
            `L ${w - r} 0`, `Q ${w} 0 ${w} ${r}`,
            `L ${w} ${h - r}`, `Q ${w} ${h} ${w - r} ${h}`,
            `L ${aRight} ${h}`,
            `L ${ax} ${h + ah}`,
            `L ${aLeft} ${h}`,
            `L ${r} ${h}`, `Q 0 ${h} 0 ${h - r}`,
            `L 0 ${r}`, `Q 0 0 ${r} 0`, `Z`
        ].join(' ');
    }

    // ── SVG 元素產生器 ──────────────────────────────────────────
    // 所有主題永遠建立完整的 <filter> 結構
    // shadowOpacity='0' 時即無光暈，但結構存在，applyTooltipColors() 可統一更新
    function makeSVGTooltip(text, cfg) {
        const { fill, textColor, strokeColor, strokeWidth, shadowColor, shadowOpacity } = cfg;
        const fontSize   = 14;
        const lineHeight = 20;
        const padX       = 16;
        const padY       = 10;
        const radius     = 20;
        const arrowW     = 12;
        const arrowH     = 7;
        const sw         = strokeColor ? (strokeWidth || 1) : 0;

        const tmp  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tmp.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;';
        const tmpT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tmpT.style.cssText = `font-family:"Roboto","YouTube Sans","Arial",sans-serif;font-size:${fontSize}px;`;
        tmpT.textContent = text;
        tmp.appendChild(tmpT);
        document.body.appendChild(tmp);
        const textW = tmpT.getBBox().width;
        document.body.removeChild(tmp);

        const capsuleW = Math.ceil(textW + padX * 2);
        const capsuleH = lineHeight + padY * 2;
        const arrowX   = capsuleW / 2;
        const totalH   = capsuleH + arrowH;
        const bleed    = sw + 2;
        const svgW     = capsuleW + bleed * 2;
        const svgH     = totalH  + bleed * 2;

        const ns  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width',   svgW);
        svg.setAttribute('height',  svgH);
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.style.cssText = 'display:block;overflow:visible;';

        // 永遠建立 <filter>，shadowOpacity='0' 時即無光暈
        const filterId = 'ttf-' + Math.random().toString(36).slice(2, 7);
        const defs   = document.createElementNS(ns, 'defs');
        const filter = document.createElementNS(ns, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-40%'); filter.setAttribute('y', '-40%');
        filter.setAttribute('width', '180%'); filter.setAttribute('height', '200%');
        const ds = document.createElementNS(ns, 'feDropShadow');
        ds.setAttribute('dx', '0'); ds.setAttribute('dy', cfg.shadowDy ?? '0');
        ds.setAttribute('stdDeviation', cfg.shadowStd ?? '4');
        ds.setAttribute('flood-color',   shadowColor   || '#000000');
        ds.setAttribute('flood-opacity',  shadowOpacity || '0');
        filter.appendChild(ds);
        defs.appendChild(filter);
        svg.appendChild(defs);

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${bleed},${bleed})`);
        g.setAttribute('filter', `url(#${filterId})`);

        const pathEl = document.createElementNS(ns, 'path');
        pathEl.setAttribute('d', buildTooltipPath(capsuleW, capsuleH, radius, arrowW, arrowH, arrowX));
        pathEl.setAttribute('fill', fill);
        if (strokeColor) {
            pathEl.setAttribute('stroke', strokeColor);
            pathEl.setAttribute('stroke-width', sw);
            pathEl.setAttribute('stroke-linejoin', 'round');
        }
        g.appendChild(pathEl);

        const textEl = document.createElementNS(ns, 'text');
        textEl.setAttribute('x', capsuleW / 2);
        textEl.setAttribute('y', padY + lineHeight / 2);
        textEl.setAttribute('dominant-baseline', 'central');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('fill', textColor);
        textEl.style.cssText = `font-family:"Roboto","YouTube Sans","Arial",sans-serif;font-size:${fontSize}px;user-select:none;`;
        textEl.textContent = text;
        g.appendChild(textEl);

        svg.appendChild(g);
        svg._pathEl     = pathEl;
        svg._textEl     = textEl;
        svg._dropShadow = ds;
        svg._capsuleW   = capsuleW;
        svg._capsuleH   = capsuleH;
        svg._radius     = radius;
        svg._arrowW     = arrowW;
        svg._arrowH     = arrowH;

        return svg;
    }

    // ── 快取結構 ────────────────────────────────────────────────
    const tooltipCache = { panel: new Map(), qa: new Map() };

    // ── 多行 SVG Tooltip（用於影片標題，依文字長度自動換行）──────
    // maxW：膠囊最大寬度（px）；fontSize：動態取得；arrowAtX：箭頭尖端的頁面 X 座標
    function makeMultilineSVGTooltip(text, cfg, maxW, fontSize, arrowAtX) {
        const { fill, textColor, strokeColor, strokeWidth, shadowColor, shadowOpacity } = cfg;
        const lineHeight = Math.round(fontSize * 1.5);
        const padX       = 16;
        const padY       = 10;
        const radius     = 20;
        const arrowW     = 12;
        const arrowH     = 7;
        const sw         = strokeColor ? (strokeWidth || 1) : 0;
        const contentW   = maxW - padX * 2;

        // ── 文字換行計算（支援中英混排）──
        const ns  = 'http://www.w3.org/2000/svg';
        const tmp = document.createElementNS(ns, 'svg');
        tmp.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;';
        const tmpT = document.createElementNS(ns, 'text');
        tmpT.style.cssText = `font-family:"Roboto","YouTube Sans","Arial",sans-serif;font-size:${fontSize}px;`;
        tmp.appendChild(tmpT);
        document.body.appendChild(tmp);

        tmpT.textContent = text;
        const totalW = tmpT.getBBox().width;

        const lines = [];
        if (totalW <= contentW) {
            lines.push(text);
        } else {
            let curLine = '';
            for (let i = 0; i < text.length; i++) {
                const ch   = text[i];
                const test = curLine + ch;
                tmpT.textContent = test;
                if (tmpT.getBBox().width > contentW && curLine.length > 0) {
                    lines.push(curLine);
                    curLine = ch;
                } else {
                    curLine = test;
                }
            }
            if (curLine) lines.push(curLine);
        }

        let maxLineW = 0;
        for (const line of lines) {
            tmpT.textContent = line;
            maxLineW = Math.max(maxLineW, tmpT.getBBox().width);
        }
        document.body.removeChild(tmp);

        const capsuleW = Math.ceil(maxLineW + padX * 2);
        const capsuleH = lineHeight * lines.length + padY * 2;
        const bleed    = sw + 2;
        const svgW     = capsuleW + bleed * 2;
        const svgH     = capsuleH + arrowH + bleed * 2;

        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width',   svgW);
        svg.setAttribute('height',  svgH);
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.style.cssText = 'display:block;overflow:visible;';

        const filterId = 'ttm-' + Math.random().toString(36).slice(2, 7);
        const defs   = document.createElementNS(ns, 'defs');
        const filter = document.createElementNS(ns, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-40%'); filter.setAttribute('y', '-40%');
        filter.setAttribute('width', '180%'); filter.setAttribute('height', '200%');
        const ds = document.createElementNS(ns, 'feDropShadow');
        ds.setAttribute('dx', '0'); ds.setAttribute('dy', cfg.shadowDy ?? '0');
        ds.setAttribute('stdDeviation', cfg.shadowStd ?? '4');
        ds.setAttribute('flood-color',   shadowColor   || '#000000');
        ds.setAttribute('flood-opacity',  shadowOpacity || '0');
        filter.appendChild(ds); defs.appendChild(filter); svg.appendChild(defs);

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${bleed},${bleed})`);
        g.setAttribute('filter', `url(#${filterId})`);

        const pathEl = document.createElementNS(ns, 'path');
        // arrowAtX 是頁面座標，需轉換成 SVG 內的局部座標
        // SVG 左上角對應的頁面 X 由呼叫端的 left 決定，但這裡還不知道 left；
        // 先用 capsuleW/2 當預設，showTitleTooltip 確定 left 後再更新 path
        pathEl.setAttribute('d', buildTooltipPath(capsuleW, capsuleH, radius, arrowW, arrowH, capsuleW / 2));
        pathEl.setAttribute('fill', fill);
        if (strokeColor) {
            pathEl.setAttribute('stroke', strokeColor);
            pathEl.setAttribute('stroke-width', sw);
            pathEl.setAttribute('stroke-linejoin', 'round');
        }
        g.appendChild(pathEl);

        // 文字靠左對齊，x = padX
        lines.forEach((line, i) => {
            const textEl = document.createElementNS(ns, 'text');
            textEl.setAttribute('x', padX);
            textEl.setAttribute('y', padY + lineHeight * i + lineHeight / 2);
            textEl.setAttribute('dominant-baseline', 'central');
            textEl.setAttribute('text-anchor', 'start');
            textEl.setAttribute('fill', textColor);
            textEl.style.cssText = `font-family:"Roboto","YouTube Sans","Arial",sans-serif;font-size:${fontSize}px;user-select:none;`;
            textEl.textContent = line;
            g.appendChild(textEl);
        });

        svg.appendChild(g);
        svg._pathEl   = pathEl;
        svg._capsuleW = capsuleW;
        svg._capsuleH = capsuleH;
        svg._radius   = radius;
        svg._arrowW   = arrowW;
        svg._arrowH   = arrowH;
        svg._bleed    = bleed;
        return svg;
    }

    // ── 取得目前有效的 panel 主題 key ───────────────────────────
    // 直接從 THEMES_MASTER 動態解析，不寫死任何主題名稱
    function getActivePanelThemeKey() {
        let t = config.theme;
        if (t === 'auto') {
            const themes = Object.entries(THEMES_MASTER).filter(([k]) => k !== 'auto');
            const matched = themes.find(([, v]) => typeof v.autoMatch === 'function' && v.autoMatch());
            t = matched ? matched[0] : themes[0]?.[0];
        }
        if (THEMES_MASTER[t]?.tooltip) return t;
        const fallback = Object.entries(THEMES_MASTER).find(([, v]) => v.tooltip);
        return fallback ? fallback[0] : t;
    }

    // ── 取得目前 YouTube 深/淺主題 key ─────────────────────────
    function getActiveYTThemeKey() {
        return document.documentElement.hasAttribute(YT_DARK_ATTR) ? YT_TOOLTIP_DARK : YT_TOOLTIP_LIGHT;
    }

    // ── 預先計算所有 Tooltip SVG（語系變更時呼叫）──────────────
    function buildTooltipCache() {
        const msg = getMsg();

        const panelTexts = [
            msg.toggleTipEnable,
            msg.toggleTipDisable,
            msg.settingsOpenTip,
            msg.settingsClose,
            msg.refreshTip,
            msg.wlTipMusic,
            msg.wlTipMember,
            msg.wdTip,
            msg.tfTip,
            msg.tfAvatarTip,
            msg.advReset,
            msg.advResetTip,
            msg.wlQuickAdd,
            msg.wlQuickRemove,
        ].filter(Boolean);

        const qaTexts = [
            msg.qaLabelWatched,
            msg.qaLabelNotInt,
            msg.qaLabelDontLike,
            msg.qaLabelDontRec,
        ].filter(Boolean);

        const panelCfg = THEMES_MASTER[getActivePanelThemeKey()].tooltip;
        const qaCfg    = QA_TOOLTIP_CFGS[getActiveYTThemeKey()];

        tooltipCache.panel.clear();
        panelTexts.forEach(text => {
            tooltipCache.panel.set(text, makeSVGTooltip(text, panelCfg));
        });

        tooltipCache.qa.clear();
        qaTexts.forEach(text => {
            tooltipCache.qa.set(text, makeSVGTooltip(text, qaCfg));
        });
    }

    // ── 主題切換時：只更新顏色，不重算形狀 ─────────────────────
    // 所有主題 SVG 結構一致（永遠有 <filter>），可統一更新含光暈在內的所有屬性
    function applyTooltipColors() {
        const panelCfg = THEMES_MASTER[getActivePanelThemeKey()].tooltip;
        const qaCfg    = QA_TOOLTIP_CFGS[getActiveYTThemeKey()];

        function recolor(map, cfg) {
            map.forEach(svg => {
                const p  = svg._pathEl;
                const t  = svg._textEl;
                const ds = svg._dropShadow;
                if (!p || !t || !ds) return;
                p.setAttribute('fill', cfg.fill);
                t.setAttribute('fill', cfg.textColor);
                if (cfg.strokeColor) {
                    p.setAttribute('stroke', cfg.strokeColor);
                    p.setAttribute('stroke-width', cfg.strokeWidth || 1);
                } else {
                    p.removeAttribute('stroke');
                    p.removeAttribute('stroke-width');
                }
                ds.setAttribute('flood-color',  cfg.shadowColor   || '#000000');
                ds.setAttribute('flood-opacity', cfg.shadowOpacity || '0');
                ds.setAttribute('dy',            cfg.shadowDy      ?? '0');
                ds.setAttribute('stdDeviation',  cfg.shadowStd     ?? '4');
            });
        }

        recolor(tooltipCache.panel, panelCfg);
        recolor(tooltipCache.qa,    qaCfg);
    }
    // ── 浮動顯示容器 ────────────────────────────────────────────
    // 直接掛在 shadow root 的根層，不是任何面板的子元素，
    // 所以不受 .panel / .btn 的 overflow:hidden 裁切。
    // z-index 設成比所有面板都高，在 Shadow DOM 的 stacking context 裡排最頂層。
    // 初始化時先插入佔位，待 shadow 建立後再 appendChild（見下方初始化區塊）。
    const _ttContainer = document.createElement('div');
    _ttContainer.id = 'tm-tooltip-host';
    _ttContainer.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'pointer-events:none',
        'top:0',
        'left:0',
        'opacity:0',
        'transition:opacity 0.15s ease',
    ].join(';');
    // 移除舊的 dialog style（若存在）
    const _oldTTStyle = document.getElementById('tm-tooltip-dialog-style');
    if (_oldTTStyle) _oldTTStyle.remove();

    let _ttHideTimer = null;

    // ── 顯示 Tooltip ────────────────────────────────────────────
    function showTooltip(btn, area) {
        const text = btn.getAttribute('data-tooltip');
        if (!text) return;

        const cache = area === 'qa' ? tooltipCache.qa : tooltipCache.panel;
        const svgEl = cache.get(text);
        if (!svgEl) return;

        if (_ttHideTimer !== null) { clearTimeout(_ttHideTimer); _ttHideTimer = null; }

        while (_ttContainer.firstChild) _ttContainer.removeChild(_ttContainer.firstChild);
        _ttContainer.appendChild(svgEl);
        _ttContainer.style.opacity = '0';

        const svgW = parseFloat(svgEl.getAttribute('width'))  || 0;
        const svgH = parseFloat(svgEl.getAttribute('height')) || 0;
        const GAP  = 5;
        const vw   = document.documentElement.clientWidth;

        const r       = btn.getBoundingClientRect();
        const idealLeft = r.left + r.width / 2 - svgW / 2;
        let   left      = idealLeft;
        let   top       = r.top - svgH - GAP;

        if (left < 4)             left = 4;
        if (left + svgW > vw - 4) left = vw - svgW - 4;
        if (top  < 4)             top  = r.bottom + GAP;

        // 若因貼邊而位移，重新計算箭頭在 SVG 內的 X 並即時重畫 path
        // 不影響快取，下次顯示時會再重算一次
        const delta = idealLeft - left;
        if (svgEl._pathEl && svgEl._capsuleW !== undefined) {
            const arrowX = svgEl._capsuleW / 2 + delta;
            // 箭頭 X 限制在膠囊範圍內（留 arrowW/2 的餘量）
            const clampedArrowX = Math.max(svgEl._arrowW, Math.min(svgEl._capsuleW - svgEl._arrowW, arrowX));
            svgEl._pathEl.setAttribute('d', buildTooltipPath(
                svgEl._capsuleW, svgEl._capsuleH,
                svgEl._radius,
                svgEl._arrowW, svgEl._arrowH,
                clampedArrowX
            ));
        }

        _ttContainer.style.left = left + 'px';
        _ttContainer.style.top  = top  + 'px';

        requestAnimationFrame(() => { _ttContainer.style.opacity = '1'; });
    }

    // ── 隱藏 Tooltip ────────────────────────────────────────────
    function hideTooltip() {
        _ttContainer.style.opacity = '0';
        _ttHideTimer = setTimeout(() => {
            while (_ttContainer.firstChild) _ttContainer.removeChild(_ttContainer.firstChild);
            _ttHideTimer = null;
        }, 150);
    }

    // ── 綁定事件 ────────────────────────────────────────────────
    function bindTooltip(btn, area) {
        area = area || 'panel';
        const text = btn.getAttribute('data-tooltip');
        // 無論開關狀態，永遠設 title 作為 fallback
        if (text) btn.title = text;
        if (!config.enhancedTooltips) return;
        btn.addEventListener('mouseenter', () => showTooltip(btn, area));
        btn.addEventListener('mouseleave', hideTooltip);
        btn.addEventListener('click',      hideTooltip);
    }

    // ── 影片標題 Tooltip：即時生成多行版本 ──────────────────────
    function showTitleTooltip(el, mouseX) {
        if (!config.enhancedTooltips || !isHomePage()) return;
        const text = el.getAttribute('data-ytf-title');
        if (!text) return;

        // 動態取得卡片標題字型大小，fallback 14px
        const titleLink = el.querySelector('a') || el;
        const fontSize  = parseFloat(getComputedStyle(titleLink).fontSize) || 14;

        const cfg   = QA_TOOLTIP_CFGS[getActiveYTThemeKey()];
        const maxW  = Math.round(window.innerWidth * 0.35);
        const svgEl = makeMultilineSVGTooltip(text, cfg, maxW, fontSize, mouseX);

        if (_ttHideTimer !== null) { clearTimeout(_ttHideTimer); _ttHideTimer = null; }
        while (_ttContainer.firstChild) _ttContainer.removeChild(_ttContainer.firstChild);
        _ttContainer.appendChild(svgEl);
        _ttContainer.style.opacity = '0';

        const svgW = parseFloat(svgEl.getAttribute('width'))  || 0;
        const svgH = parseFloat(svgEl.getAttribute('height')) || 0;
        const GAP  = 6;
        const vw   = document.documentElement.clientWidth;

        const r         = el.getBoundingClientRect();
        const idealLeft = r.left + r.width / 2 - svgW / 2;
        const left      = Math.max(4, Math.min(idealLeft, vw - svgW - 4));
        let   top       = r.top - svgH - GAP;
        if (top < 4) top = r.bottom + GAP;

        // 箭頭尖端對齊滑鼠 X，轉換成 SVG 內局部座標
        if (svgEl._pathEl && svgEl._capsuleW !== undefined) {
            const localArrowX  = mouseX - left - (svgEl._bleed || 0);
            const clampedArrowX = Math.max(svgEl._arrowW, Math.min(svgEl._capsuleW - svgEl._arrowW, localArrowX));
            svgEl._pathEl.setAttribute('d', buildTooltipPath(
                svgEl._capsuleW, svgEl._capsuleH,
                svgEl._radius, svgEl._arrowW, svgEl._arrowH,
                clampedArrowX
            ));
        }

        _ttContainer.style.left = left + 'px';
        _ttContainer.style.top  = top  + 'px';
        requestAnimationFrame(() => { _ttContainer.style.opacity = '1'; });
    }

    // ── 掃描首頁，攔截影片標題的原生 tooltip ────────────────────
    function scanAndBindTitleTooltips() {
        if (!isHomePage() || !config.enhancedTooltips) return;
        document.querySelectorAll(YT_SELECTORS.videoTitleH3).forEach(h3 => {
            if (h3.dataset.ytfTtBound) return;    // 已處理過，跳過
            const titleText = h3.getAttribute('title') || h3.textContent.trim();
            if (!titleText) return;

            // 暫存原始 title，移除原生 tooltip
            h3.dataset.ytfOriginalTitle = h3.getAttribute('title') || '';
            h3.dataset.ytfTitle         = titleText;
            h3.removeAttribute('title');
            h3.dataset.ytfTtBound       = '1';

            h3.addEventListener('mouseenter', (e) => {
                // 在 hover 當下判斷卡片是否仍可見
                const card = h3.closest(YT_SELECTORS.richItemRenderer);
                if (card && card.style.display === 'none') return;
                // YouTube SPA 可能回收此 DOM 節點並更換內容（title 被重設、data-ytf-title 過時）
                // 每次 hover 當下重新同步標題，確保顯示正確內容並防止原生 tooltip 出現
                const freshTitle = h3.getAttribute('title') || h3.textContent.trim();
                if (freshTitle) {
                    h3.dataset.ytfTitle = freshTitle;
                    h3.removeAttribute('title');
                }
                showTitleTooltip(h3, e.clientX);
            });
            h3.addEventListener('mouseleave', hideTooltip);
        });
    }

    // ── 還原被攔截的標題 title attribute ──────────────────────
    function restoreTitleTooltips() {
        document.querySelectorAll(`${YT_SELECTORS.videoTitleH3}[data-ytf-tt-bound]`).forEach(h3 => {
            const orig = h3.dataset.ytfOriginalTitle;
            if (orig) h3.setAttribute('title', orig);
            delete h3.dataset.ytfTtBound;
            delete h3.dataset.ytfTitle;
            delete h3.dataset.ytfOriginalTitle;
        });
    }

    // 語系偵測：完全由 LOCALES_MASTER 的鍵名驅動，新增語系不需要修改此處。
    // 使用 startsWith 比對，可正確處理 "zh-TW"、"ja-JP" 等帶地區碼的語言標籤。
    // Fallback 動態取 LOCALES_MASTER 的第一個語系，而非硬編碼 'en'。
    const getActiveLang = () => {
        if (config.lang !== 'auto') return config.lang;
        const browserLang = document.documentElement.lang.toLowerCase();
        const matched = Object.keys(LOCALES_MASTER).find(key => browserLang.startsWith(key));
        return matched ?? Object.keys(LOCALES_MASTER)[0];
    };

    // 自訂語系：把 GM storage 裡的 JSON 解析成 { key: value } 平面物件
    function parseCustomLang(jsonStr) {
        try {
            const data = JSON.parse(jsonStr || '{}');
            const map = {};
            if (Array.isArray(data.strings)) {
                for (const entry of data.strings) {
                    if (entry && entry.key && entry.value !== undefined) {
                        map[entry.key] = entry.value;
                    }
                }
            }
            return map;
        } catch { return {}; }
    }

    // 自訂語系快取：避免每次 getMsg() 都重新 JSON.parse
    let _customLangCache = null;
    function getCustomLangMap() {
        if (_customLangCache === null) {
            _customLangCache = parseCustomLang(GM_getValue(STORAGE_KEY_CUSTOM_LANG, '{}'));
        }
        return _customLangCache;
    }
    function invalidateCustomLangCache() { _customLangCache = null; }

    // 僅限純字串 key 可被自訂語系覆蓋（排除 RegExp、Function、Object 等複合型態）
    const CL_EDITABLE_KEYS = Object.keys(LOCALES_MASTER.en).filter(k => typeof LOCALES_MASTER.en[k] === 'string');

    const MATCH_PATTERN_KEYS = [
        'liveMatch','podcastMatch','mixMatch','playlistMatch',
        ...TIME_UNIT_KEYS.map(u => `unit${u}Match`)
    ];

    // 自訂語系編輯器分組定義（決定分組標題與顯示順序）
    const CL_KEY_GROUPS = [
        {
            groupKey: 'detection',
            keys: [
                'liveMatch','podcastMatch','mixMatch','playlistMatch',
                ...TIME_UNIT_KEYS.map(u => `unit${u}Match`)
            ].filter(k => CL_EDITABLE_KEYS.includes(k))
        },
        {
            groupKey: 'unitLabels',
            keys: TIME_UNIT_KEYS.map(u => `unit${u}Label`)
                .filter(k => CL_EDITABLE_KEYS.includes(k))
        },
        {
            groupKey: 'ui',
            keys: CL_EDITABLE_KEYS.filter(k =>
                !MATCH_PATTERN_KEYS.includes(k) &&
                !k.startsWith('unit')
            )
        }
    ];

    const getMsg = () => {
        const base = LOCALES_MASTER[getActiveLang()] || LOCALES_MASTER[Object.keys(LOCALES_MASTER)[0]];
        const result = Object.assign({}, base);
        // 自訂語系覆蓋（第二優先）
        if (config.useCustomLang) {
            const custom = getCustomLangMap();
            for (const key of CL_EDITABLE_KEYS) {
                if (custom[key] !== undefined && custom[key] !== '') {
                    result[key] = custom[key];
                }
            }
        }
        // 自訂篩選字詞覆蓋（最高優先）
        if (config.useCustomMatch) {
            const patterns = config.customMatchPatterns || {};
            for (const key of MATCH_PATTERN_KEYS) {
                if (patterns[key] && patterns[key].trim()) {
                    result[key] = patterns[key].trim();
                }
            }
        }
        return _resolveMsg(result);
    };

    // 把所有字串形式的 match pattern 轉成 RegExp，並重建 timeMatch
    function _resolveMsg(obj) {
        const r = Object.assign({}, obj);
        MATCH_PATTERN_KEYS.forEach(k => {
            if (typeof r[k] === 'string') r[k] = new RegExp(r[k], 'i');
        });
        // 重建 timeMatch（自訂語系或自訂篩選字詞覆蓋後要重建）
        if (!r.timeMatch || config.useCustomLang || config.useCustomMatch) {
            r.timeMatch = new RegExp(
                TIME_UNIT_KEYS.map(u => {
                    const m = r[`unit${u}Match`];
                    return m instanceof RegExp ? m.source : (m || '');
                }).filter(Boolean).join('|')
            );
        }
        return r;
    }

    // 取得某個 match key 目前實際生效的字串（供面板左欄顯示）
    // 優先序：useCustomMatch 自訂 > useCustomLang 自訂語系 > 內建語系
    function getEffectiveMatchStr(matchKey) {
        // 1. useCustomMatch 自訂篩選字詞（最高優先）
        if (config.useCustomMatch) {
            const v = (config.customMatchPatterns || {})[matchKey];
            if (v && v.trim()) return v.trim();
        }
        // 2. useCustomLang 自訂語系
        if (config.useCustomLang) {
            const custom = getCustomLangMap();
            if (custom[matchKey] && custom[matchKey].trim()) return custom[matchKey].trim();
        }
        // 3. 內建語系
        const base = LOCALES_MASTER[getActiveLang()] || LOCALES_MASTER.en;
        const v = base[matchKey];
        if (typeof v === 'string') return v;
        if (v instanceof RegExp) return v.source;
        return '';
    }

    // 解析自訂篩選字詞輸入值為 RegExp（與片名過濾邏輯一致）
    function parseCKPattern(str) {
        if (!str || !str.trim()) return null;
        const m = str.trim().match(/^\/(.+)\/([gimsuy]*)$/);
        if (m) {
            try { return new RegExp(m[1], m[2] || 'i'); } catch { return null; }
        }
        try { return new RegExp(str.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); } catch { return null; }
    }

    /* 每行卡片數量控制 --------------------------------------------------------------------- */
    const GRID_COLUMNS_STYLE_ID  = 'yt-filter-grid-columns-style';
    const BOTTOM_SPACER_ID       = 'yt-filter-bottom-spacer';
    // 膠囊高度(38px) + 膠囊與設定面板之間的間距(43px，對應 .panel { margin-bottom: 43px })
    const BOTTOM_SPACER_HEIGHT   = 38 + 43;

    function applyGridColumns() {
        let el = document.getElementById(GRID_COLUMNS_STYLE_ID);
        if (config.gridColumnsEnabled && isHomePage()) {
            if (!el) {
                el = document.createElement('style');
                el.id = GRID_COLUMNS_STYLE_ID;
                document.head.appendChild(el);
            }
            el.textContent = `ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: ${config.gridColumnsValue} !important; }`;
        } else {
            if (el) el.remove();
        }
    }

    function removeGridColumns() {
        const el = document.getElementById(GRID_COLUMNS_STYLE_ID);
        if (el) el.remove();
    }

    // ── 快速回饋按鈕是否有任何一個開啟 ──
    function isQAActive() {
        return config.qaShowAlreadyWatched || config.qaShowNotInterested ||
               config.qaShowDontLike       || config.qaShowDontRecommend;
    }

    // ── 取得目前實際生效的每列卡片欄數 ──
    // 優先使用我們自訂的欄數設定；若功能未開啟則從 DOM 讀取 YouTube 原生值。
    function getEffectiveColumns() {
        if (config.gridColumnsEnabled) return config.gridColumnsValue;
        const renderer = document.querySelector(YT_SELECTORS.richGridRenderer);
        if (renderer) {
            const cols = parseInt(getComputedStyle(renderer).getPropertyValue('--ytd-rich-grid-items-per-row'));
            if (!isNaN(cols) && cols > 0) return cols;
        }
        return 4; // 無法取得時的保守預設值
    }

    // ── 底部可捲動空間管理 ──
    // 判斷最後一列是否有足夠的空格讓膠囊不遮擋 QA 按鈕；
    // 若不夠，在 ytd-browse 末端插入高度為 BOTTOM_SPACER_HEIGHT 的佔位 div。
    function updateBottomSpacer() {
        const needsSpacer = isQAActive();

        let spacer = document.getElementById(BOTTOM_SPACER_ID);
        if (needsSpacer) {
            if (!spacer) {
                spacer = document.createElement('div');
                spacer.id = BOTTOM_SPACER_ID;
                spacer.style.cssText = `height:${BOTTOM_SPACER_HEIGHT}px;width:100%;pointer-events:none;flex-shrink:0;`;
                const browse = document.querySelector(YT_SELECTORS.browse);
                if (browse) browse.appendChild(spacer);
            }
        } else {
            if (spacer) spacer.remove();
        }
    }

    /* 連結攔截：在新分頁開啟影片與頻道連結 --------------------------------------------------- */
    const INTERCEPT_PATTERNS = [
        /^\/watch\?/,
        /^\/shorts\/[^/]+/,
        /^\/live\/[^/]+/,
        /^\/@/,
        /^\/channel\//,
        /^\/c\//,
        /^\/user\//,
        /^\/playlist\?/,
    ];

    function shouldInterceptHref(href) {
        if (!href) return false;
        let path;
        try {
            const url = new URL(href, 'https://www.youtube.com');
            if (url.hostname !== 'www.youtube.com' && url.hostname !== 'youtube.com') return false;
            path = url.pathname + url.search;
        } catch(e) {
            path = href;
        }
        return INTERCEPT_PATTERNS.some(re => re.test(path));
    }

    function handleLinkClick(e) {
        if (!config.openLinksInNewTab || !isHomePage()) return;
        let anchor = e.target.closest('a');

        // Fallback：點擊目標不在 <a> 內（例如 yt-lockup-metadata-view-model 整塊區域），
        // 但 YouTube 會透過內部路由觸發 SPA 跳轉。
        // 排除我們自己注入的按鈕後，向上找 ytd-rich-item-renderer，
        // 再取其中第一個通過 shouldInterceptHref 的 <a[href]> 作為跳轉目標。
        if (!anchor) {
            // 主動白名單：只攔截影片內容區域（yt-lockup-metadata-view-model）的點擊，
            // 這是觸發 SPA 跳轉但沒有 <a> 的唯一正常情境。
            if (!e.target.closest(YT_SELECTORS.metadataViewModel)) return;
            // 保險排除：排除條件集中定義於 YT_SELECTORS.linkClickExclusions。
            if (e.target.closest(YT_SELECTORS.linkClickExclusions)) return;
            const renderer = e.target.closest(YT_SELECTORS.richItemRenderer);
            if (!renderer) return;
            anchor = Array.from(renderer.querySelectorAll('a[href]'))
                         .find(a => shouldInterceptHref(a.getAttribute('href') || a.href));
            if (!anchor) return;
        }

        const href = anchor.getAttribute('href') || anchor.href;
        if (!shouldInterceptHref(href)) return;

        e.preventDefault();
        e.stopPropagation();

        let fullUrl;
        try {
            fullUrl = new URL(href, 'https://www.youtube.com').href;
        } catch(e) {
            fullUrl = 'https://www.youtube.com' + href;
        }
        window.open(fullUrl, '_blank', 'noopener');
    }

    // capture phase 攔截，確保在 YouTube 自身的 handler 之前執行
    document.addEventListener('click', handleLinkClick, true);

    /* [4.0] 視覺排版與主題控制系統 ----------------------------------------------------------- */

    const globalStyle = document.createElement('style');
    globalStyle.textContent = `
        ytd-rich-grid-row         { display: contents !important; }

        ytd-rich-item-renderer {
            margin-bottom: 24px !important;
           margin-left: calc(var(--ytd-rich-grid-item-margin, 16px) / 2) !important;
           margin-right: calc(var(--ytd-rich-grid-item-margin, 16px) / 2) !important;
        }
        ytd-rich-section-renderer { display: none !important; }


        .wl-avatar-container {
            position: absolute; top: 0; left: 0; width: 40px; height: 40px;
            pointer-events: none; z-index: 9999; display: none;
        }
        body.tm-wl-mode-music .wl-avatar-container,
        body.tm-wl-mode-member .wl-avatar-container,
        body.tm-tf-mode .wl-avatar-container { display: block; }

        /* 頻道 hover 按鈕：白名單（盾牌→+）與片名過濾（漏斗→+）統一樣式 */
        .wl-avatar-btn,
        .tf-avatar-btn {
            position: absolute; top: -4px; left: -4px;
            width: 24px; height: 24px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            pointer-events: auto; padding: 2px; box-sizing: border-box;
            opacity: 0; background: transparent; color: var(--t-wl-badge-bg, #3478F6);
            transform: scale(0.85);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: none;
        }
        body.tm-wl-mode-music ytd-rich-item-renderer:hover .wl-avatar-btn:not(.active),
        body.tm-wl-mode-member ytd-rich-item-renderer:hover .wl-avatar-btn:not(.active),
        body.tm-tf-mode ytd-rich-item-renderer:hover .tf-avatar-btn {
            opacity: 1; transform: scale(1);
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .wl-avatar-btn:hover,
        .tf-avatar-btn:hover {
            transform: scale(1.15) !important;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)) brightness(1.15);
        }
        .wl-avatar-btn.active {
            color: var(--t-wl-badge-active, #4CAF50); opacity: 1; transform: scale(1);
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .wl-avatar-btn.active:hover {
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)) brightness(1.15);
        }

        /* ── 快速動作按鈕 ── */
        .qa-btn-row {
            position: absolute;
            bottom: 0;
            right: 0;
            display: flex;
            align-items: center;
            visibility: hidden;
            gap: 4px;
        }
        /* 預留按鈕列的高度空間，加上上方間距 */
        yt-lockup-metadata-view-model {
            padding-bottom: 44px !important;
            box-sizing: border-box !important;
        }
        .qa-btn-row.qa-visible {
            visibility: visible;
        }
        .qa-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            color: var(--yt-spec-text-secondary, #aaa);
            transition: background 0.15s ease, color 0.15s ease;
        }
        .qa-btn:hover {
            background: var(--yt-spec-mono-tonal-hover, rgba(255,255,255,0.1));
            color: var(--yt-spec-text-primary, #fff);
        }

        /* ── QA 反饋通知（仿 YouTube 原生樣式）── */

        /* 顏色變數：依 YouTube 深色/淺色主題寫死，不依賴 --yt-spec-* 變數 */
        /* 深色主題 */
        html[dark] .qa-notice-frame        { background: #0f0f0f; border-color: #3d3d3d; }
        html[dark] .qa-notice-action       { color: #fff; }
        html[dark] .qa-notice-msg          { color: #aaa; }
        html[dark] .qa-notice-undo         { background: #272727; color: #fff; }
        html[dark] .qa-notice-undo svg     { fill: #fff; }
        html[dark] .qa-notice-undo:hover:not(:disabled) { background: #3d3d3d; }
        html[dark] .qa-notice-undo:disabled { background: #1a1a1a; color: #717171; }
        html[dark] .qa-notice-undo:disabled svg { fill: #717171; }

        /* 淺色主題 */
        html:not([dark]) .qa-notice-frame        { background: #fff; border-color: #e5e5e5; }
        html:not([dark]) .qa-notice-action       { color: #0f0f0f; }
        html:not([dark]) .qa-notice-msg          { color: #606060; }
        html:not([dark]) .qa-notice-undo         { background: #f2f2f2; color: #0f0f0f; }
        html:not([dark]) .qa-notice-undo svg     { fill: #0f0f0f; }
        html:not([dark]) .qa-notice-undo:hover:not(:disabled) { background: #e5e5e5; }
        html:not([dark]) .qa-notice-undo:disabled { background: #f9f9f9; color: #909090; }
        html:not([dark]) .qa-notice-undo:disabled svg { fill: #909090; }

        /* 外層容器：覆蓋整個卡片，提供定位基準 */
        .qa-feedback-notice {
            position: absolute;
            inset: 0;
            z-index: 10;
            font-family: Roboto, "YouTube Sans", sans-serif;
        }

        /* 縮圖外框：16:9 比例，帶明顯邊框與背景 */
        .qa-notice-frame {
            position: absolute;
            top: 0; left: 0; right: 0;
            aspect-ratio: 16/9;
            border-radius: 12px;
            border: 2px solid #3d3d3d;
            background: #0f0f0f;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 0;
            overflow: hidden;
        }

        /* 動作標籤（大字，純文字，在最上）*/
        .qa-notice-action {
            font-size: 16px;
            font-weight: 500;
            color: #fff;
            line-height: 1.3;
            text-align: center;
        }

        /* 中間：標題文字（較小，次要色）*/
        .qa-notice-msg {
            font-size: 14px;
            font-weight: 400;
            color: #aaa;
            text-align: center;
            line-height: 1.4;
        }

        /* 點點動畫 */
        @keyframes qa-dot-blink {
            0%, 20%  { opacity: 1; }
            50%      { opacity: 0.2; }
            80%,100% { opacity: 1; }
        }
        .qa-dots span {
            display: inline-block;
            animation: qa-dot-blink 1.2s infinite;
        }
        .qa-dots span:nth-child(2) { animation-delay: 0.2s; }
        .qa-dots span:nth-child(3) { animation-delay: 0.4s; }

        /* 中段：文字群組，佔剩餘空間並均勻分布 */
        /* padding-top 與 footer 的 padding-bottom (12px) 一致，確保上下視覺對稱 */
        .qa-notice-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-evenly;
            padding: 12px 16px 0;
            width: 100%;
            box-sizing: border-box;
        }

        /* 下半：按鈕區，固定在底部 */
        .qa-notice-footer {
            width: 100%;
            padding: 0 12px 12px;
            box-sizing: border-box;
        }

        /* 復原／重試按鈕（含 SVG icon）*/
        .qa-notice-undo {
            background: #272727;
            border: none;
            color: #fff;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            padding: 10px 0;
            border-radius: 18px;
            font-family: inherit;
            transition: background 0.15s;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            box-sizing: border-box;
        }
        .qa-notice-undo svg {
            width: 19px;
            height: 19px;
            flex-shrink: 0;
            fill: #fff;
        }
        .qa-notice-undo:hover:not(:disabled) {
            background: #3d3d3d;
        }
        .qa-notice-undo:disabled {
            color: #717171;
            cursor: default;
            background: #1a1a1a;
        }
        .qa-notice-undo:disabled svg {
            fill: #717171;
        }
    `;
    document.head.appendChild(globalStyle);

    const host = document.createElement("div");
    host.id                = "yt-filter-shadow-host";
    Object.assign(host.style, { position: "fixed", bottom: "0", right: "0", width: "0", height: "0", zIndex: "2147483647" });
    document.documentElement.appendChild(host);

    const shadow          = host.attachShadow({ mode: "closed" });
    const container       = document.createElement("div");
    const settings        = document.createElement("div");
    const whitelistPanel  = document.createElement("div");
    const watchedPanel    = document.createElement("div");
    const qaSettingsPanel = document.createElement("div");
    const titleFilterPanel = document.createElement("div");
    const tfHelpPanel      = document.createElement("div");

    const unifiedPill  = document.createElement("div");
    const statusArea   = document.createElement("div");
    const refreshArea  = document.createElement("div");
    const style        = document.createElement("style");

    style.textContent = `
        .root      {
            position: fixed; bottom: 25px; right: 25px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; font-family: sans-serif;
            --btn-bg: var(--t-pill-bg-on);
            --refresh-hover: var(--t-pill-hover-on);
        }

        .btn       { width: var(--current-pill-width, auto); white-space: nowrap; border-radius: 25px; color: var(--t-pill-text); font-size: 13px; display: flex; align-items: stretch; box-shadow: 0 4px 15px rgba(0,0,0,0.2); border: 1px solid var(--t-pill-border); transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.2s, color 0.2s, border-color 0.2s; user-select: none; background-color: var(--btn-bg); overflow: hidden; height: 38px; }

        .status-area { flex: 1; overflow: hidden; display: grid; cursor: default; }

        .state-normal { grid-area: 1 / 1; width: 100%; box-sizing: border-box; padding: 0 14px 0 18px; display: flex; align-items: center; cursor: pointer; transition: background-color 0.2s, opacity 0.2s; opacity: 1; pointer-events: auto; }
        .state-normal:hover { background-color: var(--refresh-hover); }

        .state-close { grid-area: 1 / 1; width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s; padding: 0 20px; }
        .state-close:hover { background-color: var(--refresh-hover); }

        .state-hover  { grid-area: 1 / 1; width: 100%; box-sizing: border-box; display: flex; align-items: stretch; opacity: 0; pointer-events: none; transition: opacity 0.2s; min-height: 38px; }

        .status-area:hover .state-normal { opacity: 0; pointer-events: none; }
        .status-area:hover .state-hover { opacity: 1; pointer-events: auto; }

        .action-toggle { flex: 1; padding: 0 14px 0 18px; display: flex; align-items: center; cursor: pointer; transition: background-color 0.2s; }
        .action-toggle:hover { background-color: var(--refresh-hover); }

        .action-settings { padding: 0 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-left: 1px solid var(--t-pill-border); transition: background-color 0.2s, border-color 0.2s; color: var(--t-text-muted); flex-shrink: 0; }
        .action-settings:hover { background-color: var(--refresh-hover); color: var(--t-text-main); }
        .action-settings svg { width: 16px; height: 16px; }

        .refresh-area { padding: 0 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-left: 1px solid var(--t-pill-border); transition: background-color 0.2s, border-color 0.2s; }
        .refresh-area:hover { background-color: var(--refresh-hover); }
        .refresh-area .icon { display: inline-block; font-weight: bold; }

        .panel     { position: relative; background: var(--t-panel-bg); color: var(--t-text-main); padding: 0; border-radius: 14px; border: 1px solid var(--t-panel-border); display: none; box-shadow: 0 10px 40px var(--t-panel-shadow), var(--t-panel-shadow); backdrop-filter: blur(12px); font-size: 13px; width: max-content; min-width: 250px; margin-bottom: 43px; max-height: calc(100vh - 113px); overflow: hidden; transition: background 0.3s, color 0.3s, border-color 0.3s, box-shadow 0.3s; }

        /* ── 面板抬頭（一般設定）── */
        .panel-header {
            display: flex; align-items: stretch;
            height: 44px;
            border-bottom: 1px solid var(--t-divider);
            box-sizing: border-box;
        }
        .panel-header-title {
            flex: 1; display: flex; align-items: center; gap: 7px;
            padding: 0 15px;
            font-size: 13px; font-weight: bold; color: var(--t-text-main);
        }
        .panel-header-title svg { width: 15px; height: 15px; fill: currentColor; flex-shrink: 0; opacity: 0.7; }
        .panel-header-divider { width: 1px; background: var(--t-divider); flex-shrink: 0; }
        .panel-close-area {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted); font-size: 14px;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            border-radius: 0 14px 0 0;
        }
        .panel-close-area:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }

        /* ── 面板 body ── */
        .panel-body { padding: 0 20px; }

        /* ── Section 標準行高 44px ── */
        .section {
            height: 44px; border-top: 1px solid var(--t-divider);
            display: flex; align-items: center; justify-content: space-between;
            transition: border-color 0.3s, background 0.15s;
            padding: 0; box-sizing: border-box;
            margin: 0 -20px; padding-left: 20px; padding-right: 20px;
        }
        .section-tall {
            height: auto; min-height: 44px; padding-top: 11px; padding-bottom: 11px;
        }
        /* 群組內部縮排分隔線 */
        .section-inner {
            height: 44px; border-top: 1px solid var(--t-divider);
            display: flex; align-items: center; justify-content: space-between;
            transition: border-color 0.3s, background 0.15s;
            padding: 0; box-sizing: border-box;
        }
        .section:first-child, .section-inner:first-child { border-top: none; }
        .section.hoverable { cursor: pointer; }
        .section.hoverable:hover { background: var(--t-close-hover-bg); }

        .title     { opacity: 0.9; flex: 1; margin-right: 20px; white-space: nowrap; display: flex; align-items: center; }
        .controls  { display: flex; align-items: center; gap: 6px; }

        .wl-icon-btn {
            width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
            background: transparent; color: var(--t-nav-color); border: none; border-radius: 50%;
            cursor: pointer; transition: 0.2s; margin-right: 8px; padding: 4px; box-sizing: border-box;
        }
        .wl-icon-btn:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); transform: scale(1.1); }

        .stepper   { display: flex; align-items: center; background: var(--t-input-bg); border: 1px solid var(--t-input-border); border-radius: 6px; overflow: hidden; transition: background 0.3s, border-color 0.3s; }
        .step-btn  { background: var(--t-btn-bg); border: none; color: var(--t-btn-text); width: 26px; height: 24px; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .step-btn:hover { background: var(--t-btn-hover); color: var(--t-btn-text-hover); }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
        input[type="number"] { -moz-appearance: textfield !important; border: none !important; width: 40px !important; height: 24px !important; text-align: center !important; background: var(--t-input-bg) !important; color: var(--t-input-text) !important; outline: none !important; font-size: 12px !important; padding: 0 !important; margin: 0 !important; transition: background 0.3s, color 0.3s !important; box-sizing: border-box; }
        select     { background: var(--t-input-bg); color: var(--t-input-text); border: 1px solid var(--t-input-border); outline: none; font-size: 12px; padding: 3px 6px; border-radius: 6px; cursor: pointer; transition: background 0.3s, color 0.3s, border-color 0.3s; }

        .switch    { position: relative; display: inline-block; width: 34px; height: 18px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider    { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--t-switch-bg); border: 1px solid var(--t-switch-border); transition: .3s; border-radius: 20px; box-sizing: border-box; }
        .slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 2px; bottom: 2px; background-color: var(--t-switch-knob); transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--t-switch-on); border-color: var(--t-switch-border-on); }
        input:checked + .slider:before { transform: translateX(16px); background-color: var(--t-switch-knob-on); box-shadow: var(--t-switch-knob-on-shadow, none); }

        .tm-dot    { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:10px; flex-shrink: 0; transition: background-color 0.3s; }
        .tm-dot-active { background: var(--t-dot-active); animation-name: blink; animation-duration: var(--t-dot-anim-speed, 1.2s); animation-iteration-count: infinite; }
        .tm-dot-blue   { background: var(--t-dot-limit); }
        .tm-dot-off    { background: var(--t-dot-off); }

        @keyframes blink {
            0%, 100% { opacity: 1; filter: var(--t-dot-filter-on); box-shadow: var(--t-dot-shadow-on); }
            50% { opacity: var(--t-dot-min-opacity); filter: var(--t-dot-filter-off); box-shadow: var(--t-dot-shadow-off); }
        }

        .wl-modal, .wd-modal {
            position: fixed; top: 0; left: 0;
            width: 320px; z-index: 2147483648; display: none;
            background: var(--t-panel-bg); color: var(--t-text-main); padding: 0; border-radius: 14px;
            border: 1px solid var(--t-panel-border); box-shadow: 0 20px 50px rgba(0,0,0,0.5), var(--t-panel-shadow);
            backdrop-filter: blur(12px); font-size: 13px; overflow: hidden;
        }
        .wd-modal { width: 300px; }

        .wl-header, .wd-header { cursor: move; padding: 5px 0 15px 0; border-bottom: 1px solid var(--t-divider); margin-bottom: 10px; display: flex; flex-direction: column; gap: 5px; user-select: none; }
        .wl-title, .wd-title { font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 6px; }
        .wl-desc, .wd-desc { font-size: 11px; color: var(--t-text-muted); line-height: 1.4; }
        .wl-input-group { display: flex; gap: 8px; margin-bottom: 10px; }
        .wl-input { flex: 1; background: var(--t-input-bg); border: 1px solid var(--t-pill-border); color: var(--t-input-text); padding: 6px 10px; border-radius: 6px; font-size: 13px; outline: none; transition: border 0.2s; min-width: 0; }
        .wl-input:focus { border-color: var(--t-switch-on); }
        .wl-input::placeholder { color: var(--t-text-muted); opacity: 0.6; overflow: hidden; text-overflow: ellipsis; }
        .wl-add-btn { background: var(--t-switch-on); color: var(--t-switch-on-text, #fff); border: none; padding: 0 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; transition: filter 0.15s, box-shadow 0.15s; box-shadow: var(--t-primary-shadow, none); }
        .wl-add-btn:hover { filter: brightness(1.12); box-shadow: var(--t-primary-hover-shadow, none); }

        /* ── 次要按鈕（取消、編輯、匯入、匯出）統一樣式 ── */
        .btn-secondary {
            background: var(--t-btn-bg); color: var(--t-btn-text);
            border: 1px solid var(--t-input-border); border-radius: 6px;
            padding: 0 12px; cursor: pointer; font-size: 12px; font-weight: bold;
            white-space: nowrap; flex-shrink: 0;
            transition: background 0.15s, color 0.15s, box-shadow 0.15s;
            display: flex; align-items: center; justify-content: center;
        }
        .btn-secondary:hover {
            background: var(--t-btn-hover);
            color: var(--t-btn-text-hover);
        }

        /* ── 危險按鈕（重置、清除）── */
        .reset-btn-inner {
            width: 100%; height: 34px; border-radius: 8px;
            background: var(--t-danger-bg); border: 1px solid var(--t-danger-border);
            color: var(--t-danger-text); font-size: 12px; font-weight: 500; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            transition: background 0.15s, border-color 0.15s;
        }
        .reset-btn-inner:hover { background: var(--t-danger-hover-bg); border-color: var(--t-danger-hover-border); }
        .reset-btn-inner svg { width: 13px; height: 13px; flex-shrink: 0; }
        .wl-list { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; scroll-behavior: smooth; }
        .wl-list::-webkit-scrollbar { width: 4px; }
        .wl-list::-webkit-scrollbar-thumb { background: var(--t-pill-border); border-radius: 4px; }
        .wl-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(0,0,0,0.1); border-radius: 6px; font-size: 12px; color: var(--t-text-main); transition: background 0.2s; }
        .wl-item:hover { background: var(--t-close-hover-bg); }
        .wl-item.highlight { background: var(--t-wl-highlight); transition: background 0.5s; }
        .wl-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px; }
        .wl-remove-btn { color: var(--t-text-muted); cursor: pointer; font-weight: bold; font-size: 14px; padding: 2px 6px; border-radius: 4px; transition: color 0.2s, background 0.2s; }
        .wl-remove-btn:hover { color: #ff5555; background: rgba(255, 85, 85, 0.1); }
        .empty-msg { color: var(--t-text-muted); text-align: center; padding: 20px 0; font-style: italic; }

        .wd-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
        .wd-label { white-space: nowrap; margin-right: 10px; }
        .wd-ctrl-group { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .wd-unit-fixed { width: 32px; text-align: center; }

        /* ── 進階設定入口行（面板底部完整佔滿）── */
        .adv-entry-row {
            height: 44px; padding: 0 20px;
            border-top: 1px solid var(--t-divider);
            display: flex; align-items: center; justify-content: space-between;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            box-sizing: border-box; color: var(--t-nav-color);
        }
        .adv-entry-row:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .adv-entry-chevron { font-size: 15px; line-height: 1; }

        /* ── 隱藏影片早於：兩行設計 ── */
        .hide-old-group { border-top: 1px solid var(--t-divider); margin: 0 -20px; padding: 0 20px; box-sizing: border-box; }
        .hide-old-row1 { height: 44px; display: flex; align-items: center; justify-content: space-between; }
        .hide-old-row2 { padding: 0 0 14px 0; display: flex; align-items: flex-start; gap: 6px; }

        /* ── 進階設定：統一群組間距系統 ── */
        /* 所有群組上下各 16px，視覺元素邊緣距分隔線 16px */
        .adv-grp {
            border-top: 1px solid var(--t-divider);
            margin: 0 -20px;
            padding: 16px 20px;
            box-sizing: border-box;
        }
        .adv-grp-first {
            margin: 0 -20px;
            padding: 16px 20px;
            box-sizing: border-box;
        }
        .adv-grp-row {
            min-height: 22px;
            display: flex; align-items: center; justify-content: space-between;
        }
        /* 影片回饋小標題 */
        .adv-feedback-label {
            font-size: 10px; color: var(--t-text-main);
            letter-spacing: 0.8px; text-transform: uppercase;
            line-height: 1; margin-bottom: 8px; display: block;
        }
        /* stepper 與上方 row 的間距 */
        .adv-stepper-row { margin-top: 8px; display: flex; align-items: flex-start; gap: 6px; }

        /* ── 返回按鈕（面板根層級）── */
        .back-row {
            height: 44px;
            display: flex; align-items: center; gap: 6px;
            border-top: 1px solid var(--t-divider);
            cursor: pointer; transition: background 0.15s, color 0.15s;
            color: var(--t-nav-color); font-size: 13px;
            justify-content: flex-start; padding: 0 8px;
        }
        .back-row:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .back-row svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }

        /* ── 自訂語系：進階設定面板內的 Edit 按鈕 ── */
        .cl-edit-btn {
            background: var(--t-btn-bg); color: var(--t-btn-text);
            border: 1px solid var(--t-input-border); border-radius: 6px;
            font-size: 11px; padding: 3px 9px; cursor: pointer;
            white-space: nowrap; transition: background 0.15s, color 0.15s;
        }
        .cl-edit-btn:hover { background: var(--t-btn-hover); color: var(--t-btn-text-hover); }

        /* ── 快速動作按鈕圖示（行前置）── */
        .qa-row-icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; margin-right: 6px; flex-shrink: 0; opacity: 0.7; }
        .qa-row-icon svg { width: 16px; height: 16px; fill: currentColor; display: block; }

        /* ── 每行卡片數量：由 adv-grp 統一控制間距 ── */
        .grid-group { display: contents; }

        /* ── 重置：按鈕樣式群組 ── */
        .reset-row {
            border-top: 1px solid var(--t-divider);
            padding: 16px 20px;
            cursor: pointer;
        }
        .reset-sub {
            text-align: center; font-size: 10px; color: var(--t-text-muted);
            margin-top: 6px; line-height: 1.2;
        }

        /* ── 進階設定頂部：方案B切割 ── */
        .adv-header {
            display: flex; align-items: stretch;
            height: 44px;
            border-bottom: 1px solid var(--t-divider);
            box-sizing: border-box;
        }
        .adv-back-area {
            flex: 1; display: flex; align-items: center;
            padding: 0 8px; gap: 6px;
            color: var(--t-text-muted); font-size: 13px;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            user-select: none;
        }
        .adv-back-area:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .adv-back-area svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
        .adv-header-divider { width: 1px; background: var(--t-divider); flex-shrink: 0; }
        .adv-close-area {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted); font-size: 14px;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            border-radius: 0 14px 0 0;
        }
        .adv-close-area:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }

        /* ── 進階設定：回饋按鈕群組卡片 ── */
        .feedback-card {
            position: relative;
            background: transparent;
            border-radius: 10px;
            margin: 0;
            overflow: visible;
        }
        .feedback-card::before {
            content: '';
            position: absolute;
            top: 0; bottom: 0;
            left: -12px; right: -12px;
            border-radius: 10px;
            border: 1px solid var(--t-card-border);
            background: var(--t-card-bg);
            z-index: 0;
            pointer-events: none;
        }
        .feedback-card .section-inner { position: relative; z-index: 1; }
        .feedback-card .section-inner:first-child { border-top: none; }
        .feedback-card .section-inner { border-top: 1px solid var(--t-card-divider); }

        /* ── 白名單頂部 ── */
        .wl-top {
            display: flex; align-items: stretch;
            height: 44px;
            border-bottom: 1px solid var(--t-divider);
            box-sizing: border-box;
        }
        .wl-title-area {
            flex: 1; display: flex; align-items: center;
            padding: 0 15px; gap: 6px;
            font-size: 13px; font-weight: bold; color: var(--t-text-main);
            user-select: none; cursor: move;
        }
        .wl-title-area svg { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; opacity: 0.7; }
        .wl-close-area {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted); font-size: 14px;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            border-radius: 0 14px 0 0;
        }
        .wl-close-area:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }

        /* ── 已看影片面板頂部 ── */
        .wd-top {
            display: flex; align-items: stretch;
            height: 44px;
            border-bottom: 1px solid var(--t-divider);
            box-sizing: border-box;
        }
        .wd-title-area {
            flex: 1; display: flex; align-items: center;
            padding: 0 15px; gap: 6px;
            font-size: 13px; font-weight: bold; color: var(--t-text-main);
            user-select: none; cursor: move;
        }
        .wd-title-area svg { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; opacity: 0.7; }
        .wd-close-area {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted); font-size: 14px;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            border-radius: 0 14px 0 0;
        }
        .wd-close-area:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .wd-desc-row {
            padding: 14px 15px 8px 15px;
            font-size: 11px; color: var(--t-text-main); line-height: 1.4;
        }
        .wd-body { padding: 10px 15px 15px 15px; }
        .wl-desc-row {
            padding: 14px 15px 8px 15px;
            font-size: 11px; color: var(--t-text-main); line-height: 1.4;
        }
        .wl-desc-emphasis { color: var(--t-switch-on); }

        /* ── 共用：收合按鈕（橫槓）── */
        .panel-minimize-btn {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-nav-color); font-size: 16px; font-weight: bold; line-height: 1;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            user-select: none;
        }
        .panel-minimize-btn:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }

        /* ── 片名過濾面板 (tf-) ── */
        .tf-modal {
            position: fixed; top: 0; left: 0;
            width: max-content; min-width: 420px; z-index: 2147483648; display: none;
            background: var(--t-panel-bg); color: var(--t-text-main); padding: 0; border-radius: 14px;
            border: 1px solid var(--t-panel-border); box-shadow: 0 20px 50px rgba(0,0,0,0.5), var(--t-panel-shadow);
            backdrop-filter: blur(12px); font-size: 13px; overflow: hidden;
        }
        .tf-top {
            display: flex; align-items: stretch;
            height: 44px;
            border-bottom: 1px solid var(--t-divider);
            box-sizing: border-box;
        }
        .tf-title-area {
            flex: 1; display: flex; align-items: center;
            padding: 0 15px; gap: 6px;
            font-size: 13px; font-weight: bold; color: var(--t-text-main);
            user-select: none; cursor: move; white-space: nowrap;
        }
        .tf-title-area svg { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; opacity: 0.7; }
        .tf-help-btn {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted); font-size: 13px; font-weight: bold;
            cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .tf-help-btn:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .tf-close-area {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted); font-size: 14px;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            border-radius: 0 14px 0 0;
        }
        .tf-close-area:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .tf-desc-row {
            padding: 14px 15px 8px 15px;
            font-size: 11px; color: var(--t-text-main); line-height: 1.4;
        }
        .tf-help-link {
            color: var(--t-switch-on);
            text-decoration: underline;
            text-underline-offset: 2px;
            cursor: pointer;
        }
        .tf-help-link:hover { opacity: 0.8; }

        /* ── 輸入列：高度鎖定確保按鈕與欄位對齊 ── */
        .tf-input-row {
            display: flex; gap: 8px; align-items: stretch;
            margin-bottom: 8px;
        }
        .tf-input-row .wl-input { box-sizing: border-box; min-width: 0; }
        .tf-input-row .wl-add-btn,
        .tf-input-row .tf-cancel-btn {
            box-sizing: border-box;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }

        /* ── 收合狀態 ── */
        .tf-modal.minimized .tf-body,
        .wl-modal.minimized .wl-body { display: none; }
        .tf-modal.minimized,
        .wl-modal.minimized {
            overflow: visible;
            border-radius: 14px 14px 0 0;
        }
        .tf-item {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px;
            border-radius: 8px;
            margin-bottom: 4px;
            background: var(--t-card-bg);
            border: 1px solid var(--t-card-border);
            transition: background 0.15s;
        }
        .tf-item.highlight  { background: var(--t-wl-highlight); transition: background 0.5s; }
        .tf-item.tf-editing { background: var(--t-wl-highlight); border-color: var(--t-switch-on); }
        .tf-item.tf-disabled { opacity: 0.45; pointer-events: none; }
        .tf-item:last-child { margin-bottom: 0; }
        .tf-item-pattern {
            flex: 3; font-size: 12px; color: var(--t-text-main);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-family: monospace;
        }
        .tf-item-channel {
            flex: 2; font-size: 12px; color: var(--t-text-muted);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tf-item-warn {
            font-size: 13px; flex-shrink: 0; opacity: 0.85; cursor: default;
        }
        .tf-edit-btn {
            flex-shrink: 0; width: 22px; height: 22px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; color: var(--t-text-muted); font-size: 13px;
            border-radius: 4px; border: none; background: transparent;
            transition: background 0.15s, color 0.15s;
        }
        .tf-edit-btn:hover { background: var(--t-close-hover-bg); color: var(--t-switch-on); }
        .tf-remove-btn {
            flex-shrink: 0; width: 22px; height: 22px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; color: var(--t-text-muted); font-size: 16px;
            border-radius: 4px; transition: background 0.15s, color 0.15s;
        }
        .tf-remove-btn:hover { background: rgba(255,85,85,0.12); color: #ff5555; }
        /* tf-cancel-btn 沿用 .btn-secondary 共用樣式，此處只補 flex-shrink */
        .tf-cancel-btn { flex-shrink: 0; }

        /* ── 說明浮動卡 (tfh-) ── */
        .tfh-modal {
            position: fixed;
            background: var(--t-panel-bg);
            color: var(--t-text-main);
            border: 1px solid var(--t-panel-border);
            border-radius: 14px;
            box-shadow: 0 10px 40px var(--t-panel-shadow);
            backdrop-filter: blur(12px);
            font-size: 12px;
            width: 320px;
            display: none;
            z-index: 2147483649;
            overflow: hidden;
        }
        .tfh-top {
            display: flex; align-items: stretch;
            height: 44px;
            border-bottom: 1px solid var(--t-divider);
            box-sizing: border-box;
        }
        .tfh-title {
            flex: 1; display: flex; align-items: center;
            padding: 0 15px; gap: 6px;
            font-size: 13px; font-weight: bold; color: var(--t-text-main);
        }
        .tfh-close {
            width: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--t-text-muted);
            cursor: pointer; transition: background 0.15s, color 0.15s;
            border-radius: 0 14px 0 0;
        }
        .tfh-close:hover { background: var(--t-close-hover-bg); color: var(--t-text-main); }
        .tfh-body {
            padding: 14px 16px 16px;
            line-height: 1.65;
            color: var(--t-text-main);
            overflow-y: auto;
            max-height: 420px;
        }
        .tfh-body code {
            background: var(--t-input-bg);
            border: 1px solid var(--t-input-border, var(--t-divider));
            border-radius: 4px;
            padding: 1px 5px;
            font-family: monospace;
            font-size: 11px;
            color: var(--t-switch-on);
        }
        .tfh-body b { color: var(--t-text-main); }
        .tfh-body u { text-decoration-color: var(--t-text-muted); }

    `;

    shadow.append(style, container);
    // _ttContainer 掛在 shadow root 的根層，不是任何面板的子元素
    // position:fixed 不受父元素裁切，z-index 在 shadow stacking context 裡排最頂
    shadow.appendChild(_ttContainer);
    container.className      = "root";
    container.append(settings, whitelistPanel, watchedPanel, qaSettingsPanel, titleFilterPanel, tfHelpPanel, unifiedPill);
    settings.className       = "panel";
    whitelistPanel.className = "wl-modal";
    watchedPanel.className   = "wd-modal";
    qaSettingsPanel.className = "panel";
    titleFilterPanel.className = "tf-modal";
    tfHelpPanel.className      = "tfh-modal";

    unifiedPill.className  = "btn";
    statusArea.className   = "status-area";
    refreshArea.className  = "refresh-area";

    refreshArea.innerHTML = _trustedHTML(`
    <svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>`);

    unifiedPill.append(statusArea, refreshArea);

    // shadow 建立完成後立即預先計算所有 Tooltip SVG
    buildTooltipCache();

    // refreshArea 的 tooltip 在初始化時綁定一次即可（文字從快取取得）
    // data-tooltip 會在 updateUI 中每次更新語系後同步更新
    refreshArea.addEventListener('mouseenter', () => {
        const msg = getMsg();
        refreshArea.setAttribute('data-tooltip', msg.refreshTip);
        showTooltip(refreshArea, 'panel');
    });
    refreshArea.addEventListener('mouseleave', hideTooltip);
    refreshArea.addEventListener('click',      hideTooltip);

    function applyTheme() {
        let selectedTheme = config.theme;
        if (selectedTheme === 'auto') {
            // auto 模式：依照 THEMES_MASTER 中各主題的 autoMatch 條件依序比對，
            // 第一個符合的主題勝出。若都不符合則 fallback 到第一個非 auto 主題。
            // 要新增可被 auto 選中的主題，只需在該主題加上 autoMatch 函式即可，不需修改此處。
            const themes = Object.entries(THEMES_MASTER).filter(([k]) => k !== 'auto');
            const matched = themes.find(([, t]) => typeof t.autoMatch === 'function' && t.autoMatch());
            selectedTheme = matched ? matched[0] : (themes[0]?.[0] ?? 'auto');
        }
        // fallback：動態取第一個有 colors 的主題，不硬編碼主題名稱
        const firstWithColors = Object.values(THEMES_MASTER).find(t => t.colors);
        const activeColors = THEMES_MASTER[selectedTheme]?.colors || firstWithColors?.colors || {};

        for (const [key, value] of Object.entries(activeColors)) {
            container.style.setProperty(key, value);
        }
        container.dataset.ytfTheme = selectedTheme;
        document.documentElement.style.setProperty('--t-wl-badge-bg', activeColors['--t-wl-badge-bg']);
        document.documentElement.style.setProperty('--t-wl-badge-active', activeColors['--t-wl-badge-active']);
    }

    const themeObserver = new MutationObserver((mutations) => {
        if (config.theme !== 'auto') return;
        mutations.forEach((mutation) => {
            if (mutation.attributeName === YT_DARK_ATTR) {
                applyTheme();
                buildTooltipCache();
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    function parseDurationStr(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));
        if (parts.some(isNaN)) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0];
    }

    function shouldHideVideo(text, msg) {
        if (!text || !config.enabled || !config.hideOldEnabled) return false;
        const cleanText = text.toLowerCase().trim();

        if (msg.timeMatch.test(cleanText) && /\d/.test(cleanText)) {
            for (const unitKey of TIME_UNIT_KEYS) {
                const matchRe = msg[`unit${unitKey}Match`];
                if (!matchRe) continue;
                const src   = matchRe instanceof RegExp ? matchRe.source : matchRe;
                const regex = new RegExp(`(\\d+).*?(${src})`);
                const match = cleanText.match(regex);
                if (match) {
                    const configKey    = unitKey.toLowerCase();
                    const videoSeconds = parseFloat(match[1]) * UNIT_SECONDS[configKey];
                    const thresholdSec = config.value * UNIT_SECONDS[config.unit];
                    return videoSeconds > thresholdSec;
                }
            }
        }
        return false;
    }

    function updateUI() {
        if (!isHomePage()) { host.style.display = "none"; return; }
        host.style.display = "block";
        const msg = getMsg();
        const currentLang = getActiveLang();

        applyTheme();
        applyTooltipColors();

        if (lastCalculatedLang !== currentLang) {
            const measurer = document.createElement("div");
            measurer.style.cssText = "position:absolute; visibility:hidden; white-space:nowrap; font-size:13px; font-family:sans-serif; padding:0 14px 0 18px;";
            shadow.appendChild(measurer);

            // 分別量「狀態文字」與「切換動作文字」的最大寬度
            // measurer 的 padding (0 14px 0 18px) = 32px，但不含 tm-dot（10px + 10px margin = 20px）
            // state-normal 所需寬度 = statusMaxW + dot(20px) + refresh-area(~51px) = statusMaxW + 71
            // state-hover  所需寬度 = actionMaxW + dot(20px) + action-settings(44px+1px=45px) + refresh-area(~51px) = actionMaxW + 116
            const statusTexts = [msg.statusOn, msg.statusOff, msg.statusSearching, msg.statusRefreshing, msg.statusLimit];
            const actionTexts = [msg.actionEnable, msg.actionDisable];
            let statusMaxW = 0, actionMaxW = 0;
            statusTexts.forEach(t => { measurer.textContent = t; statusMaxW = Math.max(statusMaxW, measurer.offsetWidth); });
            actionTexts.forEach(t =>  { measurer.textContent = t; actionMaxW = Math.max(actionMaxW, measurer.offsetWidth); });
            const normalW = Math.max(statusMaxW + 71, actionMaxW + 116);

            measurer.style.padding = "0 20px";
            measurer.textContent = `✕ ${msg.closePanel}`;
            let closeW = Math.max(measurer.offsetWidth + 2, 110);

            shadow.removeChild(measurer);

            container.style.setProperty('--pill-normal-width', normalW + "px");

            // 設定開啟膠囊寬度：直接量「設定已開啟」文字，加上 SVG(16px)+margin(6px)+左右padding(40px)
            const settingsMeasurer = document.createElement("div");
            settingsMeasurer.style.cssText = "position:absolute; visibility:hidden; white-space:nowrap; font-size:13px; font-family:sans-serif; padding:0;";
            settingsMeasurer.textContent = msg.settingsOpen;
            shadow.appendChild(settingsMeasurer);
            const settingsW = settingsMeasurer.offsetWidth + 16 + 6 + 40;
            shadow.removeChild(settingsMeasurer);
            container.style.setProperty('--pill-settings-width', settingsW + "px");

            container.style.setProperty('--pill-close-width', closeW + "px");

            // 更新所有狀態、語系中膠囊的最大寬度（供底部 spacer 計算使用）
            maxPillWidth = Math.max(normalW, settingsW, closeW);

            // 語系變更時重新計算所有 Tooltip SVG
            buildTooltipCache();

            lastCalculatedLang = currentLang;
        }

        const isSettingsOpen = settings.style.display === "block" || qaSettingsPanel.style.display === "block";
        const isFloatingPanel = whitelistPanel.style.display === "block" || watchedPanel.style.display === "block" || isCustomLangOpen || isCustomMatchOpen;

        // 白名單／已看影片／自訂語系編輯器 獨立浮動面板：隱藏膠囊
        if (isFloatingPanel) {
            unifiedPill.style.display = "none";
            return;
        }

        // 設定模式（一般設定 或 進階設定）：膠囊變灰，顯示「設定已開啟」，隱藏重新整理按鈕
        if (isSettingsOpen) {
            unifiedPill.style.display = "";
            container.style.setProperty('--current-pill-width', 'var(--pill-settings-width)');
            container.style.setProperty('--btn-bg', 'var(--t-pill-bg-off)');
            container.style.setProperty('--refresh-hover', 'var(--t-pill-hover-off)');
            refreshArea.style.display = "none";
            // 面板與膠囊間距縮小為 5px（設定模式下膠囊不隱藏）
            settings.style.marginBottom = "5px";
            qaSettingsPanel.style.marginBottom = "5px";
            const settingsLabel = msg.settingsOpen;
            const closeTip = msg.settingsClose;
            statusArea.innerHTML = _trustedHTML(`
                <div class="state-close" id="sa-settings-close" data-tooltip="${closeTip}">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;margin-right:6px;flex-shrink:0;">
                        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                    </svg>
                    ${settingsLabel}
                </div>
            `);
            shadow.getElementById('sa-settings-close').onclick = (e) => {
                e.stopPropagation();
                settings.style.display = "none";
                qaSettingsPanel.style.display = "none";
                settings.style.marginBottom = "";
                qaSettingsPanel.style.marginBottom = "";
                updateUI();
            };
            bindTooltip(shadow.getElementById('sa-settings-close'), 'panel');
            return;
        }

        // 一般狀態
        unifiedPill.style.display = "";
        container.style.setProperty('--current-pill-width', 'var(--pill-normal-width)');
        refreshArea.style.display = "flex";

        let dot = "tm-dot-active";
        let txt = msg.statusOn;
        let actionTxt = config.enabled ? msg.actionDisable : msg.actionEnable;
        let toggleTip = config.enabled ? msg.toggleTipDisable : msg.toggleTipEnable;

        let currentBg = "var(--t-pill-bg-on)";
        let currentHover = "var(--t-pill-hover-on)";

        if (!config.enabled) {
            dot = "tm-dot-off";
            txt = msg.statusOff;
            currentBg = "var(--t-pill-bg-off)";
            currentHover = "var(--t-pill-hover-off)";
        }
        else if (isRefreshing) {
            dot = "tm-dot-active";
            txt = msg.statusRefreshing;
        }
        else if (hasReachedLimit) {
            dot = "tm-dot-blue";
            txt = msg.statusLimit;
        }
        else if (isFetching) {
            txt = msg.statusSearching;
        }

        container.style.setProperty('--btn-bg', currentBg);
        container.style.setProperty('--refresh-hover', currentHover);

        statusArea.innerHTML = _trustedHTML(`
            <div class="state-normal" id="sa-normal">
                <span class="tm-dot ${dot}"></span> ${txt}
            </div>
            <div class="state-hover">
                <div class="action-toggle" id="sa-toggle" data-tooltip="${toggleTip}">
                    <span class="tm-dot ${dot}"></span> ${actionTxt}
                </div>
                <div class="action-settings" id="sa-settings" data-tooltip="${msg.settingsOpenTip}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                    </svg>
                </div>
            </div>
        `);

        const toggleHandler = (e) => {
            e.stopPropagation();
            config.enabled = !config.enabled;
            GM_setValue(STORAGE_KEY_CFG, config);
            if (!config.enabled) document.querySelectorAll(GRID_SELECTOR).forEach(el => el.style.display = "");
            updateUI();
            if (config.enabled) processContent();
        };

        shadow.getElementById('sa-normal').onclick = toggleHandler;
        shadow.getElementById('sa-toggle').onclick = toggleHandler;
        bindTooltip(shadow.getElementById('sa-toggle'), 'panel');

        shadow.getElementById('sa-settings').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "block";
            updateUI();
        };
        bindTooltip(shadow.getElementById('sa-settings'), 'panel');
    }

    function positionPanel(el, storageKey) {
        const saved = GM_getValue(storageKey, null);
        if (saved) {
            el.style.left = saved.left + 'px';
            el.style.top = saved.top  + 'px';
        } else {
            // 無儲存位置時置中顯示
            const w = el.offsetWidth  || 320;
            const h = el.offsetHeight || 200;
            el.style.left = Math.max(0, (window.innerWidth  - w) / 2) + 'px';
            el.style.top = Math.max(0, (window.innerHeight - h) / 2) + 'px';
        }
        el.style.transform = 'none';
    }

    function makeDraggable(el, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        handle.onmousedown = (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            el.style.left = initialLeft + 'px';
            el.style.top = initialTop + 'px';
            el.style.transform = 'none';
            document.onmousemove = drag;
            document.onmouseup = stop;
        };

        function drag(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = initialLeft + dx;
            const newTop  = initialTop  + dy;

            // 業界標準邊界：handle 頂部不超出螢幕頂；左右保留至少 100px 在畫面內
            const HANDLE_H   = 44;
            const MARGIN_X   = 100;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w  = el.offsetWidth;

            const clampedLeft = Math.min(vw - MARGIN_X, Math.max(MARGIN_X - w, newLeft));
            const clampedTop  = Math.min(vh - HANDLE_H, Math.max(0, newTop));

            el.style.left = `${clampedLeft}px`;
            el.style.top  = `${clampedTop}px`;
            el.style.transform = 'none';
        }

        function stop() {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    // ── 解析片名過濾規則：回傳 RegExp 或 null（代表格式錯誤）──
    // 以 / 開頭：嘗試解析為正規表達式；否則：視為普通關鍵字（轉義後不分大小寫）
    function parseTitleFilterRule(rule) {
        const trimmed = rule.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('/')) {
            const lastSlash = trimmed.lastIndexOf('/');
            if (lastSlash > 0) {
                const pattern = trimmed.slice(1, lastSlash);
                const flags   = trimmed.slice(lastSlash + 1);
                try { return new RegExp(pattern, flags); } catch (e) { return null; }
            }
            return null; // 只有開頭 /，沒有結尾 / → 格式錯誤
        }
        // 普通關鍵字：逸脫所有 regex 特殊字元，預設不分大小寫
        return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    function getChannelName(item) {
        const s1 = item.querySelector(YT_SELECTORS.channelName);
        if (s1 && s1.innerText.trim()) return s1.innerText.trim();
        const s2 = item.querySelector(YT_SELECTORS.channelLinkAt);
        if (s2 && s2.textContent.trim()) return s2.textContent.trim();
        const s3 = item.querySelector(YT_SELECTORS.channelLinkId);
        if (s3 && s3.textContent.trim()) return s3.textContent.trim();
        const s4 = item.querySelector(YT_SELECTORS.channelLinkMeta);
        if (s4 && s4.textContent.trim()) return s4.textContent.trim();
        return "";
    }

    function getActiveList() {
        if (activeWhitelistMode === 'music') return config.whitelistMusic;
        if (activeWhitelistMode === 'member') return config.whitelistMember;
        return [];
    }

    function setActiveList(newList) {
        if (activeWhitelistMode === 'music') config.whitelistMusic = newList;
        if (activeWhitelistMode === 'member') config.whitelistMember = newList;
    }

    function renderWhitelistPanel(highlightName = null) {
        const msg = getMsg();
        const currentList = getActiveList();

        let displayTitle = activeWhitelistMode === 'music' ? msg.wlTitleMusic : msg.wlTitleMember;
        let displayDesc = activeWhitelistMode === 'music' ? msg.wlDescMusic : msg.wlDescMember;
        const titleIcon = `<span style="width:18px;height:18px;display:inline-block;margin-right:6px;vertical-align:text-bottom;">${SHIELD_SVG}</span>`;

        const listHTML = currentList.length === 0
            ? `<div class="empty-msg">${msg.statusLimit}</div>`
            : currentList.map(name => {
                const isHighlight = name === highlightName;
                return `
                <div class="wl-item ${isHighlight ? 'highlight' : ''}" id="wl-item-${name.replace(/\s+/g, '-')}">
                    <span class="wl-item-name" title="${name}">${name}</span>
                    <span class="wl-remove-btn" data-name="${name}">×</span>
                </div>
            `}).join('');

        const isWlMinimized = whitelistPanel.classList.contains('minimized');

        whitelistPanel.innerHTML = _trustedHTML(`
            <div class="wl-top">
                <div class="wl-title-area" id="wl-title-area">${titleIcon} ${displayTitle}</div>
                <div class="panel-minimize-btn" id="wl-minimize-btn">─</div>
                <div class="wl-close-area" id="wl-close-btn">${CLOSE_SVG}</div>
            </div>
            <div class="wl-body">
                <div class="wl-desc-row">
                    ${displayDesc}
                    <div style="margin-top:6px;color:var(--t-text-muted);">${msg.wlHoverHint}</div>
                </div>
                <div style="padding: 10px 15px 6px 15px;">
                    <div style="display:flex;gap:8px;margin-bottom:4px;">
                        <input type="text" id="wl-new-input" class="wl-input" placeholder="${msg.wlPlaceholder}">
                        <button id="wl-add-btn" class="wl-add-btn">${msg.wlAdd}</button>
                    </div>
                    <div class="wl-list" id="wl-list-container">
                        ${listHTML}
                    </div>
                </div>
            </div>
        `);

        shadow.getElementById('wl-close-btn').onclick = (e) => {
            e.stopPropagation();
            closeWhitelistPanel();
        };

        shadow.getElementById('wl-minimize-btn').onclick = (e) => {
            e.stopPropagation();
            whitelistPanel.classList.toggle('minimized');
        };

        // 重繪後恢復收合狀態
        if (isWlMinimized) whitelistPanel.classList.add('minimized');

        if (highlightName) {
            setTimeout(() => {
                const target = shadow.getElementById(`wl-item-${highlightName.replace(/\s+/g, '-')}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        const addHandler = () => {
            const input = shadow.getElementById('wl-new-input');
            const name = input.value.trim();
            const list = getActiveList();
            if (name && !list.includes(name)) {
                list.push(name);
                setActiveList(list);
                GM_setValue(STORAGE_KEY_CFG, config);
                // 白名單變更後重建 Set 快取
                musicWhitelistSet  = new Set(config.whitelistMusic);
                memberWhitelistSet = new Set(config.whitelistMember);
                renderWhitelistPanel(name);
                processContent();
            }
            input.value = '';
            input.focus();
        };

        shadow.getElementById('wl-add-btn').onclick = addHandler;
        shadow.getElementById('wl-new-input').onkeypress = (e) => {
            if (e.key === 'Enter') addHandler();
        };

        shadow.querySelectorAll('.wl-remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                const nameToRemove = e.target.getAttribute('data-name');
                let list = getActiveList();
                list = list.filter(n => n !== nameToRemove);
                setActiveList(list);
                GM_setValue(STORAGE_KEY_CFG, config);
                // 白名單變更後重建 Set 快取
                musicWhitelistSet  = new Set(config.whitelistMusic);
                memberWhitelistSet = new Set(config.whitelistMember);
                renderWhitelistPanel();
                processContent();
            };
        });

        makeDraggable(whitelistPanel, shadow.getElementById('wl-title-area'));
    }

    function closeWhitelistPanel() {
        GM_setValue(STORAGE_KEY_POS_WL, { left: whitelistPanel.offsetLeft, top: whitelistPanel.offsetTop });
        whitelistPanel.style.display = "none";
        settings.style.display = "block";
        document.body.classList.remove('tm-wl-mode-music', 'tm-wl-mode-member');
        activeWhitelistMode = null;
        updateUI();
    }

    // ── 片名過濾說明浮動卡 ──
    function renderTitleFilterHelpPanel() {
        const msg = getMsg();
        tfHelpPanel.innerHTML = _trustedHTML(`
            <div class="tfh-top">
                <div class="tfh-title">❓ ${msg.tfHelpTitle}</div>
                <div class="tfh-close" id="tfh-close-btn">${CLOSE_SVG}</div>
            </div>
            <div class="tfh-body">${msg.tfHelpBody}</div>
        `);
        shadow.getElementById('tfh-close-btn').onclick = (e) => {
            e.stopPropagation();
            tfHelpPanel.style.display = "none";
        };
        tfHelpPanel.onclick = (e) => e.stopPropagation();
    }

    // ── 片名過濾黑名單面板 ──
    function renderTitleFilterPanel(highlightIdx = -1) {
        const msg = getMsg();
        const list = config.titleFilterList;
        const BLACKLIST_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 018.246 12.605L4.755 6.661A8.99 8.99 0 0112 3ZM3.754 8.393l15.491 8.944A9 9 0 013.754 8.393Z"/></svg>`;
        const PENCIL_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
        const isEditing = tfEditIndex >= 0;

        const listHTML = list.length === 0
            ? `<div class="empty-msg">${msg.statusLimit}</div>`
            : list.map((entry, idx) => {
                const { pattern, channel } = entry;
                const isValid   = parseTitleFilterRule(pattern) !== null;
                const isRegex   = pattern.trim().startsWith('/');
                const warnHTML  = (!isValid && isRegex)
                    ? `<span class="tf-item-warn" title="正規表達式格式有誤，此規則將被略過">⚠️</span>`
                    : '';
                const isThisEditing  = idx === tfEditIndex;
                const isDisabled     = isEditing && !isThisEditing;
                const chanDisplay    = channel ? channel : `<span style="color:var(--t-text-muted);font-style:italic;font-size:11px;">—</span>`;
                return `
                <div class="tf-item ${isThisEditing ? 'tf-editing' : ''} ${isDisabled ? 'tf-disabled' : ''} ${idx === highlightIdx ? 'highlight' : ''}" data-idx="${idx}">
                    ${warnHTML}
                    <span class="tf-item-pattern" title="${pattern.replace(/"/g,'&quot;')}">${pattern}</span>
                    <span class="tf-item-channel">${chanDisplay}</span>
                    <button class="tf-edit-btn" data-idx="${idx}" ${isDisabled ? 'disabled' : ''}>${PENCIL_SVG}</button>
                    <span class="tf-remove-btn" data-idx="${idx}"${isDisabled ? ' style="pointer-events:none;opacity:0.3"' : ''}>×</span>
                </div>`;
            }).join('');

        const isMinimized = titleFilterPanel.classList.contains('minimized');

        titleFilterPanel.innerHTML = _trustedHTML(`
            <div class="tf-top">
                <div class="tf-title-area" id="tf-drag-handle">
                    <span style="width:16px;height:16px;display:inline-block;flex-shrink:0;">${BLACKLIST_SVG}</span>
                    ${msg.tfTitle}
                </div>
                <div class="tf-help-btn" id="tf-help-btn">?</div>
                <div class="panel-minimize-btn" id="tf-minimize-btn">─</div>
                <div class="tf-close-area" id="tf-close-btn">${CLOSE_SVG}</div>
            </div>
            <div class="tf-body">
                <div class="tf-desc-row">
                    ${msg.tfDesc} <span id="tf-desc-link" class="tf-help-link">${msg.tfDescLink}</span>
                    <div style="margin-top:6px;color:var(--t-text-muted);">${msg.tfHoverHint}</div>
                </div>
                <div style="padding:6px 15px 4px 15px;">
                    <div class="tf-input-row">
                        <input type="text" id="tf-pattern-input" class="wl-input" placeholder="${msg.tfPlaceholder}" style="flex:3;min-width:0;">
                        <input type="text" id="tf-channel-input" class="wl-input" placeholder="${msg.tfChannelPlaceholder}" style="flex:2;min-width:0;">
                        <button id="tf-action-btn" class="wl-add-btn">${isEditing ? msg.tfSave : msg.tfAdd}</button>
                        <button id="tf-cancel-btn" class="tf-cancel-btn btn-secondary">${msg.tfCancel}</button>
                    </div>
                    <div class="wl-list" id="tf-list-container">
                        ${listHTML}
                    </div>
                </div>
            </div>
        `);

        // ── 關閉 ──
        shadow.getElementById('tf-close-btn').onclick = (e) => {
            e.stopPropagation();
            GM_setValue(STORAGE_KEY_POS_TF, { left: titleFilterPanel.offsetLeft, top: titleFilterPanel.offsetTop });
            titleFilterPanel.style.display = "none";
            tfHelpPanel.style.display = "none";
            document.body.classList.remove('tm-tf-mode');
            tfEditIndex = -1;
            settings.style.display = "block";
            updateUI();
        };

        // ── 說明卡開啟（? 按鈕與 desc 連結共用）──
        const openHelpCard = (e) => {
            e.stopPropagation();
            if (tfHelpPanel.style.display === "block") {
                tfHelpPanel.style.display = "none";
                return;
            }
            renderTitleFilterHelpPanel();
            tfHelpPanel.style.visibility = "hidden";
            tfHelpPanel.style.display = "block";
            const tfRect = titleFilterPanel.getBoundingClientRect();
            const hpW = tfHelpPanel.offsetWidth  || 320;
            const hpH = tfHelpPanel.offsetHeight || 300;
            const margin = 10, vw = window.innerWidth, vh = window.innerHeight;
            let left, top;
            if (tfRect.left - hpW - margin >= 0) {
                left = tfRect.left - hpW - margin;
            } else if (tfRect.right + hpW + margin <= vw) {
                left = tfRect.right + margin;
            } else {
                left = Math.max(margin, vw - hpW - margin);
            }
            top = Math.min(tfRect.top, vh - hpH - margin);
            top = Math.max(margin, top);
            tfHelpPanel.style.left = left + 'px';
            tfHelpPanel.style.top  = top  + 'px';
            tfHelpPanel.style.visibility = "";
        };
        shadow.getElementById('tf-help-btn').onclick = openHelpCard;
        const descLink = shadow.getElementById('tf-desc-link');
        if (descLink) descLink.onclick = openHelpCard;

        // ── 收合 ──
        shadow.getElementById('tf-minimize-btn').onclick = (e) => {
            e.stopPropagation();
            titleFilterPanel.classList.toggle('minimized');
            tfHelpPanel.style.display = "none";
        };

        // ── 動態寬度：依 placeholder 長度計算面板最小寬度 ──
        requestAnimationFrame(() => {
            const patEl = shadow.getElementById('tf-pattern-input');
            const chEl  = shadow.getElementById('tf-channel-input');
            const actEl = shadow.getElementById('tf-action-btn');
            const canEl = shadow.getElementById('tf-cancel-btn');
            if (!patEl || !chEl) return;

            const measurer = document.createElement('span');
            measurer.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;font-size:13px;font-family:sans-serif;white-space:nowrap;';
            document.body.appendChild(measurer);

            measurer.textContent = msg.tfPlaceholder;
            const patMinW = Math.ceil(measurer.getBoundingClientRect().width) + 22;

            measurer.textContent = msg.tfChannelPlaceholder;
            const chMinW  = Math.ceil(measurer.getBoundingClientRect().width) + 22;

            document.body.removeChild(measurer);

            // 按 3:2 比例，從較大的那個反推另一個；channel 欄額外保底 180px 確保長頻道名稱放得下
            const patByRatio = Math.ceil(chMinW  * 3 / 2);
            const chByRatio  = Math.ceil(patMinW * 2 / 3);
            const finalPatW  = Math.max(patMinW, patByRatio);
            const finalChW   = Math.max(chMinW,  chByRatio, 180);

            patEl.style.minWidth = finalPatW + 'px';
            chEl.style.minWidth  = finalChW  + 'px';

            // 按鈕寬度（兩按鈕間 gap 8px，與其他間隔一致）
            const btnW = (actEl ? actEl.offsetWidth : 52) + (canEl ? canEl.offsetWidth : 44) + 8;

            // 面板總寬 = padding(15*2) + gap(8 * 3，共4個元素間3個間隔) + 兩欄 + 兩按鈕
            const panelPad = 30;
            const gaps     = 8 * 3;
            const needed   = panelPad + gaps + finalPatW + finalChW + btnW;
            titleFilterPanel.style.width = Math.max(needed, 420) + 'px';
        });

        // ── 新增 / 儲存 ──
        const patternInput = shadow.getElementById('tf-pattern-input');
        const channelInput = shadow.getElementById('tf-channel-input');

        const commitHandler = () => {
            const pattern = patternInput.value.trim();
            const channel = channelInput.value.trim();
            if (!pattern) { patternInput.focus(); return; }

            if (tfEditIndex >= 0) {
                // 儲存編輯
                config.titleFilterList[tfEditIndex] = { pattern, channel };
                const savedIdx = tfEditIndex;
                tfEditIndex = -1;
                GM_setValue(STORAGE_KEY_CFG, config);
                renderTitleFilterPanel(savedIdx);
            } else {
                // 新增（防重複：pattern + channel 組合不得重複）
                const isDup = config.titleFilterList.some(e => e.pattern === pattern && e.channel === channel);
                if (!isDup) {
                    config.titleFilterList.push({ pattern, channel });
                    GM_setValue(STORAGE_KEY_CFG, config);
                    renderTitleFilterPanel(config.titleFilterList.length - 1);
                }
                patternInput.value = '';
                channelInput.value = '';
                patternInput.focus();
            }
            processContent();
        };

        shadow.getElementById('tf-action-btn').onclick = commitHandler;
        patternInput.onkeydown = (e) => { if (e.key === 'Enter') commitHandler(); };
        channelInput.onkeydown = (e) => { if (e.key === 'Enter') commitHandler(); };

        // ── 取消：清空輸入欄並退出編輯模式 ──
        shadow.getElementById('tf-cancel-btn').onclick = (e) => {
            e.stopPropagation();
            patternInput.value = '';
            channelInput.value = '';
            if (tfEditIndex >= 0) {
                tfEditIndex = -1;
                renderTitleFilterPanel();
            } else {
                patternInput.focus();
            }
        };

        // ── 編輯按鈕 ──
        shadow.querySelectorAll('#tf-list-container .tf-edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                const entry = config.titleFilterList[idx];
                tfEditIndex = idx;
                renderTitleFilterPanel();
                // 重繪後填入值
                shadow.getElementById('tf-pattern-input').value = entry.pattern;
                shadow.getElementById('tf-channel-input').value = entry.channel || '';
                shadow.getElementById('tf-pattern-input').focus();
            };
        });

        // ── 刪除按鈕 ──
        shadow.querySelectorAll('#tf-list-container .tf-remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                config.titleFilterList.splice(idx, 1);
                // 若刪除的是正在編輯的那筆，離開編輯模式
                if (tfEditIndex === idx) tfEditIndex = -1;
                else if (tfEditIndex > idx) tfEditIndex--;
                GM_setValue(STORAGE_KEY_CFG, config);
                renderTitleFilterPanel();
                processContent();
            };
        });

        // ── Scroll to highlight ──
        if (highlightIdx >= 0) {
            setTimeout(() => {
                const items = shadow.querySelectorAll('#tf-list-container .tf-item');
                if (items[highlightIdx]) items[highlightIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        titleFilterPanel.onclick = (e) => e.stopPropagation();
        makeDraggable(titleFilterPanel, shadow.getElementById('tf-drag-handle'));

        // 重繪後恢復收合狀態
        if (isMinimized) titleFilterPanel.classList.add('minimized');
    }

    function renderWatchedPanel() {
        const msg = getMsg();
        const icon = `<span style="width:18px;height:18px;display:inline-block;margin-right:6px;vertical-align:text-bottom;">${FILTER_SVG}</span>`;

        watchedPanel.innerHTML = _trustedHTML(`
            <div class="wd-top">
                <div class="wd-title-area" id="wd-drag-handle">${icon} ${msg.wdTitle}</div>
                <div class="wd-top-divider"></div>
                <div class="wd-close-area" id="wd-close-btn">${CLOSE_SVG}</div>
            </div>
            <div class="wd-desc-row">${msg.wdDesc}</div>
            <div class="wd-body">
            <div class="wd-row">
                <div class="wd-label">${msg.wdLabelPct}</div>
                <div class="wd-ctrl-group">
                     <div class="stepper">
                         <button class="step-btn" id="wd-pct-minus">−</button>
                         <input type="number" id="wd-pct-val" value="${config.watchedPercent}">
                         <button class="step-btn" id="wd-pct-plus">+</button>
                     </div>
                     <div class="wd-unit-fixed">${msg.wdUnitPct}</div>
                </div>
            </div>
            <div class="wd-row">
                <div class="wd-label">${msg.wdLabelSec}</div>
                <div class="wd-ctrl-group">
                     <div class="stepper">
                         <button class="step-btn" id="wd-sec-minus">−</button>
                         <input type="number" id="wd-sec-val" value="${config.watchedSeconds}">
                         <button class="step-btn" id="wd-sec-plus">+</button>
                     </div>
                     <div class="wd-unit-fixed">${msg.wdUnitSec}</div>
                </div>
            </div>
            </div>
        `);

        makeDraggable(watchedPanel, shadow.getElementById('wd-drag-handle'));

        shadow.getElementById('wd-close-btn').onclick = (e) => {
            e.stopPropagation();
            GM_setValue(STORAGE_KEY_POS_WD, { left: watchedPanel.offsetLeft, top: watchedPanel.offsetTop });
            watchedPanel.style.display = "none";
            settings.style.display = "block";
            updateUI();
        };

        // Logic for Percentage Row
        const pctInput = shadow.getElementById('wd-pct-val');
        const updatePct = (val) => {
            let v = parseInt(val, 10);
            if (isNaN(v) || v < 1) v = 1;
            if (v > 100) v = 100;
            config.watchedPercent = v;
            pctInput.value = v;
            GM_setValue(STORAGE_KEY_CFG, config);
            processContent();
        };
        pctInput.onchange = (e) => updatePct(e.target.value);
        shadow.getElementById('wd-pct-minus').onclick = () => updatePct(config.watchedPercent - 1);
        shadow.getElementById('wd-pct-plus').onclick = () => updatePct(config.watchedPercent + 1);

        // Logic for Seconds Row
        const secInput = shadow.getElementById('wd-sec-val');
        const updateSec = (val) => {
            let v = parseInt(val, 10);
            if (isNaN(v) || v < 0) v = 0;
            config.watchedSeconds = v;
            secInput.value = v;
            GM_setValue(STORAGE_KEY_CFG, config);
            processContent();
        };
        secInput.onchange = (e) => updateSec(e.target.value);
        shadow.getElementById('wd-sec-minus').onclick = () => updateSec(config.watchedSeconds - 1);
        shadow.getElementById('wd-sec-plus').onclick = () => updateSec(config.watchedSeconds + 1);
    }

    // ── 進階設定面板（面板內切換）──
    function renderQASettingsPanel() {
        const currentLang = getActiveLang();
        const msg = getMsg();

        const themeOptionsHTML = Object.entries(THEMES_MASTER).map(([themeKey, themeObj]) => {
        const firstLang = Object.keys(LOCALES_MASTER)[0];
        const label = themeObj.label[currentLang] || themeObj.label[firstLang] || themeKey;
            return `<option value="${themeKey}" ${config.theme === themeKey ? 'selected' : ''}>${label}</option>`;
        }).join('');

        const gridDisabled = !config.gridColumnsEnabled;
        const BACK_SVG = `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`;
        const backLabel     = msg.advBack;
        const newTabLabel   = msg.advNewTab;
        const gridLabel     = msg.advGrid;
        const resetLabel    = msg.advReset;
        const resetTip      = msg.advResetTip;
        const feedbackLabel = msg.advFeedback;

        qaSettingsPanel.innerHTML = _trustedHTML(`
            <div class="adv-header">
                <div class="adv-back-area" id="adv-back-btn">
                    ${BACK_SVG} ${backLabel}
                </div>
                <div class="adv-header-divider"></div>
                <div class="adv-close-area" id="adv-close-btn">${CLOSE_SVG}</div>
            </div>
            <div class="panel-body">
                <div class="adv-grp-first">
                    <span class="adv-feedback-label">${feedbackLabel}</span>
                    <div class="feedback-card">
                        <div class="section-inner">
                            <div class="title" style="display:flex;align-items:center;">
                                <span class="qa-row-icon">${QA_ICON_ALREADY_WATCHED}</span>
                                ${msg.qaLabelWatched}
                            </div>
                            <label class="switch"><input type="checkbox" id="v-qa-watched" ${config.qaShowAlreadyWatched ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="section-inner">
                            <div class="title" style="display:flex;align-items:center;">
                                <span class="qa-row-icon">${QA_ICON_NOT_INTERESTED}</span>
                                ${msg.qaLabelNotInt}
                            </div>
                            <label class="switch"><input type="checkbox" id="v-qa-notinterested" ${config.qaShowNotInterested ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="section-inner">
                            <div class="title" style="display:flex;align-items:center;">
                                <span class="qa-row-icon">${QA_ICON_DONT_LIKE}</span>
                                ${msg.qaLabelDontLike}
                            </div>
                            <label class="switch"><input type="checkbox" id="v-qa-dontlike" ${config.qaShowDontLike ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                        <div class="section-inner">
                            <div class="title" style="display:flex;align-items:center;">
                                <span class="qa-row-icon">${QA_ICON_DONT_RECOMMEND}</span>
                                ${msg.qaLabelDontRec}
                            </div>
                            <label class="switch"><input type="checkbox" id="v-qa-dontrecommend" ${config.qaShowDontRecommend ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                </div>
                <div class="adv-grp">
                    <div class="adv-grp-row">
                        <div class="title">${newTabLabel}</div>
                        <label class="switch"><input type="checkbox" id="v-qa-newtab" ${config.openLinksInNewTab ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="adv-grp">
                    <div class="adv-grp-row">
                        <div class="title">${msg.advInterceptTT}</div>
                        <label class="switch"><input type="checkbox" id="v-intercept-tt" ${config.enhancedTooltips ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="adv-grp">
                    <div class="adv-grp-row">
                        <div class="title">${gridLabel}</div>
                        <label class="switch"><input type="checkbox" id="v-qa-grid" ${config.gridColumnsEnabled ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                    <div class="adv-stepper-row" id="grid-stepper-wrap" style="${gridDisabled ? 'opacity:0.35;pointer-events:none;' : ''}">
                        <div class="stepper" id="grid-stepper">
                            <button class="step-btn" id="grid-minus">−</button>
                            <input type="number" id="grid-val" value="${config.gridColumnsValue}" min="3" max="10" style="width:32px;">
                            <button class="step-btn" id="grid-plus">+</button>
                        </div>
                    </div>
                </div>
                <div class="adv-grp">
                    <div class="adv-grp-row">
                        <div class="title">${msg.optTheme}</div>
                        <select id="v-theme">${themeOptionsHTML}</select>
                    </div>
                </div>
                <div class="adv-grp">
                    <div class="adv-grp-row">
                        <div class="title" style="flex-direction:column;align-items:flex-start;gap:2px;margin-right:12px;">
                            <span>${msg.labelCustomLang}</span>
                            <span style="font-size:10px;color:var(--t-text-muted);font-weight:normal;">${msg.labelCustomLangSub}</span>
                        </div>
                        <div class="controls">
                            <button class="cl-edit-btn" id="cl-edit-btn">${msg.clEditBtn}</button>
                            <label class="switch"><input type="checkbox" id="v-custom-lang" ${config.useCustomLang ? 'checked' : ''}><span class="slider"></span></label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="reset-row" id="adv-reset-btn" data-tooltip="${resetTip}">
                <button class="reset-btn-inner">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    ${resetLabel}
                </button>
                <div class="reset-sub">${resetTip}</div>
            </div>
            <div class="back-row" id="adv-back-row">${BACK_SVG} ${backLabel}</div>
        `);

        // ── 導覽：整列返回（頂部）──
        shadow.getElementById('adv-back-btn').onclick = (e) => {
            e.stopPropagation();
            qaSettingsPanel.style.display = "none";
            settings.style.display = "block";
            updateUI();
        };
        // ── 導覽：整列返回（底部）──
        shadow.getElementById('adv-back-row').onclick = (e) => {
            e.stopPropagation();
            qaSettingsPanel.style.display = "none";
            settings.style.display = "block";
            updateUI();
        };
        shadow.getElementById('adv-close-btn').onclick = (e) => {
            e.stopPropagation();
            qaSettingsPanel.style.display = "none";
            qaSettingsPanel.style.marginBottom = "";
            updateUI();
        };

        // ── 外觀：主題 ──
        shadow.getElementById('v-theme').onchange = (e) => {
            config.theme = e.target.value;
            GM_setValue(STORAGE_KEY_CFG, config);
            applyTheme();
            buildTooltipCache();
        };

        // ── 外觀：每行卡片數量 ──
        const gridStepperWrap = shadow.getElementById('grid-stepper-wrap');
        const gridInput = shadow.getElementById('grid-val');
        const gridToggle = shadow.getElementById('v-qa-grid');

        const updateGridStepper = () => {
            const disabled = !config.gridColumnsEnabled;
            gridStepperWrap.style.opacity = disabled ? '0.35' : '1';
            gridStepperWrap.style.pointerEvents = disabled ? 'none'  : '';
        };
        const applyGridVal = (val) => {
            let v = parseInt(val, 10);
            if (isNaN(v) || v < 3) v = 3;
            if (v > 10) v = 10;
            config.gridColumnsValue = v;
            gridInput.value = v;
            GM_setValue(STORAGE_KEY_CFG, config);
            applyGridColumns();
            updateBottomSpacer();
        };
        shadow.getElementById('grid-minus').onclick = (e) => { e.stopPropagation(); applyGridVal(config.gridColumnsValue - 1); };
        shadow.getElementById('grid-plus').onclick  = (e) => { e.stopPropagation(); applyGridVal(config.gridColumnsValue + 1); };
        gridInput.onchange = (e) => { e.stopPropagation(); applyGridVal(e.target.value); };
        gridInput.onclick  = (e) => e.stopPropagation();
        gridToggle.onchange = (e) => {
            config.gridColumnsEnabled = e.target.checked;
            GM_setValue(STORAGE_KEY_CFG, config);
            updateGridStepper();
            applyGridColumns();
            updateBottomSpacer();
        };

        // ── 行為：開新分頁 ──
        shadow.getElementById('v-qa-newtab').onchange = (e) => {
            config.openLinksInNewTab = e.target.checked;
            GM_setValue(STORAGE_KEY_CFG, config);
        };

        // ── 行為：增強 Tooltips ──
        shadow.getElementById('v-intercept-tt').onchange = (e) => {
            config.enhancedTooltips = e.target.checked;
            GM_setValue(STORAGE_KEY_CFG, config);
            if (config.enhancedTooltips) {
                scanAndBindTitleTooltips();
            } else {
                restoreTitleTooltips();
                hideTooltip();
            }
            // QA 按鈕重新注入，套用新的 tooltip 行為
            document.querySelectorAll(GRID_SELECTOR).forEach(el => {
                if (!el.dataset.qaInjected) return;
                delete el.dataset.qaInjected;
                const row = el.querySelector('.qa-btn-row');
                if (row) row.remove();
            });
            scanAndInjectQAButtons();
            // 設定面板按鈕重新綁定
            renderSettings();
        };

        // ── 影片回饋按鈕 ──
        const syncQAConfig = () => {
            config.qaShowAlreadyWatched = shadow.getElementById('v-qa-watched').checked;
            config.qaShowNotInterested  = shadow.getElementById('v-qa-notinterested').checked;
            config.qaShowDontLike       = shadow.getElementById('v-qa-dontlike').checked;
            config.qaShowDontRecommend  = shadow.getElementById('v-qa-dontrecommend').checked;
            GM_setValue(STORAGE_KEY_CFG, config);
            document.querySelectorAll(GRID_SELECTOR).forEach(el => {
                if (!el.dataset.qaInjected) return;
                delete el.dataset.qaInjected;
                const row = el.querySelector('.qa-btn-row');
                if (row) row.remove();
            });
            scanAndInjectQAButtons();
            updateBottomSpacer();
        };
        shadow.getElementById('v-qa-watched').onchange       = syncQAConfig;
        shadow.getElementById('v-qa-notinterested').onchange = syncQAConfig;
        shadow.getElementById('v-qa-dontlike').onchange      = syncQAConfig;
        shadow.getElementById('v-qa-dontrecommend').onchange = syncQAConfig;

        // ── 回復預設值 ──
        shadow.getElementById('adv-reset-btn').onclick = (e) => {
            e.stopPropagation();
            const preserved = {
                whitelistMusic : config.whitelistMusic,
                whitelistMember: config.whitelistMember,
                titleFilterList: config.titleFilterList,
            };
            config = { ...defaultConfig, ...preserved };
            GM_setValue(STORAGE_KEY_CFG, config);
            musicWhitelistSet  = new Set(config.whitelistMusic);
            memberWhitelistSet = new Set(config.whitelistMember);
            applyTheme();
            applyGridColumns();
            document.querySelectorAll(GRID_SELECTOR).forEach(el => el.style.display = "");
            processContent();
            renderSettings();
            renderQASettingsPanel();
            updateUI();
            updateBottomSpacer();
        };
        bindTooltip(shadow.getElementById('adv-reset-btn'), 'panel');

        // ── 自訂語系：開關 ──
        shadow.getElementById('v-custom-lang').onchange = (e) => {
            config.useCustomLang = e.target.checked;
            GM_setValue(STORAGE_KEY_CFG, config);
            invalidateCustomLangCache();
            buildTooltipCache();
            renderSettings();
        };

        // ── 自訂語系：開啟編輯器 ──
        shadow.getElementById('cl-edit-btn').onclick = (e) => {
            e.stopPropagation();
            openCustomLangEditor();
        };

        qaSettingsPanel.onclick = (e) => e.stopPropagation();
    }

    // ── 自訂語系編輯器 ─────────────────────────────────────────────────────────
    function openCustomLangEditor() {
        document.getElementById('ytf-cl-overlay')?.remove();
        document.getElementById('ytf-cl-style')?.remove();

        const msg = getMsg();

        // 從 container 的 inline style 讀取目前主題色，確保與面板 100% 一致
        const tv = (k) => container.style.getPropertyValue(k).trim();

        // 判斷是否為深色主題（用於 ref-cell 背景微調）
        const isDarkTheme = (() => {
            const themeKey = getActivePanelThemeKey();
            return themeKey !== 'light';
        })();
        const isCyberpunk = getActivePanelThemeKey() === 'cyberpunk';

        // 注入編輯器專用 CSS（使用 ytf-cl- 前綴避免與頁面衝突）
        const styleEl = document.createElement('style');
        styleEl.id = 'ytf-cl-style';
        styleEl.textContent = `
            #ytf-cl-editor {
                pointer-events:auto;
                position:absolute;
                border-radius:14px;overflow:hidden;
                border:1px solid ${tv('--t-panel-border')};
                background:${tv('--t-panel-bg')};
                box-shadow:0 10px 40px ${tv('--t-panel-shadow')};
                font-family:sans-serif;font-size:13px;
                color:${tv('--t-text-main')};
                display:flex;flex-direction:column;
                width:560px;max-height:90vh;min-height:280px;
                isolation:isolate;
            }
            #ytf-cl-resize-t, #ytf-cl-resize-b {
                position:absolute;left:0;right:0;height:6px;
                cursor:ns-resize;z-index:10;
            }
            #ytf-cl-resize-t { top:-3px; }
            #ytf-cl-resize-b { bottom:-3px; }

            /* ── 頂部標題列 ── */
            #ytf-cl-editor .cl-hdr {
                background:${tv('--t-panel-bg')};
                border-bottom:1px solid ${tv('--t-divider')};
                font-size:12px;font-weight:700;
                color:${tv('--t-text-main')};letter-spacing:0.2px;
                display:flex;align-items:stretch;
                height:44px;box-sizing:border-box;flex-shrink:0;
                position:relative;z-index:1;will-change:transform;
            }
            #ytf-cl-editor .cl-hdr-title {
                flex:1;display:flex;align-items:center;
                padding:0 15px;cursor:move;user-select:none;
            }
            #ytf-cl-editor .cl-hdr-div { width:1px;background:${tv('--t-divider')};flex-shrink:0; }
            #ytf-cl-editor .cl-hdr-close {
                width:44px;border-radius:0 14px 0 0;border:none;
                background:transparent;color:${tv('--t-text-muted')};
                font-size:14px;cursor:pointer;flex-shrink:0;
                display:flex;align-items:center;justify-content:center;
                transition:background 0.15s,color 0.15s;
            }
            #ytf-cl-editor .cl-hdr-close:hover { background:${tv('--t-close-hover-bg')};color:${tv('--t-text-main')}; }

            /* ── 貫穿全編輯器的 grid ──
               col: num(28px) | gap(8px) | key(120px) | gap(8px) | ref(1fr) | gap(8px) | trans(1fr)
               所有列都用同一套 grid，保證垂直對齊 */
            #ytf-cl-editor .cl-g {
                display:grid;
                grid-template-columns:28px 8px var(--cl-key-col-w,120px) 8px 1fr 8px 1fr;
                padding:0 15px;
                box-sizing:border-box;
            }
            /* 變數名稱欄 */
            #ytf-cl-editor .cl-key-cell {
                font-size:10px;font-family:monospace;
                color:${tv('--t-text-main')};
                padding-top:5px;word-break:normal;white-space:nowrap;
                user-select:all;
            }
            /* 分組標題列 — 使用 cl-g grid，▶ 在 num 欄，標題從 key 欄開始 */
            #ytf-cl-editor .cl-row-hdr {
                border-top:1px solid ${tv('--t-divider')};
                background:${tv('--t-card-bg')};
            }
            #ytf-cl-editor .cl-row-hdr:first-child { border-top:none; }
            #ytf-cl-editor .cl-group-arrow {
                font-size:9px;color:${tv('--t-switch-on')};font-style:normal;
                text-align:right;padding:8px 0 4px 0;align-self:start;
            }
            #ytf-cl-editor .cl-group-hdr {
                grid-column:3/-1;
                padding:8px 0 6px 0;
            }
            #ytf-cl-editor .cl-group-hdr-title {
                font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
                color:${tv('--t-text-main')};line-height:1.4;
            }
            #ytf-cl-editor .cl-group-note {
                font-size:9px;letter-spacing:0;text-transform:none;
                color:${tv('--t-text-muted')};margin-top:2px;line-height:1.5;
                display:block;
            }
            #ytf-cl-editor .cl-group-link {
                color:${tv('--t-switch-on')};text-decoration:underline;cursor:pointer;
            }
            #ytf-cl-editor .cl-group-link:hover { opacity:0.8; }

            /* ── 搜尋列 ── */
            #ytf-cl-editor .cl-search-row {
                background:${tv('--t-panel-bg')};
                padding-top:8px;padding-bottom:8px;
                border-bottom:1px solid ${tv('--t-divider')};
                flex-shrink:0;
            }
            #ytf-cl-editor .cl-search-span {
                grid-column:3/8;
                display:flex;align-items:center;gap:6px;
            }
            #ytf-cl-editor .cl-search-inp {
                flex:1;height:28px;padding:0 10px;
                font-size:11.5px;outline:none;
                background:${tv('--t-input-bg')};
                border:1px solid ${tv('--t-input-border')};
                border-radius:6px;
                color:${tv('--t-input-text')};
                transition:border-color 0.15s;
                box-sizing:border-box;
            }
            #ytf-cl-editor .cl-search-inp:focus { border-color:${tv('--t-switch-on')}; }
            #ytf-cl-editor .cl-search-inp::placeholder { color:${tv('--t-text-muted')};opacity:0.6; }
            #ytf-cl-editor .cl-search-btn {
                flex-shrink:0;
                height:28px;padding:0 14px;
                border:1px solid ${tv('--t-input-border')};
                border-radius:6px;
                background:${tv('--t-btn-bg')};color:${tv('--t-btn-text')};
                font-size:11.5px;font-weight:600;cursor:pointer;
                transition:background 0.15s,color 0.15s;
                white-space:nowrap;box-sizing:border-box;
            }
            #ytf-cl-editor .cl-search-btn:hover { background:${tv('--t-btn-hover')};color:${tv('--t-btn-text-hover')}; }

            /* ── 參考語言 + 翻譯目標語言列 ── */
            #ytf-cl-editor .cl-ctrl-row {
                background:${tv('--t-panel-bg')};
                border-bottom:1px solid ${tv('--t-divider')};
                flex-shrink:0;
            }
            #ytf-cl-editor .cl-ctrl-labels {
                padding-top:8px;padding-bottom:2px;
            }
            #ytf-cl-editor .cl-ctrl-inputs {
                padding-top:4px;padding-bottom:8px;
            }
            #ytf-cl-editor .cl-ctrl-lbl {
                font-size:10px;color:${tv('--t-text-main')};
                letter-spacing:0.5px;text-transform:uppercase;
            }
            #ytf-cl-editor .cl-ref-select,
            #ytf-cl-editor .cl-langcode-inp {
                width:100%;height:28px;border-radius:6px;padding:0 8px;
                font-size:11.5px;outline:none;
                background:${tv('--t-input-bg')};
                border:1px solid ${tv('--t-input-border')};
                color:${tv('--t-input-text')};
                transition:border-color 0.15s;
                box-sizing:border-box;
            }
            #ytf-cl-editor .cl-ref-select:focus,
            #ytf-cl-editor .cl-langcode-inp:focus { border-color:${tv('--t-switch-on')}; }
            #ytf-cl-editor .cl-langcode-inp::placeholder { color:${tv('--t-text-muted')};opacity:0.5; }

            /* ── 欄位標題（每分組各一份，上下各有分隔線，不填底色） ── */
            #ytf-cl-editor .cl-col-headers {
                background:${tv('--t-panel-bg')};
                padding-top:4px;padding-bottom:4px;
                border-top:1px solid ${tv('--t-divider')};
                border-bottom:1px solid ${tv('--t-divider')};
            }
            /* ── 分組間距 ── */
            #ytf-cl-editor .cl-group-gap {
                height:16px;
            }
            #ytf-cl-editor .cl-col-num { font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${tv('--t-text-main')};text-align:right; }
            #ytf-cl-editor .cl-col-key { font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${tv('--t-text-main')};text-align:left; }
            #ytf-cl-editor .cl-col-ref { font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${tv('--t-text-main')}; }
            #ytf-cl-editor .cl-col-val { font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${tv('--t-text-main')}; }
            #ytf-cl-editor .cl-col-badge {
                display:inline-block;font-size:8px;padding:1px 4px;
                border-radius:3px;margin-left:4px;vertical-align:middle;
            }
            #ytf-cl-editor .cl-badge-r {
                background:${isDarkTheme?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'};
                color:${tv('--t-text-muted')};
                border:1px solid ${tv('--t-divider')};
            }
            #ytf-cl-editor .cl-badge-e {
                background:${tv('--t-switch-on')}22;
                color:${tv('--t-switch-on')};
                border:1px solid ${tv('--t-switch-on')}55;
            }

            /* ── 資料列 ── */
            #ytf-cl-editor .cl-list {
                overflow-y:scroll;overflow-x:hidden;
                scrollbar-gutter:stable;
                overscroll-behavior:contain;
                padding:0 0 4px 0;flex:1;min-height:0;
            }
            #ytf-cl-editor .cl-list::-webkit-scrollbar { width:4px; }
            #ytf-cl-editor .cl-list::-webkit-scrollbar-thumb { background:${tv('--t-pill-border')};border-radius:4px; }
            #ytf-cl-editor .cl-row {
                padding-top:5px;padding-bottom:5px;
                border-bottom:1px solid ${tv('--t-card-divider')};
                align-items:flex-start;
            }
            #ytf-cl-editor .cl-row.cl-hidden { display:none; }
            #ytf-cl-editor .cl-num { padding-top:5px;font-size:10px;color:${tv('--t-text-main')};font-variant-numeric:tabular-nums;text-align:right; }
            #ytf-cl-editor .cl-ref-cell {
                font-size:11px;color:${tv('--t-text-main')};
                background:${isDarkTheme ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'};
                border:1px solid ${tv('--t-input-border')};border-radius:5px;
                padding:4px 7px;min-width:0;box-sizing:border-box;
                line-height:1.45;white-space:pre-wrap;word-break:break-word;
            }
            #ytf-cl-editor .cl-inp {
                border-radius:5px;padding:4px 7px;font-size:11.5px;outline:none;min-width:0;
                background:${tv('--t-input-bg')};
                border:1px solid ${tv('--t-input-border')};
                color:${tv('--t-input-text')};
                transition:border-color 0.15s;box-sizing:border-box;
                resize:none;overflow:hidden;line-height:1.45;font-family:sans-serif;
                display:block;min-height:26px;width:100%;
            }
            #ytf-cl-editor .cl-inp:focus { border-color:${tv('--t-switch-on')}; }

            /* ── 底部 ── */
            #ytf-cl-editor .cl-footer {
                display:flex;align-items:center;gap:8px;
                padding:10px 15px 12px;
                border-top:1px solid ${tv('--t-divider')};
                background:${tv('--t-panel-bg')};flex-shrink:0;
                position:relative;z-index:1;
            }
            #ytf-cl-editor .cl-btn {
                padding:5px 12px;border-radius:7px;border:none;
                font-size:11.5px;font-weight:600;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                transition:background 0.15s,color 0.15s;
            }
            #ytf-cl-editor .cl-btn:active { opacity:0.82; }
            #ytf-cl-editor .cl-btn-clear {
                background:${tv('--t-danger-bg')};
                border:1px solid ${tv('--t-danger-border')};
                color:${tv('--t-danger-text')};
            }
            #ytf-cl-editor .cl-btn-clear:hover {
                background:${tv('--t-danger-hover-bg')};
                border-color:${tv('--t-danger-hover-border')};
            }
            #ytf-cl-editor .cl-btn-secondary {
                background:${tv('--t-btn-bg')};
                border:1px solid ${tv('--t-input-border')};
                color:${tv('--t-btn-text')};
            }
            #ytf-cl-editor .cl-btn-secondary:hover {
                background:${tv('--t-btn-hover')};
                color:${tv('--t-btn-text-hover')};
            }
            #ytf-cl-editor .cl-btn-save { background:${tv('--t-switch-on')};color:${tv('--t-switch-on-text') || '#fff'};border:none;font-weight:700;transition:filter 0.15s,box-shadow 0.15s;box-shadow:${tv('--t-primary-shadow')}; }
            #ytf-cl-editor .cl-btn-save:hover { filter:brightness(1.12); box-shadow:${tv('--t-primary-hover-shadow')}; }
            /* 確認對話框 */
            #ytf-cl-confirm-overlay {
                position:fixed;inset:0;z-index:2147483648;
                background:rgba(0,0,0,0.55);
                display:flex;align-items:center;justify-content:center;
            }
            #ytf-cl-confirm-dialog {
                border-radius:13px;overflow:hidden;
                border:1px solid ${isDarkTheme ? 'rgba(200,60,60,0.35)' : 'rgba(200,0,0,0.2)'};
                background:${tv('--t-panel-bg')};
                box-shadow:0 10px 40px ${tv('--t-panel-shadow')};
                font-family:sans-serif;font-size:13px;color:${tv('--t-text-main')};
                width:320px;
            }
            #ytf-cl-confirm-dialog .cld-hdr {
                background:${isDarkTheme ? 'rgba(180,0,0,0.18)' : 'rgba(200,0,0,0.06)'};
                border-bottom:1px solid ${isDarkTheme ? 'rgba(200,0,0,0.25)' : 'rgba(200,0,0,0.15)'};
                padding:12px 16px 10px;
            }
            #ytf-cl-confirm-dialog .cld-title { font-size:13px;font-weight:700;color:${isDarkTheme ? '#ff6060' : '#c00'};margin-bottom:5px; }
            #ytf-cl-confirm-dialog .cld-desc { font-size:11px;color:${tv('--t-text-main')};line-height:1.5; }
            #ytf-cl-confirm-dialog .cld-body {
                padding:12px 16px;border-bottom:1px solid ${tv('--t-divider')};
                font-size:11px;color:${tv('--t-text-main')};line-height:1.6;
            }
            #ytf-cl-confirm-dialog .cld-body pre { font-family:sans-serif;margin:0;white-space:pre-wrap; }
            #ytf-cl-confirm-dialog .cld-footer {
                display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 12px;
                background:${tv('--t-panel-bg')};
            }
            #ytf-cl-confirm-dialog .cld-btn {
                flex:1;padding:7px;border-radius:7px;border:none;
                font-size:11.5px;font-weight:600;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                transition:background 0.15s,color 0.15s;min-width:80px;
            }
            #ytf-cl-confirm-dialog .cld-btn:active { opacity:0.82; }
            #ytf-cl-confirm-dialog .cld-btn-cancel {
                background:${tv('--t-btn-bg')};
                border:1px solid ${tv('--t-input-border')}; color:${tv('--t-btn-text')};
                transition:background 0.15s,color 0.15s;
            }
            #ytf-cl-confirm-dialog .cld-btn-cancel:hover {
                background:${tv('--t-btn-hover')};
                color:${tv('--t-btn-text-hover')};
            }
            #ytf-cl-confirm-dialog .cld-btn-export {
                background:${tv('--t-btn-bg')};
                border:1px solid ${tv('--t-input-border')}; color:${tv('--t-btn-text')};
                transition:background 0.15s,color 0.15s;
            }
            #ytf-cl-confirm-dialog .cld-btn-export:hover {
                background:${tv('--t-btn-hover')};
                color:${tv('--t-btn-text-hover')};
            }
            #ytf-cl-confirm-dialog .cld-btn-confirm { background:${tv('--t-switch-on')};color:${tv('--t-switch-on-text') || '#fff'};border:none;font-weight:700;transition:filter 0.15s,box-shadow 0.15s;box-shadow:${tv('--t-primary-shadow')}; }
            #ytf-cl-confirm-dialog .cld-btn-confirm:hover { filter:brightness(1.12); box-shadow:${tv('--t-primary-hover-shadow')}; }
            #ytf-cl-confirm-dialog .cld-btn-danger { background:${tv('--t-danger-bg')};border:1px solid ${tv('--t-danger-border')};color:${tv('--t-danger-text')};font-weight:700;transition:background 0.15s,border-color 0.15s; }
            #ytf-cl-confirm-dialog .cld-btn-danger:hover { background:${tv('--t-danger-hover-bg')};border-color:${tv('--t-danger-hover-border')}; }
            /* 確認對話框 */
            #ytf-cl-confirm-overlay {
                position:fixed;inset:0;z-index:2147483648;
                background:rgba(0,0,0,0.55);
                display:flex;align-items:center;justify-content:center;
            }
            #ytf-cl-confirm-dialog {
                border-radius:13px;overflow:hidden;
                border:1px solid ${isDarkTheme ? 'rgba(200,60,60,0.35)' : 'rgba(200,0,0,0.2)'};
                background:${tv('--t-panel-bg')};
                box-shadow:0 10px 40px ${tv('--t-panel-shadow')};
                font-family:sans-serif;font-size:13px;color:${tv('--t-text-main')};
                width:320px;
            }
            #ytf-cl-confirm-dialog .cld-hdr {
                background:${isDarkTheme ? 'rgba(180,0,0,0.18)' : 'rgba(200,0,0,0.06)'};
                border-bottom:1px solid ${isDarkTheme ? 'rgba(200,0,0,0.25)' : 'rgba(200,0,0,0.15)'};
                padding:12px 16px 10px;
            }
            #ytf-cl-confirm-dialog .cld-title { font-size:13px;font-weight:700;color:${isDarkTheme ? '#ff6060' : '#c00'};margin-bottom:5px; }
            #ytf-cl-confirm-dialog .cld-desc { font-size:11px;color:${tv('--t-text-muted')};line-height:1.5; }
            #ytf-cl-confirm-dialog .cld-body {
                padding:12px 16px;border-bottom:1px solid ${tv('--t-divider')};
                font-size:11px;color:${tv('--t-text-muted')};line-height:1.6;
            }
            #ytf-cl-confirm-dialog .cld-body pre { font-family:sans-serif;margin:0;white-space:pre-wrap; }
            #ytf-cl-confirm-dialog .cld-footer {
                display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 12px;
                background:${tv('--t-panel-bg')};
            }
            #ytf-cl-confirm-dialog .cld-btn {
                flex:1;padding:7px;border-radius:7px;border:none;
                font-size:11.5px;font-weight:600;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                transition:opacity 0.12s;min-width:80px;
            }
            #ytf-cl-confirm-dialog .cld-btn:active { opacity:0.82; }
            #ytf-cl-confirm-dialog .cld-btn-cancel {
                background:transparent;
                border:1px solid ${tv('--t-nav-color')}; color:${tv('--t-nav-color')};
                transition:background 0.15s,color 0.15s,border-color 0.15s;
            }
            #ytf-cl-confirm-dialog .cld-btn-cancel:hover {
                background:${tv('--t-close-hover-bg')};
                color:${tv('--t-text-main')};
                border-color:${tv('--t-text-main')};
            }
            #ytf-cl-confirm-dialog .cld-btn-export {
                background:transparent;
                border:1px solid ${tv('--t-nav-color')}; color:${tv('--t-nav-color')};
                transition:background 0.15s,color 0.15s,border-color 0.15s;
            }
            #ytf-cl-confirm-dialog .cld-btn-export:hover {
                background:${tv('--t-close-hover-bg')};
                color:${tv('--t-text-main')};
                border-color:${tv('--t-text-main')};
            }
            #ytf-cl-confirm-dialog .cld-btn-confirm { background:${tv('--t-switch-on')};color:${tv('--t-switch-on-text') || '#fff'};border:none;font-weight:700;transition:filter 0.15s,box-shadow 0.15s; }
            #ytf-cl-confirm-dialog .cld-btn-confirm:hover { filter:brightness(1.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,0.35); }
            #ytf-cl-confirm-dialog .cld-btn-danger { background:rgba(255,75,55,0.12);border:1px solid rgba(255,75,55,0.30);color:#ff6b55;font-weight:700;transition:background 0.15s,border-color 0.15s; }
            #ytf-cl-confirm-dialog .cld-btn-danger:hover { background:rgba(255,75,55,0.22);border-color:rgba(255,75,55,0.50); }
        `;
        document.head.appendChild(styleEl);

        // ── 讀取目前儲存的自訂翻譯 ──────────────────────────────────────────
        function parseCurrentLang() {
            return parseCustomLang(GM_getValue(STORAGE_KEY_CUSTOM_LANG, '{}'));
        }

        function getLangCode() {
            try {
                const data = JSON.parse(GM_getValue(STORAGE_KEY_CUSTOM_LANG, '{}'));
                return data.langCode || '';
            } catch { return ''; }
        }

        function serialise(langCode) {
            const strings = [];
            let i = 0;
            clList.querySelectorAll('.cl-row[data-key]').forEach(row => {
                i++;
                const key = row.dataset.key;
                const val = row.querySelector('.cl-inp').value;
                strings.push({ id: String(i).padStart(2, '0'), key, value: val });
            });
            const inner = strings.map(e =>
                `    { "id": ${JSON.stringify(e.id)}, "key": ${JSON.stringify(e.key)}, "value": ${JSON.stringify(e.value)} }`
            ).join(',\n');
            return `{\n  "langCode": ${JSON.stringify(langCode)},\n  "strings": [\n${inner}\n  ]\n}`;
        }

        function doExport(langCode, jsonStr) {
            const fn   = `ytf-lang-${langCode || 'custom'}.json`;
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = fn;
            document.body.appendChild(a); a.click();
            setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
        }

        function showInfoDialog(title, desc, bodyHtml, hasBody) {
            document.getElementById('ytf-cl-confirm-overlay')?.remove();
            const ov = document.createElement('div');
            ov.id = 'ytf-cl-confirm-overlay';
            ov.style.cssText = 'position:fixed;inset:0;z-index:2147483649;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;transform:translateZ(0);';
            ov.innerHTML = _trustedHTML(`
                <div id="ytf-cl-confirm-dialog">
                    <div class="cld-hdr">
                        <div class="cld-title">${msg.clImportTitle}</div>
                        <div class="cld-desc">${desc}</div>
                    </div>
                    ${hasBody ? `<div class="cld-body"><pre>${bodyHtml}</pre></div>` : ''}
                    <div class="cld-footer">
                        <button class="cld-btn cld-btn-confirm" id="ytf-cld-ok">${msg.clImportOkBtn}</button>
                    </div>
                </div>
            `);
            document.documentElement.appendChild(ov);
            document.getElementById('ytf-cld-ok').addEventListener('click', () => ov.remove());
        }

        // ── 建構參考語言下拉選單選項 ──────────────────────────────────────────
        const savedLangCode = getLangCode();
        const refLangOptions = Object.entries(LOCALES_MASTER).map(([key, data]) => {
            const label = data.langName || key;
            return `<option value="${key}">${label}</option>`;
        }).join('');
        const customLabel = `${msg.clCustomOption}${savedLangCode ? `（${savedLangCode}）` : ''}`;

        // ── 建立編輯器 overlay ────────────────────────────────────────────────
        const clOverlay = document.createElement('div');
        clOverlay.id = 'ytf-cl-overlay';
        clOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:transparent;pointer-events:none;transform:translateZ(0);';
        clOverlay.innerHTML = _trustedHTML(`
            <div id="ytf-cl-editor">
                <div id="ytf-cl-resize-t"></div>
                <div class="cl-hdr">
                    <span class="cl-hdr-title" id="ytf-cl-title-handle">▶ ${msg.clTitle}</span>
                    <div class="cl-hdr-div"></div>
                    <button class="cl-hdr-close" id="ytf-cl-close">✕</button>
                </div>
                <!-- 搜尋列（最上方，橫跨兩欄） -->
                <div class="cl-g cl-search-row">
                    <div></div><div></div>
                    <div class="cl-search-span">
                        <input class="cl-search-inp" id="ytf-cl-search" type="text"
                               placeholder="${msg.clSearchPH}" spellcheck="false">
                        <button class="cl-search-btn" id="ytf-cl-search-btn">${msg.clSearchBtn}</button>
                    </div>
                </div>
                <!-- 參考語言 + 翻譯目標語言 -->
                <div class="cl-ctrl-row">
                    <div class="cl-g cl-ctrl-labels">
                        <div></div><div></div>
                        <div class="cl-ctrl-lbl" style="grid-column:3/6">${msg.clRefLangLabel}</div>
                        <div></div>
                        <div class="cl-ctrl-lbl">${msg.clTransTargetLabel}</div>
                    </div>
                    <div class="cl-g cl-ctrl-inputs">
                        <div></div><div></div>
                        <select class="cl-ref-select" id="ytf-cl-reflang" style="grid-column:3/6">
                            ${refLangOptions}
                            <option disabled>──────</option>
                            <option value="__custom__">${customLabel}</option>
                        </select>
                        <div></div>
                        <input class="cl-langcode-inp" id="ytf-cl-langcode"
                               type="text" spellcheck="false"
                               placeholder="${msg.clTransTargetPH}"
                               value="${savedLangCode}">
                    </div>
                </div>
                <div class="cl-list" id="ytf-cl-list"></div>
                <div class="cl-footer">
                    <button class="cl-btn cl-btn-clear" id="ytf-cl-clearall">${msg.clBtnClearAll}</button>
                    <span style="flex:1"></span>
                    <label class="cl-btn cl-btn-secondary" style="cursor:pointer;">
                        ${msg.clBtnImport}
                        <input type="file" accept=".json" id="ytf-cl-file-inp" style="display:none">
                    </label>
                    <button class="cl-btn cl-btn-secondary" id="ytf-cl-export">${msg.clBtnExport}</button>
                    <span style="flex:1"></span>
                    <button class="cl-btn cl-btn-secondary" id="ytf-cl-cancel">${msg.clBtnCancel}</button>
                    <button class="cl-btn cl-btn-save" id="ytf-cl-save">${msg.clBtnSave}</button>
                </div>
                <div id="ytf-cl-resize-b"></div>
            </div>
        `);
        document.documentElement.appendChild(clOverlay);

        // 記住開啟前是哪個面板
        const prevPanel = qaSettingsPanel.style.display === 'block' ? qaSettingsPanel : settings;
        isCustomLangOpen = true;
        settings.style.display = 'none';
        qaSettingsPanel.style.display = 'none';
        host.style.display = 'none';

        // 等兩個 frame 確保 DOM 渲染完成，再取真實尺寸置中
        const clEditor = document.getElementById('ytf-cl-editor');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const saved = GM_getValue(STORAGE_KEY_POS_CL, null);
            if (saved) {
                clEditor.style.left = saved.left + 'px';
                clEditor.style.top  = saved.top  + 'px';
                if (saved.height) clEditor.style.height = Math.min(window.innerHeight * 0.9, Math.max(280, saved.height)) + 'px';
            } else {
                // 預設高度：header(44) + langcode(42) + col-headers(30) + 10列(約28px each)(280) + footer(52) ≈ 448px
                clEditor.style.height = '448px';
                const w = clEditor.offsetWidth  || 560;
                const h = clEditor.offsetHeight || 448;
                clEditor.style.left = Math.max(0, (window.innerWidth  - w) / 2) + 'px';
                clEditor.style.top  = Math.max(0, (window.innerHeight - h) / 2) + 'px';
            }
            clEditor.style.transform = 'none';
        }));

        // 拖曳
        makeDraggable(clEditor, document.getElementById('ytf-cl-title-handle'));

        // 防止 wheel 事件冒泡到頁面
        clEditor.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

        // 高度可調整
        const MIN_H = 280;
        const MAX_H = () => window.innerHeight * 0.9;
        function makeResizable(handle, isTop) {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startY   = e.clientY;
                const startH   = clEditor.offsetHeight;
                const startTop = clEditor.offsetTop;
                document.body.style.cursor = 'ns-resize';
                function onMove(e) {
                    const dy = e.clientY - startY;
                    if (isTop) {
                        const newH = Math.min(MAX_H(), Math.max(MIN_H, startH - dy));
                        const dh = startH - newH;
                        clEditor.style.height = newH + 'px';
                        clEditor.style.top = Math.max(0, startTop + dh) + 'px';
                    } else {
                        const newH = Math.min(MAX_H(), Math.max(MIN_H, startH + dy));
                        clEditor.style.height = newH + 'px';
                    }
                }
                function onUp() {
                    document.body.style.cursor = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }
        makeResizable(document.getElementById('ytf-cl-resize-t'), true);
        makeResizable(document.getElementById('ytf-cl-resize-b'), false);

        const clList = document.getElementById('ytf-cl-list');

        function clAutoResize(ta) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }

        // ── 偵測是否有未儲存的變更 ────────────────────────────────────────────
        function hasUnsavedChanges() {
            const saved = parseCurrentLang();
            let changed = false;
            clList.querySelectorAll('.cl-row[data-key]').forEach(row => {
                if (changed) return;
                const key = row.dataset.key;
                const cur = (row.querySelector('.cl-inp')?.value || '');
                const savedVal = saved[key] || '';
                if (cur !== savedVal) changed = true;
            });
            return changed;
        }

        // ── 切換到自訂篩選字詞面板的確認對話框 ───────────────────────────────
        function showSwitchDialog() {
            document.getElementById('ytf-cl-switch-overlay')?.remove();
            const ov = document.createElement('div');
            ov.id = 'ytf-cl-switch-overlay';
            ov.style.cssText = `position:fixed;inset:0;z-index:2147483649;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;`;
            ov.innerHTML = _trustedHTML(`
                <div style="border-radius:13px;overflow:hidden;border:1px solid ${tv('--t-panel-border')};background:${tv('--t-panel-bg')};box-shadow:0 10px 40px ${tv('--t-panel-shadow')};font-family:sans-serif;font-size:13px;color:${tv('--t-text-main')};width:300px;">
                    <div style="background:${tv('--t-panel-bg')};border-bottom:1px solid ${tv('--t-divider')};padding:12px 16px 10px;">
                        <div style="font-size:13px;font-weight:700;margin-bottom:5px;">${msg.clSwitchTitle}</div>
                        <div style="font-size:11px;color:${tv('--t-text-main')};line-height:1.6;white-space:pre-wrap;">${msg.clSwitchDesc}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;padding:10px 14px 12px;background:${tv('--t-panel-bg')};">
                        <button id="ytf-cls-save" style="width:100%;padding:7px;border-radius:7px;border:none;font-size:11.5px;font-weight:700;cursor:pointer;background:${tv('--t-switch-on')};color:${tv('--t-switch-on-text')||'#fff'};box-shadow:${tv('--t-primary-shadow')};transition:filter 0.15s;">${msg.clSwitchSave}</button>
                        <button id="ytf-cls-discard" style="width:100%;padding:7px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;background:${tv('--t-btn-bg')};border:1px solid ${tv('--t-input-border')};color:${tv('--t-btn-text')};transition:background 0.15s,color 0.15s;">${msg.clSwitchDiscard}</button>
                        <button id="ytf-cls-cancel" style="width:100%;padding:7px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;background:transparent;border:1px solid ${tv('--t-nav-color')};color:${tv('--t-nav-color')};transition:background 0.15s,color 0.15s;">${msg.clSwitchCancel}</button>
                    </div>
                </div>
            `);
            document.documentElement.appendChild(ov);

            const doSwitch = () => { ov.remove(); closeEditor(); openCustomMatchEditor(); };

            document.getElementById('ytf-cls-save').onclick = () => {
                const langCode = document.getElementById('ytf-cl-langcode').value.trim();
                GM_setValue(STORAGE_KEY_CUSTOM_LANG, serialise(langCode));
                invalidateCustomLangCache();
                buildTooltipCache();
                doSwitch();
            };
            document.getElementById('ytf-cls-discard').onclick = doSwitch;
            document.getElementById('ytf-cls-cancel').onclick  = () => ov.remove();
        }

        // ── 取得目前參考語言的資料 ─────────────────────────────────────────────
        function getRefMap(refLangKey) {
            if (refLangKey === '__custom__') return parseCurrentLang();
            return LOCALES_MASTER[refLangKey] || LOCALES_MASTER.en;
        }

        // ── 刷新參考欄文字 ─────────────────────────────────────────────────────
        function refreshRefCells(refLangKey) {
            const refMap = getRefMap(refLangKey);
            clList.querySelectorAll('.cl-row[data-key]').forEach(row => {
                const key = row.dataset.key;
                const cell = row.querySelector('.cl-ref-cell');
                if (!cell) return;
                const val = refMap[key];
                cell.textContent = typeof val === 'function' ? '(function)' : (val || '');
            });
        }

        // ── 搜尋過濾 ──────────────────────────────────────────────────────────
        function applySearch(query) {
            const q = query.toLowerCase().trim();
            clList.querySelectorAll('.cl-row[data-key]').forEach(row => {
                if (!q) { row.classList.remove('cl-hidden'); return; }
                const refText = (row.querySelector('.cl-ref-cell')?.textContent || '').toLowerCase();
                const trText  = (row.querySelector('.cl-inp')?.value || '').toLowerCase();
                const keyText = (row.dataset.key || '').toLowerCase();
                row.classList.toggle('cl-hidden', !refText.includes(q) && !trText.includes(q) && !keyText.includes(q));
            });
        }

        // ── 分組標題 locale key 對應 ──────────────────────────────────────────
        const CL_GROUP_LABEL_KEYS = {
            ui         : 'clGroupUi',
            detection  : 'clGroupDetection',
            unitLabels : 'clGroupUnitLabels',
        };
        const CL_GROUP_NOTE_KEYS = {
            ui         : 'clGroupUiNote',
            detection  : 'clGroupDetectionNote',
            unitLabels : 'clGroupUnitLabelsNote',
        };

        // ── 填入列表（按分組渲染）────────────────────────────────────────────
        const currentMap = parseCurrentLang();
        const defaultRefLang = Object.keys(LOCALES_MASTER).includes(getActiveLang())
            ? getActiveLang() : 'en';
        const refSelect = document.getElementById('ytf-cl-reflang');
        refSelect.value = defaultRefLang;

        let rowNum = 0;
        CL_KEY_GROUPS.forEach((group, groupIdx) => {
            if (!group.keys.length) return;

            // 分組間距（第一個分組不加）
            if (groupIdx > 0) {
                const gap = document.createElement('div');
                gap.className = 'cl-group-gap';
                clList.appendChild(gap);
            }

            // 分組標題列：▶ 在 num 欄，標題文字從 key 欄開始
            const hdr = document.createElement('div');
            hdr.className = 'cl-row-hdr cl-g';
            const groupLabel = msg[CL_GROUP_LABEL_KEYS[group.groupKey]] || group.groupKey;
            const noteKey    = { ui: 'clGroupUiNote', detection: 'clGroupDetectionNote', unitLabels: 'clGroupUnitLabelsNote' }[group.groupKey];
            let noteHtml = '';
            if (noteKey && msg[noteKey]) {
                let rawNote = msg[noteKey];
                if (group.groupKey === 'detection') {
                    const linkHtml = `<a class="cl-group-link" id="ytf-cl-switch-to-ck" href="#">${msg.clGroupDetectionLink}</a>`;
                    rawNote = rawNote.replace('{link}', linkHtml);
                }
                noteHtml = `<span class="cl-group-note">${rawNote}</span>`;
            }
            hdr.innerHTML = _trustedHTML(`
                <i class="cl-group-arrow">▶</i>
                <div></div>
                <div class="cl-group-hdr">
                    <div class="cl-group-hdr-title">${groupLabel}</div>
                    ${noteHtml}
                </div>
            `);
            clList.appendChild(hdr);

            // 欄位標題列（每個分組各一份）
            const colHdr = document.createElement('div');
            colHdr.className = 'cl-g cl-col-headers';
            colHdr.innerHTML = _trustedHTML(`
                <div class="cl-col-num">#</div><div></div>
                <div class="cl-col-key">KEY</div><div></div>
                <div class="cl-col-ref">${msg.clColRef}<span class="cl-col-badge cl-badge-r">唯讀</span></div>
                <div></div>
                <div class="cl-col-val">${msg.clColTranslation}<span class="cl-col-badge cl-badge-e">編輯中</span></div>
            `);
            clList.appendChild(colHdr);

            group.keys.forEach(key => {
                rowNum++;
                const row = document.createElement('div');
                row.className = 'cl-row cl-g';
                row.dataset.key = key;
                const num    = String(rowNum).padStart(3, '0');
                const refMap = getRefMap(defaultRefLang);
                const refVal = refMap[key];
                const trVal  = currentMap[key] !== undefined ? currentMap[key] : '';
                row.innerHTML = _trustedHTML(`
                    <span class="cl-num">${num}</span>
                    <div></div>
                    <span class="cl-key-cell">${key}</span>
                    <div></div>
                    <div class="cl-ref-cell"></div>
                    <div></div>
                    <textarea class="cl-inp" rows="1" spellcheck="false"></textarea>
                `);
                row.querySelector('.cl-ref-cell').textContent =
                    typeof refVal === 'function' ? '(function)' : (refVal || '');
                const ta = row.querySelector('.cl-inp');
                ta.value = trVal;
                ta.addEventListener('input', () => clAutoResize(ta));
                clList.appendChild(row);
            });
        });

        requestAnimationFrame(() => {
            clList.querySelectorAll('.cl-inp').forEach(ta => clAutoResize(ta));

            // ── key 欄寬度計算（量最長 key 名稱，避免換行）──
            const ruler = document.createElement('div');
            ruler.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;font-size:10px;font-family:monospace;white-space:nowrap;left:-9999px;top:-9999px;';
            document.body.appendChild(ruler);
            let maxKeyW = 0;
            clList.querySelectorAll('.cl-key-cell').forEach(el => {
                ruler.textContent = el.textContent;
                maxKeyW = Math.max(maxKeyW, ruler.offsetWidth);
            });
            document.body.removeChild(ruler);
            const keyColW = Math.max(maxKeyW + 8, 80);
            clEditor.style.setProperty('--cl-key-col-w', keyColW + 'px');

            // ── 面板寬度自動計算 ──
            // grid: num(28) + gap(8) + key(keyColW) + gap(8) + ref(1fr) + gap(8) + trans(1fr) + padding(30)
            // 兩個 1fr 欄各至少 150px，加滾動條 8px
            const minContentW = 150;
            const totalW = 28 + 8 + keyColW + 8 + minContentW * 2 + 8 + 8 + 30;
            const maxW   = window.innerWidth - 40;
            const finalW = Math.min(Math.max(totalW, 520), maxW);
            clEditor.style.width = finalW + 'px';

            // 若尚無儲存位置則重新置中
            if (!GM_getValue(STORAGE_KEY_POS_CL, null)) {
                const h = clEditor.offsetHeight || 448;
                clEditor.style.left = Math.max(0, (window.innerWidth  - finalW) / 2) + 'px';
                clEditor.style.top  = Math.max(0, (window.innerHeight - h) / 2) + 'px';
            }
        });

        // ── 參考語言切換 ──────────────────────────────────────────────────────
        refSelect.addEventListener('change', () => {
            refreshRefCells(refSelect.value);
        });

        // ── 偵測關鍵字分組的連結：切換到自訂篩選字詞面板 ──────────────────────
        const switchLink = document.getElementById('ytf-cl-switch-to-ck');
        if (switchLink) {
            switchLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (hasUnsavedChanges()) {
                    showSwitchDialog();
                } else {
                    closeEditor();
                    openCustomMatchEditor();
                }
            });
        }

        // ── 搜尋 ──────────────────────────────────────────────────────────────
        const searchInp = document.getElementById('ytf-cl-search');
        document.getElementById('ytf-cl-search-btn').addEventListener('click', () => {
            applySearch(searchInp.value);
        });
        searchInp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applySearch(searchInp.value);
        });
        searchInp.addEventListener('input', () => {
            if (!searchInp.value.trim()) applySearch('');
        });

        // ── 關閉 ──────────────────────────────────────────────────────────────
        const closeEditor = () => {
            const clEditor = document.getElementById('ytf-cl-editor');
            if (clEditor) GM_setValue(STORAGE_KEY_POS_CL, {
                left: clEditor.offsetLeft,
                top: clEditor.offsetTop,
                height: clEditor.offsetHeight
            });
            clOverlay.remove();
            document.getElementById('ytf-cl-style')?.remove();
            isCustomLangOpen = false;
            prevPanel.style.display = 'block';
            host.style.display = 'block';
            updateUI();
        };
        document.getElementById('ytf-cl-close').addEventListener('click', closeEditor);
        document.getElementById('ytf-cl-cancel').addEventListener('click', closeEditor);
        clOverlay.addEventListener('click', (e) => { if (e.target === clOverlay) closeEditor(); });

        // ── 匯出 ──────────────────────────────────────────────────────────────
        document.getElementById('ytf-cl-export').addEventListener('click', () => {
            const langCode = document.getElementById('ytf-cl-langcode').value.trim();
            doExport(langCode, serialise(langCode));
        });

        // ── 匯入 ──────────────────────────────────────────────────────────────
        document.getElementById('ytf-cl-file-inp').addEventListener('change', function() {
            const file = this.files && this.files[0];
            if (!file) return;
            this.value = '';
            const reader = new FileReader();
            reader.onload = (ev) => {
                let data;
                try { data = JSON.parse(ev.target.result); }
                catch {
                    showInfoDialog(msg.clImportErrorTitle, msg.clImportErrorDesc, '', false);
                    return;
                }
                if (!data || !Array.isArray(data.strings)) {
                    showInfoDialog(msg.clImportErrorTitle, msg.clImportErrorDesc, '', false);
                    return;
                }
                const importMap = {};
                for (const entry of data.strings) {
                    if (entry && entry.key) importMap[entry.key] = entry.value || '';
                }
                clList.querySelectorAll('.cl-row[data-key]').forEach(row => {
                    const key = row.dataset.key;
                    if (importMap[key] !== undefined) {
                        const ta = row.querySelector('.cl-inp');
                        ta.value = importMap[key];
                        clAutoResize(ta);
                    }
                });
                if (data.langCode) document.getElementById('ytf-cl-langcode').value = data.langCode;
                const knownKeys   = new Set(CL_EDITABLE_KEYS);
                const importKeys  = new Set(Object.keys(importMap));
                const unknownKeys = [...importKeys].filter(k => !knownKeys.has(k));
                const missingKeys = CL_EDITABLE_KEYS.filter(k => !importKeys.has(k));
                if (unknownKeys.length === 0 && missingKeys.length === 0) return;
                const MAX_ITEMS = 10;
                let body = `✅ ${data.strings.length} ${msg.clImportTitle}.\n`;
                body += `\n⚠️ ${msg.clImportUnknown} (${unknownKeys.length}):\n`;
                if (unknownKeys.length === 0)            body += `  (none)\n`;
                else if (unknownKeys.length > MAX_ITEMS)  body += `  (${unknownKeys.length} keys)\n`;
                else unknownKeys.forEach(k => { body += `  · ${k}\n`; });
                body += `\n⚠️ ${msg.clImportMissing} (${missingKeys.length}):\n`;
                if (missingKeys.length === 0)            body += `  (none)\n`;
                else if (missingKeys.length > MAX_ITEMS)  body += `  (${missingKeys.length} keys)\n`;
                else missingKeys.forEach(k => { body += `  · ${k}\n`; });
                body += `\n${msg.clImportSafeNote}`;
                showInfoDialog(msg.clImportTitle, '', body.replace(/</g, '&lt;').replace(/>/g, '&gt;'), true);
            };
            reader.readAsText(file, 'UTF-8');
        });

        // ── 清除全部（兩步驟確認）────────────────────────────────────────────
        document.getElementById('ytf-cl-clearall').addEventListener('click', () => {
            document.getElementById('ytf-cl-confirm-overlay')?.remove();
            const step1 = document.createElement('div');
            step1.id = 'ytf-cl-confirm-overlay';
            step1.style.cssText = 'position:fixed;inset:0;z-index:2147483649;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;transform:translateZ(0);';
            step1.innerHTML = _trustedHTML(`
                <div id="ytf-cl-confirm-dialog">
                    <div class="cld-hdr">
                        <div class="cld-title">${msg.clClearStep1Title}</div>
                        <div class="cld-desc">${msg.clClearStep1Desc}</div>
                    </div>
                    <div class="cld-footer" style="flex-direction:column;gap:6px;">
                        <button class="cld-btn cld-btn-export" id="ytf-cld-export-cont" style="flex:none;width:100%;">${msg.clClearExportBtn}</button>
                        <button class="cld-btn cld-btn-confirm" id="ytf-cld-skip-cont" style="flex:none;width:100%;">${msg.clClearSkipBtn}</button>
                        <button class="cld-btn cld-btn-cancel" id="ytf-cld-cancel1" style="flex:none;width:100%;">${msg.clClearCancelBtn}</button>
                    </div>
                </div>
            `);
            document.documentElement.appendChild(step1);
            document.getElementById('ytf-cld-cancel1').addEventListener('click', () => step1.remove());

            function proceedToStep2() {
                step1.remove();
                const step2 = document.createElement('div');
                step2.id = 'ytf-cl-confirm-overlay';
                step2.style.cssText = 'position:fixed;inset:0;z-index:2147483649;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;transform:translateZ(0);';
                step2.innerHTML = _trustedHTML(`
                    <div id="ytf-cl-confirm-dialog">
                        <div class="cld-hdr">
                            <div class="cld-title">${msg.clClearStep2Title}</div>
                            <div class="cld-desc">${msg.clClearStep2Desc}</div>
                        </div>
                        <div class="cld-footer">
                            <button class="cld-btn cld-btn-cancel" id="ytf-cld-cancel2">${msg.clClearCancelBtn}</button>
                            <button class="cld-btn cld-btn-danger" id="ytf-cld-confirm2">${msg.clClearConfirmBtn}</button>
                        </div>
                    </div>
                `);
                document.documentElement.appendChild(step2);
                document.getElementById('ytf-cld-cancel2').addEventListener('click', () => step2.remove());
                document.getElementById('ytf-cld-confirm2').addEventListener('click', () => {
                    step2.remove();
                    clList.querySelectorAll('.cl-inp').forEach(ta => { ta.value = ''; clAutoResize(ta); });
                    document.getElementById('ytf-cl-langcode').value = '';
                });
            }

            document.getElementById('ytf-cld-export-cont').addEventListener('click', () => {
                const langCode = document.getElementById('ytf-cl-langcode').value.trim();
                doExport(langCode, serialise(langCode));
                proceedToStep2();
            });
            document.getElementById('ytf-cld-skip-cont').addEventListener('click', proceedToStep2);
        });

        // ── 儲存 ──────────────────────────────────────────────────────────────
        document.getElementById('ytf-cl-save').addEventListener('click', () => {
            const langCode = document.getElementById('ytf-cl-langcode').value.trim();
            const jsonStr  = serialise(langCode);
            GM_setValue(STORAGE_KEY_CUSTOM_LANG, jsonStr);
            invalidateCustomLangCache();
            buildTooltipCache();
            closeEditor();
            // 若自訂語系已啟用，重繪設定面板使新翻譯立即生效
            if (config.useCustomLang) {
                renderSettings();
                renderQASettingsPanel();
            }
        });
    }

    // ── 自訂篩選字詞面板 ────────────────────────────────────────────────────
    function openCustomMatchEditor() {
        document.getElementById('ytf-ck-overlay')?.remove();
        document.getElementById('ytf-ck-style')?.remove();

        const msg = getMsg();
        const tv  = (k) => container.style.getPropertyValue(k).trim();
        const isDarkTheme = getActivePanelThemeKey() !== 'light';

        // ── 定義面板的列（match key → 類型顯示名稱）────────────────────────
        const CK_ROWS = [
            { key: 'liveMatch',           labelKey: 'optLive'     },
            { key: 'podcastMatch',        labelKey: 'optPodcast'  },
            { key: 'mixMatch',            labelKey: 'optMix'      },
            { key: 'playlistMatch',       labelKey: 'optPlaylist' },
            { key: 'unitSecondMatch',     labelKey: 'unitSecondLabel' },
            { key: 'unitMinuteMatch',     labelKey: 'unitMinuteLabel' },
            { key: 'unitHourMatch',       labelKey: 'unitHourLabel'   },
            { key: 'unitDayMatch',        labelKey: 'unitDayLabel'    },
            { key: 'unitWeekMatch',       labelKey: 'unitWeekLabel'   },
            { key: 'unitMonthMatch',      labelKey: 'unitMonthLabel'  },
            { key: 'unitYearMatch',       labelKey: 'unitYearLabel'   },
        ];

        const styleEl = document.createElement('style');
        styleEl.id = 'ytf-ck-style';
        styleEl.textContent = `
            #ytf-ck-editor {
                pointer-events:auto;position:absolute;
                border-radius:14px;overflow:hidden;
                border:1px solid ${tv('--t-panel-border')};
                background:${tv('--t-panel-bg')};
                box-shadow:0 10px 40px ${tv('--t-panel-shadow')};
                font-family:sans-serif;font-size:13px;
                color:${tv('--t-text-main')};
                display:flex;flex-direction:column;
                width:520px;min-width:420px;max-height:90vh;min-height:280px;
                isolation:isolate;
            }
            #ytf-ck-resize-t, #ytf-ck-resize-b {
                position:absolute;left:0;right:0;height:6px;cursor:ns-resize;z-index:10;
            }
            #ytf-ck-resize-t { top:-3px; }
            #ytf-ck-resize-b { bottom:-3px; }
            #ytf-ck-editor .ck-hdr {
                background:${tv('--t-panel-bg')};
                border-bottom:1px solid ${tv('--t-divider')};
                font-size:12px;font-weight:700;color:${tv('--t-text-main')};
                display:flex;align-items:stretch;height:44px;box-sizing:border-box;flex-shrink:0;
                position:relative;z-index:1;will-change:transform;
            }
            #ytf-ck-editor .ck-hdr-title {
                flex:1;display:flex;align-items:center;padding:0 15px;cursor:move;user-select:none;
            }
            #ytf-ck-editor .ck-hdr-div { width:1px;background:${tv('--t-divider')};flex-shrink:0; }
            #ytf-ck-editor .ck-hdr-close {
                width:44px;border-radius:0 14px 0 0;border:none;
                background:transparent;color:${tv('--t-text-muted')};
                font-size:14px;cursor:pointer;flex-shrink:0;
                display:flex;align-items:center;justify-content:center;
                transition:background 0.15s,color 0.15s;
            }
            #ytf-ck-editor .ck-hdr-close:hover { background:${tv('--t-close-hover-bg')};color:${tv('--t-text-main')}; }
            #ytf-ck-editor .ck-notice {
                padding:8px 15px;font-size:11px;
                color:${tv('--t-text-main')};
                background:${tv('--t-panel-bg')};
                border-bottom:1px solid ${tv('--t-divider')};
                flex-shrink:0;line-height:1.5;
                position:relative;z-index:1;will-change:transform;
            }
            #ytf-ck-editor .ck-notice strong { color:${tv('--t-switch-on')}; }
            /* grid: num(28px) gap(8px) type-label(120px) gap(8px) current(1fr) gap(8px) custom(1fr) scroll(8px) */
            #ytf-ck-editor .ck-g {
                display:grid;
                grid-template-columns:28px 8px var(--ck-type-col-w,120px) 8px var(--ck-content-col-w,160px) 8px var(--ck-content-col-w,160px) 8px;
                padding:0 15px;box-sizing:border-box;
            }
            #ytf-ck-editor .ck-col-headers {
                background:${tv('--t-panel-bg')};
                padding-top:5px;padding-bottom:4px;
                border-bottom:1px solid ${tv('--t-divider')};flex-shrink:0;
                font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
                position:relative;z-index:1;will-change:transform;
            }
            #ytf-ck-editor .ck-col-num { color:${tv('--t-text-main')};text-align:right; }
            #ytf-ck-editor .ck-col-type { color:${tv('--t-text-main')}; white-space:nowrap; }
            #ytf-ck-editor .ck-col-cur { color:${tv('--t-text-main')}; }
            #ytf-ck-editor .ck-col-cust { color:${tv('--t-text-main')}; font-weight:700; }
            #ytf-ck-editor .ck-badge {
                display:inline-block;font-size:8px;padding:1px 4px;
                border-radius:3px;margin-left:4px;vertical-align:middle;
            }
            #ytf-ck-editor .ck-badge-r {
                background:${isDarkTheme?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'};
                color:${tv('--t-text-muted')};border:1px solid ${tv('--t-divider')};
            }
            #ytf-ck-editor .ck-badge-e {
                background:${tv('--t-switch-on')}22;color:${tv('--t-switch-on')};
                border:1px solid ${tv('--t-switch-on')}55;
            }
            #ytf-ck-editor .ck-list {
                overflow-y:scroll;scrollbar-gutter:stable;
                overflow-x:hidden;padding:4px 0;flex:1;min-height:0;
                overscroll-behavior:contain;
            }
            #ytf-ck-editor .ck-list::-webkit-scrollbar { width:4px; }
            #ytf-ck-editor .ck-list::-webkit-scrollbar-thumb { background:${tv('--t-pill-border')};border-radius:4px; }
            #ytf-ck-editor .ck-row {
                padding-top:5px;padding-bottom:5px;
                border-bottom:1px solid ${tv('--t-card-divider')};
                align-items:center;
            }
            #ytf-ck-editor .ck-num {
                font-size:10px;color:${tv('--t-text-main')};font-variant-numeric:tabular-nums;text-align:right;
            }
            #ytf-ck-editor .ck-type-cell {
                font-size:11px;color:${tv('--t-text-main')};white-space:nowrap;
            }
            #ytf-ck-editor .ck-cur-cell {
                font-size:11px;color:${tv('--t-text-main')};
                background:${isDarkTheme?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)'};
                border:1px solid ${tv('--t-input-border')};border-radius:5px;
                padding:3px 7px;min-width:0;box-sizing:border-box;
                font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            }
            #ytf-ck-editor .ck-inp-wrap { position:relative;min-width:0; }
            #ytf-ck-editor .ck-inp {
                width:100%;border-radius:5px;padding:3px 24px 3px 7px;font-size:11px;
                outline:none;min-width:0;
                background:${tv('--t-input-bg')};
                border:1px solid ${tv('--t-input-border')};
                color:${tv('--t-input-text')};
                transition:border-color 0.15s;box-sizing:border-box;
                font-family:monospace;
            }
            #ytf-ck-editor .ck-inp:focus { border-color:${tv('--t-switch-on')}; }
            #ytf-ck-editor .ck-inp::placeholder { color:${tv('--t-text-muted')};opacity:0.5;font-family:sans-serif; }
            #ytf-ck-editor .ck-inp-clear {
                position:absolute;right:4px;top:50%;transform:translateY(-50%);
                width:16px;height:16px;border:none;background:transparent;
                color:${tv('--t-text-muted')};font-size:13px;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                opacity:0;transition:opacity 0.15s;padding:0;
            }
            #ytf-ck-editor .ck-inp-wrap:hover .ck-inp-clear,
            #ytf-ck-editor .ck-inp:focus ~ .ck-inp-clear { opacity:1; }
            #ytf-ck-editor .ck-inp-clear:hover { color:${tv('--t-text-main')}; }
            #ytf-ck-editor .ck-footer {
                display:flex;align-items:center;gap:8px;
                padding:10px 23px 12px 15px;
                border-top:1px solid ${tv('--t-divider')};
                background:${tv('--t-panel-bg')};flex-shrink:0;
                position:relative;z-index:1;
            }
            #ytf-ck-editor .ck-btn {
                padding:5px 12px;border-radius:7px;border:none;
                font-size:11.5px;font-weight:600;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                transition:background 0.15s,color 0.15s;
            }
            #ytf-ck-editor .ck-btn:active { opacity:0.82; }
            #ytf-ck-editor .ck-btn-reset {
                background:${tv('--t-danger-bg')};
                border:1px solid ${tv('--t-danger-border')};
                color:${tv('--t-danger-text')};
            }
            #ytf-ck-editor .ck-btn-reset:hover {
                background:${tv('--t-danger-hover-bg')};
                border-color:${tv('--t-danger-hover-border')};
            }
            #ytf-ck-editor .ck-btn-secondary {
                background:${tv('--t-btn-bg')};border:1px solid ${tv('--t-input-border')};
                color:${tv('--t-btn-text')};
            }
            #ytf-ck-editor .ck-btn-secondary:hover {
                background:${tv('--t-btn-hover')};color:${tv('--t-btn-text-hover')};
            }
            #ytf-ck-editor .ck-btn-save {
                background:${tv('--t-switch-on')};color:${tv('--t-switch-on-text')||'#fff'};
                border:none;font-weight:700;
                transition:filter 0.15s,box-shadow 0.15s;
                box-shadow:${tv('--t-primary-shadow')};
            }
            #ytf-ck-editor .ck-btn-save:hover { filter:brightness(1.12);box-shadow:${tv('--t-primary-hover-shadow')}; }
        `;
        document.head.appendChild(styleEl);

        const ckOverlay = document.createElement('div');
        ckOverlay.id = 'ytf-ck-overlay';
        ckOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:transparent;pointer-events:none;transform:translateZ(0);';
        ckOverlay.innerHTML = _trustedHTML(`
            <div id="ytf-ck-editor">
                <div id="ytf-ck-resize-t"></div>
                <div class="ck-hdr">
                    <span class="ck-hdr-title" id="ytf-ck-title-handle">${msg.ckTitle}</span>
                    <div class="ck-hdr-div"></div>
                    <button class="ck-hdr-close" id="ytf-ck-close">✕</button>
                </div>
                <div class="ck-notice">⚡ ${msg.ckNoticeHigh}</div>
                <div class="ck-g ck-col-headers">
                    <div class="ck-col-num">#</div><div></div>
                    <div class="ck-col-type">類型</div><div></div>
                    <div class="ck-col-cur">目前套用 <span class="ck-badge ck-badge-r">唯讀</span></div>
                    <div></div>
                    <div class="ck-col-cust">自訂字詞 <span class="ck-badge ck-badge-e">優先套用</span></div>
                    <div></div>
                </div>
                <div class="ck-list" id="ytf-ck-list"></div>
                <div class="ck-footer">
                    <button class="ck-btn ck-btn-reset" id="ytf-ck-reset">${msg.ckBtnReset}</button>
                    <span style="flex:1"></span>
                    <label class="ck-btn ck-btn-secondary" style="cursor:pointer;">
                        ${msg.ckBtnImport}
                        <input type="file" accept=".json" id="ytf-ck-file-inp" style="display:none">
                    </label>
                    <button class="ck-btn ck-btn-secondary" id="ytf-ck-export">${msg.ckBtnExport}</button>
                    <span style="flex:1"></span>
                    <button class="ck-btn ck-btn-secondary" id="ytf-ck-cancel">${msg.ckBtnCancel}</button>
                    <button class="ck-btn ck-btn-save" id="ytf-ck-save">${msg.ckBtnSave}</button>
                </div>
                <div id="ytf-ck-resize-b"></div>
            </div>
        `);
        document.documentElement.appendChild(ckOverlay);

        const prevPanel = qaSettingsPanel.style.display === 'block' ? qaSettingsPanel : settings;
        isCustomMatchOpen = true;
        settings.style.display = 'none';
        qaSettingsPanel.style.display = 'none';
        host.style.display = 'none';

        const ckEditor = document.getElementById('ytf-ck-editor');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const saved = GM_getValue(STORAGE_KEY_POS_CK, null);
            if (saved) {
                ckEditor.style.left = saved.left + 'px';
                ckEditor.style.top  = saved.top  + 'px';
                if (saved.height) ckEditor.style.height = Math.min(window.innerHeight * 0.9, Math.max(280, saved.height)) + 'px';
            } else {
                ckEditor.style.height = '480px';
                const w = ckEditor.offsetWidth  || 520;
                const h = ckEditor.offsetHeight || 480;
                ckEditor.style.left = Math.max(0, (window.innerWidth  - w) / 2) + 'px';
                ckEditor.style.top  = Math.max(0, (window.innerHeight - h) / 2) + 'px';
            }
            ckEditor.style.transform = 'none';
        }));

        makeDraggable(ckEditor, document.getElementById('ytf-ck-title-handle'));

        // 防止 wheel 事件冒泡到頁面
        ckEditor.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

        // 可調整高度
        const MIN_H = 280, MAX_H = () => window.innerHeight * 0.9;
        function makeResizable(handle, isTop) {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startY = e.clientY, startH = ckEditor.offsetHeight, startTop = ckEditor.offsetTop;
                document.body.style.cursor = 'ns-resize';
                function onMove(e) {
                    const dy = e.clientY - startY;
                    if (isTop) {
                        const newH = Math.min(MAX_H(), Math.max(MIN_H, startH - dy));
                        ckEditor.style.height = newH + 'px';
                        ckEditor.style.top = Math.max(0, startTop + (startH - newH)) + 'px';
                    } else {
                        ckEditor.style.height = Math.min(MAX_H(), Math.max(MIN_H, startH + dy)) + 'px';
                    }
                }
                function onUp() { document.body.style.cursor = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }
        makeResizable(document.getElementById('ytf-ck-resize-t'), true);
        makeResizable(document.getElementById('ytf-ck-resize-b'), false);

        const ckList = document.getElementById('ytf-ck-list');
        const patterns = Object.assign({}, config.customMatchPatterns || {});

        // 填入列表
        CK_ROWS.forEach(({ key, labelKey }, i) => {
            const row = document.createElement('div');
            row.className = 'ck-row ck-g';
            row.dataset.key = key;
            const num      = String(i + 1).padStart(2, '0');
            const typeLabel = msg[labelKey] || key;
            const currentVal = getEffectiveMatchStr(key);
            const customVal  = patterns[key] || '';
            row.innerHTML = _trustedHTML(`
                <span class="ck-num">${num}</span>
                <div></div>
                <div class="ck-type-cell">${typeLabel}</div>
                <div></div>
                <div class="ck-cur-cell"></div>
                <div></div>
                <div class="ck-inp-wrap">
                    <input class="ck-inp" type="text" spellcheck="false"
                           placeholder="${msg.ckPlaceholder}">
                    <button class="ck-inp-clear" tabindex="-1">✕</button>
                </div>
                <div></div>
            `);
            row.querySelector('.ck-cur-cell').textContent = currentVal;
            const inp = row.querySelector('.ck-inp');
            inp.value = customVal;
            row.querySelector('.ck-inp-clear').addEventListener('click', () => { inp.value = ''; inp.focus(); });
            ckList.appendChild(row);
        });

        // ── 自動計算面板寬度 ──────────────────────────────────────────────────
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const ruler = document.createElement('div');
            ruler.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;white-space:nowrap;left:-9999px;top:-9999px;';
            document.body.appendChild(ruler);

            // 量 type 欄（11px sans-serif）：type-cell 文字
            ruler.style.fontSize = '11px';
            ruler.style.fontFamily = 'sans-serif';
            ruler.style.fontWeight = 'normal';
            let maxTypeW = 0;
            ckList.querySelectorAll('.ck-type-cell').forEach(el => {
                ruler.textContent = el.textContent;
                maxTypeW = Math.max(maxTypeW, ruler.offsetWidth);
            });

            // 量內容欄：欄標題文字（9px sans-serif）、cur-cell（11px monospace）、placeholder（11px sans-serif）、inp值（11px monospace）
            // 欄標題
            ruler.style.fontSize = '9px';
            ruler.style.fontFamily = 'sans-serif';
            ruler.style.letterSpacing = '1.5px';
            ruler.style.textTransform = 'uppercase';
            const hdrCur  = document.querySelector('#ytf-ck-editor .ck-col-cur');
            const hdrCust = document.querySelector('#ytf-ck-editor .ck-col-cust');
            ruler.textContent = hdrCur  ? hdrCur.textContent  : '目前套用 唯讀';
            let maxContentW = ruler.offsetWidth;
            ruler.textContent = hdrCust ? hdrCust.textContent : '自訂字詞 優先套用';
            maxContentW = Math.max(maxContentW, ruler.offsetWidth);

            // 重設字型量其他元素
            ruler.style.fontSize = '11px';
            ruler.style.letterSpacing = '0';
            ruler.style.textTransform = 'none';

            ruler.style.fontFamily = 'monospace';
            ckList.querySelectorAll('.ck-row[data-key]').forEach(row => {
                // cur-cell 實際文字
                ruler.textContent = row.querySelector('.ck-cur-cell')?.textContent || '';
                maxContentW = Math.max(maxContentW, ruler.offsetWidth);
                // inp 現有值
                ruler.textContent = row.querySelector('.ck-inp')?.value || '';
                maxContentW = Math.max(maxContentW, ruler.offsetWidth);
            });

            // placeholder 文字
            ruler.style.fontFamily = 'sans-serif';
            ruler.textContent = msg.ckPlaceholder || '';
            maxContentW = Math.max(maxContentW, ruler.offsetWidth);

            document.body.removeChild(ruler);

            const typeColW    = Math.max(maxTypeW + 8, 80);
            const contentColW = Math.max(maxContentW + 24, 120); // 24 = padding + clear btn
            // grid: num(28)+gap(8)+type(typeColW)+gap(8)+cur(contentColW)+gap(8)+inp(contentColW)+scroll(8)+padding(30)
            const totalW = 28 + 8 + typeColW + 8 + contentColW * 2 + 8 + 8 + 30;
            const maxW   = window.innerWidth - 40;
            const finalW = Math.min(Math.max(totalW, 420), maxW);
            ckEditor.style.setProperty('--ck-type-col-w',    typeColW    + 'px');
            ckEditor.style.setProperty('--ck-content-col-w', contentColW + 'px');
            ckEditor.style.width = finalW + 'px';

            if (!GM_getValue(STORAGE_KEY_POS_CK, null)) {
                const h = ckEditor.offsetHeight || 480;
                ckEditor.style.left = Math.max(0, (window.innerWidth  - finalW) / 2) + 'px';
                ckEditor.style.top  = Math.max(0, (window.innerHeight - h) / 2) + 'px';
            }
        }));
        const closeEditor = () => {
            GM_setValue(STORAGE_KEY_POS_CK, { left: ckEditor.offsetLeft, top: ckEditor.offsetTop, height: ckEditor.offsetHeight });
            ckOverlay.remove();
            document.getElementById('ytf-ck-style')?.remove();
            isCustomMatchOpen = false;
            prevPanel.style.display = 'block';
            host.style.display = 'block';
            updateUI();
        };
        document.getElementById('ytf-ck-close').addEventListener('click', closeEditor);
        document.getElementById('ytf-ck-cancel').addEventListener('click', closeEditor);
        ckOverlay.addEventListener('click', (e) => { if (e.target === ckOverlay) closeEditor(); });

        // 重置全部
        document.getElementById('ytf-ck-reset').addEventListener('click', () => {
            ckList.querySelectorAll('.ck-inp').forEach(inp => { inp.value = ''; });
        });

        // 儲存
        document.getElementById('ytf-ck-save').addEventListener('click', () => {
            const result = {};
            ckList.querySelectorAll('.ck-row[data-key]').forEach(row => {
                const v = row.querySelector('.ck-inp').value.trim();
                if (v) result[row.dataset.key] = v;
            });
            config.customMatchPatterns = result;
            GM_setValue(STORAGE_KEY_CFG, config);
            closeEditor();
            renderSettings();
            renderQASettingsPanel();
        });

        // ── 匯出 ──────────────────────────────────────────────────────────────
        document.getElementById('ytf-ck-export').addEventListener('click', () => {
            const patterns = {};
            ckList.querySelectorAll('.ck-row[data-key]').forEach(row => {
                const v = row.querySelector('.ck-inp').value.trim();
                if (v) patterns[row.dataset.key] = v;
            });
            const jsonStr = JSON.stringify({ version: 1, customMatchPatterns: patterns }, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'ytf-custom-keywords.json';
            document.body.appendChild(a); a.click();
            setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
        });

        // ── 匯入 ──────────────────────────────────────────────────────────────
        document.getElementById('ytf-ck-file-inp').addEventListener('change', function() {
            const file = this.files && this.files[0];
            if (!file) return;
            this.value = '';
            const reader = new FileReader();
            reader.onload = (ev) => {
                let data;
                try { data = JSON.parse(ev.target.result); }
                catch {
                    showCkInfoDialog(msg.ckImportErrorTitle, msg.ckImportErrorDesc);
                    return;
                }
                if (!data || typeof data.customMatchPatterns !== 'object' || Array.isArray(data.customMatchPatterns)) {
                    showCkInfoDialog(msg.ckImportErrorTitle, msg.ckImportErrorDesc);
                    return;
                }
                ckList.querySelectorAll('.ck-row[data-key]').forEach(row => {
                    const key = row.dataset.key;
                    if (data.customMatchPatterns[key] !== undefined) {
                        row.querySelector('.ck-inp').value = data.customMatchPatterns[key];
                    }
                });
                showCkInfoDialog(msg.ckImportTitle, '');
            };
            reader.readAsText(file, 'UTF-8');
        });

        function showCkInfoDialog(title, desc) {
            const existing = document.getElementById('ytf-ck-info-overlay');
            if (existing) existing.remove();
            const ov = document.createElement('div');
            ov.id = 'ytf-ck-info-overlay';
            ov.style.cssText = 'position:fixed;inset:0;z-index:2147483649;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
            ov.innerHTML = _trustedHTML(`
                <div id="ytf-cl-confirm-dialog">
                    <div class="cld-hdr">
                        <div class="cld-title">${title}</div>
                        ${desc ? `<div class="cld-desc">${desc}</div>` : ''}
                    </div>
                    <div class="cld-footer">
                        <button class="cld-btn cld-btn-confirm" id="ytf-cki-ok">${msg.ckImportOkBtn}</button>
                    </div>
                </div>
            `);
            document.documentElement.appendChild(ov);
            document.getElementById('ytf-cki-ok').addEventListener('click', () => ov.remove());
            ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        }
    }

    // ── 快速動作按鈕：InnerTube Context ──
    function getContext() {
        try {
            const ctx = pageWindow.ytcfg && pageWindow.ytcfg.data_ && pageWindow.ytcfg.data_.INNERTUBE_CONTEXT;
            if (!ctx) return null;
            return {
                client:       { ...ctx.client },
                user:         { ...ctx.user },
                request:      { ...ctx.request },
                clickTracking:{ ...ctx.clickTracking }
            };
        } catch(e) { return null; }
    }

    // ── 純 JS SHA-1（不依賴 crypto.subtle，避免 Userscript sandbox 限制）──
    function sha1(msg) {
        function rotate(n, s) { return (n << s) | (n >>> (32 - s)); }
        function toHex(n) { return ('00000000' + n.toString(16)).slice(-8); }

        const bytes = [];
        for (let i = 0; i < msg.length; i++) {
            const c = msg.charCodeAt(i);
            if (c < 128) { bytes.push(c); }
            else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); }
            else { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
        }

        const len = bytes.length;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        const bitLen = len * 8;
        bytes.push(0, 0, 0, 0,
            (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff,
            (bitLen >>> 8) & 0xff, bitLen & 0xff);

        let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE,
            h3 = 0x10325476, h4 = 0xC3D2E1F0;

        for (let i = 0; i < bytes.length; i += 64) {
            const w = [];
            for (let j = 0; j < 16; j++)
                w[j] = (bytes[i+j*4]<<24)|(bytes[i+j*4+1]<<16)|(bytes[i+j*4+2]<<8)|bytes[i+j*4+3];
            for (let j = 16; j < 80; j++)
                w[j] = rotate(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);

            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let j = 0; j < 80; j++) {
                let f, k;
                if (j < 20)      { f = (b & c) | (~b & d); k = 0x5A827999; }
                else if (j < 40) { f = b ^ c ^ d;           k = 0x6ED9EBA1; }
                else if (j < 60) { f = (b & c)|(b & d)|(c & d); k = 0x8F1BBCDC; }
                else             { f = b ^ c ^ d;           k = 0xCA62C1D6; }
                const temp = (rotate(a, 5) + f + e + k + w[j]) >>> 0;
                e = d; d = c; c = rotate(b, 30); b = a; a = temp;
            }
            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
        }
        return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
    }

    // ── SAPISIDHASH：YouTube API 認證（同步版）──
    function getSAPISIDHASH() {
        const getCookie = (name) => {
            const match = pageWindow.document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : null;
        };
        const sapisid = getCookie('__Secure-3PAPISID') || getCookie('SAPISID');
        if (!sapisid) return null;

        const ts = Math.floor(Date.now() / 1000);
        const origin = 'https://www.youtube.com';
        const hash = sha1(`${ts} ${sapisid} ${origin}`);
        return `SAPISIDHASH ${ts}_${hash}`;
    }

    // ── 快速動作按鈕：呼叫 YouTube Feedback API ──
    async function sendFeedback(token) {
        const context = getContext();
        if (!context || !token) throw new Error('missing context or token');

        const clientVersion = pageWindow.ytcfg?.data_?.INNERTUBE_CLIENT_VERSION || '2.20240101';
        const authHeader = getSAPISIDHASH();  // 同步，不會 throw

        const headers = {
            'Content-Type': 'application/json',
            'X-Youtube-Client-Name': '1',
            'X-Youtube-Client-Version': clientVersion,
            'X-Origin': 'https://www.youtube.com',
        };
        if (authHeader) headers['Authorization'] = authHeader;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://www.youtube.com/youtubei/v1/feedback?prettyPrint=false',
                headers,
                data: JSON.stringify({
                    context,
                    feedbackTokens: [token],
                    isFeedbackTokenUnencrypted: false,
                    shouldMerge: false
                }),
                withCredentials: true,
                onload: (resp) => {
                    console.log('[YTFilter QA] sendFeedback HTTP:', resp.status);
                    if (resp.status >= 200 && resp.status < 300) {
                        try { resolve(JSON.parse(resp.responseText)); }
                        catch(e) { resolve({}); }
                    } else {
                        reject(new Error(`HTTP ${resp.status}`));
                    }
                },
                onerror: (err) => reject(new Error(`GM_xmlhttpRequest error: ${err.statusText || err}`)),
            });
        });
    }

    // ── 快速動作按鈕：執行反饋動作（含兩步驟流程）──
    // 成功時回傳 { undoToken }，失敗時 throw
    async function executeQAAction(item, key) {
        const qaData = getQAData(item);
        if (!qaData) {
            console.warn('[YTFilter QA] feedbackToken 取得失敗，可能是特殊卡片');
            throw new Error('token_missing');
        }

        const { hideToken, dontRecommendToken,
                hideUndoToken, dontRecommendUndoToken } = qaData;

        if (key === 'notInterested') {
            if (!hideToken) throw new Error('token_missing');
            const resp = await sendFeedback(hideToken);
            console.log('[YTFilter QA] notInterested isProcessed:',
                resp?.feedbackResponses?.[0]?.isProcessed);
            return { undoToken: hideUndoToken };

        } else if (key === 'dontRecommend') {
            if (!dontRecommendToken) throw new Error('token_missing');
            const resp = await sendFeedback(dontRecommendToken);
            console.log('[YTFilter QA] dontRecommend isProcessed:',
                resp?.feedbackResponses?.[0]?.isProcessed);
            return { undoToken: dontRecommendUndoToken };

        } else if (key === 'alreadyWatched') {
            // 兩步驟流程：
            // 步驟 1：送出 HIDE token，YouTube 會渲染 ytd-dismissal-reason-text-renderer
            // 步驟 2：從 DOM 取 index 0（已看過）的 feedbackToken 送出，再關閉 dialog
            if (!hideToken) throw new Error('token_missing');
            const resp = await sendFeedback(hideToken);
            console.log('[YTFilter QA] alreadyWatched step1 isProcessed:',
                resp?.feedbackResponses?.[0]?.isProcessed);
            const subToken = await waitForDismissalToken(0);
            if (subToken) {
                const resp2 = await sendFeedback(subToken);
                console.log('[YTFilter QA] alreadyWatched step2 isProcessed:',
                    resp2?.feedbackResponses?.[0]?.isProcessed);
            } else {
                console.warn('[YTFilter QA] alreadyWatched subToken 取得失敗');
            }
            closeDismissalDialog();
            return { undoToken: hideUndoToken };

        } else if (key === 'dontLike') {
            // 兩步驟流程：
            // 步驟 1：送出 HIDE token，YouTube 會渲染 ytd-dismissal-reason-text-renderer
            // 步驟 2：從 DOM 取 index 1（不喜歡）的 feedbackToken 送出，再關閉 dialog
            if (!hideToken) throw new Error('token_missing');
            const resp = await sendFeedback(hideToken);
            console.log('[YTFilter QA] dontLike step1 isProcessed:',
                resp?.feedbackResponses?.[0]?.isProcessed);
            const subToken = await waitForDismissalToken(1);
            if (subToken) {
                const resp2 = await sendFeedback(subToken);
                console.log('[YTFilter QA] dontLike step2 isProcessed:',
                    resp2?.feedbackResponses?.[0]?.isProcessed);
            } else {
                console.warn('[YTFilter QA] dontLike subToken 取得失敗');
            }
            closeDismissalDialog();
            return { undoToken: hideUndoToken };
        }

        throw new Error('unknown_key');
    }

    // ── 取得元件的 Polymer / 新框架資料（兩種元件框架通用）──
    // ⚠ YouTube 於 2026-06 將部分卡片元件從 Polymer 換成新的元件框架，
    //   資料改放在 rawProps.data（一個需要呼叫的 getter 函式），
    //   不再是單純的 .data / .__data / .__dataHost.__data 屬性。
    //   此函式優先嘗試新框架，找不到再 fallback 回舊版 Polymer 路徑
    //   （部分元件如 dialog 可能尚未轉換，仍走舊路徑）。
    function getItemData(el) {
        try {
            if (typeof el?.rawProps?.data === 'function') {
                const d = el.rawProps.data();
                if (d) return d;
            }
        } catch(e) { /* 新框架嘗試失敗，繼續 fallback */ }
        return el?.data || el?.__data || el?.__dataHost?.__data;
    }

    // ── 從影片卡片取得 videoId（一般影片與 Shorts 通用）──
    // 供去重偵測與手動移除清單共用，確保兩處使用的 ID 格式完全一致。
    function getVideoIdFromItem(item) {
        const linkEl = item?.querySelector(YT_SELECTORS.videoTitleLink)
            || item?.querySelector(YT_SELECTORS.videoLinkWatch)
            || item?.querySelector(YT_SELECTORS.videoLinkShorts);
        if (!linkEl) return null;
        const href = linkEl.getAttribute('href') ?? '';
        const match = href.match(/[?&]v=([^&]+)/) || href.match(/\/shorts\/([^/?]+)/);
        return match ? match[1] : null;
    }

    // ── 等待 ytd-dismissal-reason-text-renderer 出現並取得指定 index 的 feedbackToken ──
    // YouTube 在收到 HIDE feedback 後非同步渲染這個 dialog，所以需要等待 DOM 出現。
    // timeout 預設 3000ms，超時回傳 null（不影響第一步已完成的 feedback）。
    function waitForDismissalToken(index, timeout = 3000) {
        return new Promise((resolve) => {
            const check = () => {
                const reasons = document.querySelectorAll('ytd-dismissal-reason-text-renderer');
                if (reasons.length > index) {
                    const data = getItemData(reasons[index]);
                    const token = data?.feedbackToken ?? null;
                    resolve(token);
                    return true;
                }
                return false;
            };
            if (check()) return;
            const observer = new MutationObserver(() => {
                if (check()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // ── 關閉 dismissal dialog（step2 送出後移除不需要的 pop-up）──
    // 直接將 dialog 元素隱藏，不觸發 cancelButton 的 feedbackToken，
    // 避免對 YouTube 後端送出非預期的取消訊號。
    function closeDismissalDialog() {
        const dialog = document.querySelector('tp-yt-paper-dialog');
        if (dialog) dialog.style.display = 'none';
    }


    // 用 imageName 找 listItem，不依賴索引，語言無關
    function getQAData(item) {
        try {
            const data = getItemData(item);
            const listItems = data?.content?.lockupViewModel?.metadata
                ?.lockupMetadataViewModel?.menuButton?.buttonViewModel?.onTap
                ?.innertubeCommand?.showSheetCommand?.panelLoadingStrategy
                ?.inlineContent?.sheetViewModel?.content?.listViewModel?.listItems;
            if (!listItems) {
                console.warn('[YTFilter QA] listItems 路徑取得失敗');
                return null;
            }

            const findByImageName = (name) =>
                listItems.find(li =>
                    li?.listItemViewModel?.leadingImage?.sources?.[0]
                        ?.clientResource?.imageName === name
                );

            const getFeedbackEndpoint = (li) =>
                li?.listItemViewModel?.rendererContext?.commandContext
                    ?.onTap?.innertubeCommand?.feedbackEndpoint;

            // ⚠ YouTube 於 2026-05 將 NOT_INTERESTED 改名為 HIDE
            const hideItem = findByImageName('HIDE');
            const drItem   = findByImageName('REMOVE');

            const hideFeedback = getFeedbackEndpoint(hideItem);
            const drFeedback   = getFeedbackEndpoint(drItem);

            // undo token 預存在 Polymer data 的 replaceEnclosingAction 裡
            const getUndoToken = (feedback) =>
                feedback?.actions?.[0]?.replaceEnclosingAction
                    ?.item?.notificationMultiActionRenderer
                    ?.buttons?.[0]?.buttonRenderer?.serviceEndpoint
                    ?.undoFeedbackEndpoint?.undoToken ?? null;

            return {
                hideToken:             hideFeedback?.feedbackToken ?? null,
                dontRecommendToken:    drFeedback?.feedbackToken ?? null,
                hideUndoToken:         getUndoToken(hideFeedback),
                dontRecommendUndoToken: getUndoToken(drFeedback),
            };
        } catch(e) {
            console.error('[YTFilter QA] getQAData error:', e);
            return null;
        }
    }

    // ── 取得動作對應的 SVG icon（從現有常數）──
    function getQAActionIcon(key) {
        const icons = {
            alreadyWatched: QA_ICON_ALREADY_WATCHED,
            notInterested:  QA_ICON_NOT_INTERESTED,
            dontLike:       QA_ICON_DONT_LIKE,
            dontRecommend:  QA_ICON_DONT_RECOMMEND,
        };
        return icons[key] ?? '';
    }

    // ── 建立或取得通知容器，同時隱藏卡片內容 ──
    function getOrCreateNotice(item) {
        item.style.position = 'relative';

        const innerContent = item.querySelector(YT_SELECTORS.lockupViewModel) || item.firstElementChild;
        const btnRow = item.querySelector('.qa-btn-row');

        let notice = item.querySelector('.qa-feedback-notice');
        if (!notice) {
            // 鎖住 min-height：在隱藏內容前先記錄高度，避免 flex 容器塌陷
            // 用 min-height 而非 height，讓 flex 佈局仍可正常運作
            if (!item.dataset.qaOrigHeight) {
                const h = item.getBoundingClientRect().height;
                item.dataset.qaOrigHeight = h;
                item.style.minHeight = h + 'px';
            }

            notice = document.createElement('div');
            notice.className = 'qa-feedback-notice';
            const frame = document.createElement('div');
            frame.className = 'qa-notice-frame';
            notice.appendChild(frame);
            // 先插入 notice（佔位），再隱藏 innerContent，避免高度空窗閃動
            item.appendChild(notice);
        }

        // 用 opacity 取代 visibility：opacity 不觸發 reflow，
        // 可避免 YouTube Polymer player reload 觸發的 race condition 閃動
        if (innerContent) innerContent.style.opacity = '0';
        if (btnRow) btnRow.style.opacity = '0';

        // 同時隱藏直播標籤（在 yt-lockup-view-model 之外的 badge 元素）
        item.querySelectorAll(YT_SELECTORS.badges).forEach(el => {
            if (!el.closest('.qa-feedback-notice')) el.style.opacity = '0';
        });

        return { notice, innerContent, btnRow };
    }

    // ── 初始化 frame 的固定 DOM 結構（只建立一次，之後只更新內容）──
    function initFrameDOM(frame, key, msg) {
        const qaActMap = {
            alreadyWatched: msg.qaActWatched,
            notInterested:  msg.qaActNotInt,
            dontLike:       msg.qaActDontLike,
            dontRecommend:  msg.qaActDontRec,
        };
        const actionLabel = qaActMap[key] ?? qaActMap.notInterested;
        const icon = getQAActionIcon(key);

        // 建立固定結構，之後只更新文字和狀態，不清空 DOM
        frame.innerHTML = _trustedHTML(`
            <div class="qa-notice-body">
                <div class="qa-notice-action"></div>
                <div class="qa-notice-msg"></div>
            </div>
            <div class="qa-notice-footer">
                <button class="qa-notice-undo"></button>
            </div>
        `);

        // 填入不會變的內容
        frame.querySelector('.qa-notice-action').textContent = actionLabel;
        // 按鈕內的 SVG（固定不變）
        const btn = frame.querySelector('.qa-notice-undo');
        const iconSpan = document.createElement('span');
        iconSpan.className = 'qa-btn-icon-wrap';
        iconSpan.innerHTML = _trustedHTML(icon);
        btn.appendChild(iconSpan);
    }

    // ── 渲染通知內容（直接更新子元素，不清空 frame）──
    // listenerRef：{ fn } 物件，讓同一個 listener wrapper 可以更換內部實作，
    // 避免 replaceChild 操作造成 frame 高度瞬間塌陷。
    function renderNoticeContent(notice, state, key, msg, undoToken, onUndo, onRetry) {
        const frame = notice.querySelector('.qa-notice-frame');
        if (!frame) return;

        // 若 frame 還沒初始化，先建立結構
        if (!frame.querySelector('.qa-notice-body')) {
            initFrameDOM(frame, key, msg);
            // 初始化時一次性綁定 listener wrapper，之後只換 .fn，不動 DOM
            const btn = frame.querySelector('.qa-notice-undo');
            btn._listenerRef = { fn: null };
            btn.addEventListener('click', (e) => {
                if (btn._listenerRef.fn) btn._listenerRef.fn(e);
            });
        }

        const msgEl = frame.querySelector('.qa-notice-msg');
        const btn = frame.querySelector('.qa-notice-undo');

        const setBtnText = (text) => {
            const wrap = btn.querySelector('.qa-btn-icon-wrap');
            Array.from(btn.childNodes).forEach(n => {
                if (n.nodeType === Node.TEXT_NODE) n.remove();
            });
            btn.insertBefore(document.createTextNode(text), wrap || null);
        };

        // 清除舊 listener，換成新的
        btn._listenerRef.fn = null;

        if (state === 'pending') {
            msgEl.textContent = msg.qaNoticePending;
            setBtnText(msg.qaNoticeWaited(1));
            btn.disabled = true;
            btn.style.visibility = '';
        } else if (state === 'done') {
            msgEl.textContent = msg.qaNoticeRemoved;
            setBtnText(msg.qaNoticeUndo);
            btn.disabled = false;
            btn.style.visibility = undoToken ? '' : 'hidden';
            if (undoToken && onUndo) btn._listenerRef.fn = onUndo;
        } else if (state === 'failed') {
            msgEl.textContent = msg.qaNoticeFailed;
            setBtnText(msg.qaNoticeRetry);
            btn.disabled = false;
            btn.style.visibility = '';
            if (onRetry) btn._listenerRef.fn = onRetry;
        }
    }

    // ── 處理中順計時器（已等待 N 秒）──
    function startPendingCountdown(notice, onTimeout) {
        let elapsed = 1;
        const timer = setInterval(() => {
            elapsed++;
            const btn = notice.querySelector('.qa-notice-undo');
            if (btn) {
                const text = getMsg().qaNoticeWaited(elapsed);
                const wrap = btn.querySelector('.qa-btn-icon-wrap');
                Array.from(btn.childNodes).forEach(n => {
                    if (n.nodeType === Node.TEXT_NODE) n.remove();
                });
                btn.insertBefore(document.createTextNode(text), wrap || null);
            }
            if (elapsed >= 10) {
                clearInterval(timer);
                onTimeout();
            }
        }, 1000);
        return timer;
    }

    // ── 主入口：顯示通知並管理狀態 ──
    function showQANotice(item, key, executePromise) {
        const msg = getMsg();
        const { notice, innerContent, btnRow } = getOrCreateNotice(item);

        // 復原函式：每次從 DOM 重新抓元素，避免設定變更後參考過期
        const restoreCard = (undoToken) => {
            notice.remove();
            if (innerContent) innerContent.style.opacity = '';
            const currentBtnRow = item.querySelector('.qa-btn-row');
            if (currentBtnRow) { currentBtnRow.style.opacity = ''; currentBtnRow.style.pointerEvents = ''; }
            item.style.minHeight = '';
            item.style.height = '';
            item.style.alignSelf = '';
            delete item.dataset.qaOrigHeight;
            // 從手動移除清單中移除，否則 processContent() 下次執行會再次隱藏此卡片
            item.dataset.qaRestored = '1';
            const vid = getVideoIdFromItem(item);
            if (vid) manuallyRemovedIds.delete(vid);
            if (item.style.display === 'none') item.style.display = '';
            // 恢復直播標籤
            item.querySelectorAll(YT_SELECTORS.badges).forEach(el => { el.style.opacity = ''; });
            if (undoToken) sendFeedback(undoToken).catch(err => console.error('[YTFilter QA] undo 失敗:', err));
        };

        const restoreOnly = () => {
            notice.remove();
            if (innerContent) innerContent.style.opacity = '';
            const currentBtnRow = item.querySelector('.qa-btn-row');
            if (currentBtnRow) { currentBtnRow.style.opacity = ''; currentBtnRow.style.pointerEvents = ''; }
            item.style.minHeight = '';
            item.style.height = '';
            item.style.alignSelf = '';
            delete item.dataset.qaOrigHeight;
            // 從手動移除清單中移除，否則 processContent() 下次執行會再次隱藏此卡片
            item.dataset.qaRestored = '1';
            const vid = getVideoIdFromItem(item);
            if (vid) manuallyRemovedIds.delete(vid);
            if (item.style.display === 'none') item.style.display = '';
            // 恢復直播標籤
            item.querySelectorAll(YT_SELECTORS.badges).forEach(el => { el.style.opacity = ''; });
        };

        // 初始顯示「處理中」
        renderNoticeContent(notice, 'pending', key, msg, null, null, null);
        const countdownTimer = startPendingCountdown(notice, () => {
            // 逾時 → 失敗
            renderNoticeContent(notice, 'failed', key, msg, null, null, (e) => {
                e.preventDefault(); e.stopPropagation();
                restoreOnly();
            });
        });

        // 等待 API 結果
        executePromise.then(({ undoToken }) => {
            clearInterval(countdownTimer);
            renderNoticeContent(notice, 'done', key, msg, undoToken,
                (e) => { e.preventDefault(); e.stopPropagation(); restoreCard(undoToken); },
                null
            );
        }).catch(() => {
            clearInterval(countdownTimer);
            renderNoticeContent(notice, 'failed', key, msg, null, null, (e) => {
                e.preventDefault(); e.stopPropagation();
                restoreOnly();

            });
        });
    }

    // ── 快速動作按鈕：注入函式（獨立於過濾邏輯之外）──
    function injectQAButtons(item) {
        // 若已標記注入但按鈕列不存在（例如 YouTube 原生復原後重建了卡片內容），
        // 清除標記以允許重新注入
        if (item.dataset.qaInjected && !item.querySelector('.qa-btn-row')) {
            delete item.dataset.qaInjected;
        }
        if (item.dataset.qaInjected) return; // 已注入，跳過

        // 插入點：yt-lockup-metadata-view-model（已是 position:relative）
        // 按鈕列絕對定位在右下角，自然對齊三個點按鈕
        const metaModel = item.querySelector(YT_SELECTORS.metadataViewModel);
        if (!metaModel) return;

        item.dataset.qaInjected = '1'; // 標記已注入

        const msg = getMsg();
        const btnRow = document.createElement('div');
        btnRow.className = 'qa-btn-row';
        // 若卡片目前處於「已移除」狀態，按鈕列維持隱藏
        if (item.querySelector('.qa-feedback-notice')) {
            btnRow.style.opacity = '0';
            btnRow.style.pointerEvents = 'none';
        }

        const btnDefs = [
            { key: 'alreadyWatched', icon: QA_ICON_ALREADY_WATCHED,  configKey: 'qaShowAlreadyWatched',  title: msg.qaLabelWatched  },
            { key: 'notInterested',  icon: QA_ICON_NOT_INTERESTED,   configKey: 'qaShowNotInterested',   title: msg.qaLabelNotInt   },
            { key: 'dontLike',       icon: QA_ICON_DONT_LIKE,        configKey: 'qaShowDontLike',        title: msg.qaLabelDontLike },
            { key: 'dontRecommend',  icon: QA_ICON_DONT_RECOMMEND,   configKey: 'qaShowDontRecommend',   title: msg.qaLabelDontRec  },
        ];

        // 預先取得 qaData 判斷哪些 token 存在
        const qaDataForBtns = getQAData(item);

        btnDefs.forEach(({ key, icon, configKey, title }) => {
            if (!config[configKey]) return;
            // 若 token 不存在（特殊卡片），不顯示對應按鈕
            if (qaDataForBtns) {
                if ((key === 'notInterested' || key === 'alreadyWatched' || key === 'dontLike')
                    && !qaDataForBtns.hideToken) return;
                if (key === 'dontRecommend' && !qaDataForBtns.dontRecommendToken) return;
            }
            const btn = document.createElement('button');
            btn.className = 'qa-btn';
            btn.setAttribute('data-tooltip', title);
            btn.innerHTML = _trustedHTML(icon);
            btn.dataset.qaKey = key;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                item._qaLastKey = key;
                // 本次動作開始，清除先前的復原標記
                delete item.dataset.qaRestored;
                // 在發送前先取得 videoId，供成功後記入手動移除清單
                const videoId = getVideoIdFromItem(item);
                const promise = executeQAAction(item, key).then(result => {
                    // 成功後將此影片 ID 加入本次工作階段的手動移除清單，
                    // 防止 processContent() 重新執行時因重複偵測順序變動而重新顯示。
                    // 若使用者在 API 回應前已按下復原，則不再加入（防競態）。
                    if (videoId && !item.dataset.qaRestored) manuallyRemovedIds.add(videoId);
                    return result;
                });
                showQANotice(item, key, promise);
            });
            bindTooltip(btn, 'qa');
            btnRow.appendChild(btn);
        });

        if (btnRow.children.length === 0) return;

        metaModel.appendChild(btnRow);

        // 觸發顯示：mouseenter 時動態計算對齊三個點的位置
        item.addEventListener('mouseenter', () => {
            const menuDiv = item.querySelector(YT_SELECTORS.menuButton);
            if (menuDiv) {
                const menuRect = menuDiv.getBoundingClientRect();
                const metaRect = metaModel.getBoundingClientRect();
                // 三個點中心距 metaModel 右邊緣的距離
                const menuCenterFromRight = metaRect.right - (menuRect.left + menuRect.width / 2);
                // 讓我們最右邊按鈕的中心對齊三個點中心
                btnRow.style.right = (menuCenterFromRight - 18) + 'px'; // 18 = 按鈕半徑 36/2
            }
            btnRow.classList.add('qa-visible');
        });
        item.addEventListener('mouseleave', () => btnRow.classList.remove('qa-visible'));
    }

        // ── 快速動作按鈕：獨立掃描（不受過濾邏輯限制）──
    function scanAndInjectQAButtons() {
        if (!isHomePage()) return;
        document.querySelectorAll(GRID_SELECTOR).forEach(item => {
            injectQAButtons(item);
        });
    }

        function processContent() {
        if (!isHomePage()) return;
        const msg = getMsg();
        let hasChanged = false;

        // 重複影片過濾：每次掃描建立新的 Set，確保跨次掃描不互相干擾
        const seenVideoIds = new Set();

        document.querySelectorAll(GRID_SELECTOR).forEach(item => {

            // 正在顯示 QA 通知的卡片跳過過濾，避免 MutationObserver 觸發時錯誤隱藏
            if (item.querySelector('.qa-feedback-notice')) return;

            // 取得影片 ID，用於重複偵測（與手動移除清單共用同一取值邏輯）
            const videoId = getVideoIdFromItem(item);

            if (videoId) {
                // 使用者本次已主動移除此影片，直接隱藏，不受去重邏輯順序影響
                if (manuallyRemovedIds.has(videoId)) {
                    if (item.style.display !== 'none') {
                        item.style.setProperty('display', 'none', 'important');
                        hasChanged = true;
                    }
                    return;
                }
                if (seenVideoIds.has(videoId)) {
                    if (item.style.display !== "none") {
                        item.style.setProperty("display", "none", "important");
                        hasChanged = true;
                    }
                    return;
                } else {
                    seenVideoIds.add(videoId);
                }
            }

            const channelName = getChannelName(item);

            // 1. 白名單頭像按鈕注入
            const avatarContainer = item.querySelector(YT_SELECTORS.avatarContainer) || item.querySelector(YT_SELECTORS.avatarContainerFB);
            if (avatarContainer) {
                let injector = avatarContainer.querySelector('.wl-avatar-container');
                if (!injector) {
                    if (getComputedStyle(avatarContainer).position === 'static') {
                        avatarContainer.style.position = 'relative';
                    }
                    injector = document.createElement('div');
                    injector.className = 'wl-avatar-container';
                    avatarContainer.appendChild(injector);
                }

                // ── 盾牌按鈕（白名單模式）──
                let wlBtn = injector.querySelector('.wl-avatar-btn');
                if (!wlBtn) {
                    wlBtn = document.createElement('div');
                    wlBtn.className = 'wl-avatar-btn';
                    wlBtn.innerHTML = _trustedHTML(ADD_AVATAR_SVG);
                    injector.appendChild(wlBtn);

                    wlBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentName = getChannelName(item);
                        if (!currentName || !activeWhitelistMode) return;

                        let list = getActiveList();
                        if (list.includes(currentName)) {
                            list = list.filter(n => n !== currentName);
                        } else {
                            list.push(currentName);
                        }
                        setActiveList(list);
                        GM_setValue(STORAGE_KEY_CFG, config);
                        // 白名單變更後重建 Set 快取
                        musicWhitelistSet  = new Set(config.whitelistMusic);
                        memberWhitelistSet = new Set(config.whitelistMember);
                        renderWhitelistPanel(list.includes(currentName) ? currentName : null);
                        processContent();
                    };
                    bindTooltip(wlBtn, 'panel');
                }

                if (activeWhitelistMode) {
                    const currentList = getActiveList();
                    if (currentList.includes(channelName)) {
                        wlBtn.classList.add('active');
                        wlBtn.setAttribute('data-tooltip', msg.wlQuickRemove);
                    } else {
                        wlBtn.classList.remove('active');
                        wlBtn.setAttribute('data-tooltip', msg.wlQuickAdd);
                    }
                }

                // ── 漏斗按鈕（片名過濾模式）──
                let tfBtn = injector.querySelector('.tf-avatar-btn');
                if (!tfBtn) {
                    tfBtn = document.createElement('div');
                    tfBtn.className = 'tf-avatar-btn';
                    tfBtn.innerHTML = _trustedHTML(ADD_AVATAR_SVG);
                    tfBtn.setAttribute('data-tooltip', msg.tfAvatarTip);
                    injector.appendChild(tfBtn);

                    tfBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentName = getChannelName(item);
                        if (!currentName) return;
                        // 填入片名過濾面板的頻道輸入欄
                        const channelInput = shadow.getElementById('tf-channel-input');
                        if (channelInput) {
                            channelInput.value = currentName;
                            channelInput.focus();
                        }
                    };
                    bindTooltip(tfBtn, 'panel');
                }
            }

            // --- 過濾邏輯（Fail Fast：找到第一個符合條件即停止）---

            if (!config.enabled) {
                 if (item.style.display === "none") {
                    item.style.display = "";
                    hasChanged = true;
                }
                return;
            }

            let shouldBeHidden = false;

            // 2. 文字比對（成本最低，優先執行）
            const cleanText = item.innerText.toLowerCase().trim();
            if (config.hideLive     && msg.liveMatch.test(cleanText))       shouldBeHidden = true;
            else if (config.hideUpcoming && item.querySelector(YT_SELECTORS.upcomingButton)) shouldBeHidden = true;
            else if (config.hidePodcast  && msg.podcastMatch.test(cleanText))  shouldBeHidden = true;
            else if (config.hideMix      && msg.mixMatch.test(cleanText))      shouldBeHidden = true;
            else if (config.hidePlaylist && msg.playlistMatch.test(cleanText)) shouldBeHidden = true;

            // 3. 音樂影片（DOM 查找 + 白名單）
            if (!shouldBeHidden && config.hideMusic) {
                const musicIcon = item.querySelector(`path[d="${MUSIC_PATH_D}"]`);
                if (musicIcon && !musicWhitelistSet.has(channelName)) {
                    shouldBeHidden = true;
                }
            }

            // 4. 會員限定（DOM 查找 + 白名單）
            if (!shouldBeHidden && config.hideMember) {
                 const memberIcon = item.querySelector(`path[d="${MEMBER_PATH_D}"]`);
                 if (memberIcon && !memberWhitelistSet.has(channelName)) {
                     shouldBeHidden = true;
                 }
            }

            // 4.5. 一般影片過濾（排除所有特殊類型後剩餘者）
            // 一般影片 = 不是以下任何一種特殊類型：直播、待播、Podcast、合集混音、播放清單、音樂影片、會員限定
            if (!shouldBeHidden && config.hideRegular) {
                const cleanTextR = item.innerText.toLowerCase().trim();
                const isLive     = msg.liveMatch.test(cleanTextR);
                const isUpcoming = !!item.querySelector(YT_SELECTORS.upcomingButton);
                const isPodcast  = msg.podcastMatch.test(cleanTextR);
                const isMix      = msg.mixMatch.test(cleanTextR);
                const isPlaylist = msg.playlistMatch.test(cleanTextR);
                const isMusic    = !!item.querySelector(`path[d="${MUSIC_PATH_D}"]`);
                const isMember   = !!item.querySelector(`path[d="${MEMBER_PATH_D}"]`);
                const isSpecial  = isLive || isUpcoming || isPodcast || isMix || isPlaylist || isMusic || isMember;
                if (!isSpecial) {
                    shouldBeHidden = true;
                }
            }

            // 4.6. 片名過濾黑名單（精準比對 h3 片名）
            if (!shouldBeHidden && config.hideTitleFilter && config.titleFilterList.length > 0) {
                const titleEl = item.querySelector(YT_SELECTORS.videoTitleH3);
                const titleText = (titleEl?.getAttribute('title') || titleEl?.textContent || '').trim();
                if (titleText) {
                    for (const entry of config.titleFilterList) {
                        const { pattern, channel } = entry;
                        // 有指定頻道時，頻道不符則跳過此規則
                        if (channel && channel !== channelName) continue;
                        const re = parseTitleFilterRule(pattern);
                        if (re && re.test(titleText)) { shouldBeHidden = true; break; }
                    }
                }
            }

            // 5. 已觀看（DOM 進度條 + 數學計算）
            if (!shouldBeHidden && config.hideWatched) {
                const progressEl = item.querySelector(YT_SELECTORS.progressBar);
                if (progressEl) {
                    const styleWidth = progressEl.style.width || "0%";
                    const progressPct = parseFloat(styleWidth);
                    const badge = item.querySelector(YT_SELECTORS.badgeText);
                    if (badge) {
                         const durationSec = parseDurationStr(badge.textContent);
                         const watchedSec = durationSec * (progressPct / 100);
                         if (progressPct >= config.watchedPercent || watchedSec >= config.watchedSeconds) {
                             shouldBeHidden = true;
                         }
                    } else {
                        if (progressPct >= config.watchedPercent) shouldBeHidden = true;
                    }
                }
            }

            // 6. 影片年齡（Regex 解析，成本最高，最後執行）
            if (!shouldBeHidden) {
                const labels = item.querySelectorAll(TIME_SELECTOR);
                for (let label of labels) {
                    if (shouldHideVideo(label.textContent, msg)) { shouldBeHidden = true; break; }
                }
            }

            const isActuallyEmpty = item.innerText.trim() === "" && item.querySelectorAll('img').length === 0;
            if ((shouldBeHidden || isActuallyEmpty) && item.style.display !== "none") {
                item.style.setProperty("display", "none", "important");
                hasChanged = true;
            } else if (!shouldBeHidden && !isActuallyEmpty && item.style.display === "none") {
                item.style.display = "";
                hasChanged = true;
            }
        });

        if (hasChanged) window.dispatchEvent(new Event('resize'));
        const visibleCount = Array.from(document.querySelectorAll(GRID_SELECTOR)).filter(el => el.style.display !== "none" && el.offsetHeight > 0).length;
        if (visibleCount < MIN_VIDEO_COUNT && !isFetching && !hasReachedLimit && !isRefreshing) autoFetch().catch(err => console.error('[YTFilter] autoFetch 失敗:', err));
        updateBottomSpacer();
    }

    async function autoFetch() {
        if (!isHomePage() || !config.enabled || isFetching || hasReachedLimit) return;
        isFetching = true;
        updateUI();
        const start = Date.now();

        while (isHomePage()) {
            const currentVisible = Array.from(document.querySelectorAll(GRID_SELECTOR)).filter(el => el.style.display !== "none" && el.offsetHeight > 0).length;
            if (currentVisible >= MIN_VIDEO_COUNT || !config.enabled || (Date.now() - start) > FETCH_TIMEOUT_MS) {
                if (config.enabled && (Date.now() - start) > FETCH_TIMEOUT_MS) hasReachedLimit = true;
                break;
            }
            window.scrollBy(0, 2000);
            await new Promise(r => setTimeout(r, 1000));
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        const finalizeFetch = async () => {
            const delays = [1000, 1000];
            for (const delay of delays) {
                await new Promise(r => setTimeout(r, delay));
                if (!isHomePage() || !config.enabled) {
                    // 延遲期間使用者已離開首頁，中止並重置狀態以免阻塞下次進入
                    isFetching = false;
                    return;
                }
                document.querySelectorAll(GRID_SELECTOR).forEach(el => el.style.display = "");
                processContent();
                window.scrollBy(0, 1);
                await new Promise(r => setTimeout(r, 50));
                window.scrollBy(0, -1);
            }
            isFetching = false;
            updateUI();
            updateBottomSpacer();
        };

        await finalizeFetch();
    }

    function syncConfig() {
        const rawVal = parseFloat(shadow.getElementById('v-val').value);
        config.value = (isNaN(rawVal) || rawVal <= 0) ? 1 : rawVal;
        config.unit         = shadow.getElementById('v-unit').value;
        config.hideOldEnabled = shadow.getElementById('v-hide-old').checked;
        config.hideLive     = shadow.getElementById('v-live').checked;
        config.hideRegular  = shadow.getElementById('v-regular').checked;
        config.hideUpcoming = shadow.getElementById('v-upcoming').checked;
        config.hideMusic    = shadow.getElementById('v-music').checked;
        config.hideMember   = shadow.getElementById('v-member').checked;
        config.hidePodcast  = shadow.getElementById('v-podcast').checked;
        config.hideMix      = shadow.getElementById('v-mix').checked;
        config.hidePlaylist = shadow.getElementById('v-playlist').checked;
        config.hideWatched  = shadow.getElementById('v-watched').checked;
        const tfEl = shadow.getElementById('v-titlefilter');
        if (tfEl) config.hideTitleFilter = tfEl.checked;

        GM_setValue(STORAGE_KEY_CFG, config);
        musicWhitelistSet  = new Set(config.whitelistMusic);
        memberWhitelistSet = new Set(config.whitelistMember);
        hasReachedLimit = false;
        applyTheme();
        // 開關狀態影響 stepper 的可互動性
        const stepperDisabled = !config.hideOldEnabled;
        const stepper = shadow.getElementById('v-old-stepper-wrap');
        const unitSel = shadow.getElementById('v-unit');
        if (stepper) {
            stepper.style.opacity = stepperDisabled ? '0.35' : '1';
            stepper.style.pointerEvents = stepperDisabled ? 'none'  : '';
        }
        if (unitSel) {
            unitSel.style.opacity = stepperDisabled ? '0.35' : '1';
            unitSel.style.pointerEvents = stepperDisabled ? 'none'  : '';
        }
        document.querySelectorAll(GRID_SELECTOR).forEach(el => el.style.display = "");
        processContent();
        updateUI();
        updateBottomSpacer();
    }

    function renderSettings() {
        const msg = getMsg();
        const currentLang = getActiveLang();

        const wlBtnHTML = `<button class="wl-icon-btn" id="wl-music-btn" data-tooltip="${msg.wlTipMusic}">${SHIELD_SVG}</button>`;
        const wlBtnMemberHTML = `<button class="wl-icon-btn" id="wl-member-btn" data-tooltip="${msg.wlTipMember}">${SHIELD_SVG}</button>`;
        const wdBtnHTML = `<button class="wl-icon-btn" id="wd-btn" data-tooltip="${msg.wdTip}">${FILTER_SVG}</button>`;

        const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
        const oldDisabled = !config.hideOldEnabled;
        const generalTitle = msg.generalTitle;

        settings.innerHTML = _trustedHTML(`
            <div class="panel-header">
                <div class="panel-header-title">${GEAR_SVG}${generalTitle}</div>
                <div class="panel-header-divider"></div>
                <div class="panel-close-area" id="close-btn">${CLOSE_SVG}</div>
            </div>
            <div class="panel-body">
                <div class="section section-tall">
                    <div class="title" style="flex-direction:column;align-items:flex-start;gap:2px;margin-right:12px;">
                        <span>${msg.labelCustomMatch}</span>
                        <span style="font-size:10px;color:var(--t-text-muted);font-weight:normal;">${msg.labelCustomMatchSub}</span>
                    </div>
                    <div class="controls">
                        <button class="cl-edit-btn" id="ck-edit-btn">${msg.ckEditBtn}</button>
                        <label class="switch"><input type="checkbox" id="v-custom-match" ${config.useCustomMatch ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="hide-old-group">
                    <div class="hide-old-row1">
                        <div class="title">${msg.optHideOld}</div>
                        <label class="switch"><input type="checkbox" id="v-hide-old" ${config.hideOldEnabled ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                    <div class="hide-old-row2" id="v-old-stepper-wrap" style="${oldDisabled ? 'opacity:0.35;pointer-events:none;' : ''}">
                        <div class="stepper" id="v-old-stepper">
                            <button class="step-btn" id="minus">−</button>
                            <input type="number" id="v-val" value="${config.value}" step="any">
                            <button class="step-btn" id="plus">+</button>
                        </div>
                        <select id="v-unit">
                            ${TIME_UNIT_KEYS.map(u => {
                                const k = u.toLowerCase();
                                const label = msg[`unit${u}Label`] || u;
                                return `<option value="${k}" ${config.unit === k ? 'selected' : ''}>${label}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>
                <div class="section">
                    <div class="title">${msg.optRegular}</div>
                    <label class="switch">
                        <input type="checkbox" id="v-regular" ${config.hideRegular ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="section">
                    <div class="title">${msg.optLive}</div>
                    <label class="switch"><input type="checkbox" id="v-live" ${config.hideLive ? 'checked' : ''}><span class="slider"></span></label>
                </div>
                <div class="section">
                    <div class="title">${msg.optUpcoming}</div>
                    <label class="switch"><input type="checkbox" id="v-upcoming" ${config.hideUpcoming ? 'checked' : ''}><span class="slider"></span></label>
                </div>
                <div class="section">
                    <div class="title">${msg.optPodcast}</div>
                    <label class="switch"><input type="checkbox" id="v-podcast" ${config.hidePodcast ? 'checked' : ''}><span class="slider"></span></label>
                </div>
                <div class="section">
                    <div class="title">${msg.optMix}</div>
                    <label class="switch"><input type="checkbox" id="v-mix" ${config.hideMix ? 'checked' : ''}><span class="slider"></span></label>
                </div>
                <div class="section">
                    <div class="title">${msg.optPlaylist}</div>
                    <label class="switch"><input type="checkbox" id="v-playlist" ${config.hidePlaylist ? 'checked' : ''}><span class="slider"></span></label>
                </div>
                <div class="section">
                    <div class="title">${msg.optMusic}</div>
                    <div class="controls">
                        ${wlBtnHTML}
                        <label class="switch"><input type="checkbox" id="v-music" ${config.hideMusic ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="section">
                    <div class="title">${msg.optMember}</div>
                    <div class="controls">
                        ${wlBtnMemberHTML}
                        <label class="switch"><input type="checkbox" id="v-member" ${config.hideMember ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="section">
                    <div class="title">${msg.optWatched}</div>
                    <div class="controls">
                        ${wdBtnHTML}
                        <label class="switch"><input type="checkbox" id="v-watched" ${config.hideWatched ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="section">
                    <div class="title">${msg.optTitleFilter}</div>
                    <div class="controls">
                        <button class="wl-icon-btn" id="tf-btn" data-tooltip="${msg.tfTip}">${FILTER_SVG}</button>
                        <label class="switch"><input type="checkbox" id="v-titlefilter" ${config.hideTitleFilter ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </div>
            </div>
            <div class="adv-entry-row" id="adv-entry-btn">
                <div class="title">${msg.advancedSettings}</div>
                <span class="adv-entry-chevron">›</span>
            </div>
        `);

        shadow.getElementById('close-btn').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "none";
            settings.style.marginBottom = "";
            updateUI();
        };
        shadow.getElementById('v-hide-old').onchange = syncConfig;
        shadow.getElementById('minus').onclick = (e) => {
            e.stopPropagation();
            const input = shadow.getElementById('v-val');
            const val = parseFloat(input.value);
            if (val > 1) { input.value = val - 1; syncConfig(); }
        };
        shadow.getElementById('plus').onclick = (e) => {
            e.stopPropagation();
            const input = shadow.getElementById('v-val');
            input.value = parseFloat(input.value) + 1;
            syncConfig();
        };
        const inputVal = shadow.getElementById('v-val');
        inputVal.onchange = (e) => {
            e.stopPropagation();
            let val = parseFloat(inputVal.value);
            if (isNaN(val) || val <= 0) val = 1;
            config.value = val; inputVal.value = val; syncConfig();
        };
        inputVal.onclick = (e) => e.stopPropagation();
        shadow.getElementById('v-unit').onchange    = syncConfig;
        shadow.getElementById('v-live').onchange    = syncConfig;
        shadow.getElementById('v-regular').onchange = syncConfig;
        shadow.getElementById('v-upcoming').onchange = syncConfig;
        shadow.getElementById('v-music').onchange   = syncConfig;
        shadow.getElementById('v-member').onchange  = syncConfig;
        shadow.getElementById('v-podcast').onchange = syncConfig;
        shadow.getElementById('v-mix').onchange     = syncConfig;
        shadow.getElementById('v-playlist').onchange = syncConfig;
        shadow.getElementById('v-watched').onchange = syncConfig;
        shadow.getElementById('v-titlefilter').onchange = syncConfig;
        shadow.getElementById('v-custom-match').onchange = (e) => {
            config.useCustomMatch = e.target.checked;
            GM_setValue(STORAGE_KEY_CFG, config);
        };
        shadow.getElementById('ck-edit-btn').onclick = (e) => {
            e.stopPropagation();
            openCustomMatchEditor();
        };
        settings.onclick = (e) => e.stopPropagation();

        shadow.getElementById('wl-music-btn').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "none";
            whitelistPanel.style.display = "block";
            activeWhitelistMode = 'music';
            document.body.classList.add('tm-wl-mode-music');
            renderWhitelistPanel();
            positionPanel(whitelistPanel, STORAGE_KEY_POS_WL);
            updateUI();
        };
        bindTooltip(shadow.getElementById('wl-music-btn'), 'panel');
        shadow.getElementById('wl-member-btn').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "none";
            whitelistPanel.style.display = "block";
            activeWhitelistMode = 'member';
            document.body.classList.add('tm-wl-mode-member');
            renderWhitelistPanel();
            positionPanel(whitelistPanel, STORAGE_KEY_POS_WL);
            updateUI();
        };
        bindTooltip(shadow.getElementById('wl-member-btn'), 'panel');
        shadow.getElementById('wd-btn').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "none";
            watchedPanel.style.display = "block";
            renderWatchedPanel();
            positionPanel(watchedPanel, STORAGE_KEY_POS_WD);
            updateUI();
        };
        bindTooltip(shadow.getElementById('wd-btn'), 'panel');
        shadow.getElementById('tf-btn').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "none";
            titleFilterPanel.style.display = "block";
            document.body.classList.add('tm-tf-mode');
            renderTitleFilterPanel();
            positionPanel(titleFilterPanel, STORAGE_KEY_POS_TF);
            updateUI();
        };
        bindTooltip(shadow.getElementById('tf-btn'), 'panel');
        shadow.getElementById('adv-entry-btn').onclick = (e) => {
            e.stopPropagation();
            settings.style.display = "none";
            qaSettingsPanel.style.display = "block";
            renderQASettingsPanel();
            updateUI();
        };
    }

    // ── 清理殘留的 QA 通知卡片 ──
    // YouTube 的 Polymer 框架在 SPA 導航時會回收複用 ytd-rich-item-renderer，
    // 不重建外層 DOM，導致我們注入的 .qa-feedback-notice 殘留在新影片卡片上。
    // 每次路由至首頁時主動掃描並完整還原所有受影響的 renderer。
    function cleanupQANotices() {
        document.querySelectorAll('.qa-feedback-notice').forEach(notice => {
            const item = notice.closest(YT_SELECTORS.richItemRenderer);
            if (!item) { notice.remove(); return; }

            // 還原被隱藏的卡片內容
            const innerContent = item.querySelector(YT_SELECTORS.lockupViewModel) || item.firstElementChild;
            if (innerContent && innerContent !== notice) innerContent.style.opacity = '';
            const btnRow = item.querySelector('.qa-btn-row');
            if (btnRow) { btnRow.style.opacity = ''; btnRow.style.pointerEvents = ''; }
            item.querySelectorAll(YT_SELECTORS.badges)
                .forEach(el => { if (!el.closest('.qa-feedback-notice')) el.style.opacity = ''; });

            // 還原 renderer 的尺寸與自訂屬性
            item.style.minHeight = '';
            item.style.height = '';
            item.style.alignSelf = '';
            delete item.dataset.qaOrigHeight;

            notice.remove();
        });
    }

    function handleRoute() {
        if (isHomePage()) {
            isFetching = false;
            isRefreshing = false;
            host.style.display = "block";
            cleanupQANotices();
            renderSettings();
            updateUI();
            scanAndInjectQAButtons();
            scanAndBindTitleTooltips();
            processContent();
            applyGridColumns();
            // 延遲執行，等待 YouTube 卡片 DOM 渲染完畢後再插入 spacer
            setTimeout(updateBottomSpacer, 300);
        } else {
            host.style.display = "none";
            settings.style.display = "none";
            document.body.classList.remove('tm-wl-mode-music', 'tm-wl-mode-member', 'tm-tf-mode');
            tfEditIndex = -1;
            restoreTitleTooltips();
            hideTooltip();
            removeGridColumns();
            const spacer = document.getElementById(BOTTOM_SPACER_ID);
            if (spacer) spacer.remove();
        }
    }

    window.addEventListener("yt-navigate-finish", () => { isRefreshing = false; handleRoute(); });
    refreshArea.onclick = (e) => {
        e.stopPropagation(); hasReachedLimit = false; isRefreshing = true; updateUI();
        const logo = document.querySelector(YT_SELECTORS.topbarLogo) || document.querySelector(YT_SELECTORS.topbarLogoFB);
        if (logo) logo.click(); else window.location.reload();
    };

    const observer = new MutationObserver(() => {
        if (!isHomePage()) return;
        clearTimeout(processTimer);
        processTimer = setTimeout(() => {
            scanAndInjectQAButtons();
            scanAndBindTitleTooltips();
            if (config.enabled && !isFetching && !isRefreshing) {
                processContent();
            }
            updateBottomSpacer();
        }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => { if (isHomePage() && !document.getElementById("yt-filter-shadow-host")) document.documentElement.appendChild(host); }, 4000);

    handleRoute();
})();