# 프로필·타이틀·업적 복원 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Existing checkout is clean and reused on a feature branch.

**Goal:** Supabase 구조에 인스타그램과 기존 추가 타이틀·업적을 복원한다.
**Architecture:** 기존 회원 API에 컬럼을 추가하고 자동 회색·포인트 집계를 공통 함수로 제공한다. 수동 활동 입력 지표는 유지한다.
**Tech Stack:** React, Express, PostgreSQL, PGlite, Vitest.
**Spec:** docs/superpowers/specs/2026-11-09-restore-profile-titles-design.md

## Constraints

- 기존 회원과 업적·대표 선택을 보존하는 추가 마이그레이션만 사용한다.
- 운영 DB 변경·배포·자동 머지는 하지 않는다.
- 사용자 확정 기본값과 기존 유머러스한 이름을 복원한다.

## Tasks

- [x] 인스타그램 API·검증·회원 노출의 실패 테스트 → 컬럼·응답·입력·링크 구현 → 통과 확인.
- [x] 포인트 정정·취소·분기 경계, 회색 암장 구분, 신규 타이틀·일곱 업적·대표 선택의 실패 테스트 → 공통 집계 및 추가 마이그레이션 → 통과 확인.
- [x] 빈 인스타그램·타이틀 정보 팝업·새 업적 표시를 확인하고 전체 타입·린트·테스트·빌드 실행.
- [x] /simplify와 독립 리뷰·Codex 리뷰 2회 완료. 1차 성능 지적 1건 반영, 2차 지적 없음. 최신 원격 재확인 후 이 변경을 커밋·푸시·일반 PR로 제출한다.

## Review Focus

생략한 프로필 입력의 기존 값 보존, Instagram 외부 URL 거부, 한국 분기 경계, 과거 주문 취소 시 원분기 실적 제외, 삭제한 업적 재생성 방지 및 대표 업적 조건 재검증을 테스트한다.

검증: Node 24에서 전체 170개 테스트·타입·린트·빌드 통과. 격리된 계정으로 프로필 저장과 타이틀 정보 팝업까지 확인. Codex 1차 성능 지적은 분기 SQL 집계와 회원 목록의 불필요한 분기 조회 제거로 반영했다.
