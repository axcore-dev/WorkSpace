/**
 * 외부 앱 공식 심볼 마크. 파일은 `public/brands/<slug>.<svg|png>`에 둔다.
 *
 * SVG는 svgl.app에서 받은 공식 컬러 마크, PNG는 한국 서비스처럼 SVG를 배포하지 않는 곳의 favicon/apple-touch-icon이다.
 * 라이브러리 없이 `<img>`로 그린다 — 정적 파일이라 next/image 최적화가 필요 없다.
 */
const PNG = new Set(["kakaowork", "naverworks", "jandi", "ecount", "douzone"]);

/**
 * 파일이 실제로 있는 slug — `public/brands/`와 같아야 한다.
 * BE가 내려주는 도구 행의 `brand`가 그대로 들어오므로, 모르는 값이면 404 이미지를 그리지 않고 아무것도 그리지 않는다.
 */
const SVG = new Set([
  "excel",
  "gmail",
  "googlecalendar",
  "googledrive",
  "googlesheets",
  "notion",
  "outlook",
  "slack",
  "teams",
]);

export function BrandIcon({
  slug,
  size = 20,
  className = "",
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const png = PNG.has(slug);
  if (!png && !SVG.has(slug)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 정적 브랜드 마크, 최적화 불필요
    <img
      src={`/brands/${slug}.${png ? "png" : "svg"}`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  );
}
