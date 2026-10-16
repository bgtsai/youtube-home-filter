import json
# 全部取自實際擷取的資料結構
CARDS=[
 dict(id="home-new",  bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["天高海闊張修杰","3013","1 小時前"]], href="/watch?v=e1", expect="show", why="1 小時前，未超過門檻"),
 dict(id="home-old",  bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["某頻道","5000","3 個月前"]], href="/watch?v=e2", expect="hide", why="3 個月前 > 2 天門檻"),
 dict(id="home-mix",  bare=False, ct="LOCKUP_CONTENT_TYPE_PLAYLIST", badge=None, collection=True,
      rows=[["羅賓·阿黛爾·安德森和其他藝人","播放清單"]],
      href="/watch?v=URLwenN1aws&list=RDURLwenN1aws&start_radio=1", expect="hide", why="混合輯 list=RD"),
 dict(id="home-pl",   bare=False, ct="LOCKUP_CONTENT_TYPE_PLAYLIST", badge=None, collection=True,
      rows=[["某頻道","播放清單"]], href="/watch?v=x&list=PLabcdef", expect="show", why="一般播放清單，未開啟該過濾"),
 dict(id="live-now",  bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="LIVE",
      rows=[["2948 人正在觀看"]], href="/watch?v=e3", expect="hide", why="正在直播"),
 dict(id="live-past", bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["8.8萬","直播時間：3 天前"]], href="/watch?v=e4", expect="hide", why="存檔 3 天前 > 門檻（非因直播）"),
 dict(id="live-past-new", bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["8.8萬","直播時間：1 小時前"]], href="/watch?v=e5", expect="show", why="直播存檔但很新 → 不該被當直播擋掉"),
 dict(id="side-video", bare=True, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["AI 101"],["2094","4 小時前"]], href="/watch?v=e6", expect="show", why="側欄，4 小時前未超門檻"),
 dict(id="side-member", bare=True, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["方偉時間"],["5 小時前"],[]], href="/watch?v=e7", expect="show", why="側欄會員、末列空陣列，時間仍須解析正確"),
 dict(id="side-old", bare=True, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["某頻道"],["123","2 年前"],[]], href="/watch?v=e8", expect="hide", why="側欄舊片 → 驗證播放頁過濾生效"),
 # 廣告：rawProps 存在但 rawProps.data 為 undefined，應一律隱藏
 dict(id="ad-slot",   bare=False, ad=True, ct=None, badge=None, rows=[],
      href="https://www.googleadservices.com/pagead/aclk?x=1", expect="hide", why="廣告卡片（無 view-model 資料）"),
 dict(id="ad-video",  bare=False, ad=True, ct=None, badge=None, rows=[],
      href="/watch?v=AKStsRwsCN0", expect="hide", why="贊助商影片廣告（同樣無資料）"),
 # 語言綁定回歸：頁面語言為日文時，時間過濾仍須生效（面板語言是另一回事）
 dict(id="ja-old",    bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["チャンネル","5000","3 か月前"]], href="/watch?v=j1", expect="hide", why="日文頁面：3 か月前 > 門檻"),
 dict(id="ja-new",    bare=False, ct="LOCKUP_CONTENT_TYPE_VIDEO", badge="DEFAULT",
      rows=[["チャンネル","3013","1 時間前"]], href="/watch?v=j2", expect="show", why="日文頁面：1 時間前，未超門檻"),
 dict(id="podcast", bare=False, ct="LOCKUP_CONTENT_TYPE_PODCAST", badge=None,
      rows=[["某頻道","1 小時前"]], href="/watch?v=e9", expect="hide", why="Podcast 列舉值"),
]
def mk(c):
    rows=",".join("{metadataParts:[%s]}"%(",".join('{text:{content:%s}}'%json.dumps(p) for p in r)) for r in c["rows"])
    badge = "" if not c.get("badge") else "{thumbnailBadgeViewModel:{badgeStyle:'THUMBNAIL_OVERLAY_BADGE_STYLE_%s',text:'1:00'}}"%c["badge"]
    thumbKey="collectionThumbnailViewModel" if c.get("collection") else "thumbnailViewModel"
    data=("{contentType:'%s',contentImage:{%s:{overlays:[{thumbnailBottomOverlayViewModel:{badges:[%s]}}]}},"
          "metadata:{lockupMetadataViewModel:{title:{content:'t'},metadata:{contentMetadataViewModel:{metadataRows:[%s]}}}}}"
          )%(c["ct"],thumbKey,badge,rows)
    inner='<a href="%s">t</a>'%c["href"]
    el='<yt-lockup-view-model id="%s" class="lockup ytLockupViewModelWrapper">%s</yt-lockup-view-model>'%(c["id"],inner)
    if not c["bare"]: el='<ytd-rich-item-renderer>%s</ytd-rich-item-renderer>'%el
    if c.get("ad"):
        return el, "document.getElementById('%s').rawProps={};"%c["id"]
    return el, "document.getElementById('%s').rawProps={data:()=>(%s)};"%(c["id"],data)
els,js=zip(*[mk(c) for c in CARDS])
LANG=__import__('os').environ.get('FIXLANG','zh-TW')
html="<!doctype html><html lang='"+LANG+"'><body><ytd-browse></ytd-browse>%s<script>%s</script></body></html>"%("".join(els),"".join(js))
open("fixture.html","w",encoding="utf-8").write(html)
json.dump(CARDS,open("expect.json","w"),ensure_ascii=False,indent=1)
print("已建立 fixture，卡片數:",len(CARDS))
