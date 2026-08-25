# BE 런타임 버전 결정 — Java 25 / Spring Boot 4.1.1

> 작성 2026-08-25 · 대상 `BE/` (Spring Boot 백엔드 신규 착수)

## 결론

| 항목 | 선택 |
| --- | --- |
| **Java** | **25 (LTS)** — Eclipse Temurin |
| **Spring Boot** | **4.1.1** |
| 빌드 | Gradle + Kotlin DSL, JDK는 toolchain으로 고정 |
| DB | PostgreSQL 15+ |

```kotlin
// BE/build.gradle.kts
plugins {
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}
```

toolchain으로 고정하는 이유는 개발자 로컬에 어떤 JDK가 깔려 있든 빌드는 25로 돌게 하기 위해서다. 팀 세팅이 제각각이어도 빌드 결과가 갈리지 않는다.

---

## 왜 Spring Boot 4.1.1인가

2026-08 기준 지원 현황이다.

| 버전 | GA | 무상(OSS) 지원 종료 | 상용 지원 종료 | Java 호환 | 판단 |
| --- | --- | --- | --- | --- | --- |
| 3.4 | 2024-11 | 2025-12-31 **종료** | 2026-12-31 | 17–24 | ✗ |
| 3.5 | 2025-05 | 2026-06-30 **종료** | 2032-06-30 | 17–25 | ✗ |
| 4.0 | 2025-11 | 2026-12-31 (약 4개월) | 2027-12-31 | 17–25 | △ |
| **4.1** | 2026-06 | **2027-07-31** | 2028-07-31 | **17–26** | ✓ |

- **3.x는 선택지가 아니다.** 가장 최근 라인인 3.5조차 무상 지원이 2026-06-30에 이미 끝났다. 지금 3.x로 시작하면 첫 커밋부터 보안 패치를 못 받는 상태다.
- **4.0도 아니다.** 무상 지원이 2026-12-31에 끝난다. 지금 시작하면 개발이 끝나기도 전에 업그레이드 작업이 잡힌다.
- **4.1이 현재 라인이다.** 2027-07-31까지 무상 지원되고, 그 사이 4.2가 나오면 마이너 업그레이드로 이어가면 된다.

4.x는 Spring Framework 7 기반이라 3.x에서 넘어올 때 마이그레이션 비용이 있지만, **우리는 신규라 그 비용이 0이다.** 기존 코드가 없다는 게 최신 라인으로 시작할 수 있는 가장 큰 이점이다.

## 왜 Java 25인가

| | Java 17 | Java 21 | **Java 25** |
| --- | --- | --- | --- |
| GA | 2021-09 | 2023-09 | 2025-09 |
| LTS | ○ | ○ | ○ |
| Temurin 지원 종료 | 2027-10-31 | 2029-12-31 | **2031-09-30** |
| Boot 4.1 지원 | 베이스라인 | ○ | ○ (first-class) |

- **17은 Boot 4의 최소 요구치일 뿐** 새 프로젝트가 고를 이유가 없다. 가상 스레드가 없고, 지원도 2027-10에 끝나 우리 프로젝트보다 먼저 죽는다.
- **21과 25 사이에 기능적 강제는 없다.** 21로 시작해도 문제없이 굴러간다. 다만 21을 고르면 지원 종료(2029-12) 전에 한 번 더 올려야 하고, 그 업그레이드를 **지금 공짜로 미리 해두는 게** 25를 고르는 이유다. 코드가 없을 때가 런타임을 올리기 가장 싼 시점이다.
- 다음 LTS는 2027년(Java 29 예정)이라, 25로 잡으면 최소 5년은 런타임 교체 없이 간다.
- Java 26은 Boot 4.1이 지원하지만 non-LTS(지원 2026-09-15 종료)라 제외.

---

## 버전별 특징 정리

### Java 17 (2021-09) — 현대 Java의 기준선

문법의 큰 덩어리가 여기서 완성됐다. 아래는 17부터 쓸 수 있는 것들이다.

- **Records** — DTO/값 객체를 한 줄로. `record ItemDto(Long id, String name) {}`
- **Sealed classes** — 상속 계층을 닫는다. 스키마의 상태값(`활성`/`부분 입고` 등)을 타입으로 표현할 때 쓴다.
- **Pattern matching for `instanceof`** — `if (o instanceof Item i)` 형태로 캐스팅 생략
- **Switch expressions / Text blocks** — 값을 반환하는 `switch`, 여러 줄 문자열(SQL 쿼리에 유용)
- **JDK 내부 API 강한 캡슐화(JEP 403)** — 리플렉션으로 내부를 찌르던 오래된 라이브러리가 여기서 깨진다. 레거시 마이그레이션의 주 걸림돌이지만 우리는 해당 없음.

**한계**: 가상 스레드가 없다. I/O 대기가 많은 ERP 백엔드에서는 이게 결정적이다.

### Java 21 (2023-09) — 가상 스레드가 들어온 버전

17에 더해서:

