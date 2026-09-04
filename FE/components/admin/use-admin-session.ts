"use client";

import { useEffect, useState } from "react";
import { ApiRequestError, apiGet } from "@/lib/api";

/** `/api/auth/me` 응답 중 운영자 콘솔이 쓰는 필드. */
export type AdminMe = {
  id: string;
  email: string;
  name: string;
  internalAdmin: boolean;
};

export type AdminSession =
  | { status: "loading" }
  /** 로그인돼 있고 운영자다. */
  | { status: "ok"; me: AdminMe }
  /** 로그인은 됐지만 운영자가 아니다. */
  | { status: "forbidden"; me: AdminMe }
  /** 로그인이 안 됐다 (access 재발급까지 실패). */
  | { status: "unauthenticated" }
  /** 서버에 닿지 못했다. */
  | { status: "error"; message: string };

/**
 * 운영자 콘솔 진입 판정.
 *
 * `/api/auth/me` 를 한 번 불러 로그인·운영자 여부를 확인한다. 여기 결과로 화면을 가리는 것은
 * **보안 경계가 아니다** — `/api/admin/**` 는 서버가 요청마다 DB 로 다시 본다. 이 훅은 운영자가
 * 아닌 사람에게 운영 메뉴 껍데기가 보이지 않게 하고, 사이드바에 실제 로그인한 사람을 표시하기
 * 위한 것이다.
 *
 * 401 은 로그인 안 됨, 200 + internalAdmin=false 는 권한 없음으로 가른다. 둘 다 같은 안내 화면을
 * 보여 주지만 버튼(로그인 / 워크스페이스로)이 다르다.
 */
export function useAdminSession(): AdminSession {
  const [session, setSession] = useState<AdminSession>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiGet<AdminMe>("/api/auth/me")
      .then((me) => {
        if (cancelled) return;
        if (!me) {
          setSession({ status: "unauthenticated" });
          return;
        }
        setSession(me.internalAdmin ? { status: "ok", me } : { status: "forbidden", me });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 401) {
          setSession({ status: "unauthenticated" });
          return;
        }
        setSession({
          status: "error",
          message:
            e instanceof ApiRequestError
              ? e.message
              : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
