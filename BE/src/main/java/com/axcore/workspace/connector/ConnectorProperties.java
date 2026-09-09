package com.axcore.workspace.connector;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 외부 서비스 연동 설정. {@code app.connector.*} 로 주입된다.
 *
 * @param tokenKey          토큰 암호화 키. base64 로 적은 32바이트. 비어 있으면 연결 자체가 503 이다 —
 *                          평문으로 저장하는 대체 경로를 두지 않는다
 * @param googleRedirectUri 구글이 code 를 돌려보내는 주소 — <b>연동 화면 자체</b>다. 그 화면이 주소의 code·state 를 서버에
 *                          넘겨 마무리하므로 중간 페이지가 없다. 구글 콘솔에 같은 주소가 등록돼 있어야 한다.
 *                          기본값은 properties 에서 FE 주소(MAIL_BASE_URL)로 만든다
 */
@ConfigurationProperties(prefix = "app.connector")
public record ConnectorProperties(
        @DefaultValue("") String tokenKey, @DefaultValue("") String googleRedirectUri) {

    public boolean configured() {
        return !tokenKey.isBlank();
    }
}
