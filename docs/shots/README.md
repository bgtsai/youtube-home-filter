# 截圖用的骨架示意頁面

程式改版後要重做 README 截圖時，複用這裡的檔案，不要重寫。

| 檔案 | 用途 |
|---|---|
| `mock.py` | 產生 `mock.html`／`index.html`：YouTube 首頁的骨架示意頁面。卡片是真的 `yt-lockup-view-model` 並掛上真實結構的 `rawProps.data()`，所以腳本會當成真卡片處理；畫面上的文字一律是色條、縮圖是帶播放箭頭的灰方塊，不含任何真實 YouTube 內容 |
| `shoot.py` | 用 Playwright 注入 `youtube-home-filter.user.js`，展開各面板並截圖，中英文各一套，輸出到 `docs/images/` |

```bash
python3 mock.py && cp mock.html index.html && python3 shoot.py
```

注意事項：

- 縮圖必須是 `<img>`。腳本有一條「沒有文字又沒有 `<img>` 就視為空卡片」的收尾邏輯，純 SVG 會讓整頁被隱藏。
- 卡片數要維持在 `MIN_VIDEO_COUNT`（100）以上，否則會一直觸發自動補抓，截不到靜止狀態。
- `shoot.py` 會覆寫 `attachShadow` 強制 `mode:'open'`，只影響截圖環境。
