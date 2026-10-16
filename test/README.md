# 回歸測試

用**實際從 YouTube 擷取的資料結構**建合成頁面，端到端驗證過濾邏輯。
不需要連 YouTube，也不受 reCAPTCHA 影響。

```bash
pip install playwright && playwright install chromium
python3 fixture.py          # 產生 fixture.html
python3 serve.py &          # 本機伺服器（需要 http:// 才能模擬 / 與 /watch 路徑）
python3 run.py              # 執行測試
```

涵蓋 11 個案例，分別在模擬的首頁（`/`）與播放頁（`/watch`）執行：

- 首頁格線卡片（有 `ytd-rich-item-renderer` 外層）與播放頁側欄卡片（裸 lockup）
- 時間門檻：新片保留、舊片隱藏
- 混合輯（`list=RD`）與一般播放清單（`list=PL`）的區分
- 正在直播（`badgeStyle = ..._LIVE`）隱藏
- 已結束的直播存檔：舊的因時間被擋、新的保留（不應被當成直播）
- Podcast 列舉值
- 會員卡片 `metadataRows` 末列為空陣列時，時間仍須解析正確

改動過濾邏輯後請重跑；新增情境時把真實資料結構加進 `fixture.py` 的 `CARDS`。
