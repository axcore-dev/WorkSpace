package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.connector.TokenCipher;
import com.axcore.workspace.mes.MesDataSource;
import com.axcore.workspace.workspace.admin.dto.ExternalSystemAdminResponse;
import com.axcore.workspace.workspace.admin.dto.ExternalSystemRequest;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 운영 콘솔 › 워크스페이스 › 연동 — 회사의 외부 시스템 행({@code external_systems}) 등록 · 수정 · 삭제 · 연결 테스트.
 *
 * <p>테넌트 표를 운영자가 만지는 유일한 자리다. {@link TenantSearchPath} 로 그 회사 스키마를 열고 JDBC 로 바로 쓴다
 * ({@link WorkspaceMemberReader} 와 같은 방식). 스키마 이름을 SQL 에 이어 붙이지 않는다.
 *
 * <p>비밀번호는 {@link TokenCipher} 로 잠가 저장하고 응답에는 절대 싣지 않는다. 수정 본문의 비밀번호가 비면 저장된 값을
 * 유지한다. 접속 정보가 있는 MES 는 회사당 하나다 — AI 가 어느 MES 를 읽을지 하나로 정해져야 한다
 * ({@code MesDataSourceRegistry}). 행을 바꾸면 {@code updated_at} 이 바뀌어 레지스트리가 다음 조회부터 새 풀을 연다.
 *
 * <p>감사 로그는 워크스페이스 {@code update} 로 남기고 무엇을 했는지는 detail 에 적는다 — 행위 종류를 늘리면 shared 의
 * CHECK 제약까지 늘려야 해서 그러지 않는다.
 */
@Service
public class AdminExternalSystemService {

    private static final String COLUMNS =
            "id, name, vendor, kind, status, host, port, db_name, db_user, db_password_enc is not null as has_password, sslmode, updated_at";

    private static final RowMapper<ExternalSystemAdminResponse> ROW = (rs, i) -> new ExternalSystemAdminResponse(
            rs.getLong("id"), rs.getString("name"), rs.getString("vendor"), rs.getString("kind"), rs.getString("status"),
            rs.getString("host"), rs.getInt("port"), rs.getString("db_name"), rs.getString("db_user"),
            rs.getBoolean("has_password"), rs.getString("sslmode"), toInstant(rs.getTimestamp("updated_at")));

    private final WorkspaceRegistrar registrar;
    private final TenantSearchPath searchPath;
    private final JdbcTemplate jdbc;
    private final TokenCipher cipher;
    private final AdminAuditRecorder audit;

    public AdminExternalSystemService(
            WorkspaceRegistrar registrar, TenantSearchPath searchPath, JdbcTemplate jdbc, TokenCipher cipher, AdminAuditRecorder audit) {
        this.registrar = registrar;
        this.searchPath = searchPath;
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<ExternalSystemAdminResponse> list(Long workspaceId) {
        open(workspaceId);
        return jdbc.query("select " + COLUMNS + " from external_systems order by sort_order, id", ROW);
    }

    @Transactional
    public ExternalSystemAdminResponse create(UUID actor, Long workspaceId, ExternalSystemRequest req) {
        open(workspaceId);
        validate(req, null);
        String enc = req.linked() ? cipher.encrypt(req.password()) : null;
        Long id = jdbc.queryForObject(
                """
                insert into external_systems (name, vendor, kind, host, port, db_name, db_user, db_password_enc, sslmode, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
                returning id
                """,
                Long.class,
                req.name().strip(), req.vendor().strip(), req.kind(), nullIfBlank(req.host()), req.portOrDefault(),
                nullIfBlank(req.dbName()), nullIfBlank(req.dbUser()), enc, req.sslmodeOrDefault());
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "외부 시스템 등록: " + req.name().strip());
        return get(id);
    }

