import type { ModulePageData } from "./types";
import { PAGE as management } from "./pages/management";
import { PAGE as design } from "./pages/design";
import { PAGE as production } from "./pages/production";
import { PAGE as equipment } from "./pages/equipment";
import { PAGE as quality } from "./pages/quality";
import { PAGE as inventory } from "./pages/inventory";
import { PAGE as sales } from "./pages/sales";
import { PAGE as support } from "./pages/support";

/**
 * 8대 모듈 상세 페이지 더미 데이터.
 * 실제 내용은 `data/pages/<모듈>.ts` 에 모듈별로 있다. 이 파일은 모아 주는 배럴이다.
 */
export const MODULE_PAGES: Record<string, ModulePageData> = {
  management,
  design,
  production,
  equipment,
  quality,
  inventory,
  sales,
  support,
};
