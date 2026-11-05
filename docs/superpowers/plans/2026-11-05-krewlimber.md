# Krewlimber Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 이메일 없이 자체 아이디·비밀번호로 가입하고 운영진 승인을 받는 클라이밍 동호회 사이트를 만든다.

**Architecture:** React/Vite 프론트엔드와 동일 출처 Express 서버를 사용한다. SQLite에 회원·세션·성과·관리 이력을 저장하고 모든 권한을 서버에서 검사한다. 비밀번호는 scrypt로 해시하며 HttpOnly 세션 쿠키와 동일 출처 검증을 사용한다.

**Tech Stack:** React, TypeScript, Vite, Express, Node SQLite, Vitest, Supertest.

**Spec:** ../specs/2026-11-05-krewlimber-design.md

## Global Constraints

- 자체 아이디·비밀번호 계정, 이메일과 OAuth 없음.
- 가입 신청 후 운영진이 승인해야 회원 기능을 사용할 수 있다.
- 회원 목록, 내 정보, 명예의 전당, 권한에 따른 회원 관리 화면.
- 원본 로고 수정 금지. 아이보리·검정·라임색, 홀드와 루트 그래픽.
- 보호 브랜치에 직접 커밋·푸시 금지. 비어 있는 저장소는 내용 없는 bootstrap 커밋을 기준으로 기능 브랜치와 PR을 만든다.
- 최초 관리자는 서버에서 대화형 명령으로 생성한다. 기본 비밀번호나 선착순 관리자 없음.

## Review Focus

- 역할·승인 상태를 본인 수정 요청에 끼워 넣어도 권한이 바뀌지 않아야 한다.
- 활동 정지와 비밀번호 변경 후 기존 세션이 무효화되어야 한다.
- 잘못된 출처의 변경 요청과 무차별 로그인은 거부해야 한다.
- 마지막 관리자의 강등·정지와 상태 갱신 실패 시 데이터 일관성을 보장한다.
- 날짜·난이도·성과 대상·문자열 길이를 서버에서 검증하고 없는 기록은 404로 처리한다.

### Task 1: Persistent membership API

**Files:** server/db.ts, server/auth.ts, server/app.ts, server/index.ts, src/types/index.ts, tests/api.test.ts

**Interfaces:** createApp({db, origin, secureCookies}) returns Express; openDatabase(path) returns DatabaseSync; createAccount(db, {username,password,nickname,role,status}) creates an account. GET /api/me returns {user: User|null}; GET /api/members returns {members: Member[]}; GET /api/honors returns {honors: Honor[]}. POST signup/login/logout, PATCH profile/password, GET/PATCH admin users and POST/DELETE honors.

- [x] Write tests against real in-memory SQLite and Supertest: signup pending, duplicate and malformed rejection, password/session security, member/admin authorization, approval and suspension, profile tampering, last-admin protection, honor CRUD validation, same-origin protection, throttling.
- [x] Run pnpm test:unit and observe missing API implementation failure.
- [x] Implement schema, scrypt hashing, hashed session tokens, CSRF origin checks, transactional admin changes and audit history.
- [x] Run pnpm test:unit; expected all pass. Run pnpm type-check.

### Task 2: Responsive club experience

**Files:** src/pages/_, src/components/_, src/apis/client.ts, src/hooks/useSession.tsx, src/consts/index.ts, src/styles.css, src/main.tsx, public/*

**Interfaces:** Shared API types from Task 1. useSession returns {user,loading,refresh}; api(path, init) rejects non-success responses with a user-readable error.

- [x] Implement private dashboard, signup/login, members search and grade filter, own profile/password, member-only honor gallery, administrator membership and honor tools using real API.
- [x] Implement pending/rejected/suspended states, empty/error/loading states and keyboard/mobile navigation.
- [x] Build and open local preview. Verify browser signup/login/profile and protected page behavior at desktop and mobile widths.

### Task 3: Operations and delivery

**Files:** scripts/create-admin.ts, scripts/admin-input.ts, Dockerfile, compose.yaml, README.md, .github/workflows/ci.yml, .github/pull_request_template.md

**Interfaces:** pnpm admin:create prompts for username, nickname and hidden password; Docker persists /app/data and requires APP_ORIGIN for production.

- [x] Add administrator provisioning with hidden password input, audit-preserving one-time password reset by an authenticated admin, deployment and backup instructions.
- [x] Run type-check, lint, test:unit, build and verify production server routing and health.
- [x] Run /simplify, then independent Codex review (max two rounds) and fix validated findings.
- [ ] Push bootstrap and feature branches, open an assigned PR targeting bootstrap, attach PR and show local preview. Do not merge.