- **가상 스레드 (JEP 444, 정식)** — 이 라인의 핵심. OS 스레드에 1:1로 묶이지 않는 경량 스레드라, 요청 하나가 DB/외부 API를 기다리는 동안 플랫폼 스레드를 붙잡지 않는다. Spring Boot에서는 `spring.threads.virtual.enabled=true` 한 줄로 켜진다. **우리처럼 DB I/O가 대부분인 워크로드에 그대로 이득이다.**
- **Pattern matching for `switch` + Record patterns (정식)** — `switch (shape) { case Circle(double r) -> ... }` 형태의 분해. 상태 분기 코드가 눈에 띄게 짧아진다.
- **Sequenced Collections** — `list.getFirst()` / `getLast()` / `reversed()`가 컬렉션 공통 API로 들어옴
- **Generational ZGC** — 짧은 정지시간 GC가 세대 구분을 얻어 처리량이 개선됨

### Java 25 (2025-09) — 가상 스레드 시대의 빈틈을 메운 버전

21에 더해서:

- **Scoped Values (JEP 506, 정식)** — `ThreadLocal`의 대체재. **가상 스레드를 쓰기 시작하면 바로 필요해진다.** 요청 단위 컨텍스트(로그인 사용자, `workspace_id` 같은 테넌트 식별자)를 스레드마다 심어 나르는 방식이 `ThreadLocal`인데, 가상 스레드는 요청당 수십만 개가 생겨 `ThreadLocal`의 메모리·전파 모델이 맞지 않는다. Scoped Value는 불변이고 스코프를 벗어나면 자동 해제돼 이 문제를 없앤다. **우리 스키마가 `workspace_id` + RLS 전제라 이 기능이 설계에 직접 걸린다.**
- **Compact Object Headers (JEP 519, 정식)** — 객체 헤더를 16→8바이트로 줄인다. 작은 객체가 많은 JPA 엔티티/DTO 위주 애플리케이션에서 힙 사용량이 실측 10~20%가량 줄어든다. 같은 서버로 더 버틴다는 뜻이다.
- **AOT 클래스 로딩·링킹 / 메서드 프로파일링 (JEP 514·515)** — 기동 시 하던 일을 미리 해둬 시작 시간을 줄인다. 컨테이너 재배포·오토스케일이 잦을수록 이득.
- **Flexible Constructor Bodies (JEP 513, 정식)** — `this()`/`super()` 호출 앞에 검증 코드를 둘 수 있다. 생성자에서 인자 검증하는 패턴이 자연스러워진다.
- **Module Import Declarations (JEP 511), Compact Source Files (JEP 512)** — `import module java.base;`, 클래스 선언 없는 단일 파일 실행. 스크립트성 코드·학습용에 유용하고 프로덕션 영향은 적다.
- **Generational Shenandoah (정식), JFR CPU-time 프로파일링(Linux)** — GC/관측 도구 개선
- **32비트 x86 포트 제거 (JEP 503)** — 64비트만 남음. 우리 배포 환경에 영향 없음.
- 아직 preview: Structured Concurrency, Primitive types in patterns, Stable Values

**요약하면** — 21이 "가상 스레드를 줬다"면, 25는 "가상 스레드를 실제로 쓸 때 필요한 것들(Scoped Values)과 운영 효율(메모리·기동 시간)을 채웠다."

---

## 재검토가 필요한 조건

아래에 해당하면 **Java 21로 내린다.** Spring Boot 4.1은 21도 정식 지원하므로 코드 변경 없이 toolchain 숫자만 바꾸면 된다.

- 사내 표준 JDK 또는 배포용 Docker 베이스 이미지가 21로 고정돼 있는 경우
- 사용할 APM 에이전트(Pinpoint, Scouter, 상용 APM 등)가 Java 25 미지원인 경우
- 바이트코드를 조작하는 도구(구버전 ByteBuddy 기반 라이브러리 등)가 25에서 깨지는 경우

`INFRA/`가 아직 비어 있어 **배포 환경 제약은 확인되지 않았다.** 배포 방식이 정해지면 위 세 가지를 확인하고 이 문서를 갱신한다.

## 이 문서 밖으로 넘긴 결정

- **ORM 선택** (Spring Data JPA / jOOQ / Spring Data JDBC)
- **RLS 연동 방식** — 스키마가 `workspace_id` + PostgreSQL RLS 전제라, HikariCP에서 커넥션을 빌려올 때 세션 변수를 세팅하고 반납 전에 되돌리는 처리가 필요하다. 누락되면 커넥션 재사용 시 **다른 테넌트 데이터가 보인다.** ORM 선택보다 먼저 정해야 한다.

## 참고

- [Spring Boot 지원 일정 — endoflife.date](https://endoflife.date/spring-boot)
- [Spring Boot 4.1.0 available now](https://spring.io/blog/2026/06/10/spring-boot-4/)
- [Spring Boot 4.0.0 available now](https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now/)
- [Eclipse Temurin 지원 일정 — endoflife.date](https://endoflife.date/eclipse-temurin)
