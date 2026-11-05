# Achievements and quarterly titles implementation plan

> **For agentic workers:** Use superpowers:executing-plans; implement in this checkout and preserve the existing Draft PR.

**Goal:** 간결한 UI에 분기 타이틀·누적 업적·대표 업적과 다양한 테스트 유저를 제공한다.

**Architecture:** 기존 SQLite에 활동·업적 정의·대표 선택을 추가하고 순위/달성을 서버에서 계산한다. React는 보호된 API를 조회하며, 데모 데이터는 명시적 시드에서만 생성한다.

**Tech Stack:** Existing React/TypeScript/Vite, Express, Node SQLite, Zod, Vitest/Supertest.

**Spec:** ../specs/2026-11-05-achievements-design.md

## Global Constraints

- 자체 로그인과 기존 회원·관리자 권한을 유지한다.
- 분기 1위는 참여 횟수, 동률은 공동 보유자로 표시한다.
- 대표 업적은 실제 획득한 항목 하나만 선택 가능하다.
- 원본 SVG는 변경하지 않는다. 테스트 유저는 데모 DB에만 넣는다.
- 새 타입은 required 또는 명시적인 null을 사용한다.

## Review Focus

- 0건·동률·분기 경계·정지 회원이 순위를 오염시키지 않는다.
- 누적 목표 직전/정확한 달성·기록 감소·정의 삭제가 대표 선택에 반영된다.
- 일반 회원과 대기 계정이 관리자 데이터 변경을 수행할 수 없다.
- 기존 DB 재오픈 시 데이터·선택을 보존하고 삭제한 기본 정의를 되살리지 않는다.
- 데모 시드가 실제 DB를 변경하거나 기존 사용자 비밀번호·세션을 덮어쓰지 않는다.

### Task 1: Data and API

**Files:** src/types/index.ts, src/consts/progression.ts, server/db.ts, server/progression.ts, server/progression-routes.ts, server/app.ts; tests/progression.test.ts.

**Interfaces:** GET /api/titles?quarter=YYYY-Qn; GET /api/me/achievements; PATCH /api/me/featured-achievement {achievementId:string|null}; GET /api/admin/progression?quarter=...; PUT /api/admin/activity/:userId {quarter,counts}; POST/DELETE /api/admin/achievements. GET /members gains required titles and nullable featuredAchievement.

- [x] Add meaningful tests for ranking, achievements, migration and authorization; observe RED.
- [x] Implement additive version-2 schema and default catalog, derived ranking/achievement services and validated routes.
- [x] Run tests and type-check; expect all green.

### Task 2: Screens and copy

**Files:** src/pages/{Auth,HallOfFame,Members,Me,Home,Admin}.tsx; components/{BrandLogo,TitleList,Achievements,AdminProgression}.tsx; src/styles.css; tests/achievements-ui.test.tsx.

**Interfaces:** Task 1 DTOs and existing api/useResource/useSession.

- [x] Test selection/locked state and title expansion behavior.
- [x] Add title rows and quarter selection, achievement list/conditions/featured selection, member title/achievement prominence, admin counters and achievement creation/deletion.
- [x] Use the original logo on signup and remove unnecessary subtitles and repeated copy across pages.
- [x] Check desktop/mobile and persistent selection through the existing test preview.

### Task 3: Demo and delivery

**Files:** scripts/seed-demo.ts, server/demo-fixtures.ts, tests/demo.test.ts, package.json, README.md, docs/screenshots/*.

- [x] Implement explicitly guarded, idempotent hardcoded test users and quarterly activity; preserve existing test admin sessions/password.
- [x] Seed only the existing temporary preview DB and keep its URL/login usable.
- [x] Run type-check, zero-warning lint, tests, build and browser checks.
- [x] Run /simplify and independent Codex review (2 rounds), validate fixes and run the final local checks.

Delivery uses the existing feature branch and Draft PR #1. GitHub Actions results are recorded in the PR checks.
