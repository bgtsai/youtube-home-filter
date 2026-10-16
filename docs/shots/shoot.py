# -*- coding: utf-8 -*-
"""對設定面板與注入的 YouTube UI 截圖，中英文各一套，輸出到 docs/images/。
背景是骨架屏假頁面（mock.html），不含任何真實 YouTube 內容。"""
import json, os, sys, subprocess, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path('/home/claude/youtube-home-filter')
OUT  = ROOT / 'docs' / 'images'
OUT.mkdir(parents=True, exist_ok=True)
SCRIPT = (ROOT / 'youtube-home-filter.user.js').read_text(encoding='utf-8')
PORT = int(os.environ.get('SHOT_PORT', '8911'))

def cfg(lang):
    return {"enabled": True, "hideOldEnabled": True, "value": 2, "unit": "day",
            "hideLive": True, "hideUpcoming": True, "hidePodcast": True, "hideMix": True,
            "hidePlaylist": False, "hideMusic": True, "hideMember": False, "hideRegular": False,
            "hideWatched": True, "watchedPercent": 3, "watchedSeconds": 15,
            "hideTitleFilter": True, "lang": lang, "theme": "dark",
            "enhancedTooltips": True, "openLinksInNewTab": False,
            "gridColumnsEnabled": True, "gridColumnsValue": 3,
            "qaShowAlreadyWatched": True, "qaShowNotInterested": True,
            "qaShowDontLike": True, "qaShowDontRecommend": True,
            "whitelistMusic": ["Channel 2", "Channel 5"], "whitelistMember": [],
            "titleFilterList": [{"channel": "Channel 1", "pattern": "trailer|teaser"},
                                {"channel": "", "pattern": "^\[Live\]"}]}

def shim(lang):
    return """
window.__store={'tm-yt-filter-cfg':%s};
window.GM_getValue=(k,d)=>window.__store[k]!==undefined?window.__store[k]:d;
window.GM_setValue=(k,v)=>{window.__store[k]=v;};
window.GM_xmlhttpRequest=()=>{};window.unsafeWindow=window;
window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));
// shadow root 設為 open，讓截圖工具能選到面板內部元素
const _as=Element.prototype.attachShadow;
Element.prototype.attachShadow=function(o){return _as.call(this,{...o,mode:'open'});};
""" % json.dumps(cfg(lang))

def shoot(pg, name, sel, pad=18, lang=''):
    el = pg.locator(sel).first
    el.wait_for(state='visible', timeout=5000)
    box = el.bounding_box()
    vp = pg.viewport_size
    clip = {"x": max(0, box['x'] - pad), "y": max(0, box['y'] - pad),
            "width": min(vp['width'], box['width'] + pad * 2),
            "height": min(vp['height'], box['height'] + pad * 2)}
    path = OUT / f"{name}.{lang}.png"
    pg.screenshot(path=str(path), clip=clip)
    print(f"  ✓ {path.name}  {int(clip['width'])}x{int(clip['height'])}")

def gear(pg):
    pg.evaluate("()=>document.getElementById('yt-filter-shadow-host').shadowRoot"
                ".getElementById('sa-settings').click()")

