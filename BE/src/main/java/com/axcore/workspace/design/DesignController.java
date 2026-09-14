package com.axcore.workspace.design;

import com.axcore.workspace.design.dto.DrawingCreateRequest;
import com.axcore.workspace.design.dto.DrawingDto;
import com.axcore.workspace.design.dto.MappingRequest;
import com.axcore.workspace.design.dto.RenameRequest;
import com.axcore.workspace.design.dto.RevisionRequest;
import com.axcore.workspace.security.JwtPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 제품설계 — 도면 · BOM. 경로는 재고·물류(`/api/workspace/inventory/*`)와 같은 자리다.
 *
 * <p>화면({@code FE/lib/design-api.ts})이 부르고, 재고·물류의 발주서 작성도 {@code GET /drawings} 를 함께 읽어
 * 도면(BOM)에서 소요를 뽑는다. 회사를 고른 토큰이어야 하고, 탭 권한이 없거나 회사가 탭을 끄면 403 이다.
 */
@RestController
@RequestMapping("/api/workspace/design")
public class DesignController {

    private final DesignReadService read;
    private final DesignWriteService write;

    public DesignController(DesignReadService read, DesignWriteService write) {
        this.read = read;
        this.write = write;
    }

    @GetMapping("/drawings")
    public List<DrawingDto> drawings(@AuthenticationPrincipal Jwt jwt) {
        return read.drawings(JwtPrincipal.of(jwt));
    }

    /** 도면 등록 — 원본 · 파생. 201. */
    @PostMapping("/drawings")
    public ResponseEntity<Void> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DrawingCreateRequest request) {
        write.create(JwtPrincipal.of(jwt), request);
        return ResponseEntity.status(201).build();
    }

    @PostMapping("/drawings/{code}/revisions")
    public ResponseEntity<Void> revise(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String code, @Valid @RequestBody RevisionRequest request) {
        write.revise(JwtPrincipal.of(jwt), code, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/drawings/{code}/name")
    public ResponseEntity<Void> rename(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String code, @Valid @RequestBody RenameRequest request) {
        write.rename(JwtPrincipal.of(jwt), code, request.name());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/drawings/{code}/discard")
    public ResponseEntity<Void> discard(@AuthenticationPrincipal Jwt jwt, @PathVariable String code) {
        write.discard(JwtPrincipal.of(jwt), code);
        return ResponseEntity.noContent().build();
    }

    /** 파생 도면의 「개정 반영 확인」. */
    @PostMapping("/drawings/{code}/acknowledge")
    public ResponseEntity<Void> acknowledge(@AuthenticationPrincipal Jwt jwt, @PathVariable String code) {
        write.acknowledge(JwtPrincipal.of(jwt), code);
        return ResponseEntity.noContent().build();
    }

    /** BOM 한 줄 ↔ 품목 마스터. 본문의 itemCode 가 비면 매핑을 푼다. */
    @PutMapping("/drawings/{code}/bom/{lineId}")
    public ResponseEntity<Void> mapBomLine(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String code,
            @PathVariable long lineId,
            @Valid @RequestBody MappingRequest request) {
        write.mapBomLine(JwtPrincipal.of(jwt), code, lineId, request.itemCode());
        return ResponseEntity.noContent().build();
    }
}
