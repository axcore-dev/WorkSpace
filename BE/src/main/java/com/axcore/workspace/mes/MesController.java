package com.axcore.workspace.mes;

import com.axcore.workspace.security.JwtPrincipal;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 고객사 MES 읽기 — AI 의 업무 데이터 도구가 사용자 토큰으로 부른다. 화면은 아직 부르지 않는다.
 *
 * <p>{@code GET /api/workspace/mes/{concept}?컬럼=값…} — 쿼리 파라미터는 전부 동등 조건이고, 개념의 허용 목록에
 * 있는 컬럼만 받는다({@link MesConcepts}). 권한 · 기능 켜짐은 생산관리(품질 개념은 품질검사) 모듈 읽기 규칙이다.
 */
@RestController
@RequestMapping("/api/workspace/mes")
public class MesController {

    private final MesReadService read;

    public MesController(MesReadService read) {
        this.read = read;
    }

    @GetMapping("/{concept}")
    public List<Map<String, Object>> read(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String concept,
            @RequestParam Map<String, String> equals) {
        return read.read(JwtPrincipal.of(jwt), concept, equals);
    }
}
