package com.axcore.workspace.oauth;

import com.axcore.workspace.user.entity.AuthProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Configuration
@EnableConfigurationProperties(OAuthProperties.class)
public class OAuthConfig {

    /**
     * 제공자 호출용 {@link RestClient}.
     *
     * <p>타임아웃을 명시하는 것이 이 빈의 존재 이유다. 기본값은 무한 대기라서, 제공자가 응답하지
     * 않으면 로그인 요청이 끝나지 않는다. 가상 스레드를 쓰고 있어 스레드 고갈로 번지지는 않지만
     * 사용자 쪽에서는 화면이 멈춘 것과 같다.
     *
     * <p>로그인 흐름 안에서 사용자가 기다리는 호출이라 짧게 잡는다. 실패하면 다시 누르는 편이
     * 20초를 기다리는 것보다 낫다.
     *
     * <p>{@code JdkClientHttpRequestFactory} 를 직접 쓰는 이유: Boot 3.4 계열의
     * {@code ClientHttpRequestFactoryBuilder} 가 Boot 4 코어에는 없다. JDK {@link HttpClient} 와
     * spring-web 만으로 같은 일을 하므로 모듈 위치에 흔들리지 않는다. 연결 타임아웃은
     * {@code HttpClient} 쪽에, 읽기 타임아웃은 팩토리 쪽에 있다.
     */
    @Bean
    RestClient oauthRestClient() {
        HttpClient httpClient =
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().requestFactory(requestFactory).build();
    }

    /**
     * 제공자별 클라이언트 조회표.
     *
     * <p>{@code List<OAuthClient>} 를 받아 맵으로 접는다. 제공자를 추가할 때 이 파일을 고치지 않기
     * 위한 것이다 — 새 {@code @Component} 하나만 만들면 자동으로 들어온다.
     */
    @Bean
    OAuthClientRegistry oauthClientRegistry(List<OAuthClient> clients) {
        Map<AuthProvider, OAuthClient> byProvider =
                clients.stream()
                        .collect(Collectors.toMap(OAuthClient::provider, Function.identity()));
        return provider -> Optional.ofNullable(byProvider.get(provider));
    }

    /** 함수형 인터페이스 하나짜리 조회표. 별도 클래스를 만들 만한 내용이 없다. */
    @FunctionalInterface
    public interface OAuthClientRegistry {
        Optional<OAuthClient> find(AuthProvider provider);
    }
}
