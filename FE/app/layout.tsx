import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkSpace — AI 통합 워크스페이스",
  description:
    "AI 실시간 통합 데이터 기반 지능형 자율제조 운영 플랫폼. 분절된 제조 데이터를 통합하고 AI로 공정을 판단·최적화합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
