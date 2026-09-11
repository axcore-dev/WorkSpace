package com.axcore.workspace.user.introspection;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * introspect 판정 결과. FE 안의 AI 서버가 이 값으로 "누가 어느 회사 스키마에서 무엇을 할 수 있는가" 를 정한다.
 *
 * <p>{@code schemaName} 이 핵심이다. AI 서버는 이 값 외의 어떤 경로로도 스키마 이름을 얻지 않는다.
 * 클라이언트가 보낸 값으로 스키마를 열면 남의 회사 문서를 검색하는 길이 생긴다.
 *
 * @param modules 이 사용자가 쓸 수 있는 기능(모듈) slug. AI 는 이 분야의 자료·질문에만 답한다
 *                ({@link ModuleAccessReader}). 비어 있으면 어떤 분야도 열리지 않는다.
 * @param tokenExpiresAt access 토큰의 exp. AI 서버가 판정을 캐시할 때 상한으로 쓴다
 */
public record IntrospectionResponse(
        UUID userId,
        UUID sessionId,
        String email,
        String name,
        Long workspaceId,
        String workspaceName,
        String schemaName,
        List<String> modules,
        List<String> tabs,
        Instant tokenExpiresAt) {
}