    @Transactional
    public ExternalSystemAdminResponse update(UUID actor, Long workspaceId, long id, ExternalSystemRequest req) {
        open(workspaceId);
        ExternalSystemAdminResponse before = get(id);
        validate(req, id);
        boolean keepPassword = req.linked() && (req.password() == null || req.password().isBlank());
        String enc = !req.linked() ? null : keepPassword ? null : cipher.encrypt(req.password());
        jdbc.update(
                """
                update external_systems
                   set name = ?, vendor = ?, kind = ?, host = ?, port = ?, db_name = ?, db_user = ?,
                       db_password_enc = case when ? then db_password_enc else ? end,
                       sslmode = ?, updated_at = now()
                 where id = ?
                """,
                req.name().strip(), req.vendor().strip(), req.kind(), nullIfBlank(req.host()), req.portOrDefault(),
                nullIfBlank(req.dbName()), nullIfBlank(req.dbUser()), keepPassword, enc, req.sslmodeOrDefault(), id);
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "외부 시스템 수정: " + before.name());
        return get(id);
    }

    @Transactional
    public void delete(UUID actor, Long workspaceId, long id) {
        open(workspaceId);
        ExternalSystemAdminResponse before = get(id);
        jdbc.update("delete from external_systems where id = ?", id);
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "외부 시스템 삭제: " + before.name());
    }

    /**
     * 저장된 접속 정보로 한 번 붙어 본다. 성공이면 empty, 실패면 드라이버가 준 이유. 저장된 status 도 그 결과로 바꾼다 —
     * 화면의 배지가 마지막 테스트 결과를 보인다.
     */
    @Transactional
    public Optional<String> test(Long workspaceId, long id) {
        open(workspaceId);
        ExternalSystemAdminResponse row = get(id);
        if (row.host() == null) {
            return Optional.of("접속 정보가 없는 시스템이에요");
        }
        String enc = jdbc.queryForObject("select db_password_enc from external_systems where id = ?", String.class, id);
        Optional<String> problem = MesDataSource.probe(
                new MesDataSource.Connection(row.id(), row.host(), row.port(), row.dbName(), row.dbUser(), row.sslmode(), ""),
                enc == null ? "" : cipher.decrypt(enc));
        // status 만 바꾸고 updated_at 은 두지 않는다 — 테스트가 풀을 다시 열게 하면 안 된다
        jdbc.update("update external_systems set status = ? where id = ?", problem.isEmpty() ? "ok" : "down", id);
        return problem;
    }

    // ── 안쪽 ────────────────────────────────────────────────────────────────

    /** 회사 스키마를 연다. 개설 전이면 만질 표가 없다. */
    private void open(Long workspaceId) {
        String schema = registrar.schemaNameOf(workspaceId);
        if (schema == null || schema.isBlank()) {
            throw new WorkspaceStateException("아직 개설되지 않은 회사예요. 개설이 끝난 뒤에 등록할 수 있어요");
        }
        searchPath.bind(schema);
    }

    private ExternalSystemAdminResponse get(long id) {
        List<ExternalSystemAdminResponse> rows =
                jdbc.query("select " + COLUMNS + " from external_systems where id = ?", ROW, id);
        if (rows.isEmpty()) {
            throw new SettingsNotFoundException("외부 시스템을 찾지 못했어요");
        }
        return rows.getFirst();
    }

    /** 짝이 맞는 접속 정보인지, 그리고 접속 정보가 있는 MES 가 이미 있지 않은지. {@code exceptId} 는 수정 중인 행. */
    private void validate(ExternalSystemRequest req, Long exceptId) {
        boolean hasStored = exceptId != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "select db_password_enc is not null from external_systems where id = ?", Boolean.class, exceptId));
        req.connectionProblem(hasStored).ifPresent(m -> { throw new SettingsValidationException(m); });
        if (!cipher.available() && req.linked() && req.password() != null && !req.password().isBlank()) {
            throw new SettingsValidationException("연동 토큰 키(CONNECTOR_TOKEN_KEY)가 없어 비밀번호를 저장할 수 없어요");
        }
        if (req.linked() && "MES".equals(req.kind())) {
            Integer others = jdbc.queryForObject(
                    "select count(*) from external_systems where kind = 'MES' and host is not null and id <> coalesce(?, -1)",
                    Integer.class, exceptId);
            if (others != null && others > 0) {
                throw new SettingsValidationException("접속 정보가 있는 MES 는 회사당 하나예요. 기존 MES 를 수정해 주세요");
            }
        }
    }

    private static String nullIfBlank(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private static Instant toInstant(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
