# OpenClaw 도구 제어 시스템 보안 분석 보고서

**작성일**: 2026-03-25
**목적**: 사내 Docker 배포 시 OpenClaw의 도구(tool) 사용 제어 메커니즘 분석
**대상**: OpenClaw Gateway (LLM 무관)

---

## 1. 핵심 요약

OpenClaw은 **다층 도구 정책 시스템**으로 LLM의 도구 사용을 제어한다.
도구 제어는 **프롬프트 레벨이 아닌 실행 레벨**에서 이루어지며, **거부된 도구는 LLM에게 아예 보이지 않는다.**

### 신뢰 모델

- **단일 사용자/신뢰된 운영자 모델** (멀티테넌트 아님)
- Gateway에 인증된 호출자 = 신뢰된 운영자로 취급
- 여러 사용자 → 별도 Gateway/컨테이너 필요 (공유 인스턴스 비권장)

---

## 2. 도구 제어 아키텍처

### 2.1 제어 방식: "LLM에게 도구를 안 보여준다"

```
[도구 전체 목록]
    ↓ Profile 필터
    ↓ Global allow/deny 필터
    ↓ Provider별 필터
    ↓ Agent별 필터
    ↓ Group/Channel 필터
    ↓ Sandbox 필터
    ↓ Subagent 필터
[최종 도구 목록] → LLM에게 전달
```

**핵심**: 거부된 도구는 LLM의 도구 정의에서 **물리적으로 제거**됨.
프롬프트 인젝션으로 우회 불가 — LLM이 도구의 존재 자체를 모름.

### 2.2 정책 계층 (우선순위 순)

| 계층 | 위치 | 적용 범위 |
|------|------|----------|
| **Tool Profile** | `tools.profile` | 전체 기본값 |
| **Global allow/deny** | `tools.allow` / `tools.deny` | 모든 에이전트 |
| **Provider별** | `tools.byProvider.<id>` | 특정 LLM 제공자 |
| **Agent별** | `agents.list[].tools` | 특정 에이전트 |
| **Group/Channel별** | `channels.<ch>.accounts[].groups` | 특정 채널/그룹 |
| **Sender별** | `toolsBySender` | 특정 사용자 |
| **Subagent** | 하드코딩 | 하위 에이전트 (항상 적용) |
| **HTTP Gateway** | 하드코딩 | 외부 HTTP 호출자 |

**규칙**: deny가 항상 우선. allow 목록이 비어있으면 전부 허용.

---

## 3. 도구 프로필 (Profile)

| 프로필 | 허용 범위 | 사용 시나리오 |
|--------|----------|-------------|
| `minimal` | 세션 상태 조회만 | 읽기 전용 봇 |
| `coding` | 파일 R/W + 명령 실행 + 자동화 | 개발 에이전트 |
| `messaging` | 메시지 전송 + 세션 관리 | 채팅 봇 |
| `full` | 모든 도구 | 관리자 전용 |

---

## 4. 명령 실행(exec) 제어

### 4.1 실행 보안 모드

| 모드 | 동작 |
|------|------|
| `deny` | 모든 명령 차단 |
| `allowlist` | safeBins 목록 또는 승인된 명령만 허용 |
| `full` | 모든 명령 허용 (승인 필요 여부 설정 가능) |

### 4.2 승인(Approval) 워크플로우

```
LLM이 exec 호출 요청
    ↓
승인 모드 확인 (off / on-miss / always)
    ↓ (on-miss 또는 always)
운영자에게 승인 요청 UI 표시
    ↓
운영자가 "1회 허용" 또는 "항상 허용" 선택
    ↓
승인 레코드 생성 (runId 기반)
    ↓
Node-host에서 승인 레코드 검증 후 실행
```

**위변조 방지**: 사용자가 `approved: true`를 직접 주입할 수 없음. 승인 레코드 ID 기반 검증.

### 4.3 safeBins (무승인 허용 명령)

`gpg`, `ssh-keygen`, `openssl` 등 stdin-only 명령.
사용자 추가 설정 가능: `tools.exec.safeBins`

---

## 5. Gateway HTTP 레벨 차단

외부 HTTP 호출자(`POST /tools/invoke`)에 대해 **하드코딩된 차단 목록**:

| 차단 도구 | 이유 |
|----------|------|
| `sessions_spawn` | 원격 세션 생성 → RCE 위험 |
| `sessions_send` | 교차 세션 메시지 주입 |
| `cron` | 지속적 자동화 제어 |
| `gateway` | Gateway 설정 변경 |
| `whatsapp_login` | 대화형 터미널 플로우 |

**오버라이드**: `gateway.tools.allow: ["sessions_spawn"]`으로 명시적 허용 가능.

---

## 6. Sandbox (격리 실행 환경)

### 6.1 모드

| 모드 | 동작 |
|------|------|
| `off` (기본값) | 호스트에서 직접 실행 |
| `non-main` | 메인 세션 외 모두 샌드박스 |
| `all` | 모든 세션 샌드박스 |

### 6.2 샌드박스 기본 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| 네트워크 | `none` | 완전 격리 |
| readOnlyRoot | `true` | 읽기 전용 루트 파일시스템 |
| capDrop | `["ALL"]` | 모든 Linux 기능 제거 |
| tmpfs | `/tmp`, `/var/tmp`, `/run` | 메모리 기반 임시 폴더 |
| securityOpt | `no-new-privileges` | 권한 상승 차단 |

