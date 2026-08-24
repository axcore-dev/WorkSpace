"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button, Card, FIELD, isPersonalEmail } from "@/components/ui";
import { IconCheck, IconMail } from "@/components/icons";

export default function SignupPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("demo@democompany.co.kr");

  if (sent) {
    return (
      <AuthShell>
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-slate-400">
            <IconMail size={30} />
          </span>
          <h1 className="text-lg font-bold text-slate-900">인증 메일을 확인해 주세요</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            입력하신 이메일로 인증 링크를 보냈습니다. 링크를 클릭하면 가입이 완료됩니다.
          </p>
          <Button size="lg" className="mt-6 w-full" onClick={() => router.push("/login")}>
            <IconCheck size={16} />
            인증 완료 — 로그인으로 이동 (데모)
          </Button>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-md p-8">
        <h1 className="text-lg font-bold text-slate-900">이메일 회원가입</h1>
        <p className="mt-1 text-sm text-slate-500">업무용 이메일로 계정을 생성해 주세요.</p>
        {/* 데모: 검증 없이 버튼 클릭 즉시 다음 단계로 */}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="su-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                이름
              </label>
              <input id="su-name" defaultValue="박데모" placeholder="홍길동" className={FIELD} />
            </div>
            <div>
              <label htmlFor="su-company" className="mb-1.5 block text-sm font-medium text-slate-700">
                회사명
              </label>
              <input id="su-company" defaultValue="(주)데모컴퍼니" placeholder="데모컴퍼니" className={FIELD} />
            </div>
          </div>
          <div>
            <label htmlFor="su-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              업무 이메일
            </label>
            <input
              id="su-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.co.kr"
              className={FIELD}
            />
            {isPersonalEmail(email) ? (
              <p className="mt-1.5 text-xs text-amber-600">
                개인 메일 주소예요. 회사에서 발급한 업무용 이메일로 가입해 주세요.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-400">회사 도메인 이메일로 가입하면 워크스페이스 초대가 쉬워져요.</p>
            )}
          </div>
          <div>
            <label htmlFor="su-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              비밀번호
            </label>
            <input
              id="su-password"
              type="password"
              autoComplete="new-password"
              defaultValue="demo1234!"
              placeholder="8자 이상 · 대문자·숫자·특수문자 포함"
              className={FIELD}
            />
          </div>
          <Button type="submit" size="lg" className="w-full">
            가입하기
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary-600 transition-colors hover:text-primary-700">
            로그인
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
