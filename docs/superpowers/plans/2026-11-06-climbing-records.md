# Climbing Records Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 인스타그램 프로필과 방문·색상 완등 기록, 프랜차이즈/지점 요약, 기록 기반 참여·완등 집계를 제공한다.

**Architecture:** 기존 React/Express/SQLite를 유지한다. 검증한 정적 암장 목록을 서버가 제공하고 방문 및 색상 행을 SQLite에 저장한다. 집계는 원본 방문 테이블에서 일괄 계산하여 기존 수동값과 중복 합산하지 않는다.

**Tech Stack:** React 19, TypeScript, Express 5, Node 22 SQLite, Vitest/jsdom.

**Spec:** ../specs/2026-11-06-climbing-records-design.md

## Global Constraints

- 기능 브랜치에서 작업 후 main 대상 일반 PR, 자동 머지 금지.
- 신규 의존성 없음, required 필드 사용, 빈 Instagram은 빈 문자열.
- 참여는 날짜+암장별 1회. 색상 지표는 더클라임의 기본색만 반영.
- 기존 계정·프로필·번개·포인트 보존. 기존 참여·완등 수동값은 집계 제외.
- 정적 암장 목록의 전수성·최신성을 과장하지 않는다.

## Review Focus

- 동일 날짜 여러 지점 방문 및 중복 등록은 각각 집계/409 처리.
- 다른 회원 접근·미승인 접근과 감사 실패의 원자성.
- 타 브랜드 빨강 및 커스텀 색상은 더클라임 지표에 포함되지 않음.
- 과거 분기와 삭제로 인한 대표 업적 해제 및 재달성 선택 유지 정책.
- 기존 DB 전환 보존과 프랜차이즈/지점 분리·색상 이름 접근성.

### Task 1: Instagram

**Files:** server/db.ts, auth.ts, app.ts, validation.ts; src/types/index.ts, pages/Me.tsx, Members.tsx; tests/instagram.test.ts.
**Interfaces:** Profile.instagramUrl:string, PATCH /api/me canonical HTTPS profile address.

- [x] API 테스트에서 기본값 누락 실패 확인 후 저장·노출·거부 동작 구현.
- [x] Instagram API 테스트 통과.
- [x] 타입 fixture와 마이그레이션 fixture 갱신, 멤버 링크 확인.

### Task 2: Catalog and visits

**Files:** server/gyms.catalog.json, server/climbing.ts, climbing-routes.ts, climbing-progress.ts; src/types/climbing.ts, consts/climbing.ts; tests/climbing-records.test.ts.
**Interfaces:** GET /api/gyms -> GymCatalog; GET/POST /api/me/climbs, PUT/DELETE /api/me/climbs/:id -> record; GET /api/me/climbing-summary -> ClimbingSummary.

- [x] 암장 조회 및 생성/중복/권한/날짜/커스텀색 테스트가 404로 실패함을 확인.
- [x] v8 visits+colors 테이블, verified catalog, CRUD·요약 및 감사 트랜잭션 구현.
- [x] 방문별 참여, 더클라임색, 분기·누적·대표 해제 테스트 후 집계 연결.
- [x] 기존 테스트를 새 기록 근거로 갱신하고 전체 통과 확인.

### Task 3: Recording UI and summary

**Files:** src/pages/ClimbingRecords.tsx, components/GymPicker.tsx, ClimbingSummary.tsx; src/styles/climbing.css; main.tsx, Layout.tsx, Me.tsx, AdminProgression.tsx.
**Interfaces:** GymPicker onSelect(Gym), summary expandable franchise/branch colors; /climbs and /me?tab=records.

- [x] 검색/지역 필터/커스텀색/제출 UI와 프랜차이즈 펼치기 테스트 먼저 작성.
- [x] 오늘 날짜·암장 다이얼로그·색상 수량·커스텀색·본인 목록 수정/삭제 구현.
- [x] 내 정보 기록 탭과 운영진 화면의 자동집계/번개 입력 구분.
- [x] 테스트 유저에만 멱등 방문 샘플을 제공하고 기존 계정/비밀번호/프로필 보존.

### Task 4: Delivery

- [x] 타입·lint 0 warning·전체 테스트·build·format·diff 검증.
- [x] 브라우저에서 검색·등록·수정·요약·모바일 확인 및 전후 스크린샷.
- [x] /simplify 후 Codex critical review 최대 2회, 타당한 지적 반영 및 재검증.
- [ ] commit/push, main 대상 일반 PR 생성·연결, CI 통과 확인.
