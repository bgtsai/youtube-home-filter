"""測試夾具用的極簡伺服器：對任何路徑都回傳 fixture.html。

兩個刻意的設計，都是踩過坑之後加的：

1. 每次請求才讀檔，不在啟動時讀進記憶體。
   否則重新產生夾具（例如 FIXLANG=ja python3 fixture.py）之後，
   還活著的舊 server 會繼續送舊內容。
2. 連接埠被占用時直接報錯退出，不靜默結束。
   舊 server 還在時，新的這支若無聲退出，測試實際跑的是舊夾具，
   症狀會偽裝成產品 bug（實際發生過：日文案例假性失敗，
   回退版本重測「也失敗」，更像是舊有缺陷）。
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, 'fixture.html')
PORT = int(os.environ.get('FIXPORT', '8786'))


class R(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            body = open(FIXTURE, 'rb').read()      # 每次請求重讀，不快取
        except OSError as e:
            self.send_error(500, f'讀取夾具失敗: {e}')
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    try:
        srv = HTTPServer(('127.0.0.1', PORT), R)
    except OSError as e:
        sys.exit(f'[serve.py] 連接埠 {PORT} 無法綁定：{e}\n'
                 f'  很可能有舊的 server 還活著——那支會繼續送舊夾具，\n'
                 f'  測試結果會偽裝成產品問題。先結束它，或用 FIXPORT=其他埠號 重跑。')
    print(f'[serve.py] http://127.0.0.1:{PORT}/ → {FIXTURE}（每次請求重讀）')
    srv.serve_forever()