### 6.3 샌드박스 내부 도구 정책

샌드박스는 **독립적인 도구 정책**을 가짐 (메인 정책과 별도):

- 기본 허용: `exec`, `read`, `write`, `edit`, `apply_patch`
- 기본 차단: `browser`, `canvas`, `cron`, `gateway`, 모든 채널 도구

### 6.4 위험 플래그 (의도적 예외)

| 플래그 | 위험 |
|--------|------|
| `dangerouslyAllowReservedContainerTargets` | 호스트 컨테이너 바인딩 |
| `dangerouslyAllowExternalBindSources` | 워크스페이스 외부 경로 바인딩 |
| `dangerouslyAllowContainerNamespaceJoin` | 컨테이너 네트워크 공유 |

이들은 **운영자가 의도적으로 활성화하는 예외**이며, 취약점이 아닌 기능으로 분류됨.

---

## 7. 채널 접근 제어

### 7.1 페어링

- 8자리 영숫자 코드 (1시간 TTL)
- 채널별 allow-from 리스트
- 그룹별 도구 정책

### 7.2 Sender별 도구 제어

```yaml
channels:
  telegram:
    accounts:
      - id: "my-bot"
        groups:
          "*":                    # 기본 그룹
            tools:
              deny: ["exec"]      # 기본: exec 차단
          "#admin-group":
            toolsBySender:
              "id:123456":        # 특정 사용자에게만 exec 허용
                allow: ["exec", "gateway"]
```

**정책 우선순위**: Sender별 > 와일드카드(`*`) > 그룹별 > 채널 기본값

---

## 8. 감사(Audit) 기능

### 8.1 보안 감사 명령

```bash
openclaw security audit --deep
```

검사 항목:
- HTTP Gateway 차단 목록 준수 여부
- Gateway 인증 모드 (토큰/비밀번호 필수)
- 샌드박스 설정 활성화 여부
- 플러그인 신뢰 범위
- 파일시스템 권한

### 8.2 실행 로그

- 승인 요청/결정 기록: `openclaw exec-approvals list`
- 세션 트랜스크립트: 도구 호출/결과/거부 기록
- Gateway API: `/exec/approvals`

---

## 9. CLI 모드 vs Agent 모드 차이

| | CLI 모드 (현재 로컬) | Agent 모드 (사내 배포 시) |
|--|-------------------|----------------------|
| 도구 정책 | 적용됨 | 적용됨 |
| HTTP Gateway 차단 | 미적용 | 적용됨 |
| 승인 워크플로우 | 사용 가능 | 사용 가능 |
| 샌드박스 | 설정에 따름 | 설정에 따름 |
| 권한 모드 | `bypassPermissions` (현재) | 설정 가능 |

**주의**: 현재 로컬 CLI는 `--dangerously-skip-permissions`로 모든 도구가 무제한 허용 상태.

---

## 10. 사내 배포 시 권장 설정

```yaml
# 최소 권한 원칙 기반 설정 예시

gateway:
  bind: "127.0.0.1"          # 루프백만
  auth:
    mode: "token"
    token: "<32자 이상 랜덤>"

tools:
  profile: "messaging"        # 기본: 메시징만
  deny:
    - "exec"                  # 셸 실행 차단
    - "write"                 # 파일 쓰기 차단
    - "edit"                  # 파일 편집 차단
    - "gateway"               # Gateway 설정 변경 차단

agents:
  defaults:
    sandbox:
      mode: "all"             # 모든 세션 샌드박스
      docker:
        capDrop: ["ALL"]
        readOnlyRoot: true
        network: "none"

  list:
    - id: "admin-agent"       # 관리자 전용 에이전트
      tools:
        profile: "full"
        deny: ["gateway"]

    - id: "user-agent"        # 일반 사용자 에이전트
      tools:
        profile: "messaging"
        deny: ["exec", "gateway", "cron"]
```

---

## 11. 확인이 필요한 사항 (미팅 의제)

| # | 확인 사항 | 이유 |
|---|----------|------|
| 1 | `tools.profile` 기본값을 `messaging`으로 충분한지 | 사내 봇 용도에 따라 결정 |
| 2 | exec 승인 모드를 `always`로 할지 `deny`로 할지 | 셸 접근이 필요한 사용 사례 유무 |
| 3 | 샌드박스 `mode: "all"` 적용 시 성능 영향 | 세션마다 Docker 컨테이너 생성 오버헤드 |
| 4 | 채널별 `toolsBySender` 세분화 수준 | 팀/역할별 권한 차등 필요 여부 |
| 5 | 플러그인 신뢰 범위 | 사내 플러그인만 허용할지 외부 포함할지 |
| 6 | 감사 로그 보관 정책 | 컴플라이언스 요구사항 |

---

## 12. 결론

OpenClaw의 도구 제어 시스템은 **설정 파일에 명시된 대로 런타임에서 강제**된다.

- 거부된 도구는 LLM에게 **물리적으로 노출되지 않음** (프롬프트 인젝션 우회 불가)
- 명령 실행은 **승인 워크플로우**로 게이팅 가능
- 샌드박스는 **네트워크 격리 + 읽기 전용 + 권한 제거**가 기본값
- 채널/그룹/사용자 단위로 **세분화된 도구 접근 제어** 가능

**사내 배포 시 핵심 결정**: exec 허용 여부와 샌드박스 모드 선택.
이 두 가지가 보안 수준의 90%를 결정한다.
