# Vercel Supabase Implementation Plan

**Goal:** Vercel Hobby + Supabase Free에서 기존 크루라이머 기능을 운영한다.
**Architecture:** 기존 React와 Express를 유지한다. PostgreSQL은 제한된 서버 연결 풀을 통해 접근하고 private Storage는 기존 권한 검사 뒤 제공한다.
**Spec:** ../specs/2026-11-06-vercel-supabase-design.md

## Global constraints
무료 플랜만 사용. 기존 로그인·회원 승인·4자 비밀번호 유지. 비밀은 서버 환경변수에만 저장. 로컬 데이터는 보존. 실제 회원 데이터 외부 이전은 별도로 범위를 확인.

## Review focus
동시 마지막 재고 주문, 동일 작업 재전송, 세션 폐기 직후 권한 검사, 실패 트랜잭션의 전체 rollback, 서버리스 인스턴스 간 로그인 제한을 검증한다.

## Task 1: PostgreSQL 스키마와 연결
- [ ] tests/postgres-schema.test.ts: 실제 PostgreSQL 엔진에서 스키마 생성, 외래키, 계정 중복, 포인트 원장의 unique 제약과 rollback 테스트를 먼저 작성·실패 확인.
- [ ] supabase/migrations/202611060001_initial.sql: 기존 테이블과 업적 정의를 생성. 밀리초 expiresAt은 BIGINT, 원장 합계는 BIGINT 범위, 테이블 RLS 및 Data API 역할 권한 차단.
- [ ] server/postgres.ts: 환경변수 검증, TLS 연결, 최대 2개 풀, 단일 client transaction, 오류시 rollback/release 구현.
- [ ] scripts/check-supabase.ts: 환경변수 파일에서 연결해 SELECT 1만 실행. 비밀값은 출력하지 않음.
- [ ] 스키마 테스트와 type-check 통과 확인.

## Task 2: API 이전
- [ ] DB 호출의 비동기 인터페이스를 정의하고 auth, app, progression, notice, market 순서로 변환.
- [ ] 주문은 사용자 및 상품을 잠그고 트랜잭션 안에서 재검증. 관리자 재고 수정과 주문 취소에도 일관된 잠금 적용.
- [ ] DB 공유 rate-limit 저장소 적용. 기존 SQLite 테스트를 PostgreSQL 통합 테스트로 포팅.
- [ ] 기존 102개 테스트 및 동시성·rollback 회귀 테스트 통과 확인.

## Task 3: Storage 및 Vercel
- [ ] server/market-images.ts: private bucket 저장/조회 어댑터, 파일 처리·회원 검사 유지. 업로드 제한은 Vercel 요청 한도 이하로 조정.
- [ ] api/index.ts 및 vercel.json: 서버리스 진입점, API/SPA 라우팅, 메타데이터 출처 및 신뢰 프록시 설정.
- [ ] deploy/.env.production.sample 및 README: 키를 제외한 설정 예제와 마이그레이션·복구 방법 기록.
- [ ] 타입/린트/전체 테스트/빌드 후 새 DB에 마이그레이션, Preview 기능 검증.

## Task 4: 계정 연결과 배포
- [ ] Vercel Hobby 계정 및 Supabase Free 프로젝트 확인.
- [ ] 비밀 환경변수를 서버 범위에만 연결. 유료 옵션 선택 금지.
- [ ] Preview 테스트 데이터와 운영 데이터 분리, 실제 데이터 이전 범위 확인.
- [ ] 로그인·승인·공지·이미지·마켓을 배포 URL에서 검증하고 결과 공유.
