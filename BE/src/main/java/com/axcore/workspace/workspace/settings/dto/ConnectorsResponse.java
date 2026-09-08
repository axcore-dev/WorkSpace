package com.axcore.workspace.workspace.settings.dto;

import java.util.List;

/**
 * 설정 › 워크스페이스 › 연동 한 화면. 섹션이 둘이라 응답도 둘이다.
 *
 * @param systems  외부 시스템(ERP · MES · 센서). 읽기 전용 — 운영팀이 등록한다
 * @param services 이 회사가 연결한 외부 서비스 slug. 카탈로그 순서다
 * @param editable 내가 연결·해제할 수 있는가 ({@code roles.can_manage_integrations}). 화면 토글 잠금용이다
 */
public record ConnectorsResponse(
        List<ExternalSystemResponse> systems, List<String> services, boolean editable) {

    /**
     * @param status ok · delayed · down. 배지 문구와 색은 화면이 정한다
     */
    public record ExternalSystemResponse(long id, String name, String vendor, String kind, String status) {}
}
