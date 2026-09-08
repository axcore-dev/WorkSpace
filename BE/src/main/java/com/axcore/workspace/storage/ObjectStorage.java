package com.axcore.workspace.storage;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 오브젝트 스토리지 하나짜리 창구 — 올리기 · 내려받기 · 지우기.
 *
 * <p>네이버 클라우드 Object Storage 는 S3 호환이라 AWS SDK 로 붙는다. FE 의 AI 서버가 같은 버킷을 같은
 * 방식으로 쓰고 있고({@code FE/lib/ai/server/storage.ts}), 두 곳의 규칙을 맞춘다.
 *
 * <p><b>경로 방식(path style)을 강제한다.</b> 가상 호스트 방식은 버킷 이름이 도메인에 들어가 TLS 인증서와
 * 어긋날 수 있고, 네이버 문서 예시도 경로 방식이다.
 *
 * <p><b>키는 이 클래스 밖에서 조립하지 않는다는 규칙이 아니다.</b> AI 쪽은 회사 문서라 키 앞마디를
 * 회사 스키마로 강제하지만, 여기는 계정 파일이라 회사에 속하지 않는다. 대신 부르는 쪽이
 * {@link StorageKeys} 로만 키를 만든다 — 사용자 입력이 키에 섞이면 남의 객체를 덮어쓸 수 있다.
 *
 * <p>클라이언트는 처음 쓸 때 만들고 재사용한다. 설정이 없으면 만들지 않고 503 을 던진다.
 */
@Component
public class ObjectStorage {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorage.class);

    private final StorageProperties properties;
    private volatile S3Client client;

    public ObjectStorage(StorageProperties properties) {
        this.properties = properties;
        if (!properties.configured()) {
            log.info("오브젝트 스토리지 설정이 없다. 파일 업로드는 503 으로 거절한다 (app.storage.*)");
        }
    }

    public boolean available() {
        return properties.configured();
    }

    /** 올린다. 같은 키가 있으면 덮어쓴다 — 키에 uuid 가 들어 있어 실제로는 부딪히지 않는다. */
    public void put(String key, byte[] body, String contentType) {
        try {
            s3().putObject(
                    PutObjectRequest.builder()
                            .bucket(properties.bucket())
                            .key(key)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(body));
        } catch (S3Exception e) {
            throw new StorageUnavailableException("파일을 저장하지 못했습니다", e);
        }
    }

    /**
     * 내려받는다. 없으면 빈 값이다 — 키는 DB 에 있는데 객체가 사라진 경우가 실제로 생긴다
     * (버킷을 갈아 끼웠거나 손으로 지웠거나). 그때 500 을 내면 화면 전체가 깨진다.
     *
     * <p><b>바이트만 돌려준다.</b> 스토리지가 기억하는 형식은 넘기지 않는다 — 형식은 키(확장자)가 정하고,
     * 내려주는 쪽이 {@link StorageKeys#contentTypeOf} 로 되짚는다. 출처를 하나로 두어야 "버킷에 무엇이
     * 들어 있든 우리가 허용한 세 형식 외에는 응답 헤더에 나가지 않는다" 가 코드에서 보인다.
     */
    public Optional<byte[]> get(String key) {
        try (ResponseInputStream<GetObjectResponse> stream =
                s3().getObject(GetObjectRequest.builder().bucket(properties.bucket()).key(key).build())) {
            return Optional.of(stream.readAllBytes());
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (S3Exception | java.io.IOException e) {
            throw new StorageUnavailableException("파일을 읽지 못했습니다", e);
        }
    }

    /**
     * 지운다. 없는 키를 지우는 것은 성공이다(S3 규약) — 사진을 바꾸다 중간에 실패해 DB 에만 남은
     * 키를 정리할 때 그 편이 편하다.
     */
    public void delete(String key) {
        try {
            s3().deleteObject(DeleteObjectRequest.builder().bucket(properties.bucket()).key(key).build());
        } catch (S3Exception e) {
            throw new StorageUnavailableException("파일을 지우지 못했습니다", e);
        }
    }

    /**
     * 접두어 아래 객체 전부. 한 사용자의 폴더를 비우거나, 주인 없는 파일을 훑을 때 쓴다.
     *
     * <p>S3 는 한 번에 최대 1000개를 돌려주므로 이어서 받는다. 접두어가 넓으면(전체 {@code profile/})
     * 객체 수만큼 걸린다 — 하루 한 번 도는 청소가 감당할 크기다. 사용자가 수만 명을 넘으면 사용자별로
     * 나눠 돌린다.
     */
    public List<Listed> list(String prefix) {
        List<Listed> all = new ArrayList<>();
        String token = null;
        try {
            do {
                ListObjectsV2Response page =
                        s3().listObjectsV2(
                                ListObjectsV2Request.builder()
                                        .bucket(properties.bucket())
                                        .prefix(prefix)
                                        .continuationToken(token)
                                        .build());
                for (S3Object o : page.contents()) {
                    all.add(new Listed(o.key(), o.lastModified()));
                }
                token = page.isTruncated() ? page.nextContinuationToken() : null;
            } while (token != null);
        } catch (S3Exception e) {
            throw new StorageUnavailableException("파일 목록을 읽지 못했습니다", e);
        }
        return all;
    }

    /** 목록의 한 줄. 언제 올라갔는지가 있어야 "방금 올라간 것" 을 주인 없는 파일로 오해하지 않는다 */
    public record Listed(String key, Instant lastModified) {}

    private S3Client s3() {
        if (!properties.configured()) {
            throw new StorageUnavailableException("파일 저장소가 설정되지 않았습니다");
        }
        S3Client current = client;
        if (current == null) {
            synchronized (this) {
                current = client;
                if (current == null) {
                    current = build();
                    client = current;
                }
            }
        }
        return current;
    }

    private S3Client build() {
        return S3Client.builder()
                // AWS SDK 2.30 부터 올릴 때마다 CRC32 체크섬 헤더를 붙이고 본문을 aws-chunked 로 감싼다.
                // 네이버 클라우드는 그 요청을 서명 불일치로 보고 403 을 낸다. 필요할 때만 붙이게 되돌린다 —
                // 무결성 검사는 HTTPS 와 스토리지 쪽 검증에 맡긴다. 이 설정 없이는 업로드가 전부 실패한다.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .endpointOverride(URI.create(properties.endpoint()))
                .region(Region.of(properties.region()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    @PreDestroy
    void close() {
        S3Client current = client;
        if (current != null) {
            current.close();
        }
    }
}
