package com.axcore.workspace.workspace.admin.dto;

/**
 * 사용량과 한도.
 *
 * <p><b>아직 집계하는 곳이 없다.</b> 지금은 전부 0 이 나간다. 화면은 이 값으로 「이번 달 예상
 * 금액」을 계산하므로 필드가 없으면 계산 자체가 깨지고, 그래서 값이 없더라도 형태는 유지한다.
 *
 * <p>0 을 내보내는 것과 필드를 빼는 것의 차이: 빼면 화면이 "이 회사는 사용량 개념이 없다" 로
 * 읽고, 0 을 주면 "아직 쓴 것이 없다" 로 읽는다. 후자가 사실에 가깝다.
 *
 * @param syncLimit null 이면 무제한
 */
public record WorkspaceUsageResponse(
        long storageGb,
        long storageLimitGb,
        long queries,
        long queryLimit,
        long syncs,
        Long syncLimit) {

    /** 집계가 붙기 전까지 모든 워크스페이스가 이 값을 받는다. */
    public static WorkspaceUsageResponse empty() {
        return new WorkspaceUsageResponse(0, 0, 0, 0, 0, null);
    }
}
