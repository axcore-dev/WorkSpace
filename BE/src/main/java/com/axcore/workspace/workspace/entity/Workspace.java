package com.axcore.workspace.workspace.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

/**
 * 회사 = 워크스페이스. (shared.workspaces)
 *
 * <p>이 행의 {@code id} 가 테넌트 스키마 이름의 재료다({@code ax_ + lpad(id, 5, '0')}).
 * 그래서 PK 가 UUID 가 아니라 순번이다. (docs/db/schema-draft-v2.md)
 *
 * <p>지금은 <b>읽기 전용</b>이다. 회사를 만드는 경로(프로비저닝)는 스키마 생성·테넌트
 * 마이그레이션 순회와 함께 붙어야 하고 그건 아직 없다. 여기서는 "내가 들어갈 수 있는 회사"를
 * 찾는 데까지만 쓴다.
 */
@Entity
@Table(name = "workspaces", schema = "shared")
public class Workspace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "biz_number", length = 10)
    private String bizNumber;

    /**
     * {@code SET search_path} 에 문자열로 조립되는 유일한 값이다.
     *
     * <p>DB 의 CHECK 제약({@code ^ax_[0-9]{5,}$})과 애플리케이션 양쪽에서 형태를 막는다.
     * 사용자가 정하는 값이 아니라 PK 에서 파생되지만, 조립 지점이 인젝션 표면이라 한쪽만
     * 믿지 않는다.
     */
    @Column(name = "schema_name", length = 63)
    private String schemaName;

    /** 화면 표시용 상호. 자유롭게 바뀌며 스키마 이름에 영향을 주지 않는다. */
    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "ceo_name", length = 100)
    private String ceoName;

    @Column(nullable = false, length = 30)
    private String plan;

    @Column(nullable = false, length = 20)
    private WorkspaceStatus status;

    @Column(name = "schema_version", length = 50)
    private String schemaVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Workspace() {
        // JPA 용
    }

    public boolean isEnterable() {
        return status.isEnterable();
    }

    public Long getId() {
        return id;
    }

    public String getBizNumber() {
        return bizNumber;
    }

    public String getSchemaName() {
        return schemaName;
    }

    public String getName() {
        return name;
    }

    public String getCeoName() {
        return ceoName;
    }

    public String getPlan() {
        return plan;
    }

    public WorkspaceStatus getStatus() {
        return status;
    }

    public String getSchemaVersion() {
        return schemaVersion;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof Workspace other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "Workspace{id=%s, name=%s, status=%s}".formatted(id, name, status);
    }
}
