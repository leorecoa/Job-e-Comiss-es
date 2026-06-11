# Fix Bug Prompt

Use this checklist for bug-fix work:

1. Reproduce or identify the exact failing path.
2. Search for all related call sites.
3. Make the smallest code change that fixes the root cause.
4. Do not add unrelated features or refactors.
5. Add or adjust tests when the bug has a reusable rule.
6. Run:

```bash
npm run check
npm run build
npm audit --audit-level=moderate
```

7. Report cause, changed files, validation results and remaining risk.
