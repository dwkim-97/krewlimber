# 모바일 이벤트 빙고 Implementation Plan

**Goal:** 조 코드 기반 공유 빙고와 운영진 진행 화면을 구현한다.
**Architecture:** 기존 Express·PostgreSQL 인증/트랜잭션 위에 독립 이벤트 도메인과 모바일 React 화면을 추가한다. 비회원 조 세션과 회원 체크 권한을 분리한다.
**Spec:** docs/superpowers/specs/2026-11-10-event-bingo-design.md

## 계약

공유 타입은 `src/types/bingo.ts`에 정의한다. 모든 상태 필드는 required이며 없는 이벤트·조·순위는 null/빈 배열로 표현한다.

- 참가자 GET `/api/event/bingo`, POST `/join` `{code}`, POST `/leave` `{eventId,teamId}` → BingoState.
- POST `/numbers` `{eventId,teamId,number,revision}`, DELETE `/numbers/:number` `{eventId,teamId,revision}`, PUT `/board` `{eventId,teamId,board,revision}`, PUT `/marks` `{eventId,teamId,number,checked,revision}` → BingoState.
- 관리자 GET `/api/event/bingo/admin` → BingoAdminState.
- POST `/api/event/bingo/admin/events` `{maxValue}`, PATCH `/admin/config` `{eventId,maxValue,revision}`, POST `/admin/teams` `{eventId,name}`, POST `/admin/start` `{eventId,revision}`, POST `/admin/finish` `{eventId,revision}` → BingoAdminState.

## 작업

- [x] 서버: 실패하는 SQLite/PGlite API·권한·상태 전환·줄 계산 검사 작성, 새 스키마·조 세션·revision·순위 구현.
- [x] 참가자 화면: 조 입장, 숫자 추가·필터·가로 스크롤, 25칸 배치·체크, 종료 순위 및 동기화. UI 실패 검사를 먼저 작성한다.
- [x] 관리자 화면: 이벤트/n 설정·조 코드 생성·준비 상태·시작·종료·최종 순위. 라우트/로그인 복귀 연동과 권한 UI 검사를 작성한다.
- [x] 전체 테스트·타입·린트·빌드, 실제 모바일/비회원/회원 화면 검증.
- [x] /simplify와 독립 리뷰·Codex 리뷰 2회 완료. 최신 main과 미병합 PR을 재확인했다.

## 검토 초점

다른 조 상태 노출, 비회원/미승인 회원의 체크 우회, 시작/종료와 늦은 저장 경합, 중복·미획득·범위 밖 숫자, 미완성 판 시작 처리, 동점/대각선/최대 12줄, 새 이벤트와 이전 세션 분리, 로그인 복귀 및 동기화 중 입력 보존을 검증한다.

## 검증 결과

- Node 24 전체 51개 파일·207개 테스트 통과. 타입 검사·경고 0개 린트·빌드·Vercel Node ESM 실행 검사 통과.
- SQLite/PGlite에서 조 격리, 비회원/미승인 체크 거부, 단계 잠금, 줄 계산·동점, 기존 판 정정, 이벤트·조 대상 및 revision 충돌을 검사했다.
- 390px 모바일 브라우저에서 입장·수집·전체 보기·25칸 배치와 관리자 준비 현황을 확인했다. 페이지 전체 가로 넘침 없이 숫자 목록 안에서 스크롤된다.
- 별도 테스트 서버의 실제 HTTP에서 회원 체크 5개 → 1줄 → 종료 순위와 미완성 조 제외를 확인했다. 임시 서버와 테스트 계정은 메모리에서만 사용하고 종료했다.
- /simplify: 쿠키 처리 간소화, 느린 조회의 반복 취소 방지, 모바일 숫자 목록 넘침 수정. 광범위한 기존 코드 리팩터링은 범위 밖이므로 수행하지 않았다.
- Codex 1차 2건(탭 전환 시 다른 조 저장, 관리자 현재 순위), 2차 2건(25개 미만 정정, 저장 중 입력 손실)을 모두 반영하고 회귀 검사를 통과했다. 미반영 항목 없음.
- 제출은 `codex/mobile-event-bingo` → `main` 일반 PR로 진행한다. 기준은 `aa0a468`, PR #11의 복원 기능을 보존한다. 운영 마이그레이션·배포·PR 머지는 포함하지 않는다.
