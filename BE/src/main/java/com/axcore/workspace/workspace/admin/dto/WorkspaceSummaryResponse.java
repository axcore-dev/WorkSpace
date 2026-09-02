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
        int memberCount,
        int systemCount,
        Instant lastActiveAt,
        Instant createdAt) {

    /**
     * @param memberCount {@code shared.user_workspace_memberships} 기준. 목록 한 화면에
     *     회사가 수십 개라 회사마다 테넌트 스키마를 여는 대신 공용 라우팅 인덱스를 센다.
     *     상세 화면의 구성원 목록은 테넌트 스키마에서 읽으므로 근거가 다르다 — 초대 수락이
     *     양쪽에 함께 쓰므로 값은 같아야 하고, 어긋난다면 그 자체가 조사할 신호다.
     */
    public static WorkspaceSummaryResponse from(Workspace w, int memberCount) {
        return new WorkspaceSummaryResponse(
                w.getId(),
                w.getName(),
                w.getBizNumber(),
                w.getPlan(),
                ConsoleStatus.of(w.getStatus()),
                w.getSchemaName(),
                w.getOperatorName(),
                w.getLinkSentAt(),
                w.getLinkOpenedAt() != null,
                memberCount,
                // 연동은 아직 만드는 곳이 없다. 목록은 0 을 「미연결」로 보여 준다.
                0,
                // 목록에서 회사마다 테넌트 스키마를 열지 않는다. 마지막 활동은 상세에서만 읽는다.
                null,
                w.getCreatedAt());
    }
}
