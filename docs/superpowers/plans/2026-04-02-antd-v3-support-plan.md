# antd v3 Support Implementation Plan

## Overview
Add support for antd 3.x to enable migration assistance and legacy project queries.

## Tasks

### 1. Data Extraction Pipeline
**Files:** `scripts/extract.ts`, `scripts/extractors/*.ts`

- [ ] 1.1 Test extract.ts against antd `3.x-stable` branch
  - Run extraction with `--antd-dir ~/Projects/ant-design` pointing to 3.x-stable checkout
  - Verify component metadata extraction works
  - Check API table parsing compatibility

- [ ] 1.2 Create v3 data extraction script or script option
  - Option A: Add `--branch` flag to extract.ts
  - Option B: Create `scripts/extract-v3.ts` wrapper

- [ ] 1.3 Generate data files
  - Run: `npx tsx scripts/extract.ts --antd-dir ~/Projects/ant-design --output data/v3.26.20.json` (after checking out 3.x-stable)
  - Create `data/v3.json` as copy of `v3.26.20.json`
  - Update `data/versions.json` with v3 entry

### 2. Code Modifications
**Files:** `src/data/version.ts`, `src/commands/token.ts`, `src/commands/semantic.ts`

- [ ] 2.1 Add v3 fallback version
  - Update `FALLBACK_VERSION` handling if needed (currently v5, v3 detection should work)

- [ ] 2.2 Add token command v3 handling
  - Add version check: if majorVersion === 'v3', return `UNSUPPORTED_VERSION_FEATURE`
  - Message: "Design Tokens are only available in antd v5+"
  - Suggestion: Link to v3 Less variables docs

- [ ] 2.3 Add semantic command v3 handling
  - Add version check: if majorVersion === 'v3', return `UNSUPPORTED_VERSION_FEATURE`
  - Message: "Semantic structure is only available in antd v5+"

### 3. Migration Knowledge
**Files:** `src/commands/migrate.ts`, `src/commands/migrate/v3-to-v4.ts`

- [ ] 3.1 Create v3-to-v4 migration knowledge module
  - Define `v3ToV4Migrations` array with breaking changes
  - Include: Icon, BackTop, Mention, Form.create, getFieldDecorator, etc.

- [ ] 3.2 Update migrate command
  - Handle `antd migrate 3 4` and `antd migrate v3 v5`
  - Load v3-to-v4 migrations when from version is v3

### 4. Testing
**Files:** `src/__tests__/cli.test.ts`, `src/commands/migrate/__tests__/`

- [ ] 4.1 Add v3 data loading tests
  - Test `loadMetadata('v3')` returns valid data
  - Test `loadMetadataForVersion('3.26.20')` works

- [ ] 4.2 Add token/semantic v3 error tests
  - Verify `antd token --version 3.26.0` returns error
  - Verify `antd semantic --version 3.26.0` returns error

- [ ] 4.3 Add migrate v3→v4 tests
  - Test migration output contains v3-specific items

### 5. Documentation
**Files:** `spec.md`

- [ ] 5.1 Update spec.md
  - Add v3 to supported versions
  - Document v3 limitations (no token, no semantic)
  - Add v3→v4 migration documentation

## Execution Order

1. **Phase 1** (Data): Tasks 1.1 → 1.2 → 1.3
2. **Phase 2** (Code): Tasks 2.1 → 2.2 → 2.3
3. **Phase 3** (Migration): Tasks 3.1 → 3.2
4. **Phase 4** (Testing): Tasks 4.1 → 4.2 → 4.3
5. **Phase 5** (Docs): Task 5.1

## Dependencies

- Requires checkout of antd `3.x-stable` branch at `~/Projects/ant-design`
- No new npm dependencies

## Estimated Scope

- ~150-200 lines new code
- ~100 lines test code
- 2 new data files (~2MB total)