package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.workspace.entity.Workspace;

import java.time.Instant;

/**
 * 운영자 목록 화면의 한 줄.
 *
 * <p>상세와 나누는 이유는 사업장·담당자·참조 수신이 전부 별도 조회이기 때문이다. 목록에서
 * 그것들을 함께 끌어오면 회사 수만큼 쿼리가 늘어나는데(N+1), 목록 화면은 쓰지도 않는다.
 */
public record WorkspaceSummaryResponse(
        Long id,
        String name,
        String bizNumber,
        String plan,
        String status,
        String schemaName,
        String operatorName,
        Instant linkSentAt,
        /** 접속 링크를 열었는가. 개설했는데 아무도 들어오지 않은 회사를 목록에서 가려낸다. */
        boolean linkOpened,
        Instant createdAt) {

    public static WorkspaceSummaryResponse from(Workspace w) {
        return new WorkspaceSummaryResponse(
                w.getId(),
                w.getName(),
                w.getBizNumber(),
                w.getPlan(),
                w.getStatus().dbValue(),
                w.getSchemaName(),
                w.getOperatorName(),
                w.getLinkSentAt(),
                w.getLinkOpenedAt() != null,
                w.getCreatedAt());
    }
}
