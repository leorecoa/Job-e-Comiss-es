# Release Check Prompt

Before creating a release:

1. Confirm `main` is up to date.
2. Confirm open PRs that should be included are merged.
3. Run:

```bash
npm run check
npm run build
npm audit --audit-level=moderate
```

4. Review `CHANGELOG.md`.
5. Confirm README setup instructions still match the app.
6. Create a GitHub release with clear notes and validation summary.
