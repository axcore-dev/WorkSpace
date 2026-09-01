package com.axcore.workspace.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 인증 설정.
 *
 * <p>요청마다 도는 것은 리소스 서버의 Bearer 필터 하나뿐이다. 서명·만료·발급자만 보고 통과시키며
 * DB 를 보지 않는다. 그래서 강제 로그아웃이 access TTL 만큼 늦게 적용된다. 즉시 끊어야 하는
 * 경우(비밀번호 변경 등)는 refresh 를 revoke 하는 것으로 처리한다.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({JwtProperties.class, AuthProperties.class})
public class SecurityConfig {

    /**
     * CSRF 를 끄는 이유: 상태 없는 Bearer 토큰 API 다. 다만 refresh 는 쿠키로 오가므로 그 경로에만
     * CSRF 표면이 남는다. 쿠키의 SameSite 로 막고, 교차 출처 스크립트는 CORS 때문에 재발급된
     * 응답 본문을 읽을 수 없다.
     */
    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtDecoder jwtDecoder,
            AuthenticationEntryPoint authenticationEntryPoint,
            AccessDeniedHandler accessDeniedHandler)
            throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        registry ->
                                registry
                                        // 토큰이 없는 상태에서 부르는 것들.
                                        //
                                        // mfa/verify — 로그인 도중이라 access 토큰이 아직 없다.
                                        //   챌린지 토큰과 코드를 함께 가진 것이 자격 증명이다.
                                        // email/verify · password/reset — 메일 링크는 로그인하지
                                        //   않은 브라우저에서 열린다. 토큰을 가진 것이 곧
                                        //   그 메일함을 열었다는 증거다.
                                        // password/reset-request — 비밀번호를 잊은 사람이 쓴다.
                                        //   가입 여부와 무관하게 항상 같은 응답을 준다.
                                        // oauth/{provider} — 소셜 로그인. 제공자가 발급한
                                        //   authorization code 를 가진 것이 자격 증명이다.
                                        .requestMatchers(
                                                "/api/auth/signup",
                                                "/api/auth/login",
                                                "/api/auth/refresh",
                                                "/api/auth/logout",
                                                "/api/auth/oauth/*",
                                                "/api/auth/mfa/verify",
                                                "/api/auth/email/verify",
                                                "/api/auth/password/reset-request",
                                                "/api/auth/password/reset")
                                        .permitAll()
                                        .requestMatchers("/actuator/health/**")
                                        .permitAll()
                                        // 처리되지 않은 예외는 서블릿 컨테이너가 /error 로 다시
                                        // 태운다. 이 경로가 막혀 있으면 400 이어야 할 응답이
                                        // 전부 401 로 뒤바뀌어 원인을 못 찾는다.
                                        .requestMatchers("/error")
                                        .permitAll()
                                        // 운영자 콘솔. 여기서는 "로그인했는가" 까지만 가른다.
                                        //
                                        // 운영자인지는 shared.users.is_internal_admin 이고,
                                        // 그 값을 토큰에 싣지 않기 때문에 경로 규칙으로 막을 수
                                        // 없다. access 토큰은 최대 TTL 만큼 살아 있어서
                                        // 클레임으로 두면 권한을 회수해도 그동안 계속 통한다.
                                        // 실제 판정은 AdminWorkspaceService#requireInternalAdmin
                                        // 이 요청 시점의 DB 로 한다.
                                        .requestMatchers("/api/admin/**")
                                        .authenticated()
                                        .anyRequest()
                                        .authenticated())
                .oauth2ResourceServer(
                        oauth2 ->
                                oauth2.jwt(jwt -> jwt.decoder(jwtDecoder))
                                        .authenticationEntryPoint(authenticationEntryPoint)
                                        .accessDeniedHandler(accessDeniedHandler))
                .exceptionHandling(
                        e ->
                                e.authenticationEntryPoint(authenticationEntryPoint)
                                        .accessDeniedHandler(accessDeniedHandler));
        return http.build();
    }

    /** 인증 실패도 JSON 으로 돌려준다. 기본 동작은 본문 없는 401 이라 FE 가 분기할 근거가 없다. */
    @Bean
    AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, exception) ->
                writeError(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "인증이 필요합니다");
    }

    @Bean
    AccessDeniedHandler accessDeniedHandler() {
        return (request, response, exception) ->
                writeError(response, HttpStatus.FORBIDDEN, "FORBIDDEN", "권한이 없습니다");
    }

    private static void writeError(
            HttpServletResponse response, HttpStatus status, String code, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"%s\",\"message\":\"%s\"}".formatted(code, message));
    }

    /** 접두사가 붙는 인코더다. 나중에 argon2id 로 바꿔도 기존 해시가 그대로 검증된다. */
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /**
     * hideUserNotFoundExceptions 는 기본값(true) 그대로 둔다. 없는 계정과 틀린 비밀번호가 같은
     * 예외로 나와야 응답으로 계정 존재 여부가 새지 않는다. (명세 2.1.4)
     */
    @Bean
    AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    private static SecretKey secretKey(JwtProperties properties) {
        return new SecretKeySpec(properties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(JwtProperties properties) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(properties)));
    }

    /**
     * 알고리즘을 HS256 으로 못 박는다. 토큰이 스스로 알고리즘을 고르게 두면 alg 를 바꿔치기하는
     * 고전적인 우회가 열린다. 발급자(iss)도 함께 검증한다.
     */
    @Bean
    JwtDecoder jwtDecoder(JwtProperties properties) {
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withSecretKey(secretKey(properties))
                        .macAlgorithm(MacAlgorithm.HS256)
                        .build();
        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(
                        JwtValidators.createDefault(),
                        new JwtIssuerValidator(properties.issuer())));
        return decoder;
    }

    /**
     * refresh 쿠키를 주고받으려면 credentials 를 허용해야 하고, 그러면 Origin 에 와일드카드를 쓸
     * 수 없다. 허용 출처를 설정으로만 받는 이유다.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(AuthProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(properties.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
