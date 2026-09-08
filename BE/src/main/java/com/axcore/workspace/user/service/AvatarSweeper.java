package com.axcore.workspace.user.service;

import com.axcore.workspace.storage.ObjectStorage;
import com.axcore.workspace.storage.StorageKeys;
import com.axcore.workspace.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 주인 없는 프로필 사진을 하루 한 번 지운다.
 *
 * <p>파일이 남는 길은 셋이고 전부 <b>"어느 계정도 가리키지 않는 객체"</b>로 귀결된다.
 *
 * <ol>
 *   <li>사진을 바꾸거나 지울 때 옛 객체 삭제가 실패했다 — DB 는 이미 새 키(또는 null)다.
 *   <li>올린 직후 DB 반영 전에 서버가 죽었다 — 객체는 있는데 DB 는 옛 키다.
 *   <li>계정이 지워졌다 — 폴더는 남았는데 행이 없다.
 * </ol>
 *
 * <p>그래서 세 경우를 따로 추적하지 않는다. {@code profile/} 아래를 전부 훑고, 지금 계정들이 가리키는 키
 * 집합에 없는 것을 지운다. 실패한 삭제를 기록해 두는 표를 따로 두지 않는 이유가 이것이다 — 기록이 빠져도
 * 이 규칙이 잡는다.
 *
 * <p><b>방금 올라간 객체는 건드리지 않는다.</b> 업로드는 객체를 먼저 올리고 DB 를 바꾸는 순서라, 그 사이에
 * 훑으면 정상 업로드가 주인 없는 파일로 보인다. 올라간 지 한 시간이 지난 것만 본다. 업로드 트랜잭션은
 * 밀리초 단위라 여유가 충분하다.
 *
 * <p>인스턴스가 여럿이면 같은 시각에 함께 돈다. 삭제는 두 번 해도 같은 결과라 잠금을 두지 않는다.
 * 목록 조회 비용이 배로 들 뿐이다.
 */
@Component
public class AvatarSweeper {

    private static final Logger log = LoggerFactory.getLogger(AvatarSweeper.class);

    /** 이보다 최근에 올라간 객체는 아직 DB 반영 중일 수 있다. */
    private static final Duration GRACE = Duration.ofHours(1);

    private final ObjectStorage storage;
    private final UserRepository users;

    public AvatarSweeper(ObjectStorage storage, UserRepository users) {
        this.storage = storage;
        this.users = users;
    }

    /** 새벽 4시 30분. 사람이 사진을 올리지 않는 시간이라 유예 창과 겹칠 일이 거의 없다. */
    @Scheduled(cron = "0 30 4 * * *")
    public void sweepDaily() {
        sweep(Instant.now());
    }

    /**
     * @return 지운 객체 수
     */
    public int sweep(Instant now) {
        if (!storage.available()) {
            return 0;
        }
        // ponytail: 전체 접두어를 한 번에 훑는다. 사용자가 수만 명을 넘으면 사용자별 폴더로 나눠 돈다.
        List<ObjectStorage.Listed> objects = storage.list("profile/");
        Set<String> referenced = new HashSet<>(users.findAllAvatarObjectKeys());
        Instant cutoff = now.minus(GRACE);

        int removed = 0;
        for (ObjectStorage.Listed o : objects) {
            if (referenced.contains(o.key()) || o.lastModified().isAfter(cutoff)) {
                continue;
            }
            // 우리가 만든 모양이 아닌 키는 손대지 않는다 — 다른 무언가가 이 접두어를 쓰고 있을 수 있다
            if (!StorageKeys.isAvatarKey(o.key())) {
                log.warn("profile/ 아래에 우리 모양이 아닌 객체가 있다: {}", o.key());
                continue;
            }
            try {
                storage.delete(o.key());
                removed++;
            } catch (RuntimeException e) {
                log.warn("주인 없는 프로필 사진 {} 을 지우지 못했다. 다음 순회에서 다시 본다", o.key(), e);
            }
        }
        log.info("프로필 사진 청소: {}개 중 {}개를 지웠다 (계정이 가리키는 키 {}개)", objects.size(), removed, referenced.size());
        return removed;
    }
}
