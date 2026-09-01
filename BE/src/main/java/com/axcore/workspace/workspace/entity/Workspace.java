package com.axcore.workspace.workspace.entity;

import com.axcore.workspace.workspace.provisioning.SchemaName;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 회사 = 워크스페이스. (shared.workspaces)
 *
 * <p>이 행의 {@code id} 가 테넌트 스키마 이름의 재료다({@code ax_ + lpad(id, 5, '0')}).
 * 그래서 PK 가 UUID 가 아니라 순번이다. (docs/db/schema-draft-v2.md)
 *
 * <p><b>고객이 직접 만들지 않는다.</b> 우리가 계약 정보를 받아 대신 만들고 접속 링크를 보낸다.
 * 그래서 여기 있는 상세 필드들은 개설 화면에서 운영자가 입력하는 값이다.
 *
 * <p>네 값이 각자 역할을 갖는다.
 *
 * <ul>
 *   <li>{@code id} — 스키마 이름의 유일한 재료. 불변
 *   <li>{@code bizNumber} — 회사의 유일성 보장. 같은 회사가 두 번 열리는 것을 막는다
 *   <li>{@code schemaName} — 실제 {@code search_path} 에 들어가는 값. <b>생성 후 불변</b>
 *   <li>{@code name} — 화면에 뿌리는 회사명. 자유롭게 변경 가능하며 스키마에 영향을 주지 않는다
 * </ul>
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
     * 실제로 열리는 스키마 이름. {@code ax_ + lpad(id, 5, '0')} 이다.
     *
     * <p><b>INSERT 시점에는 비어 있다.</b> 이름의 재료가 PK 인데 PK 는 DB 가 채번하므로, INSERT
     * 를 마쳐야 값을 알 수 있다. 그래서 저장이 두 단계다 — {@link #open} 으로 넣고,
     * {@link #assignSchema()} 로 붙인다. 컬럼이 nullable 인 것도 이 때문이고,
     * {@code ck_workspaces_active_schema} 가 "개설 중일 때만 비어 있을 수 있다" 로 그 구멍을 막는다.
     *
     * <p><b>이 값은 SQL 에 문자열로 조립되지 않는다.</b> 스키마 이름은 식별자라 바인딩 파라미터로
     * 넘길 수 없지만, 조립이 필요한 두 자리를 모두 DB 함수로 옮겨 {@code format} 의 {@code %I}
     * 가 인용을 대신하게 했다({@code shared.create_tenant_schema} ·
     * {@code shared.workspace_comment}). 열 때는 {@code set_config('search_path', ?, true)} 로
     * 값으로 넘긴다({@link com.axcore.workspace.workspace.provisioning.TenantSearchPath}).
     *
     * <p>그런데도 형태를 세 곳에서 본다 — 애플리케이션({@code SchemaName}), DB CHECK 제약,
     * 함수 안. <b>바인딩이 막아 주는 것은 SQL 인젝션까지이기 때문이다.</b> {@code ax_00002} 처럼
     * 형태가 멀쩡한 남의 스키마 이름은 바인딩을 그대로 통과한다.
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

    // ── 개설 화면이 받는 회사 정보 ──────────────────────────────────────────

    @Column(name = "corp_number", length = 13)
    private String corpNumber;

    @Column(name = "biz_type", length = 100)
    private String bizType;

    @Column(name = "biz_item", length = 100)
    private String bizItem;

    @Column(length = 300)
    private String address;

    @Column(length = 300)
    private String website;

    @Column(name = "tax_email", length = 255)
    private String taxEmail;

    @Column(columnDefinition = "text")
    private String memo;

    /** 담당 운영자 이름. 표시용이며 권한 판단에 쓰지 않는다. */
    @Column(name = "operator_name", length = 100)
    private String operatorName;

    // ── 담당자 ─────────────────────────────────────────────────────────────
    //
    // 접속 링크를 받는 사람과 평소 연락 담당을 나눈다. 실무자가 링크를 받고 계약·정산 연락은
    // 다른 사람에게 가는 경우가 있다.

    @Column(name = "link_contact_name", length = 100)
    private String linkContactName;

    @Column(name = "link_contact_email", length = 255)
    private String linkContactEmail;

    @Column(name = "contact_name", length = 100)
    private String contactName;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Column(name = "link_sent_at")
    private Instant linkSentAt;

    /** 접속 링크를 실제로 연 시각. 열지 않은 회사를 찾는 데 쓴다. */
    @Column(name = "link_opened_at")
    private Instant linkOpenedAt;

    /**
     * 참조 수신 주소.
     *
     * <p>개수가 정해지지 않아 컬럼으로 둘 수 없다. {@code Set} 인 이유는 (workspace_id, email)
     * 이 PK 라 같은 주소가 두 번 들어갈 수 없기 때문이다 — 리스트로 두면 중복을 넣었을 때
     * 제약 위반이 나고 그 문구는 사용자에게 아무 뜻이 없다.
     */
    @ElementCollection
    @CollectionTable(
            name = "workspace_cc_emails",
            schema = "shared",
            joinColumns = @JoinColumn(name = "workspace_id"))
    @Column(name = "email", nullable = false, length = 255)
    private Set<String> ccEmails = new LinkedHashSet<>();

    /**
     * 본사 외 사업장.
     *
     * <p>본사 정보는 이 엔티티의 컬럼이며 여기 중복해 넣지 않는다.
     */
    @OneToMany(mappedBy = "workspace", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<WorkspaceSite> sites = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Workspace() {
        // JPA 용
    }

    private Workspace(String name, String bizNumber) {
        this.name = name;
        this.bizNumber = bizNumber;
        this.plan = "free";
        // 행은 있지만 스키마는 아직 없는 구간. 이 상태에서는 아무도 들어갈 수 없다.
        this.status = WorkspaceStatus.PROVISIONING;
    }

    /**
     * 개설 시작. 이 시점에는 스키마가 없다.
     *
     * <p>{@code schemaName} 을 채우지 않는 이유는 PK 가 아직 없기 때문이다. INSERT 로 채번된
     * 뒤에 {@link #assignSchema()} 로 붙인다. 이 순서는 슬러그 방식과 다른 지점이다.
     */
    public static Workspace open(String name, String bizNumber) {
        return new Workspace(name, bizNumber);
    }

    /**
     * PK 에서 스키마 이름을 계산해 붙인다. INSERT 로 채번된 뒤에만 부를 수 있다.
     *
     * <p>한 번 정해지면 바꾸지 않는다. 이미 만들어진 스키마를 가리키는 값이라, 바꾸는 순간
     * 그 회사의 데이터를 찾을 수 없게 된다.
     */
    public String assignSchema() {
        if (id == null) {
            throw new IllegalStateException("PK 가 채번된 뒤에만 스키마 이름을 붙일 수 있습니다");
        }
        if (schemaName != null) {
            throw new IllegalStateException("스키마 이름은 생성 후 바꾸지 않습니다: " + schemaName);
        }
        this.schemaName = SchemaName.of(id);
        return this.schemaName;
    }

    /** 프로비저닝이 끝났다. 이제 들어갈 수 있다. */
    public void activate(String schemaVersion) {
        if (schemaName == null) {
            throw new IllegalStateException("스키마가 없는 회사는 활성화할 수 없습니다");
        }
        this.status = WorkspaceStatus.ACTIVE;
        this.schemaVersion = schemaVersion;
    }

    public void recordSchemaVersion(String schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    /** 일시 중지. 스키마와 데이터는 그대로 두고 진입만 막는다. */
    public void suspend() {
        this.status = WorkspaceStatus.SUSPENDED;
    }

    public void resume() {
        this.status = WorkspaceStatus.ACTIVE;
    }

    /**
     * 해지. <b>스키마를 지우지 않는다.</b>
     *
     * <p>{@code DROP SCHEMA ... CASCADE} 한 줄이면 되지만 되돌릴 수 없다. 상태만 바꿔 두고
     * 유예기간이 지난 뒤 배치가 덤프를 남기고 실제로 지운다.
     * (docs/db/schema-draft-v2.md — "삭제도 자동화하되 즉시 지우지 않는다")
     */
    public void terminate() {
        this.status = WorkspaceStatus.TERMINATED;
    }

    public void markLinkSent(Instant at) {
        this.linkSentAt = at;
    }

    public void markLinkOpened(Instant at) {
        if (this.linkOpenedAt == null) {
            this.linkOpenedAt = at;
        }
    }

    /** 개설 화면이 받는 회사 정보. 상호는 따로 바꾼다 — 유일성이 걸린 값과 섞지 않는다. */
    public void updateCompanyInfo(
            String corpNumber,
            String bizType,
            String bizItem,
            String address,
            String website,
            String taxEmail,
            String memo,
            String operatorName) {
        this.corpNumber = corpNumber;
        this.bizType = bizType;
        this.bizItem = bizItem;
        this.address = address;
        this.website = website;
        this.taxEmail = taxEmail;
        this.memo = memo;
        this.operatorName = operatorName;
    }

    public void updateContacts(
            String linkContactName,
            String linkContactEmail,
            String contactName,
            String contactEmail,
            String contactPhone,
            Set<String> ccEmails) {
        this.linkContactName = linkContactName;
        this.linkContactEmail = linkContactEmail;
        this.contactName = contactName;
        this.contactEmail = contactEmail;
        this.contactPhone = contactPhone;
        this.ccEmails.clear();
        if (ccEmails != null) {
            this.ccEmails.addAll(ccEmails);
        }
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changePlan(String plan) {
        this.plan = plan;
    }

    public void changeCeoName(String ceoName) {
        this.ceoName = ceoName;
    }

    /** 사업장 목록을 통째로 갈아 끼운다. 부분 수정은 화면에도 없다. */
    public void replaceSites(List<WorkspaceSite> replacements) {
        this.sites.clear();
        if (replacements != null) {
            replacements.forEach(this::addSite);
        }
    }

    public void addSite(WorkspaceSite site) {
        site.attachTo(this);
        this.sites.add(site);
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

    public String getCorpNumber() {
        return corpNumber;
    }

    public String getBizType() {
        return bizType;
    }

    public String getBizItem() {
        return bizItem;
    }

    public String getAddress() {
        return address;
    }

    public String getWebsite() {
        return website;
    }

    public String getTaxEmail() {
        return taxEmail;
    }

    public String getMemo() {
        return memo;
    }

    public String getOperatorName() {
        return operatorName;
    }

    public String getLinkContactName() {
        return linkContactName;
    }

    public String getLinkContactEmail() {
        return linkContactEmail;
    }

    public String getContactName() {
        return contactName;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public Instant getLinkSentAt() {
        return linkSentAt;
    }

    public Instant getLinkOpenedAt() {
        return linkOpenedAt;
    }

    public Set<String> getCcEmails() {
        return ccEmails;
    }

    public List<WorkspaceSite> getSites() {
        return sites;
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
