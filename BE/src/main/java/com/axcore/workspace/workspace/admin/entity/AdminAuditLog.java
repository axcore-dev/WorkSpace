package com.axcore.workspace.workspace.admin.entity;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.workspace.entity.Workspace;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

/**
 * 운영자 행위 한 건. (shared.admin_audit_logs)
 *
 * <p>세터가 없다. 감사 기록은 만들어진 뒤 바뀌지 않는다 — 고칠 수 있는 기록은 증적이 아니다.
 *
 * <p>행위자 이름과 대상 이름을 <b>스냅샷</b>으로 함께 들고 있다. 연관관계만 두면 나중에 회사명이
 * 바뀌거나 계정이 지워졌을 때 그때 무슨 일이 있었는지가 사라진다.
 */
@Entity
@Table(
        name = "admin_audit_logs",
        schema = "shared",
        indexes = {
            @Index(name = "ix_aal_occurred_at", columnList = "occurred_at desc, id desc"),
            @Index(name = "ix_aal_workspace", columnList = "workspace_id, occurred_at desc")
        })
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    /** 계정이 지워지면 NULL 이 된다. 그래서 이름을 따로 남긴다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(name = "actor_name", nullable = false, length = 100, updatable = false)
    private String actorName;

    @Column(nullable = false, length = 30, updatable = false)
    private AdminAuditAction action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id")
    private Workspace workspace;

    @Column(name = "target_schema", length = 63, updatable = false)
    private String targetSchema;

    @Column(name = "target_name", length = 200, updatable = false)
    private String targetName;

    @Column(updatable = false)
    private String detail;

    protected AdminAuditLog() {
        // JPA 용
    }

    private AdminAuditLog(
            Instant occurredAt,
            User actor,
            String actorName,
            AdminAuditAction action,
            Workspace workspace,
            String detail) {
        this.occurredAt = occurredAt;
        this.actor = actor;
        this.actorName = actorName;
        this.action = action;
        this.workspace = workspace;
        this.targetSchema = workspace == null ? null : workspace.getSchemaName();
        this.targetName = workspace == null ? null : workspace.getName();
        this.detail = detail;
    }

    /**
     * @param actor 계정을 못 찾은 경우 null 을 허용한다. 기록을 남기지 못하는 것보다 낫다
     * @param workspace 워크스페이스와 무관한 행위가 생기면 null
     * @param detail 한 줄 요약. 없으면 null
     */
    public static AdminAuditLog record(
            Instant occurredAt,
            User actor,
            AdminAuditAction action,
            Workspace workspace,
            String detail) {
        return new AdminAuditLog(
                occurredAt,
                actor,
                actor == null ? "(알 수 없음)" : actor.getName(),
                action,
                workspace,
                detail);
    }

    public Long getId() {
        return id;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getActorName() {
        return actorName;
    }

    public AdminAuditAction getAction() {
        return action;
    }

    public String getTargetSchema() {
        return targetSchema;
    }

    public String getTargetName() {
        return targetName;
    }

    public String getDetail() {
        return detail;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof AdminAuditLog other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "AdminAuditLog{id=%s, action=%s, target=%s}".formatted(id, action, targetSchema);
    }
}
