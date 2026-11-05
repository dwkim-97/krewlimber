# Boards and market implementation plan

**Goal:** 승인 회원을 위한 공지 게시판과 쇼핑몰 형태 포인트 마켓을 기존 사이트에 추가한다.
**Architecture:** Existing React/TypeScript/Vite, Express, SQLite; additive migration and server authorization. Implement with independent scoped tasks in this checkout on codex/boards-market, based on origin/main.
**Spec:** ../specs/2026-11-05-boards-market-design.md

## Review Focus

- 기존 사용자·세션·업적이 DB 갱신 후 보존된다.
- 미승인 회원은 글·상품을 읽지 못하고 일반 회원은 관리자 작업을 수행하지 못한다.
- 검색·페이지 경계와 고정 글 정렬이 일관된다.
- 사용자 글을 HTML로 실행하지 않는다.
- 거래가 포함되면 차감·재고·취소가 하나의 트랜잭션이며 재요청이 중복 처리되지 않는다.

## Task 1: Notices

Files: src/types/boards.ts, server/notice-routes.ts, server/db.ts, server/app.ts, src/pages/Notices.tsx, src/components/NoticeEditor.tsx, tests/notices.test.ts.
Interfaces: GET /api/notices?q=&page=, GET /api/notices/:id, POST/PATCH/DELETE /api/admin/notices[/:id]. List returns required items,total,page,pageSize; detail includes body, pinned, author, dates, views. Admin routes reuse existing member/admin/audit guards.

- Write meaningful permission, CRUD, pin/search/page and validation tests; observe RED.
- Implement additive schema, validated routes and audit records; run targeted tests GREEN.
- Implement list/detail/editor and integrate protected routes and navigation.

## Task 2: Point market

Files: market types, server routes/service, market pages and admin tools, database migration and tests.
Interfaces (all DTO fields required): src/types/boards.ts. GET /api/market/products?q=&category=&page= -> Page<Product>; GET /api/market/products/:id -> {product}; GET /api/me/wallet -> Wallet (recent 20 entries); GET /api/me/orders?page= -> Page<MarketOrder>; POST /api/market/orders {productId,quantity,requestId:UUID,productRevision:number} -> {order}; PATCH /api/market/orders/:id/cancel -> {order}. Admin GET /api/admin/market/products?page=&q= -> Page<Product>; POST /api/admin/market/products and PATCH /:id accept complete ProductInput (PATCH also requires the original revision); GET /api/admin/market/orders?status=all&page= -> Page<MarketOrder>; PATCH /api/admin/market/orders/:id {status:completed|cancelled}; GET /api/admin/points?userId= -> Wallet; POST /api/admin/points {userId,amount,reason,requestId:UUID} -> Wallet. Existing GET /api/admin/users supplies approved-member selector.

- Test insufficient balance/stock, replay request IDs, duplicate cancellation, completion boundary and role restrictions before implementation.
- Implement ledger and snapshot orders with atomic creation/cancellation and additive v3 tables , v4 product revision and v5 point-adjustment retry IDs.
- Implement gallery/detail/admin management and any agreed point/order flows with tests.

## Task 3: Integration and delivery

- Seed representative notices and products only in the dedicated temporary preview DB.
- Verify desktop/mobile and member/admin flows; save screenshots.
- Run full test suite, type-check, zero-warning lint, build and format checks.
- Run /simplify, fresh code review and Codex review (max 2 rounds), apply valid findings with regression tests.
- Commit on the feature branch, create Draft PR targeting main and verify CI. No direct push to main or default-branch changes are implied by this request.
