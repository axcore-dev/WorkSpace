import { MODULES } from "@/data/modules";
import type { FeatureModuleDto } from "@/lib/workspace-api";

/**
 * 모듈/서브기능 ON-OFF 상태.
 *
 * **원본은 서버다** (`GET /api/workspace/features`, 테넌트 `enabled_features`). 예전에는 localStorage 에만
 * 있어서 브라우저를 바꾸면 사라졌고, 사이드바·AI 답변 범위가 회사의 설정을 알 길이 없었다.
 * 이 파일은 서버 응답을 화면 모양으로 바꾸고, 서버에서 받기 전에 쓸 기본값을 만든다.
 *
 * OFF 상태에서도 데이터는 보존되며 재활성화 시 즉시 복원된다는 운영 원칙에 따라
 * 여기서는 노출 여부만 관리한다.
 */
export type ModuleState = Record<string, { enabled: boolean; subs: Record<string, boolean> }>;

const SYSTEMS_KEY = "axpoint-external-systems";

/**
 * 기본 ON 모듈 — 경영지원·재고물류·영업관리. 나머지는 OFF.
 *
 * BE `FeatureCatalog.DEFAULT_ON` 과 같은 값이어야 한다. 서버에 행이 없는 탭은 저쪽 기본값으로 내려오고,
 * 여기 값은 **응답이 오기 전 첫 렌더**(SSR · 로딩 중)에만 쓰인다. 둘이 다르면 첫 화면이 깜빡인다.
 */
export const DEFAULT_ON_MODULES = new Set(["management", "inventory", "sales"]);

export function defaultModuleState(): ModuleState {
  const state: ModuleState = {};
  for (const m of MODULES) {
    const on = DEFAULT_ON_MODULES.has(m.slug);
    state[m.slug] = {
      enabled: on,
      subs: Object.fromEntries(m.subfunctions.map((s) => [s.id, on])),
    };
  }
  return state;
}

/**
 * 서버 응답 → 화면 상태. 카탈로그(`MODULES`)를 기준으로 채운다.
 *
 * 서버에 없는 모듈·탭은 기본값으로, 카탈로그에 없는 서버 값은 버린다 — 양쪽 카탈로그가 잠깐 어긋나도
 * 화면이 깨지지 않게 한다. 모듈 ON 은 탭에서 파생한다(서버와 같은 규칙).
 */
export function moduleStateFromServer(features: FeatureModuleDto[]): ModuleState {
  const base = defaultModuleState();
  const bySlug = new Map(features.map((f) => [f.module, f]));
  for (const m of MODULES) {
    const f = bySlug.get(m.slug);
    if (!f) continue;
    for (const sub of m.subfunctions) {
      if (typeof f.tabs[sub.id] === "boolean") base[m.slug].subs[sub.id] = f.tabs[sub.id];
    }
    base[m.slug].enabled = Object.values(base[m.slug].subs).some(Boolean);
  }
  return base;
}

export function loadSelectedSystems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SYSTEMS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveSelectedSystems(ids: string[]) {
  localStorage.setItem(SYSTEMS_KEY, JSON.stringify(ids));
}
