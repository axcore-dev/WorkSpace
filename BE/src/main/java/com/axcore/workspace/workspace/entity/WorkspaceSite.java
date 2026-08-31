package com.axcore.workspace.workspace.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;

/**
 * 본사 외 사업장. (shared.workspace_sites)
 *
 * <p>본사 정보는 {@link Workspace} 의 컬럼이며 여기 중복해 넣지 않는다.
 *
 * <p>사업자번호에 유일 제약이 없다. 종된 사업장은 본사와 같은 번호를 쓰고, 회사가 다르면
 * 애초에 다른 워크스페이스다. {@code shared.workspaces.biz_number} 의 유일 제약은 "같은
 * 회사가 두 번 열리는 것" 을 막는 장치라 성격이 다르다.
 */
@Entity
@Table(name = "workspace_sites", schema = "shared")
public class WorkspaceSite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "biz_number", length = 10)
    private String bizNumber;

    @Column(length = 300)
    private String address;

    @Column(name = "biz_type", length = 100)
    private String bizType;

    @Column(name = "biz_item", length = 100)
    private String bizItem;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WorkspaceSite() {
        // JPA 용
    }

    private WorkspaceSite(
            String name, String bizNumber, String address, String bizType, String bizItem) {
        this.name = name;
        this.bizNumber = bizNumber;
        this.address = address;
        this.bizType = bizType;
        this.bizItem = bizItem;
    }

    public static WorkspaceSite of(
            String name, String bizNumber, String address, String bizType, String bizItem) {
        return new WorkspaceSite(name, bizNumber, address, bizType, bizItem);
    }

    /** 양방향 연관의 주인 쪽을 채운다. {@link Workspace#addSite} 만 부른다. */
    void attachTo(Workspace workspace) {
        this.workspace = workspace;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getBizNumber() {
        return bizNumber;
    }

    public String getAddress() {
        return address;
    }

    public String getBizType() {
        return bizType;
    }

    public String getBizItem() {
        return bizItem;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof WorkspaceSite other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
