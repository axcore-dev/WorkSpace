package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.admin.entity.AdminAuditLog;
import com.axcore.workspace.workspace.admin.repository.AdminAuditLogRepository;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 운영자 행위를 남긴다.
 *
 * <p>{@link Propagation#REQUIRES_NEW} 인 이유가 둘이다.
 *
 * <p>하나, 실패한 행위도 남겨야 하는 경우가 있다. 본 작업이 예외로 끝나 롤백되면 같은
 * 트랜잭션에 쓴 기록도 함께 사라진다.
 *
 * <p>둘, 반대로 기록이 실패해도 본 작업은 살아야 한다. 감사 테이블 문제로 워크스페이스 개설이
 * 통째로 막히면 그게 더 큰 사고다. 그래서 여기서 나는 예외는 삼키고 로그만 남긴다 — 기록이
 * 빠졌다는 사실 자체는 애플리케이션 로그에 남는다.
 */
@Service
public class AdminAuditRecorder {

    private static final Logger log = LoggerFactory.getLogger(AdminAuditRecorder.class);

    private final AdminAuditLogRepository auditRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;

    public AdminAuditRecorder(
            AdminAuditLogRepository auditRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository) {
        this.auditRepository = auditRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
    }

    /** 워크스페이스를 id 로 가리키는 경우. 기록 시점에 이름·스키마를 스냅샷으로 뜬다. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID actorId, AdminAuditAction action, Long workspaceId, String detail) {
        try {
            User actor = actorId == null ? null : userRepository.findById(actorId).orElse(null);
            Workspace workspace =
                    workspaceId == null
                            ? null
                            : workspaceRepository.findById(workspaceId).orElse(null);
            auditRepository.save(
                    AdminAuditLog.record(Instant.now(), actor, action, workspace, detail));
        } catch (RuntimeException e) {
            // 기록 실패가 본 작업을 무너뜨리면 안 된다. 다만 조용히 넘어가지도 않는다.
            log.error(
                    "감사 기록 실패 — 행위자 {} · {} · 워크스페이스 {}",
                    actorId,
                    action.dbValue(),
                    workspaceId,
                    e);
        }
    }
}
