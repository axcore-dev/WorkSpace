import { Card, SectionHeader } from "@/components/ui";

/**
 * 온톨로지 탭 — 수정요청v10 ③에서 내용을 비웠다.
 *
 * 매핑 표·연결된 시스템 표·필터가 있었지만 매핑 개념 자체가 재점검 중이라 화면부터 비운다.
 * 데이터(`AdminWorkspace.mappings`·`systems`)와 라벨(`MAPPING_STATE_LABEL`·`SYSTEM_STATE_LABEL`)은
 * 남겨 둔다 — 돌아올 화면이다. 지웠던 화면은 커밋 이력에 있다.
 */
export function IntegrationsTab() {
  return (
    <Card>
      <SectionHeader title="온톨로지" />
      <p className="text-sm text-slate-400">온톨로지 매핑은 재점검 중이에요.</p>
    </Card>
  );
}
