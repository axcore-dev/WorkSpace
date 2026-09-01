package com.axcore.workspace.workspace.admin.dto;

/**
 * 새로 발급한 접속 링크.
 *
 * <p>시스템은 메일을 보내지 않는다. 운영팀이 이 링크를 복사해 담당자에게 직접 전달한다.
 *
 * <p><b>{@code link} 는 이 응답에서만 나간다.</b> 토큰은 해시로만 저장하므로 나중에 다시 꺼낼
 * 수 없고, 목록 조회에도 실리지 않는다. 링크를 잃어버리면 다시 발급하면 된다 — 그때 이전
 * 링크는 회수된다. 살아 있는 링크를 항상 볼 수 있게 두려면 원문을 저장해야 하는데, 그러면
 * DB 덤프 하나로 모든 회사에 들어갈 수 있게 된다.
 *
 * @param link 담당자에게 전달할 URL
 * @param invitation 발급된 초대의 상태
 */
public record InvitationIssuedResponse(String link, InvitationResponse invitation) {
}
