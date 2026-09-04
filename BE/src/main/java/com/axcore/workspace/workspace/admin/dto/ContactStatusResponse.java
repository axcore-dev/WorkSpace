package com.axcore.workspace.workspace.admin.dto;

import java.time.Instant;

/**
 * 담당자가 회사에 어디까지 들어와 있는가. 운영자 콘솔의 「접속 링크」 버튼이 이걸 보고 동작을 정한다.
 *
 * <ul>
 *   <li>{@code EMPTY} — 담당자 이메일이 없다. 발급할 대상이 없다
 *   <li>{@code MEMBER} — 이미 구성원이다. 링크를 새로 낼 이유가 없다. {@code owner} 면 소유자까지 끝난 상태
 *   <li>{@code INVITED} — 살아 있는 초대 링크가 있다(수락·회수 전, 만료 전). 원문은 다시 꺼낼 수 없으니
 *       "이미 초대됨" 을 보여 주고, 재발급은 명시적으로만
 *   <li>{@code NONE} — 계정도 초대도 없다. 링크를 발급해 보낸다
 * </ul>
 *
 * @param email 정규화된 담당자 이메일. EMPTY 면 null
 * @param owner MEMBER 일 때 테넌트 소유자인지. 그 외 false
 * @param invitedAt INVITED 일 때 발급 시각
 * @param expiresAt INVITED 일 때 만료 시각
 */
public record ContactStatusResponse(
        String email, State state, boolean owner, Instant invitedAt, Instant expiresAt) {

    public enum State {
        EMPTY,
        MEMBER,
        INVITED,
        NONE
    }

    public static ContactStatusResponse empty() {
        return new ContactStatusResponse(null, State.EMPTY, false, null, null);
    }

    public static ContactStatusResponse member(String email, boolean owner) {
        return new ContactStatusResponse(email, State.MEMBER, owner, null, null);
    }

    public static ContactStatusResponse invited(String email, Instant invitedAt, Instant expiresAt) {
        return new ContactStatusResponse(email, State.INVITED, false, invitedAt, expiresAt);
    }

    public static ContactStatusResponse none(String email) {
        return new ContactStatusResponse(email, State.NONE, false, null, null);
    }
}
