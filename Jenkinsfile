// axcore WorkSpace — Jenkins(CI) → docker compose(CD) 파이프라인.
//
// 설치·크리덴셜·서버 준비는 docs/infra/ci-cd.md 에 있다. 이 파일은 Jenkins 컨테이너
// (INFRA/docker-compose.jenkins.yml) 안에서 돌고, 호스트의 Docker 데몬에 compose 를 시킨다.
//
// 파라미터로 무엇을 할지 고른다. 기본값(APP_ONLY · AUTO)은 "dev 를 받아, 마지막 배포 이후 바뀐 쪽
// (BE/FE)만 다시 빌드해 올린다" 이고, DB 는 건드리지 않는다.
//
// TARGET=AUTO 의 판정 기준은 브랜치 이름이 아니라 **바뀐 파일 경로**다. squash 머지·직접 push 에서는
// 브랜치 이름이 남지 않고, BE 브랜치가 FE 파일을 고치는 일도 있기 때문이다. 기준점은 마지막으로
// 배포에 성공한 커밋(LAST_DEPLOY_FILE)이고, 그 기록이 없으면 ALL 로 떨어진다.

// TARGET(AUTO 판정 포함)에서 compose 서비스 목록을 만든다. 파라미터 검증과 AUTO 판정 두 곳에서 쓴다.
def applyTarget(boolean be, boolean fe, boolean nginx) {
  env.BUILD_BE = be.toString()
  env.BUILD_FE = fe.toString()
  def services = []
  if (be)    services << 'app'
  if (fe)    services << 'frontend'
  // nginx 와 certbot 은 TLS 볼륨을 공유하는 한 묶음이라 같이 다시 만든다.
  if (nginx) services << 'nginx' << 'certbot'
  env.APP_SERVICES = services.join(' ')
}

