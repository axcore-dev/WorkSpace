package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.workspace.entity.WorkspaceStatus;

import java.util.Arrays;
import java.util.Optional;

/**
 * 운영자 콘솔이 쓰는 상태 어휘.
 *
 * <p>DB 는 {@code provisioning} 인데 화면은 「대기중」이라 부른다. 개설이 끝나지 않았다는 사실은
 * 운영자에게 "우리가 아직 준비 중" 이지 "프로비저닝 중" 이 아니다.
 *
 * <p>응답과 질의를 <b>같은 어휘</b>로 맞춘다. 응답은 {@code pending} 인데 필터는
 * {@code provisioning} 으로 받으면, 화면에 보이는 값을 그대로 되돌려 줄 수 없다.
 *
 * <p>{@code terminated} 는 어휘에는 있지만 기본 목록에서 빠진다
 * ({@code AdminWorkspaceController}). 해지된 회사가 매일 보는 목록에 계속 남아 있을 이유가 없고,
 * 그렇다고 상태를 없애면 해지와 일시 중지를 구분할 수 없게 된다.
 */
public enum ConsoleStatus {
    PENDING("pending", WorkspaceStatus.PROVISIONING),
    ACTIVE("active", WorkspaceStatus.ACTIVE),
    SUSPENDED("suspended", WorkspaceStatus.SUSPENDED),
    TERMINATED("terminated", WorkspaceStatus.TERMINATED);

    private final String value;
    private final WorkspaceStatus domain;

    ConsoleStatus(String value, WorkspaceStatus domain) {
        this.value = value;
        this.domain = domain;
    }

    public String value() {
        return value;
    }

    public WorkspaceStatus domain() {
        return domain;
    }

    /** 응답에 실을 값. */
    public static String of(WorkspaceStatus status) {
        return Arrays.stream(values())
                .filter(c -> c.domain == status)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("어휘에 없는 상태입니다: " + status))
                .value;
    }

    /** 질의 파라미터 해석. 대소문자는 무시한다. */
    public static Optional<ConsoleStatus> from(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String normalized = raw.strip().toLowerCase();
        return Arrays.stream(values()).filter(c -> c.value.equals(normalized)).findFirst();
    }
}
