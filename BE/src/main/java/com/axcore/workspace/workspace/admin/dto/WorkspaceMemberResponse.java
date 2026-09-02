package com.axcore.workspace.workspace.admin.dto;

import java.time.Instant;

/**
 * 고객사 구성원 한 명. 운영자 콘솔의 「멤버」 탭이 쓴다.
 *
 * <p>테넌트 스키마의 {@code members} 와 {@code shared.users} 를 이어 만든다. 그래서 JPA 엔티티가
 * 아니라 조회 결과 전용 레코드다.
 *
 * @param name 아직 가입하지 않은 초대 상태면 null 일 수 있다. 화면이 "—" 로 대신 보여 준다
 * @param role 역할이 지정되지 않았으면 null
 * @param status active · invited · suspended · left
 * @param lastActiveAt 접속한 적이 없으면 null
 */
public record WorkspaceMemberResponse(
        String name,
        String email,
        String role,
        String status,
        Instant invitedAt,
        Instant lastActiveAt) {
}
