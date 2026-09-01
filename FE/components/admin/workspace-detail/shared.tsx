"use client";

import { IconPencil } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Button, SectionHeader } from "@/components/ui";
import type { AdminWorkspace, WsStatus } from "@/data/admin";

export type Save = (patch: Partial<AdminWorkspace>) => void;

/** 카드 제목 + '수정' 버튼. 읽기 뷰는 항상 보이므로 버튼을 숨기지 않는다 */
export function EditHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <SectionHeader
      title={title}
      action={
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <IconPencil size={13} />
          수정
        </Button>
      }
    />
  );
}

/**
 * 카드 수정 팝업 — 저장·닫기 줄까지 포함한다.
 *
 * 왼쪽 버튼이 「닫기」인 것은 DESIGN.md UX 라이팅 규칙이다(다이얼로그 왼쪽 버튼은 [닫기]로 통일).
 * 여기 한 곳에 두면 카드마다 같은 줄을 네 번 쓰지 않아도 되고, 문구도 한 번에 바뀐다.
 */
export function EditModal({
  open,
  onClose,
  title,
  canSave = true,
  onSave,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  canSave?: boolean;
  onSave: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            title={canSave ? undefined : "필수 항목을 채우면 저장할 수 있어요"}
          >
            저장
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">{children}</div>
    </Modal>
  );
}

export const STATUS_TONE: Record<WsStatus, "green" | "slate" | "amber"> = {
  active: "green",
  pending: "slate",
  suspended: "amber",
};
