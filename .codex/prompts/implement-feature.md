# Implement Feature Prompt

Use this checklist for feature work:

1. Confirm the feature scope and non-goals.
2. Read existing types, components, repositories and tests.
3. Reuse current patterns before adding abstractions.
4. Keep persistence in repositories.
5. Keep business rules in testable helpers.
6. Add focused tests for new rules.
7. Update README/ROADMAP/docs only where useful.
8. Validate with:

```bash
npm run check
npm run build
npm audit --audit-level=moderate
```
