# Dependency Audit - 2026-09-16

Command:

```bash
npm audit --json
```

## Findings

| Package | Severity | Direct | Advisory | Affected | Fixed version / path | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `postcss` via `next/node_modules/postcss` | High | No | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, plus related moderate PostCSS advisories | `<=8.5.22` | `npm audit` offers `next@16.3.5`, a semver-major upgrade | Temporarily accepted. The vulnerable copy is bundled under Next; the safe fix path is a major framework upgrade that should be planned and tested separately. |
| `next` | Moderate | Yes | Reported because Next includes the affected PostCSS dependency | `9.3.4-canary.0 - 16.3.0-preview.10` | `next@16.3.5`, semver-major | Temporarily accepted for this stabilization batch. Do not run `npm audit fix --force`; schedule a controlled Next 16 migration. |

## Rationale

The project currently builds and tests on Next 15.5.25. The only fix offered by npm is a semver-major Next upgrade. That has meaningful compatibility risk for routing, linting, build output, and framework behavior, so it is documented here rather than applied blindly during stabilization.
