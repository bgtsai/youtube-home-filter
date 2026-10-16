from playwright.sync_api import sync_playwright
import json, pathlib
SCRIPT=open('/home/claude/youtube-home-filter/youtube-home-filter.user.js',encoding='utf-8').read()
CARDS=json.load(open('expect.json'))
CFG={"enabled":True,"hideOldEnabled":True,"value":2,"unit":"day",
     "hideLive":True,"hidePodcast":True,"hideMix":True,"hidePlaylist":False,
     "hideUpcoming":False,"hideMusic":False,"hideMember":False,"hideRegular":False,
     "hideWatched":False,"hideTitleFilter":False,"lang":"en","theme":"dark",
     "whitelistMusic":[],"whitelistMember":[],"titleFilterList":[]}
SHIM="""
window.__store={'tm-yt-filter-cfg':%s};
window.GM_getValue=(k,d)=>window.__store[k]!==undefined?window.__store[k]:d;
window.GM_setValue=(k,v)=>{window.__store[k]=v;};
window.GM_xmlhttpRequest=()=>{};window.unsafeWindow=window;
window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));
""" % json.dumps(CFG)
url="http://127.0.0.1:8742"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"]); ctx=b.new_context(locale="zh-TW",viewport={"width":1400,"height":900})
    ctx.add_init_script(SHIM); pg=ctx.new_page()
    for page in ["/", "/watch"]:
        pg.goto(url+page); pg.wait_for_timeout(300)
        pg.evaluate(SCRIPT); pg.wait_for_timeout(1200)
        pg.evaluate("()=>{window.dispatchEvent(new Event('yt-navigate-finish'));}")
        pg.wait_for_timeout(900)
        st=pg.evaluate("""() => { const o={};
          for(const e of document.querySelectorAll('yt-lockup-view-model')){
            const t=e.closest('ytd-rich-item-renderer')||e; o[e.id]=t.style.display==='none'?'hide':'show'; }
          return {st:o, errs:window.__errs.slice(0,3)}; }""")
        print(f"\n===== 模擬頁面 {page} =====")
        ok=fail=0
        for c in CARDS:
            if page=="/watch" and not c["bare"]: continue
            if page=="/" and c["bare"]: continue
            import os
            ja = c["id"].startswith("ja-")
            if ja != (os.environ.get("FIXLANG")=="ja"): continue
            got=st["st"].get(c["id"])
            good = got==c["expect"]
            ok,fail=(ok+1,fail) if good else (ok,fail+1)
            print(("  ✅" if good else "  ❌")+f" {c['id']:16s} 期望={c['expect']:4s} 實際={got:4s}  {c['why']}")
        print(f"  → {ok} 通過 / {fail} 失敗 | JS 錯誤: {st['errs'] or '無'}")
    b.close()