def run(lang, locale):
    url = f"http://127.0.0.1:{PORT}/"
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--force-device-scale-factor=2"])
        ctx = b.new_context(locale=locale, viewport={"width": 1500, "height": 950},
                            device_scale_factor=2)
        ctx.add_init_script(shim(lang))
        pg = ctx.new_page()
        pg.goto(url); pg.wait_for_timeout(250)
        pg.evaluate(SCRIPT); pg.wait_for_timeout(1000)
        pg.evaluate("()=>window.dispatchEvent(new Event('yt-navigate-finish'))")
        pg.wait_for_timeout(900)
        print(f"== {lang} ==")

        HOST = '#yt-filter-shadow-host'
        pg.wait_for_timeout(3000)   # 等膠囊從「過濾中…」回到靜止狀態
        # 1 收合狀態的膠囊
        shoot(pg, '01-pill', f'{HOST} .btn', pad=14, lang=lang)
        # 2 設定面板
        gear(pg); pg.wait_for_timeout(700)
        shoot(pg, '02-settings', f'{HOST} .panel:visible', lang=lang)
        # 3 白名單面板（音樂）
        pg.locator(f'{HOST} #wl-music-btn').click(); pg.wait_for_timeout(700)
        shoot(pg, '03-whitelist', f'{HOST} .wl-modal', lang=lang)
        pg.locator(f'{HOST} #wl-close-btn').click(); pg.wait_for_timeout(500)
        # 4 已觀看偵測
        pg.locator(f'{HOST} #wd-btn').click(); pg.wait_for_timeout(700)
        shoot(pg, '04-watched', f'{HOST} .wd-modal', lang=lang)
        pg.locator(f'{HOST} #wd-close-btn').click(); pg.wait_for_timeout(500)
        # 5 片名過濾面板
        pg.locator(f'{HOST} #tf-btn').click(); pg.wait_for_timeout(700)
        shoot(pg, '05-titlefilter', f'{HOST} .tf-modal', lang=lang)
        pg.locator(f'{HOST} #tf-close-btn').click(); pg.wait_for_timeout(500)
        # 6 進階（快速回饋按鈕）設定
        pg.locator(f'{HOST} #adv-entry-btn').click(); pg.wait_for_timeout(800)
        shoot(pg, '06-advanced', f'{HOST} .panel:visible', lang=lang)
        pg.locator(f'{HOST} #adv-back-btn').click(); pg.wait_for_timeout(600)
        pg.locator(f'{HOST} #close-btn').click(); pg.wait_for_timeout(600)

        # 7 卡片 hover → 快速回饋按鈕
        vis = pg.evaluate("""() => [...document.querySelectorAll('ytd-rich-item-renderer')]
            .filter(e=>e.style.display!=='none').map(e=>e.querySelector('yt-lockup-view-model').id)""")
        print('   可見卡片:', vis)
        if vis:
            tgt = f'#{vis[0]}'
            pg.locator(tgt).hover(); pg.wait_for_timeout(700)
            shoot(pg, '07-qa-buttons', f'ytd-rich-item-renderer:has({tgt})', pad=16, lang=lang)
            # 9 增強 tooltip：hover 中間卡片的標題，截圖含 tooltip 與卡片
            pg.mouse.move(10, 500); pg.wait_for_timeout(300)
            mid = vis[1] if len(vis) > 1 else vis[0]
            pg.locator(f'#{mid} h3').hover(); pg.wait_for_timeout(900)
            bb = pg.evaluate("""(id)=>{const t=document.getElementById('yt-filter-shadow-host').shadowRoot.getElementById('tm-tooltip-host').getBoundingClientRect();
                const c=document.getElementById(id).closest('ytd-rich-item-renderer').getBoundingClientRect();
                const x=Math.min(t.x,c.x), y=Math.min(t.y,c.y);
                return {x:x, y:y, w:Math.max(t.right,c.right)-x, h:Math.max(t.bottom,c.bottom)-y};}""", mid)
            pg.screenshot(path=str(OUT / f'09-tooltip.{lang}.png'),
                          clip={"x": max(0, bb['x']-16), "y": max(0, bb['y']-16),
                                "width": min(1500-max(0,bb['x']-16), bb['w']+32),
                                "height": bb['h']+32})
            print(f"  ✓ 09-tooltip.{lang}.png")
        # 8 白名單模式 → 頭像盾牌
        pg.mouse.move(10, 500); pg.wait_for_timeout(200)
        gear(pg); pg.wait_for_timeout(600)
        pg.locator(f'{HOST} #wl-music-btn').click(); pg.wait_for_timeout(600)
        # 以真實的 DOM 變動觸發腳本自己的 observer，讓它重新掃描並標記已在白名單的頻道
        pg.evaluate("""()=>{const g=document.querySelector('.sk-grid');
            const d=document.createElement('span'); g.appendChild(d);
            setTimeout(()=>d.remove(),50);}"""); pg.wait_for_timeout(1200)
        vis2 = pg.evaluate("""() => [...document.querySelectorAll('ytd-rich-item-renderer')]
            .filter(e=>e.style.display!=='none').map(e=>e.querySelector('yt-lockup-view-model').id)""")
        print('   白名單模式可見卡片:', vis2)
        act = pg.evaluate("""() => [...document.querySelectorAll('.wl-avatar-btn.active')].length""")
        print('   已加入白名單的盾牌數:', act)
        if vis2:
            pg.locator(f'#{vis2[0]}').hover(); pg.wait_for_timeout(600)
            bx = pg.evaluate("""() => { const g=document.querySelector('.sk-grid').getBoundingClientRect();
                const c=document.querySelector('ytd-rich-item-renderer').getBoundingClientRect();
                return {x:g.x,w:g.width,y:c.y,h:c.height}; }""")
            pg.screenshot(path=str(OUT / f'08-whitelist-mode.{lang}.png'),
                          clip={"x": max(0, bx['x']-12), "y": max(0, bx['y']-12),
                                "width": min(1500-bx['x']+12, bx['w']+24),
                                "height": bx['h']+34})
            print(f"  ✓ 08-whitelist-mode.{lang}.png")
        errs = pg.evaluate("()=>window.__errs||[]")
        b.close()

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)],
                       cwd=str(pathlib.Path(__file__).parent),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    run('zh', 'zh-TW')
    run('en', 'en-US')
finally:
    srv.terminate()
