package com.axcore.workspace.oauth;

/**
 * 기존 계정에 이 소셜 계정을 자동으로 붙일 수 없다.
 *
 * <p>두 경우다.
 *
 * <ul>
 *   <li><b>제공자가 이메일 소유를 확인하지 않았다.</b> 이 경우 자동 연결을 허용하면 계정 탈취가
 *       된다 — 아무 제공자 계정에 남의 주소를 적어 두고 로그인하면 그 사람의 계정으로 들어간다.
 *       제공자가 확인해 준 주소일 때만 그 주소의 소유자와 같은 사람이라고 볼 수 있다.
 *   <li><b>그 계정에 이미 같은 제공자가 다른 식별자로 연결돼 있다.</b> 계정당 제공자 하나라는
 *       제약({@code ux_user_identities_user_provider})과 어긋난다.
 * </ul>
 *
 * <p>문구를 구분하지 않는다. 어느 쪽이든 사용자가 할 일은 같다 — 이메일과 비밀번호로 로그인한 뒤
 * 설정에서 직접 연결하는 것이다. 구분해서 알려 주면 "이 주소가 이미 가입돼 있다"는 사실이
 * 새어 나간다.
 */
public class SocialLinkBlockedException extends RuntimeException {

    public SocialLinkBlockedException() {
        super("이 계정으로는 자동 연결할 수 없습니다. 이메일과 비밀번호로 로그인한 뒤 설정에서 연결해 주세요");
    }
}
