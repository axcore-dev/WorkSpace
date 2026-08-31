package com.axcore.workspace.oauth;

/**
 * 제공자와의 통신이 실패했다.
 *
 * <p>코드가 이미 쓰였거나 만료됐거나, 제공자가 응답을 거절했거나, 응답에 필요한 필드가 없는
 * 경우다. 사용자에게는 전부 같은 문구로 나간다 — 어느 쪽이든 사용자가 할 수 있는 일은
 * "다시 시도" 하나뿐이고, 구분해서 알려 주면 제공자 응답을 탐색하는 데 쓰일 수 있다.
 *
 * <p>원인은 로그에만 남긴다. {@code cause} 를 붙여 두는 것이 그 목적이다.
 */
public class OAuthExchangeException extends RuntimeException {

    public OAuthExchangeException(String message) {
        super(message);
    }

    public OAuthExchangeException(String message, Throwable cause) {
        super(message, cause);
    }
}
