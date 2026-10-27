# NOVA by AETHRA — Repository Working Rules

- Inspect the repository and current Git state before editing; preserve existing code and configuration.
- Implement only the active checkpoint. Do not expand scope without explicit direction.
- Apply security-first defaults: validate inputs when introduced, keep dependencies intentional, and never expose secrets or credentials.
- Test relevant changes and report the commands and results accurately.
- Document material implementation results in the appropriate project documentation.
- Never automatically deploy, push, commit, or modify Git remotes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
