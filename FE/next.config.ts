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
};

export default nextConfig;
