package com.axcore.workspace.security;

import com.axcore.workspace.user.introspection.IntrospectionRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 서비스 간 호출임을 증명하는 {@code X-Internal-Token} 검사.
 *
 * <p>FE 안의 AI 서버가 BE 를 부를 때 두 겹으로 증명한다 — 사용자 access 토큰(누구를 대신하는가)과 이 헤더(자기가
 * 서비스인가). 브라우저의 클라이언트 코드는 이 비밀을 갖지 않으므로, 이 검사가 걸린 경로는 사람이 직접 두드릴 수 없다.
 * introspect({@code TokenIntrospectionService})가 먼저 썼고, 연동 내부 엔드포인트가 같은 검사를 쓴다.
 *
 * <p>비밀이 비어 있으면 <b>전부 거부</b>한다. 열어 두는 기본값은 설정을 잊은 배포에서 내부 경로가 익명에게 열리는
 * 구멍이 된다. 길이가 달라도 {@link MessageDigest#isEqual} 로 비교한다 — 문자열 {@code equals} 는 앞에서부터
 * 다른 자리를 찾는 순간 끝나 시간이 새어 나간다.
 */
@Component
public class InternalCallerGuard {

    private final AuthProperties properties;

    public InternalCallerGuard(AuthProperties properties) {
        this.properties = properties;
    }

    public void require(String internalToken) {
        String expected = properties.internalToken();
        if (expected == null || expected.isBlank()) {
            throw new IntrospectionRejectedException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "INTROSPECTION_DISABLED",
                    "서비스 간 호출이 비활성화되어 있습니다. AUTH_INTERNAL_TOKEN 을 확인하세요");
        }
        byte[] given = internalToken == null ? new byte[0] : internalToken.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given)) {
            throw new IntrospectionRejectedException(HttpStatus.FORBIDDEN, "FORBIDDEN", "권한이 없습니다");
        }
    }
}
