plugins {
	// 로컬에 JDK 25 toolchain이 없으면 Gradle이 자동으로 받아온다.
	// 팀원마다 설치된 JDK가 달라도 빌드가 동일하게 돌게 하기 위한 것.
	id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "axpoint"
