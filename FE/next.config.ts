import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너 배포용. .next/standalone 에 node_modules 중 실제로 쓰는 것만 추려 넣은
  // 자체 실행 서버(server.js)를 만든다. FE/Dockerfile 의 runtime 스테이지가 이걸 복사한다.
  // next dev / next start 에는 영향이 없다.
  output: "standalone",
  // 데모 환경: 좌측 하단 Next.js 개발 인디케이터(플로팅) 숨김
  devIndicators: false,
  // AI 서버(lib/ai/server)가 쓰는 네이티브·Node 전용 패키지. 번들러가 감싸면 pg 의 동적 require 와
  // pdf.js 의 워커 로딩이 깨진다. 외부 모듈로 두고 런타임 node_modules 에서 그대로 불러온다.
  serverExternalPackages: ["pg", "unpdf", "mammoth", "exceljs"],
  /**
   * 이미지 출처 제한(CSP img-src). AI 답변은 모델이 쓴 마크다운을 그리는데, 이미지 태그는 클릭 없이 외부로
   * 요청이 나가는 유출 경로가 된다. 렌더러가 이미지를 그리지 않게 해 두었고(components/chat/markdown.tsx),
   * 이 헤더는 그 방어가 어디선가 빠져도 브라우저가 막게 하는 두 번째 겹이다.
   *
   * 다른 지시어(script-src 등)는 두지 않는다 — Next 의 인라인 스크립트·스타일에 nonce 를 붙이는 작업이 따로
   * 필요하고, 지금 막으려는 것은 이미지 한 종류다. 허용 목록은 화면이 실제로 그리는 곳만이다:
   * 자기 오리진(브랜드 아이콘·외부 시스템 캡처), data:/blob:(프로필 사진 미리보기), 외부 시스템 데모 화면.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "img-src 'self' data: blob: https://www.mespluscloud.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
