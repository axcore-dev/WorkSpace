package com.axcore.workspace.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 오브젝트 스토리지 설정. {@code app.storage.*} 로 주입된다.
 *
 * <p>네이버 클라우드 Object Storage 다. S3 호환이라 AWS SDK 를 그대로 쓴다. FE 의 AI 서버가 같은 버킷을
 * 같은 방식으로 이미 쓰고 있다({@code FE/lib/ai/server/storage.ts}) — 환경변수 이름도 그쪽과 같게 맞춘다.
 *
 * <p><b>비어 있어도 부팅은 된다.</b> 로컬에서 사진 업로드를 쓰지 않는 사람까지 키를 받아 오게 만들 이유가
 * 없다. 대신 설정 없이 업로드를 부르면 {@link StorageUnavailableException} 으로 503 이 나간다 — 조용히
 * 성공한 척하는 것보다 낫다.
 *
 * @param bucket 버킷 이름. AI 문서와 같은 버킷을 쓰되 키 앞마디로 갈린다({@code avatars/})
 */
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        @DefaultValue("https://kr.object.ncloudstorage.com") String endpoint,
        @DefaultValue("kr-standard") String region,
        @DefaultValue("") String bucket,
        @DefaultValue("") String accessKey,
        @DefaultValue("") String secretKey) {

    /** 셋 다 있어야 쓸 수 있다. 하나라도 비면 설정하지 않은 것으로 본다. */
    public boolean configured() {
        return !bucket.isBlank() && !accessKey.isBlank() && !secretKey.isBlank();
    }
}
