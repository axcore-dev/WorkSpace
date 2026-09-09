package com.axcore.workspace.workspace.settings.dto;

import java.time.Instant;
import java.util.List;

/**
 * 설정 › 워크스페이스 › 연동 한 화면. 섹션이 둘이라 응답도 둘이고, 제공자 계정이 하나 더 붙는다.
 *
 * @param systems  외부 시스템(ERP · MES · 센서). 읽기 전용 — 운영팀이 등록한다
 * @param services <b>지금 켜져 있어 쓸 수 있는</b> 외부 서비스 slug. 등록됐고(registered) 켜져 있는 것. AI 대화의 앱 칩이 이걸 본다.
 *                 카탈로그 순서다
 * @param registered 한 번 연결해 둔 앱 전부와 켜짐 여부. 화면의 「외부 서비스」 목록이 이걸 그린다 — 꺼도 사라지지 않고
 *                   비활성으로 남는다. 다시 켤 때 재인증이 필요 없다(제공자 토큰이 그 앱의 스코프를 이미 덮는다)
 * @param accounts 연결된 제공자 계정. 화면이 「구글 · someone@gmail.com」 처럼 보이고, 재연결 필요를 알린다.
 *                 토큰은 절대 여기 실리지 않는다
 * @param editable 내가 연결·해제할 수 있는가 ({@code roles.can_manage_integrations}). 화면 잠금용이다
 */
public record ConnectorsResponse(
        List<ExternalSystemResponse> systems,
        List<String> services,
        List<RegisteredResponse> registered,
        List<AccountResponse> accounts,
        boolean editable) {

    /**
     * @param status ok · delayed · down. 배지 문구와 색은 화면이 정한다
     */
    public record ExternalSystemResponse(long id, String name, String vendor, String kind, String status) {}

    /** @param enabled 지금 켜져 있는가. 꺼진 앱은 목록에 비활성으로 남는다 */
    public record RegisteredResponse(String slug, boolean enabled) {}

    /**
     * @param provider        google · slack · notion
     * @param externalAccount 구글은 이메일, 슬랙은 팀 이름. 못 받았으면 null
     * @param needsReconnect  토큰 갱신이 거절됐다. 사용자가 다시 연결해야 한다
     */
    public record AccountResponse(
            String provider, String externalAccount, boolean needsReconnect, Instant connectedAt) {}
}
