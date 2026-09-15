package com.axcore.workspace.external;

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
 * 외부 시스템 온톨로지 · 읽기 — AI 의 업무 데이터 도구가 사용자 토큰으로 부른다. 화면은 아직 부르지 않는다.
 *
 * <ul>
 *   <li>{@code GET /api/workspace/external/ontology} — 이 회사의 개념 전부(모델용 설명만, SQL 없음). FE 가 탭으로 거른다</li>
 *   <li>{@code GET /api/workspace/external/{systemId}/{conceptId}?컬럼=값…} — 쿼리 파라미터는 전부 동등 조건이고, 개념의 허용
 *       컬럼만 받는다({@link ExternalQuery})</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/workspace/external")
public class ExternalController {

    private final ExternalReadService read;

    public ExternalController(ExternalReadService read) {
        this.read = read;
    }

    /**
     * 모델이 보는 개념. SQL · 허용 컬럼은 싣지 않는다 — 모델이 볼 이유가 없고, 프롬프트에 고객 DB 구조가 실리지 않게.
     *
     * @param filterColumns 예외로 싣는다: FE 가 동등 조건만 쿼리 파라미터로 넘기려면 어느 컬럼이 되는지 알아야 한다
     */
    public record ConceptResponse(
            long systemId, String systemName, String systemKind, String conceptId, String name, List<String> synonyms, String tab,
            String description, Map<String, String> attrs, List<ExternalConcept.Relation> relations, String formula, List<String> filterColumns) {
        static ConceptResponse of(ExternalConcept c) {
            return new ConceptResponse(c.systemId(), c.systemName(), c.systemKind(), c.conceptId(), c.name(), c.synonyms(), c.tab(),
                    c.description(), c.attrs(), c.relations(), c.formula(), c.filterColumns());
        }
    }

    @GetMapping("/ontology")
    public List<ConceptResponse> ontology(@AuthenticationPrincipal Jwt jwt) {
        return read.ontology(JwtPrincipal.of(jwt)).stream().map(ConceptResponse::of).toList();
    }

    @GetMapping("/{systemId}/{conceptId}")
    public List<Map<String, Object>> read(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long systemId,
            @PathVariable String conceptId,
            @RequestParam Map<String, String> equals) {
        return read.read(JwtPrincipal.of(jwt), systemId, conceptId, equals);
    }
}
