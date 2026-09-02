package com.axcore.workspace.workspace.admin.dto;

import java.time.Instant;

/**
 * 연동된 외부 시스템 한 대.
 *
 * <p><b>아직 이 값을 만드는 곳이 없다.</b> 연동 규격이 재점검 중이라 항상 빈 목록이 나간다.
 * 목록 화면은 이 배열이 비면 「미연결」로 보여 준다.
 *
 * @param kind ERP · MES · WMS
 * @param state ok · authFail · idle
 */
public record WorkspaceSystemResponse(
        String name, String kind, String site, String state, Instant lastSyncAt) {
}
