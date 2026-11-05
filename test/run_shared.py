# run.py 與 diag.py 共用的設定、GM 替身與網址（只維護這一份）
import json
SCRIPT=open('/home/claude/youtube-home-filter/youtube-home-filter.user.js',encoding='utf-8').read()
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
URL="http://127.0.0.1:8786"
