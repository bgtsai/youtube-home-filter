from http.server import BaseHTTPRequestHandler, HTTPServer
H=open('fixture.html','rb').read()
class R(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(H))); self.end_headers(); self.wfile.write(H)
    def log_message(self,*a): pass
HTTPServer(('127.0.0.1',8742),R).serve_forever()
