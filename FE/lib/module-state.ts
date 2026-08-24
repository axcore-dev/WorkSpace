import { MODULES } from "@/data/modules";

/**
 * 모듈/서브기능 ON-OFF 상태 (localStorage 저장).
 * OFF 상태에서도 데이터는 보존되며 재활성화 시 즉시 복원된다는 운영 원칙에 따라
 * 여기서는 노출 여부만 관리한다.
 */
export type ModuleState = Record<string, { enabled: boolean; subs: Record<string, boolean> }>;

const STORAGE_KEY = "axpoint-modules";
const SYSTEMS_KEY = "axpoint-external-systems";

/** 데모 기본 ON 모듈 — 경영지원·재고물류·영업관리. 나머지는 OFF. */
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

export function loadModuleState(): ModuleState {
  if (typeof window === "undefined") return defaultModuleState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultModuleState();
    const parsed = JSON.parse(raw) as ModuleState;
    // 카탈로그와 병합해 누락 키 보정
    const base = defaultModuleState();
    for (const slug of Object.keys(base)) {
      if (parsed[slug]) {
        base[slug].enabled = parsed[slug].enabled;
        for (const sub of Object.keys(base[slug].subs)) {
          if (typeof parsed[slug].subs?.[sub] === "boolean") {
            base[slug].subs[sub] = parsed[slug].subs[sub];
          } else {
            // 저장 이후 카탈로그에 추가된 신규 서브기능 — 모듈 상태를 따라간다
            base[slug].subs[sub] = parsed[slug].enabled;
          }
        }
      }
    }
    return base;
  } catch {
    return defaultModuleState();
  }
}

export function saveModuleState(state: ModuleState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
