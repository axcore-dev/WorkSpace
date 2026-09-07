/**
 * 네이버 클라우드 Object Storage. S3 호환 API 라 AWS SDK v3 를 그대로 쓴다.
 *
 * ── 격리 ────────────────────────────────────────────────────────────────────
 * 버킷은 하나고, 객체 키의 첫 마디가 회사 스키마(`ax_00001/...`)다. 회사 문서는 회사 기밀이라
 * 키 앞부분을 요청자의 스키마(`AiPrincipal.schemaName`)로만 만들고, 이 모듈 밖에서 키를 조립하지
 * 않는다. 객체는 전부 비공개이고, 화면이 여는 링크는 인증을 통과한 뒤 발급되는 10분짜리 presigned
 * URL 하나다. 버킷에 공개 읽기(ACL) 를 주는 일이 없어야 한다.
 *
 * `forcePathStyle` 을 켠다. 가상 호스트 방식은 버킷 이름이 도메인에 들어가 TLS 인증서와 어긋날 수
 * 있고, 네이버 문서 예시도 경로 방식이다.
 */
import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "./env";

let client: S3Client | undefined;
let bucketName: string | undefined;

function s3(): { client: S3Client; bucket: string } {
  if (!client || !bucketName) {
    const cfg = storageConfig();
    client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    bucketName = cfg.bucket;
  }
  return { client, bucket: bucketName };
}

/** presigned URL 수명. 화면에서 "열기" 를 누른 직후에만 쓰이므로 길 필요가 없다 */
const VIEW_URL_TTL_SEC = 600;

/**
 * 객체 키. `<회사 스키마>/ai-sources/<사용자 id>/<문서 id>/<파일명>`
 *
 * 문서 id(uuid) 가 한 마디를 차지해서 같은 이름을 다시 올려도 덮어쓰지 않고, 파일명은
 * `files.ts` 의 `safeName` 을 거친 값만 온다(경로 구분자가 없다).
 */
export function buildStorageKey(
  schemaName: string,
  userId: string,
  docId: string,
  fileName: string,
): string {
  return `${schemaName}/ai-sources/${userId}/${docId}/${fileName}`;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const { client, bucket } = s3();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { client, bucket } = s3();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("객체 본문이 비어 있어요");
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteObject(key: string) {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** 화면이 문서를 새 탭에서 열 때 쓰는 한시적 링크 */
export async function presignViewUrl(key: string, fileName: string): Promise<string> {
  const { client, bucket } = s3();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      // 브라우저가 원래 파일명으로 보여 주게 한다. RFC 5987 로 한글 이름을 살린다
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: VIEW_URL_TTL_SEC },
  );
}
