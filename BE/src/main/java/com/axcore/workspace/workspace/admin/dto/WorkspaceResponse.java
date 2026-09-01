package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceSite;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * 운영자 화면의 워크스페이스 상세.
 *
 * <p>{@code schemaName} 을 내보낸다. 운영자만 보는 화면이고, 장애 대응 때 어느 스키마를 봐야
 * 하는지가 첫 질문이다. 고객용 응답({@code WorkspaceMembershipResponse})에는 들어가지 않는다.
 */
public record WorkspaceResponse(
        Long id,
        String name,
        String bizNumber,
        String corpNumber,
        String ceoName,
        String bizType,
        String bizItem,
        String address,
        String website,
        String taxEmail,
        String plan,
        String status,
        String schemaName,
        String schemaVersion,
        String operatorName,
        String memo,
        Contacts contacts,
        List<Site> sites,
        List<WorkspaceMemberResponse> members,
        WorkspaceUsageResponse usage,
        List<WorkspaceInvoiceResponse> invoices,
        List<WorkspaceSystemResponse> systems,
        Instant lastActiveAt,
        Instant linkSentAt,
        Instant linkOpenedAt,
        Instant createdAt,
        Instant updatedAt) {

    public record Contacts(
            String linkName,
            String linkEmail,
            String contactName,
            String contactEmail,
            String contactPhone,
            Set<String> ccEmails) {}

    public record Site(
            Long id, String name, String bizNumber, String address, String bizType, String bizItem) {

        static Site from(WorkspaceSite site) {
            return new Site(
                    site.getId(),
                    site.getName(),
                    site.getBizNumber(),
                    site.getAddress(),
                    site.getBizType(),
                    site.getBizItem());
        }
    }

    /**
     * 구성원 없이. 상태 변경 응답처럼 구성원을 다시 읽을 이유가 없는 자리에서 쓴다.
     *
     * <p>화면은 부분 갱신으로 병합하므로 여기서 빠진 필드가 화면의 기존 값을 지우지 않는다.
     */
    public static WorkspaceResponse from(Workspace w) {
        return from(w, List.of(), null);
    }

    /**
     * 상세 조회용. 구성원과 마지막 활동은 테넌트 스키마에서 따로 읽어 넘긴다.
     *
     * @param members 개설 전이거나 조회에 실패하면 빈 목록
     * @param lastActiveAt 아무도 들어온 적이 없으면 null
     */
    public static WorkspaceResponse from(
            Workspace w, List<WorkspaceMemberResponse> members, Instant lastActiveAt) {
        return new WorkspaceResponse(
                w.getId(),
                w.getName(),
                w.getBizNumber(),
                w.getCorpNumber(),
                w.getCeoName(),
                w.getBizType(),
                w.getBizItem(),
                w.getAddress(),
                w.getWebsite(),
                w.getTaxEmail(),
                w.getPlan(),
                ConsoleStatus.of(w.getStatus()),
                w.getSchemaName(),
                w.getSchemaVersion(),
                w.getOperatorName(),
                w.getMemo(),
                new Contacts(
                        w.getLinkContactName(),
                        w.getLinkContactEmail(),
                        w.getContactName(),
                        w.getContactEmail(),
                        w.getContactPhone(),
                        Set.copyOf(w.getCcEmails())),
                w.getSites().stream().map(Site::from).toList(),
                members,
                // 집계·청구·연동은 아직 만드는 곳이 없다. 형태만 유지한다 — 각 DTO 주석 참고.
                WorkspaceUsageResponse.empty(),
                List.of(),
                List.of(),
                lastActiveAt,
                w.getLinkSentAt(),
                w.getLinkOpenedAt(),
                w.getCreatedAt(),
                w.getUpdatedAt());
    }
}
