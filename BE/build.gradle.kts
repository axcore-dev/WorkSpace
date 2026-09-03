plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.axcore"
version = "0.0.1-SNAPSHOT"
description = "WorkSpace backend"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	// JPA(Hibernate 7) + HikariCP. 엔티티/리포지토리가 여기에 의존한다.
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	// 스키마의 진실은 마이그레이션 파일이다. Hibernate 는 대조(validate)만 한다.
	// Boot 4 는 자동설정이 모듈별로 갈라져서 flyway-core 만 넣으면 부팅 때 아무 일도 일어나지
	// 않는다. 마이그레이션을 돌리는 건 spring-boot-flyway 쪽이다.
	// PG 지원도 Flyway 10 부터 별도 모듈이라 같이 넣는다.
	implementation("org.springframework.boot:spring-boot-flyway")
	runtimeOnly("org.flywaydb:flyway-database-postgresql")
	// 인증/인가. 비밀번호 해시(BCrypt)도 이 스타터가 들고 온다.
	implementation("org.springframework.boot:spring-boot-starter-security")
	// JWT 발급·검증. 직접 파싱하지 않고 Nimbus + 리소스 서버 필터를 쓴다.
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	// 메일 실발송(SMTP). JavaMailSender 자동설정이 spring.mail.* 를 읽는다.
	// app.mail.mode=smtp 일 때만 SmtpMailSender 가 이걸 쓴다. log 모드에서는 놀고 있는 빈이다.
	implementation("org.springframework.boot:spring-boot-starter-mail")
	runtimeOnly("org.postgresql:postgresql")
	annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}