pipeline {
  agent any

  options {
    skipDefaultCheckout(true)
    // 8GB 서버에서 빌드 두 개가 겹치면 메모리가 넘친다. 한 번에 하나만 돈다.
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 40, unit: 'MINUTES')
  }

  parameters {
    choice(
      name: 'BUILD_MODE',
      choices: ['APP_ONLY', 'APP_WITH_DB', 'DB_ONLY', 'FULL_REBUILD', 'STOP_ALL'],
      description: '''배포 모드:
      APP_ONLY     : 앱(BE/FE)만 빌드·재시작. DB 는 이미 떠 있어야 한다 (기본)
      APP_WITH_DB  : DB 를 먼저 올리고(없으면 생성, 있으면 유지) 앱을 빌드·재시작
      DB_ONLY      : DB 만 올리거나 재시작. 데이터 보존
      FULL_REBUILD : ⚠️ DB 볼륨 삭제 후 전부 캐시 없이 재빌드. CONFIRM_DESTROY 에 DELETE 를 입력해야 실행된다
      STOP_ALL     : 앱·DB 컨테이너 중지 (nginx 포함, Jenkins 제외)'''
    )
    choice(
      name: 'TARGET',
      choices: ['AUTO', 'ALL', 'BE', 'FE'],
      description: '''어느 앱을 빌드·재시작할지.
      AUTO : 마지막 배포 커밋 이후 바뀐 경로로 판정 (기본). BE/ 만 → BE, FE/ 만 → FE, 둘 다·INFRA/·Jenkinsfile → ALL,
             INFRA/nginx/·INFRA/certbot/ 포함 → nginx·certbot 재빌드, 코드 변경 없음 → 배포 생략. 기록이 없으면 ALL
      ALL / BE / FE : 판정 없이 강제. .env 만 바꿨을 때(코드 diff 에 안 나온다)는 ALL 을 고른다'''
    )
    string(
      name: 'BRANCH',
      defaultValue: 'dev',
      description: '배포할 브랜치. 기본은 dev'
    )
    booleanParam(
      name: 'RUN_CI',
      defaultValue: true,
      description: 'CI 검사(BE 컴파일 · FE 타입체크/테스트/lint)를 배포 전에 돌린다. 실패하면 배포하지 않는다'
    )
    booleanParam(
      name: 'FE_LINT_STRICT',
      defaultValue: false,
      description: 'FE eslint 오류를 실패로 본다. 기존 오류(verify-email set-state-in-effect)가 정리되면 true 로 올린다'
    )
    booleanParam(
      name: 'REBUILD_NGINX',
      defaultValue: false,
      description: 'nginx·certbot 이미지를 다시 빌드해 재시작한다 (INFRA/nginx/ 또는 INFRA/certbot/ 을 바꿨을 때). AUTO 는 경로 변경으로 자동 감지한다'
    )
    booleanParam(
      name: 'PRUNE_IMAGES',
      defaultValue: true,
      description: '끝에 사용하지 않는 이미지·빌드 캐시를 정리한다 (디스크 50GB 보호)'
    )
    booleanParam(
      name: 'VERBOSE_LOG',
      defaultValue: true,
      description: '빌드 로그를 전부 출력한다'
    )
    string(
      name: 'CONFIRM_DESTROY',
      defaultValue: '',
      description: 'FULL_REBUILD 일 때만 본다. DELETE 라고 정확히 입력해야 DB 볼륨을 지운다'
    )
  }

  environment {
    // GitHub 원격. 크리덴셜 ID 는 docs/infra/ci-cd.md 「Jenkins 크리덴셜」과 같아야 한다.
    REPO_URL        = 'https://github.com/axcore-dev/WorkSpace.git'
    GIT_CRED_ID     = 'github-token'
    ENV_FILE_CRED   = 'infra-env-file'

    COMPOSE_APP     = 'docker compose -f docker-compose.yml'
    COMPOSE_DB      = 'docker compose -f docker-compose.db.yml'
    NETWORK_NAME    = 'axcore-net'

    // 마지막으로 배포에 성공한 커밋 SHA. TARGET=AUTO 가 이 커밋과 HEAD 의 diff 로 대상을 정한다.
    // jenkins_home 은 호스트 바인드라 컨테이너를 다시 만들어도 남는다. 워크스페이스에 두면
    // FULL_REBUILD 의 deleteDir 에 같이 지워진다.
    LAST_DEPLOY_FILE = '/var/jenkins_home/axcore-last-deploy'

    // CI 검사에 쓰는 이미지. BE Dockerfile(temurin 25) · FE Dockerfile(node 24) 과 맞춘다.
    CI_JDK_IMAGE    = 'eclipse-temurin:25-jdk'
    CI_NODE_IMAGE   = 'node:24-alpine'
    GRADLE_CACHE    = 'axcore-gradle-cache'
  }

  stages {

    // 0. 파라미터 검증 -------------------------------------------------------
    stage('파라미터 검증') {
      steps {
        script {
          if (params.BUILD_MODE == 'FULL_REBUILD' && params.CONFIRM_DESTROY != 'DELETE') {
            error('FULL_REBUILD 는 DB 볼륨을 지운다. CONFIRM_DESTROY 에 DELETE 를 입력해야 실행된다.')
          }
          // 뒤 스테이지들이 공유하는 파생값. sh 블록에서는 환경변수로 읽는다.
          env.DEPLOY_APP   = (params.BUILD_MODE in ['APP_ONLY', 'APP_WITH_DB', 'FULL_REBUILD']).toString()
          env.DEPLOY_DB    = (params.BUILD_MODE in ['APP_WITH_DB', 'DB_ONLY', 'FULL_REBUILD']).toString()
          env.QUIET_FLAG   = params.VERBOSE_LOG ? '' : '--quiet'

          // AUTO 는 체크아웃 뒤 「배포 대상 판정」에서 확정된다. 여기서는 일단 ALL 로 두고,
          // FULL_REBUILD 는 판정 없이 전부 다시 만든다.
          env.AUTO_TARGET = (params.TARGET == 'AUTO' && params.BUILD_MODE != 'FULL_REBUILD').toString()
          applyTarget(
            params.TARGET in ['AUTO', 'ALL', 'BE'],
            params.TARGET in ['AUTO', 'ALL', 'FE'],
            params.REBUILD_NGINX
          )
          // 배포 성공 시 LAST_DEPLOY_FILE 을 갱신할지. BE/FE 만 골라 부분 배포한 경우는 갱신하지 않는다 —
          // 그 커밋을 "다 배포됐다" 고 기록하면 나머지 쪽 변경이 다음 AUTO 판정에서 빠진다.
          env.RECORD_DEPLOY = (params.TARGET in ['AUTO', 'ALL']).toString()

          echo "[INFO] BUILD_MODE=${params.BUILD_MODE} TARGET=${params.TARGET} BRANCH=${params.BRANCH} services=[${env.APP_SERVICES}]"
        }
      }
    }

    // 1. 서비스 중지 ---------------------------------------------------------
    stage('서비스 중지') {
      when { expression { params.BUILD_MODE == 'STOP_ALL' } }
      steps {
        dir('INFRA') {
          sh '''
            set -e
            if [ ! -f docker-compose.yml ]; then
              echo "[INFO] 체크아웃된 INFRA 가 없다. 컨테이너 이름으로 직접 중지한다."
              docker stop axcore-nginx axcore-certbot axcore-fe axcore-be axcore-postgres 2>/dev/null || true
              exit 0
            fi
            ${COMPOSE_APP} down --remove-orphans || true
            ${COMPOSE_DB}  down || true
            echo "[INFO] 앱·DB 중지 완료. 데이터 볼륨은 남아 있다. Jenkins 는 건드리지 않았다."
          '''
        }
      }
    }

    // 2. 워크스페이스 정리 ---------------------------------------------------
    stage('워크스페이스 정리') {
      when { expression { params.BUILD_MODE == 'FULL_REBUILD' } }
      steps {
        echo '[INFO] 전체 재구성: 워크스페이스를 비운다'
        deleteDir()
      }
    }

    // 3. 체크아웃 -----------------------------------------------------------
    stage('코드 체크아웃') {
      when { expression { params.BUILD_MODE != 'STOP_ALL' } }
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: "*/${params.BRANCH}"]],
          userRemoteConfigs: [[url: env.REPO_URL, credentialsId: env.GIT_CRED_ID]],
          // 태그 없이 얕게 받되, TARGET=AUTO 가 마지막 배포 커밋과 diff 를 뜰 수 있게 50개는 남긴다.
          // 그 사이 커밋이 50개를 넘으면 기준 커밋이 이력에 없어 ALL 로 떨어진다(안전한 쪽).
          extensions: [[$class: 'CloneOption', depth: 50, noTags: true, shallow: true]]
        ])
        sh 'git log --oneline -1'
      }
    }

    // 3-1. 배포 대상 판정 (TARGET=AUTO) ---------------------------------------
    // 마지막 배포 커밋(LAST_DEPLOY_FILE)과 HEAD 사이에 바뀐 경로로 BE/FE/nginx 를 정한다.
    //   BE/ 만 → BE, FE/ 만 → FE, 둘 다 → ALL
    //   INFRA/ · Jenkinsfile 이 끼면 → ALL (compose·Dockerfile·nginx 는 앱 둘 다에 영향), INFRA/nginx/ → nginx 도 재빌드
    //   관련 경로가 하나도 없으면(docs 만 등) → 배포 생략, 커밋만 기록
    //   기준 커밋이 없거나 이력에 없으면 → ALL
    stage('배포 대상 판정') {
      when {
        allOf {
          expression { env.DEPLOY_APP == 'true' }
          expression { env.AUTO_TARGET == 'true' }
        }
      }
      steps {
        script {
          def out = sh(returnStdout: true, script: '''
            set -e
            if [ ! -f "${LAST_DEPLOY_FILE}" ]; then echo "__NO_BASE__"; exit 0; fi
            base=$(cat "${LAST_DEPLOY_FILE}")
            if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then echo "__BASE_MISSING__ ${base}"; exit 0; fi
            if [ "${base}" = "$(git rev-parse HEAD)" ]; then echo "__SAME__"; exit 0; fi
            echo "__BASE__ ${base}"
            git diff --name-only "${base}" HEAD
          ''').trim()

          def lines = out ? out.split('\n').collect { it.trim() }.findAll { it } : []
          def head  = lines ? lines[0] : ''

          if (head == '__NO_BASE__') {
            echo '[INFO] AUTO: 배포 기록이 없다 (첫 실행). ALL 로 진행한다'
            applyTarget(true, true, params.REBUILD_NGINX)
          } else if (head.startsWith('__BASE_MISSING__')) {
            echo "[INFO] AUTO: 기준 커밋 ${head.split(' ')[1]} 이 얕은 이력에 없다 (50개 초과). ALL 로 진행한다"
            applyTarget(true, true, params.REBUILD_NGINX)
          } else if (head == '__SAME__') {
            echo '[INFO] AUTO: 마지막 배포 커밋과 HEAD 가 같다. 배포할 것이 없다. 강제하려면 TARGET=ALL/BE/FE'
            env.DEPLOY_APP = 'false'
            applyTarget(false, false, false)
          } else {
            def paths = lines.drop(1)
            def be    = paths.any { it.startsWith('BE/') }
            def fe    = paths.any { it.startsWith('FE/') }
            def infra = paths.any { it.startsWith('INFRA/') || it == 'Jenkinsfile' }
            def nginx = paths.any { it.startsWith('INFRA/nginx/') || it.startsWith('INFRA/certbot/') }
            if (infra) { be = true; fe = true }

            echo "[INFO] AUTO: 기준 ${head.split(' ')[1].take(7)}..HEAD 변경 ${paths.size()}개 → BE=${be} FE=${fe} INFRA=${infra} nginx=${nginx}"
            paths.take(30).each { echo "       ${it}" }
            if (paths.size() > 30) echo "       ... 외 ${paths.size() - 30}개"

            if (!be && !fe && !nginx) {
              echo '[INFO] AUTO: BE/FE/INFRA 변경이 없다 (문서 등). 배포를 생략하고 이 커밋을 배포 완료로 기록한다'
              env.DEPLOY_APP = 'false'
              applyTarget(false, false, false)
              sh 'git rev-parse HEAD > "${LAST_DEPLOY_FILE}"'
            } else {
              applyTarget(be, fe, params.REBUILD_NGINX || nginx)
            }
          }
          echo "[INFO] 확정: DEPLOY_APP=${env.DEPLOY_APP} services=[${env.APP_SERVICES}]"
        }
      }
    }

    // 4. 환경 설정 -----------------------------------------------------------
    stage('환경 설정') {
      when { expression { params.BUILD_MODE != 'STOP_ALL' } }
      steps {
        withCredentials([file(credentialsId: env.ENV_FILE_CRED, variable: 'ENV_FILE')]) {
          sh '''
            set -e
            cp "$ENV_FILE" INFRA/.env
            chmod 600 INFRA/.env
            # 값은 찍지 않고 키 이름만 확인한다.
            echo "[INFO] INFRA/.env 키: $(grep -oE '^[A-Z_][A-Z0-9_]*=' INFRA/.env | tr -d '=' | tr '\\n' ' ')"
          '''
        }
      }
    }

    // 5. 네트워크 ------------------------------------------------------------
    stage('네트워크 설정') {
      when { expression { params.BUILD_MODE != 'STOP_ALL' } }
      steps {
        sh '''
          if docker network inspect ${NETWORK_NAME} >/dev/null 2>&1; then
            echo "[INFO] ${NETWORK_NAME} 이미 존재"
          else
            echo "[INFO] ${NETWORK_NAME} 생성"
            docker network create ${NETWORK_NAME}
          fi
        '''
      }
    }

    // 6. CI 검사 -------------------------------------------------------------
    // 빌드 도구(JDK 25, Node 24)를 Jenkins 이미지에 넣지 않고 컨테이너로 빌려 쓴다.
    // $WORKSPACE 는 호스트와 컨테이너에서 같은 경로다 (docker-compose.jenkins.yml 참고).
    // 컨테이너가 root 로 만든 파일은 마지막에 jenkins 소유로 돌려놓는다 — 안 그러면
    // 다음 체크아웃·deleteDir 가 권한 오류로 죽는다.
    stage('CI 검사 · BE') {
      when {
        allOf {
          expression { params.RUN_CI }
          expression { env.DEPLOY_APP == 'true' && env.BUILD_BE == 'true' }
        }
      }
      steps {
        sh '''
          set -e
          echo "[INFO] BE 컴파일 (main + test). 테스트 실행은 DB 가 필요해 아직 넣지 않는다 — docs/infra/ci-cd.md 「남은 일」"
          docker run --rm \\
            -v "$WORKSPACE/BE:/w" -w /w \\
            -v ${GRADLE_CACHE}:/root/.gradle \\
            -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \\
            -e GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx1g -Dorg.gradle.daemon=false" \\
            ${CI_JDK_IMAGE} sh -c '
              chmod +x gradlew
              ./gradlew --no-daemon --console=plain compileJava compileTestJava
              rc=$?
              chown -R "$HOST_UID:$HOST_GID" /w
              exit $rc
            '
        '''
      }
    }

    stage('CI 검사 · FE') {
      when {
        allOf {
          expression { params.RUN_CI }
          expression { env.DEPLOY_APP == 'true' && env.BUILD_FE == 'true' }
        }
      }
      steps {
        sh '''
          set -e
          echo "[INFO] FE 타입체크 · 단위 테스트 · lint (strict=${FE_LINT_STRICT})"
          docker run --rm \\
            -v "$WORKSPACE/FE:/app" -w /app \\
            -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \\
            -e NEXT_TELEMETRY_DISABLED=1 \\
            -e FE_LINT_STRICT="${FE_LINT_STRICT}" \\
            ${CI_NODE_IMAGE} sh -c '
              rc=0
              npm ci --no-audit --no-fund && npx tsc --noEmit && npm test || rc=$?
              if [ "$rc" = "0" ]; then
                if [ "$FE_LINT_STRICT" = "true" ]; then
                  npm run lint || rc=$?
                else
                  npm run lint || echo "[WARN] eslint 오류가 있지만 FE_LINT_STRICT=false 라 계속 진행한다"
                fi
              fi
              chown -R "$HOST_UID:$HOST_GID" /app
              exit $rc
            '
        '''
      }
    }

    // 7. DB ------------------------------------------------------------------
    stage('DB 기동') {
      when { expression { env.DEPLOY_DB == 'true' } }
      steps {
        dir('INFRA') {
          sh '''
            set -e
            if [ "${BUILD_MODE}" = "FULL_REBUILD" ]; then
              echo "[WARN] FULL_REBUILD: DB 컨테이너·볼륨을 지운다"
              ${COMPOSE_DB} down -v --remove-orphans || true
            fi

            echo "[INFO] PostgreSQL 기동"
            ${COMPOSE_DB} up -d

            echo "[INFO] DB 헬스체크 대기 (최대 90s)"
            status=missing
            for i in $(seq 1 45); do
              status=$(docker inspect --format '{{.State.Health.Status}}' axcore-postgres 2>/dev/null || echo missing)
              [ "$status" = "healthy" ] && break
              sleep 2
            done
            if [ "$status" != "healthy" ]; then
              docker logs --tail 50 axcore-postgres || true
              echo "[ERROR] DB 가 healthy 가 되지 않았다: $status"
              exit 1
            fi
            ${COMPOSE_DB} ps
          '''
        }
      }
    }

    // 8. 앱 빌드·배포 ----------------------------------------------------------
    stage('앱 빌드') {
      when { expression { env.DEPLOY_APP == 'true' } }
      steps {
        dir('INFRA') {
          sh '''
            set -e
            NO_CACHE=""
            if [ "${BUILD_MODE}" = "FULL_REBUILD" ]; then
              echo "[INFO] FULL_REBUILD: 앱 컨테이너 전부 내리고 캐시 없이 빌드"
              ${COMPOSE_APP} down --remove-orphans || true
              NO_CACHE="--no-cache"
            fi

            # BE 와 FE 를 동시에 빌드하지 않는다. 8GB 에서 Gradle + next build 가 겹치면 넘친다.
            for svc in ${APP_SERVICES}; do
              echo "[INFO] 이미지 빌드: $svc"
              ${COMPOSE_APP} build ${QUIET_FLAG} ${NO_CACHE} "$svc"
            done
          '''
        }
      }
    }

    stage('앱 배포') {
      when { expression { env.DEPLOY_APP == 'true' } }
      steps {
        dir('INFRA') {
          sh '''
            set -e
            # 대상 서비스만 새 이미지로 교체한다. --no-deps 라 다른 컨테이너는 건드리지 않는다.
            echo "[INFO] 컨테이너 교체: ${APP_SERVICES}"
            ${COMPOSE_APP} up -d --no-deps ${APP_SERVICES}

            # nginx·certbot 은 항상 떠 있어야 한다. 이미 떠 있고 이미지가 같으면 compose 가 아무것도 안 한다.
            ${COMPOSE_APP} up -d --no-deps nginx certbot

            echo "[INFO] 헬스체크 대기 (컨테이너당 최대 120s)"
            wait_healthy() {
              name="$1"
              status=missing
              for i in $(seq 1 60); do
                status=$(docker inspect --format '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)
                if [ "$status" = "healthy" ]; then
                  echo "[INFO] $name healthy"
                  return 0
                fi
                sleep 2
              done
              echo "[ERROR] $name 이 healthy 가 되지 않았다: $status"
              docker logs --tail 80 "$name" || true
              return 1
            }
            if [ "${BUILD_BE}" = "true" ]; then wait_healthy axcore-be; fi
            if [ "${BUILD_FE}" = "true" ]; then wait_healthy axcore-fe; fi
            wait_healthy axcore-nginx

            echo "[INFO] 배포 완료"
            ${COMPOSE_APP} ps

            # 다음 AUTO 판정의 기준점. 헬스체크까지 통과한 뒤에만 기록한다 — 실패한 배포를 기준으로 삼으면
            # 그 변경이 다음 판정에서 빠진다. 부분 배포(TARGET=BE/FE)는 기록하지 않는다(RECORD_DEPLOY).
            if [ "${RECORD_DEPLOY}" = "true" ]; then
              git -C .. rev-parse HEAD > "${LAST_DEPLOY_FILE}"
              echo "[INFO] 배포 커밋 기록: $(cat "${LAST_DEPLOY_FILE}")"
            else
              echo "[INFO] TARGET=${TARGET} 부분 배포라 배포 커밋을 기록하지 않는다. 다음 AUTO 는 이전 기준으로 판정한다"
            fi
          '''
        }
      }
    }

    // 9. 정리 ----------------------------------------------------------------
    stage('이미지 정리') {
      when {
        allOf {
          expression { params.PRUNE_IMAGES }
          expression { params.BUILD_MODE != 'STOP_ALL' }
        }
      }
      steps {
        sh '''
          echo "[INFO] dangling 이미지 정리"
          docker image prune -f || true
          echo "[INFO] 빌드 캐시 정리 (Gradle/npm 캐시 마운트는 4GB 까지 남긴다)"
          docker builder prune -f --keep-storage 4GB || true
          df -h / | tail -1
        '''
      }
    }
  }

  post {
    success {
      echo "[INFO] 성공: ${params.BUILD_MODE} / ${params.TARGET} / ${params.BRANCH}"
    }
    failure {
      echo "[ERROR] 실패: ${params.BUILD_MODE} / ${params.TARGET} / ${params.BRANCH}"
      sh 'docker ps --format "table {{.Names}}\\t{{.Status}}" || true'
    }
    always {
      // 크리덴셜에서 복사한 .env 를 워크스페이스에 남기지 않는다.
      sh 'rm -f INFRA/.env || true'
    }
  }
}
