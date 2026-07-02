/**
 * AXCORE 브랜드 로고 (public/assets 의 트리밍된 PNG 사용).
 * - color: 밝은 배경용 (회색 워드마크 + 블루 액센트)
 * - white: 어두운 배경용 (화이트 워드마크 + 블루 액센트)
 * 원본 종횡비 ≈ 3.87:1 이므로 height 기준으로 크기를 지정한다.
 */
const SRC = {
  color: "/assets/axcore-color.png",
  white: "/assets/axcore-white.png",
} as const;

export function Logo({
  variant = "color",
  height = 20,
  className = "",
}: {
  variant?: keyof typeof SRC;
  height?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt="AXCORE"
      height={height}
      style={{ height }}
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
