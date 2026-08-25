# syntax=docker/dockerfile:1

# --- build stage -----------------------------------------------------------
# build.gradle.kts 의 toolchain 이 Java 25 라 베이스도 25 로 맞춘다.
# 이미지 안에 JDK 25 가 있으면 foojay resolver 가 JDK 를 따로 내려받지 않는다.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# wrapper 와 빌드 스크립트를 먼저 복사해 의존성 레이어를 캐시한다.
COPY gradlew ./
COPY gradle gradle
COPY settings.gradle.kts build.gradle.kts ./
RUN chmod +x gradlew

COPY src src
# bootJar 만 돌린다. build/assemble 과 달리 jar 태스크가 돌지 않아
# -plain.jar 가 생기지 않고, 실행 가능한 jar 하나만 남는다.
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon clean bootJar

# --- runtime stage ---------------------------------------------------------
FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app

# compose 의 healthcheck 가 /actuator/health 를 찌르는 데 필요하다.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# root 로 실행하지 않는다.
RUN groupadd --system spring \
 && useradd --system --gid spring --no-create-home spring

COPY --from=build /workspace/build/libs/*.jar app.jar
USER spring

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
