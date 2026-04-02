# antd v3 Support Design

## Overview

Add support for antd 3.x to enable migration assistance and legacy project queries.

## Goals

1. **Migration assistance** — Help users migrate from v3 to v4/v5/v6 with `antd migrate 3 4`
2. **Legacy project support** — Full query feature support for projects still on v3 (info, demo, doc, props query)

## Non-Goals

- Token system support for v3 (v3 uses Less variables, not Design Tokens)
- Semantic structure support for v3 (v3 doesn't have classNames/styles)
- Per-minor version snapshots (only final version 3.26.20)

## Design Details

### 1. Data Layer

**File structure:**
```text
data/
├── v3.json              # v3 entry point (identical to v3.26.20)
├── v3.26.20.json        # v3 final version snapshot
└── versions.json        # add v3 entry
```

**versions.json addition:**
```json
{
  "v3": {
    "3.26": "3.26.20"
  }
}
```

**Extraction script modifications (`scripts/extract.ts`):**
- v3 frontmatter uses `type` field for sub-category (v4+ uses `group`), already handled by `resolveCategory()`
- v3 has no `_semantic.tsx` files, semantic data will be empty (already handled)
- v3 has no `token-meta.json`, token data will be empty (already handled)
- Add branch detection for `3.x-stable`

**Data compatibility:**
- v3 documentation structure is similar to v4+ (frontmatter + markdown)
- API tables follow the same format
- No changes needed to `loadMetadata()` or `loadMetadataForVersion()`

### 2. Command Support Matrix

| Command | v3 Support | Notes |
|---------|------------|-------|
| `list` | ✅ Full | Component listing |
| `info` | ✅ Full | Props API query |
| `doc` | ✅ Full | Documentation output |
| `demo` | ✅ Full | Demo code |
| `token` | ❌ Error | `UNSUPPORTED_VERSION_FEATURE` |
| `semantic` | ❌ Error | `UNSUPPORTED_VERSION_FEATURE` |
| `changelog` | ✅ Full | Changelog entries |
| `doctor` | ✅ Full | Project diagnostics |
| `usage` | ✅ Full | Usage analysis |
| `lint` | ✅ Full | Code linting |
| `migrate` | ✅ Enhanced | v3→v4 migration knowledge |

### 3. Error Handling for Unsupported Features

Return friendly error messages for v3-incompatible commands:

```json
{
  "error": true,
  "code": "UNSUPPORTED_VERSION_FEATURE",
  "message": "Design Tokens are only available in antd v5+",
  "suggestion": "v3 uses Less variables for theming. See: https://3x.ant.design/docs/react/customize-theme"
}
```

### 4. Enhanced Migration Support (v3→v4)

**New migration knowledge module** (`src/commands/migrate/v3-to-v4.ts`):

Key migration items:
- **Icon**: String `type` prop removed → Use `@ant-design/icons` components
- **BackTop**: Removed → Use `FloatButton.BackTop`
- **Mention**: Removed → Use `Mentions`
- **Form.create()**: Removed → Use `Form.useForm()` hook
- **Form.getFieldDecorator**: Removed → Use `Form.Item name` prop
- **Affix offsetTop**: Changed behavior in v4
- **Less variables**: Replaced by CSS-in-JS in v4

**Migration output example** (`antd migrate 3 4`):
```json
{
  "from": "3",
  "to": "4",
  "steps": [
    {
      "component": "Icon",
      "breaking": true,
      "description": "Icon with string `type` prop removed. Use @ant-design/icons components instead",
      "autoFixable": false,
      "guide": "https://ant.design/docs/react/migrate-v4#icon"
    },
    {
      "component": "BackTop",
      "breaking": true,
      "description": "BackTop is removed, use FloatButton.BackTop instead",
      "autoFixable": true,
      "codemod": "v4-import-rename"
    }
  ],
  "summary": {"total": 15, "autoFixable": 5, "manual": 10}
}
```

## Implementation Plan

### Phase 1: Data Extraction
1. Modify `scripts/extract.ts` to handle v3-specific differences
2. Create `scripts/extract-v3.ts` or add branch detection in extract.ts
3. Generate `data/v3.json` and `data/v3.26.20.json` from `3.x-stable` branch
4. Update `data/versions.json`

### Phase 2: Command Updates
1. Add version check in `token` command for v3 error message
2. Add version check in `semantic` command for v3 error message
3. Test all other commands work with v3 data

### Phase 3: Migration Enhancement
1. Create `src/commands/migrate/v3-to-v4.ts` with migration knowledge
2. Update `migrate` command to recognize v3→v4 path
3. Add v3-specific migration items

### Phase 4: Testing
1. Add unit tests for v3 data loading
2. Add e2e tests for v3 commands
3. Test migration command with v3 projects

## Risks

1. **v3 documentation differences** — May need additional handling for edge cases
2. **Package size** — Adding v3 data increases bundle size (~1-2MB compressed)
3. **Maintenance burden** — v3 is EOL, unlikely to need updates after initial implementation

## Alternatives Considered

1. **Separate package** — Rejected: Adds user friction for a small feature
2. **Full minor snapshots** — Rejected: Overkill for EOL version, only one version needed
3. **Less variables for token command** — Rejected: Too much effort for low usage