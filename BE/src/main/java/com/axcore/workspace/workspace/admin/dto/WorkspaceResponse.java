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

    public static WorkspaceResponse from(Workspace w) {
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
                w.getStatus().dbValue(),
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
                w.getLinkSentAt(),
                w.getLinkOpenedAt(),
                w.getCreatedAt(),
                w.getUpdatedAt());
    }
}
