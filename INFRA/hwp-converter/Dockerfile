# hwp 변환기 — 옛 바이너리 `.hwp`(HWP 5.0) 에서 본문 텍스트를 뽑는다. AI 소스 색인이 이 컨테이너를 부른다.
#
# 왜 따로 컨테이너인가: JS 로 읽을 만한 hwp 파서가 없고(pyhwp 는 Python), hwp 는 국내에서 악성 첨부로 자주 쓰이는
# 형식이라 파싱을 앱 프로세스 밖에서 하는 편이 낫다. 외부 포트가 없고 내부 네트워크(compose `converter`)에서만 닿는다.
#
# pyhwp 는 2020 년이 마지막 릴리스라 Python 3.11 에 고정한다(3.12 에서 distutils 제거로 설치가 깨질 수 있다).
FROM python:3.11-slim

# six · docopt · olefile · hypua2jamo 는 pyhwp 가 쓰지만 메타데이터에 빠져 있어 직접 적는다(없으면 hwp5txt 가
# ModuleNotFoundError 로 죽는다). lxml 은 XML 변환 경로용인데 import 에 걸려 있어 함께 둔다.
# 전부 버전 고정 — 빌드가 서버(Jenkins)에서 도니 재현 가능해야 하고, 파서가 신뢰할 수 없는 파일을 여는 자리라 무엇이
# 들어가는지 정해 둔다. 올릴 때는 이 줄만 바꾼다.
RUN pip install --no-cache-dir pyhwp==0.1b15 lxml==5.4.0 six==1.17.0 docopt==0.6.2 olefile==0.47 hypua2jamo==0.7 \
    && useradd --create-home --uid 10001 hwp

WORKDIR /app
COPY server.py /app/server.py

USER hwp
ENV PYTHONUNBUFFERED=1
# 포트는 compose 안에서만 열린다. EXPOSE 는 문서용이다.
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=2).status == 200 else 1)"
CMD ["python", "/app/server.py"]
