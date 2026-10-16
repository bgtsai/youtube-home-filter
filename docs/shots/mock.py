# -*- coding: utf-8 -*-
"""產生 YouTube 首頁的骨架屏（skeleton）示意頁面，供截圖使用。
卡片是真的 yt-lockup-view-model + rawProps.data()，腳本會當成真實卡片處理，
因此注入的按鈕、頭像盾牌、tooltip 都會真的出現；畫面上沒有任何真實 YouTube 內容。"""
import json

AGES = ["1 小時前", "3 小時前", "5 小時前", "8 小時前",
        "2 小時前", "6 小時前", "9 小時前", "4 小時前"]
BLOCK = "█"

def card(i, age):
    data = {
        "contentType": "LOCKUP_CONTENT_TYPE_VIDEO",
        "contentImage": {"thumbnailViewModel": {"overlays": [
            {"thumbnailBottomOverlayViewModel": {"badges": [
                {"thumbnailBadgeViewModel": {
                    "badgeStyle": "THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT",
                    "text": "12:34"}}]}}]}},
        "metadata": {"lockupMetadataViewModel": {
            "title": {"content": " "},
            "metadata": {"contentMetadataViewModel": {"metadataRows": [
                {"metadataParts": [{"text": {"content": "Channel %d" % (i + 1)}},
                                   {"text": {"content": age}}]}]}}}}
    }
    w1, w2 = (94, 61) if i % 3 else (88, 45)
    # 標題的 title 屬性用色塊字元，讓增強 tooltip 有東西可顯示又不含真實文字
    tt = (BLOCK * 15) + " " + (BLOCK * 8) + " " + (BLOCK * 13)
    html = f'''
<ytd-rich-item-renderer class="sk-item">
 <yt-lockup-view-model id="c{i}" class="lockup">
  <a href="/watch?v=mockvid{i:02d}" class="sk-thumb">
    <img class="sk-img" alt="" src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%231d1d1d'/%3E%3Cpath d='M139 66l46 24-46 24z' fill='%233a3a3a'/%3E%3C/svg%3E">
    <span class="sk-dur"></span>
  </a>
  <yt-lockup-metadata-view-model class="sk-meta">
    <div class="ytLockupMetadataViewModelAvatar sk-avatar"></div>
    <div class="sk-text">
      <h3 class="ytLockupMetadataViewModelHeadingReset sk-title" title="{tt}">
        <span class="sk-bar" style="width:{w1}%"></span>
        <span class="sk-bar" style="width:{w2}%"></span>
      </h3>
      <div class="sk-bar sk-sub" style="width:54%"></div>
      <div class="sk-bar sk-sub" style="width:40%"></div>
    </div>
    <div class="ytLockupMetadataViewModelMenuButton sk-menu">
      <button aria-label="menu"><svg viewBox="0 0 24 24"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg></button>
    </div>
  </yt-lockup-metadata-view-model>
 </yt-lockup-view-model>
</ytd-rich-item-renderer>'''
    js = ("document.getElementById('c%d').rawProps={data:()=>(%s)};"
          % (i, json.dumps(data, ensure_ascii=False)))
    return html, js

cards, scripts = zip(*[card(i, AGES[i % len(AGES)]) for i in range(102)])
rail = ''.join('<div class="sk-rail-item"><span class="sk-dot"></span>'
               '<span class="sk-bar" style="width:%d%%"></span></div>' % w
               for w in (70, 55, 62, 48, 66, 52, 74, 58))

HTML = f'''<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>mock</title>
<style>
:root{{--bg:#0f0f0f;--sk:#282828;--sk2:#1d1d1d;--line:#303030}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);font-family:Roboto,Arial,sans-serif;color:#fff}}
@keyframes sh{{0%,100%{{opacity:.6}}50%{{opacity:.9}}}}
.sk-bar{{display:block;height:11px;border-radius:5px;background:var(--sk);animation:sh 2.6s infinite}}
.sk-sub{{height:9px;background:var(--sk2);margin-top:8px}}
.sk-top{{position:fixed;top:0;left:0;right:0;height:56px;background:var(--bg);display:flex;
 align-items:center;gap:18px;padding:0 16px;z-index:5}}
.sk-burger{{width:22px;height:16px;display:flex;flex-direction:column;justify-content:space-between}}
.sk-burger i{{height:2px;background:#9a9a9a;border-radius:2px}}
.sk-logo{{width:92px;height:20px;border-radius:4px;background:var(--sk)}}
.sk-search{{flex:0 1 540px;height:38px;border:1px solid var(--line);border-radius:19px;margin:0 auto}}
.sk-ava-top{{width:32px;height:32px;border-radius:50%;background:var(--sk)}}
.sk-side{{position:fixed;top:56px;left:0;width:200px;bottom:0;padding:12px 10px;z-index:4}}
.sk-rail-item{{display:flex;align-items:center;gap:14px;height:40px;padding:0 10px;border-radius:10px}}
.sk-dot{{width:18px;height:18px;border-radius:5px;background:var(--sk);flex:none}}
.sk-main{{margin:56px 0 0 200px;padding:24px}}
.sk-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:30px 16px}}
.sk-thumb{{position:relative;aspect-ratio:16/9;border-radius:12px;background:var(--sk2);
 display:flex;align-items:center;justify-content:center}}
.sk-img{{width:100%;height:100%;object-fit:cover;border-radius:12px;display:block}}
.sk-dur{{position:absolute;right:8px;bottom:8px;width:40px;height:16px;border-radius:4px;background:#000000aa}}
.sk-meta{{display:flex;gap:12px;margin-top:12px;position:relative}}
.sk-avatar{{width:36px;height:36px;border-radius:50%;background:var(--sk);flex:none;position:relative}}
.sk-text{{flex:1;min-width:0}}
.sk-title{{margin:0;display:flex;flex-direction:column;gap:8px;cursor:pointer}}
.sk-menu{{opacity:0;transition:opacity .15s}}
.sk-item:hover .sk-menu{{opacity:1}}
.sk-menu button{{background:none;border:none;padding:4px;cursor:pointer}}
.sk-menu svg{{width:20px;height:20px;fill:#aaa}}
</style></head><body>
<div class="sk-top"><div class="sk-burger"><i></i><i></i><i></i></div><div class="sk-logo"></div>
 <div class="sk-search"></div><div class="sk-ava-top"></div></div>
<div class="sk-side">{rail}</div>
<ytd-browse><div class="sk-main"><div class="sk-grid">{''.join(cards)}</div></div></ytd-browse>
<script>{''.join(scripts)}</script>
</body></html>'''

open('mock.html', 'w', encoding='utf-8').write(HTML)
print('mock.html 已產生，卡片數 102')
