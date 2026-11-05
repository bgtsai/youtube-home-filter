# __diagQueue 整合測試：同時裝頁面狀態封存器（bgtsai/page-state-recorder），
# 封存後檢查 Home Filter 交出的每張卡片判定規則是否正確。
# 用法：先照 README 跑 fixture.py 與 serve.py，再 python3 diag.py
#       PSR=<page-state-recorder.user.js 路徑> 可指定封存器位置
from playwright.sync_api import sync_playwright
import json, os
from run_shared import CFG, SHIM, URL, SCRIPT

PSR = open(os.environ.get('PSR', '/home/claude/page-state-recorder/page-state-recorder.user.js'), encoding='utf-8').read()
# 期望的判定規則（rule 名稱與 youtube-home-filter.user.js 的 hideReason 一致）
EXPECT = {
    'home-new': 'shown', 'home-old': 'age', 'home-mix': 'mix', 'home-pl': 'shown',
    'live-now': 'live', 'live-past': 'age', 'live-past-new': 'shown',
    'ad-slot': 'noData', 'ad-video': 'noData', 'shelf-dup': 'shown', 'grid-dup': 'shown', 'podcast': 'podcast',
}
ok = fail = 0
def check(name, cond, detail=''):
    global ok, fail
    if cond: ok += 1; print('  ✅ ' + name)
    else: fail += 1; print('  ❌ ' + name + ('  → ' + str(detail)[:300] if detail != '' else ''))

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(locale="zh-TW", viewport={"width": 1400, "height": 900})
    ctx.add_init_script(SHIM)
    ctx.add_init_script(PSR)          # 封存器在 document-start
    pg = ctx.new_page()
    pg.goto(URL + '/'); pg.wait_for_timeout(300)
    pg.evaluate(SCRIPT); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{window.dispatchEvent(new Event('yt-navigate-finish'));}")
    pg.wait_for_timeout(900)
    d = json.loads(pg.evaluate("() => window.__psrTest.dumpParts(1).join('')"))
    b.close()

print('\n===== __diagQueue 整合 =====')
hf = next((x for x in d['diag'] if x['name'] == 'YouTube Home Filter'), None)
check('Home Filter 出現在 diag 且沒有錯誤', hf is not None and 'error' not in hf, d['diag'])
objs = d['objs']; nodes = d['nodes']
def deref(v): return objs[v['$ref']] if isinstance(v, dict) and '$ref' in v else v
snap = deref(hf['value']) if hf else None
props = snap['p'] if snap else {}
check('交出設定（門檻 2 天）', deref(props.get('config', {})).get('p', {}).get('value') == 2, props.get('config'))
check('交出判定時間（台北）', isinstance(props.get('verdictsAt'), str) and props['verdictsAt'].endswith('+08:00'), props.get('verdictsAt'))
verdicts = [deref(v)['p'] for v in deref(props.get('verdicts', {})).get('a', [])]
def lockup_id(v):
    n = v.get('lockup', {})
    if '$node' not in n: return None
    return next((a[1] for a in nodes[n['$node']].get('a', []) if a[0] == 'id'), None)
got = {lockup_id(v): v.get('rule') for v in verdicts}
for cid, rule in EXPECT.items():
    check(f'{cid:14s} 判定={rule}', got.get(cid) == rule, got.get(cid))
age = next((v for v in verdicts if lockup_id(v) == 'home-old'), None)
det = deref(age.get('detail')) if age else None
check('age 判定附上秒數與門檻', det and det.get('p', {}).get('thresholdSec') == 2 * 86400, det)
check('判定裡的卡片指回樹上節點（$node）', all('$node' in v.get('lockup', {}) for v in verdicts), verdicts[:2])
print(f'  → {ok} 通過 / {fail} 失敗')
raise SystemExit(1 if fail else 0)
