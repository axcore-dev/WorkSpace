/**
 * 외부 앱 공식 심볼 마크. 파일은 `public/brands/<slug>.<svg|png>`에 둔다.
 *
 * SVG는 svgl.app에서 받은 공식 컬러 마크, PNG는 한국 서비스처럼 SVG를 배포하지 않는 곳의 favicon/apple-touch-icon이다.
 * 라이브러리 없이 `<img>`로 그린다 — 정적 파일이라 next/image 최적화가 필요 없다.
 */
const PNG = new Set(["kakaowork", "naverworks", "jandi", "ecount", "douzone"]);

export function BrandIcon({ slug, size = 20, className = "" }: { slug: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 정적 브랜드 마크, 최적화 불필요
    <img
      src={`/brands/${slug}.${PNG.has(slug) ? "png" : "svg"}`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  );
}
