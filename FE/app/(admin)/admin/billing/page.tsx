"use client";

import { Breadcrumb } from "@/components/admin/breadcrumb";
import { IconGauge } from "@/components/icons";
import { Button, Card, EmptyState } from "@/components/ui";

/**
 * 사용량 · 요금.
 *
 * 청구·사용량 API 가 아직 BE 에 없다. 전에는 더미 워크스페이스로 표를 채웠는데, 운영 화면에
 * 가짜 회사·가짜 미수금이 보이면 실제 상태와 구분이 안 된다. BE 가 붙기 전까지는 빈 상태로
 * 두고 어디서 무엇을 볼 수 있는지만 안내한다.
 *
 * BE 연동 시 여기에 넣을 것: 기간 선택(월), 고객사별 사용량·예상 청구액·미수금 표, CSV 내려받기.
 */
export default function AdminBillingPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "사용량 · 요금" }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">사용량 · 요금</h1>
      </div>

      <Card className="mt-5">
        <EmptyState
          icon={<IconGauge size={28} />}
          title="사용량·요금 데이터가 아직 연동되지 않았어요"
          desc="청구 API 가 준비되면 고객사별 사용량과 예상 청구액이 여기에 표시됩니다. 요금제는 워크스페이스 목록에서 확인할 수 있어요."
          action={
            <Button variant="secondary" href="/admin/workspaces">
              워크스페이스 목록으로
            </Button>
          }
        />
      </Card>
    </div>
  );
}
