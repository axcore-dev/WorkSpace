package com.axcore.workspace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@code @EnableScheduling} — 주기 작업은 지금 하나다({@code AvatarSweeper}, 하루 한 번).
 * 인스턴스가 여럿이면 각자 돈다는 뜻이니, 스케줄을 더 붙일 때는 두 번 돌아도 같은 결과인지 먼저 본다.
 */
@SpringBootApplication
@EnableScheduling
public class WorkspaceApplication {

	public static void main(String[] args) {
		SpringApplication.run(WorkspaceApplication.class, args);
	}

}
