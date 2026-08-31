"use client";

import { IconPencil } from "@/components/icons";
import { Button, SectionHeader } from "@/components/ui";
import type {
  AdminWorkspace,
  MappingState,
  SystemState,
  WsStatus,
} from "@/data/admin";

export type Save = (patch: Partial<AdminWorkspace>) => void;

/** 카드 제목 + '수정' 버튼. 편집 중일 때는 버튼을 숨긴다 */
export function EditHeader({
  title,
  desc,
  editing,
  onEdit,
}: {
  title: string;
  desc?: string;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <SectionHeader
      title={title}
      desc={desc}
      action={
        editing ? undefined : (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <IconPencil size={13} />
            수정
          </Button>
        )
      }
    />
  );
}

export const STATUS_TONE: Record<WsStatus, "green" | "slate" | "amber"> = {
  live: "green",
  invited: "slate",
  suspended: "amber",
};

export const SYSTEM_TONE: Record<SystemState, "green" | "red" | "slate"> = {
  ok: "green",
  authFail: "red",
  idle: "slate",
};

export const MAPPING_TONE: Record<MappingState, "green" | "amber" | "red"> = {
  mapped: "green",
  review: "amber",
  unmapped: "red",
};
