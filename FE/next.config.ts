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
   * 자기 오리진(브랜드 아이콘·외부 시스템 캡처·올린 프로필 사진 `/api/avatars/*`), data:/blob:,
   * 외부 시스템 데모 화면, 그리고 소셜 로그인이 준 프로필 사진 두 곳.
   *
   * 소셜 사진 호스트를 여는 이유: 구글·네이버로 가입하면 계정에 남는 사진 주소가 그쪽 CDN 이다
   * (`shared.users.avatar_url`). 막아 두면 그 사용자만 계정 화면에서 깨진 이미지를 본다. 두 호스트는
   * 우리가 고른 제공자의 것이고 경로가 아니라 호스트 단위로만 연다. 사용자가 직접 올린 사진은 우리
   * 오리진으로 나가므로 이 항목과 무관하다.
   */
  /**
   * 프로필 사진만 BE 로 넘긴다.
   *
   * 사진은 `<img src="/api/avatars/...">` 로 그린다 — 이미지 태그에는 Authorization 헤더도, API 주소도
   * 실을 수 없어서 상대 경로여야 한다. 운영에서는 nginx 가 `/api/` 를 전부 Spring 으로 보내므로 이 규칙이
   * 발동하지 않는다. 문제는 로컬이다: 브라우저가 FE(8000)로 요청하는데 Next 에는 그 경로가 없어서 404 가
   * 나고, 사진이 안 바뀐 것처럼 보인다.
   *
   * 그래서 이 한 경로만 BE 로 넘긴다. `/api/` 전체를 넘기지 않는 이유는 나머지 호출이 이미
   * `lib/api.ts` 의 `API_BASE` 로 직접 가고 있어서다. CSP 의 `img-src 'self'` 도 그대로 둘 수 있다 —
   * 브라우저가 보는 주소는 여전히 자기 오리진이다.
   */
  async rewrites() {
    const be = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
    return [{ source: "/api/avatars/:path*", destination: `${be}/api/avatars/:path*` }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "img-src 'self' data: blob: https://www.mespluscloud.com" +
              " https://lh3.googleusercontent.com https://phinf.pstatic.net",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
