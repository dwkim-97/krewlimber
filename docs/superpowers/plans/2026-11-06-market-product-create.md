# Market Product Create Implementation Plan

**Goal:** 운영진이 마켓에서 별도 페이지를 통해 상품을 등록한다.
**Architecture:** 기존 상품 폼과 관리자 API를 재사용하고 새 라우트를 기존 권한 가드로 보호한다.
**Spec:** docs/superpowers/specs/2026-11-06-market-product-create-design.md

## 작업

- [ ] 등록 진입 버튼의 권한별 노출, 페이지 접근 차단, 저장 성공·실패·취소·저장 중 화면 이탈의 UI 테스트를 먼저 작성하고 실패를 확인한다.
- [ ] `src/components/ProductForm.tsx`로 기존 폼을 추출하고 관리 화면과 `src/pages/ProductCreate.tsx`에서 재사용한다. 콜백·상품 인자는 required이며 신규 상품은 명시적 null이다.
- [ ] `/market/new`의 관리자 가드와 마켓 상단 버튼·완료 메시지를 연결한다.
- [ ] 기존 수정·재고 버전 충돌 테스트와 전체 테스트, 타입·린트·빌드·포맷을 검증한다.
- [ ] 데스크톱·모바일에서 등록을 확인하고 캡처한다. simplify와 독립 리뷰를 수행한 뒤 기능 브랜치를 푸시하고 main 대상 일반 PR을 생성한다.
