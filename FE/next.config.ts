import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너 배포용. .next/standalone 에 node_modules 중 실제로 쓰는 것만 추려 넣은
  // 자체 실행 서버(server.js)를 만든다. FE/Dockerfile 의 runtime 스테이지가 이걸 복사한다.
  // next dev / next start 에는 영향이 없다.
  output: "standalone",
  // 데모 환경: 좌측 하단 Next.js 개발 인디케이터(플로팅) 숨김
  devIndicators: false,
};

export default nextConfig;
