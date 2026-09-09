package com.axcore.workspace.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.function.Supplier;

/**
 * 구글 API 호출의 공통 껍데기 — 실패를 우리 예외로 바꾼다.
 *
 * <p>네 클라이언트(캘린더 · Gmail · Drive · Sheets)가 같은 규칙을 쓴다.
 * 401 은 토큰 문제라 {@link ConnectorNotConnectedException} 이고 화면이 「다시 연결」로 안내한다.
 * 403 은 대개 프로젝트에서 그 API 를 켜지 않은 것이다 — 메시지에 힌트를 남긴다.
 * 404 는 id·범위 오타다. 나머지는 {@link ConnectorProviderException} 으로 502 다. 원인은 로그에만 남긴다.
 */
@Component
public class GoogleApi {

    private static final Logger log = LoggerFactory.getLogger(GoogleApi.class);

    private final RestClient rest;

    public GoogleApi(RestClient oauthRestClient) {
        this.rest = oauthRestClient;
    }

    /** 요청은 호출부가 만든다(uri · 메서드 · 본문 · 인증 헤더). 여기는 실패 변환만 한다 */
    public RestClient rest() {
        return rest;
    }

    public <T> T call(String what, Supplier<T> request) {
        try {
            return request.get();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                throw new ConnectorNotConnectedException("구글 연결이 만료됐습니다. 다시 연결해 주세요");
            }
            if (e.getStatusCode() == HttpStatus.FORBIDDEN) {
                log.warn("구글 {} 403. 해당 API 가 프로젝트에서 켜져 있는지 확인: {}", what, e.getMessage());
                throw new ConnectorProviderException(
                        "구글이 " + what + "을(를) 거절했습니다. 구글 클라우드에서 해당 API 활성화와 권한을 확인해 주세요", e);
            }
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                throw new ConnectorProviderException(what + " 대상을 찾을 수 없습니다. id 나 범위를 확인해 주세요", e);
            }
            log.warn("구글 {} 실패", what, e);
            throw new ConnectorProviderException("구글 " + what + "에 실패했습니다", e);
        } catch (RestClientException e) {
            log.warn("구글 {} 실패", what, e);
            throw new ConnectorProviderException("구글 " + what + "에 실패했습니다", e);
        }
    }

    /** 인증 헤더 값. 클라이언트가 매 요청에 붙인다 */
    public static String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }
}
