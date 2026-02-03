# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript sources for the CLI (entry point in `src/index.ts`).
- `dist/`: Build output from `tsc` (compiled JS, run by `node dist/index.js`).
- `src/sync.ts`, `src/verify.ts`, `src/copyback.ts`: Core command implementations.
- `src/config.ts`: Environment/config loading.
- `src/checkpoint.ts`: Resume/checkpoint logic.

## Build, Test, and Development Commands
- `npm run build`: Compile TypeScript to `dist/`.
- `npm start <command>`: Run the built CLI (`sync`, `verify`, `all`).
- `npm run dev <command>`: Run the CLI directly from `src/` via `ts-node`.
- `npm test`: Currently exits with an error (no tests configured).

## Coding Style & Naming Conventions
- TypeScript, strict mode enabled in `tsconfig.json`.
- Use 2-space indentation and consistent casing (compiler enforces file name casing).
- Prefer clear, verb-based function names for actions (e.g., `sync`, `verify`).

## Testing Guidelines
- No test framework is configured yet.
- If adding tests, document the framework, test locations (e.g., `tests/`), and update `npm test`.

## Commit & Pull Request Guidelines
- Commit history follows Conventional Commits (e.g., `feat: ...`, `docs: ...`).
- PRs should include:
  - A short summary and the user impact.
  - Linked issue or rationale.
  - Any CLI output or logs relevant to changes.

## Security & Configuration Tips
- Create `.env` from `.env.example` and keep credentials out of git.
- Required keys include OSS and AWS settings (see `README.md` for exact names).
