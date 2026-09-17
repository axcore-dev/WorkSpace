"""
hwp 변환기 — `POST /text` 에 hwp 바이트를 보내면 본문 텍스트(UTF-8)를 돌려준다. `GET /health` 는 살아 있는지.

pyhwp 의 `hwp5html --html` 로 XHTML 을 받아(표준 출력, 이미지 추출 없음) 문서 순서대로 평문으로 편다.
`hwp5txt` 를 안 쓰는 이유: 표를 `<표>` 한 글자로 뭉개 셀 내용이 통째로 빠진다 — 사업계획서의 예산 표가 사라진다.
XHTML 에서는 표가 살아 있어 행마다 셀을 ` | ` 로 잇는다(xlsx 추출과 같은 표기라 모델이 같은 방식으로 읽는다).

부르는 쪽은 FE 의 AI 서버(`FE/lib/ai/server/extract.ts`) 하나이고, 요청은 compose 내부 네트워크에서만 온다.

안전장치: 본문 크기 상한(20 MB, FE 업로드 한도와 같다) · 변환 시간 상한(30초) · 임시 파일은 요청이 끝나면 지운다 ·
hwp5html 은 인자 목록으로 실행한다(셸 없음) · 컨테이너는 비루트 · 읽기 전용 파일시스템 · 외부 네트워크 없음.
hwp5html 은 모르는 서식 값을 만나면 경고를 내고 종료 코드 1 을 돌려주면서도 XHTML 은 다 내놓는다 — 그래서
종료 코드가 아니라 「XHTML 이 나왔는가」로 성공을 판단한다.
"""
import os
import re
import subprocess
import tempfile
import threading
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 20 * 1024 * 1024
TIMEOUT_SEC = 30
PORT = 8100
# 결과 평문 상한. 20 MB 압축 파일이 수백 MB 텍스트로 부풀 수 있다(압축 폭탄) — 그 뒤는 잘라내고 표시를 남긴다.
MAX_TEXT_BYTES = 4 * 1024 * 1024
# 동시에 도는 hwp5html 수. 서버가 2 vCPU 라 그 이상은 서로 느려질 뿐이다. 넘치면 기다린다(FE 쪽 대기 40초 안에 끝난다).
CONCURRENCY = 2
_slots = threading.BoundedSemaphore(CONCURRENCY)

BLOCK = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "pre"}


def _local(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _collapse(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _walk(el, out: list):
    """문서 순서대로 평문. 표는 행마다 셀을 ` | ` 로, 그 밖의 블록은 한 줄로."""
    name = _local(el.tag)
    if name == "table":
        for tr in el.iter():
            if _local(tr.tag) != "tr":
                continue
            cells = [_collapse("".join(td.itertext())) for td in tr if _local(td.tag) in ("td", "th")]
            if any(cells):
                out.append(" | ".join(cells))
        out.append("")
        return
    if name in BLOCK and el.find(".//{*}table") is None:
        text = _collapse("".join(el.itertext()))
        if text:
            out.append(text)
        return
    for child in el:
        _walk(child, out)


def xhtml_to_text(xhtml: bytes) -> str:
    root = ET.fromstring(xhtml)
    body = next((e for e in root.iter() if _local(e.tag) == "body"), root)
    out: list = []
    _walk(body, out)
    return "\n".join(out).strip() + "\n"


def convert(data: bytes) -> bytes:
    """hwp 바이트 → 평문 UTF-8. 실패는 ValueError(사람이 읽을 한 줄)."""
    fd, path = tempfile.mkstemp(suffix=".hwp", dir="/tmp")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        with _slots:
            proc = subprocess.run(
                ["hwp5html", "--html", path],
                capture_output=True,
                timeout=TIMEOUT_SEC,
                check=False,
            )
        xhtml = proc.stdout
        if not xhtml.strip():
            lines = proc.stderr.decode("utf-8", "replace").strip().splitlines()
            raise ValueError(lines[-1][:300] if lines else "빈 결과")
        try:
            text = xhtml_to_text(xhtml).encode("utf-8")
        except ET.ParseError as e:
            raise ValueError(f"XHTML 해석 실패: {e}") from e
        if len(text) > MAX_TEXT_BYTES:
            text = text[:MAX_TEXT_BYTES].decode("utf-8", "ignore").encode("utf-8") + "\n[이하 생략 — 문서가 너무 길어 앞부분만 읽었어요]\n".encode("utf-8")
        return text
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


class Handler(BaseHTTPRequestHandler):
    server_version = "hwp-converter/1"

    def log_message(self, fmt, *args):  # 요청마다 한 줄. 파일 이름은 받지 않으므로 새는 것이 없다
        print("%s %s" % (self.command, fmt % args), flush=True)

    def _send(self, status: int, body: bytes, content_type: str = "text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, b"ok")
        else:
            self._send(404, b"not found")

    def do_POST(self):
        if self.path != "/text":
            self._send(404, b"not found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send(400, b"bad length")
            return
        if length <= 0:
            self._send(400, b"empty")
            return
        if length > MAX_BYTES:
            self._send(413, b"too large")
            return
        data = self.rfile.read(length)
        try:
            self._send(200, convert(data))
        except subprocess.TimeoutExpired:
            self._send(504, b"timeout")
        except ValueError as e:
            self._send(422, ("변환 실패: " + str(e)).encode("utf-8"))
        except Exception as e:  # noqa: BLE001 — 어떤 실패든 500 한 줄로. 스택은 로그로만
            print("error:", repr(e), flush=True)
            self._send(500, b"error")


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
