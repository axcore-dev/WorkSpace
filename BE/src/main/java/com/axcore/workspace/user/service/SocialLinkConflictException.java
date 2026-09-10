package com.axcore.workspace.user.service;

/**
 * 로그인한 사용자가 계정 설정에서 소셜 계정을 붙이려 했는데 붙일 수 없는 상태다.
 *
 * <ul>
 *   <li>그 제공자 계정이 <b>이미 다른 사용자에게</b> 연결돼 있다 — 한 제공자 계정은 한 사용자에게만 붙는다.
 *       이 사실은 알려 준다. 남의 주소가 가입돼 있는지가 새는 것이 아니라, 지금 로그인해 동의까지 마친
 *       본인의 제공자 계정에 대한 답이다.
 *   <li>내 계정에 <b>같은 제공자</b>가 이미 다른 식별자로 연결돼 있다 — 계정당 제공자 하나다.
 * </ul>
 *
 * <p>409 로 답한다({@code GlobalExceptionHandler} 의 계정 상태 충돌 묶음). 문구가 곧 안내다.
 */
public class SocialLinkConflictException extends RuntimeException {

    public SocialLinkConflictException(String message) {
        super(message);
    }

    public static SocialLinkConflictException takenByAnotherUser(String providerLabel) {
        return new SocialLinkConflictException(
                "이 " + providerLabel + " 계정은 이미 다른 사용자 계정에 연결되어 있습니다. 다른 " + providerLabel + " 계정으로 시도해 주세요");
    }

    public static SocialLinkConflictException providerAlreadyLinked(String providerLabel) {
        return new SocialLinkConflictException(
                providerLabel + " 계정이 이미 연결되어 있습니다. 다른 계정으로 바꾸려면 먼저 해제해 주세요");
    }
}
