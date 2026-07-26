# kbox

**Local-first, end-to-end encrypted API key vault for the browser.**

No cloud account. Secrets are encrypted on-device (PIN + optional WebAuthn PRF). Optional peer-to-peer sync over WebRTC.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![pnpm](https://img.shields.io/badge/package%20manager-pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

- **Encrypted at rest** — AES-GCM per secret; master key only in memory, cleared on lock
- **Unlock** — PIN (PBKDF2 600k) or WebAuthn; browse labels/tags while locked
- **Local storage** — IndexedDB (+ localStorage backup); no vault server
- **Optional sync** — QR / peer ID → WebRTC after both devices confirm

> Sync sends plaintext secrets over the data channel. Treat QR codes and peer IDs as sensitive. Review crypto before storing high-value credentials.

## Quick start

Requires Node.js 20+ and [pnpm](https://pnpm.io/) (npm / yarn not supported).

```bash
git clone https://github.com/SmilingXinyi/kbox.git
cd kbox
pnpm install
pnpm dev
```

Open the Vite URL (usually `http://localhost:5173`). Production: `pnpm build` → `pnpm preview`.

## Features

|           |                                                                           |
| --------- | ------------------------------------------------------------------------- |
| **Vault** | Setup (owner, PIN 4–12, optional WebAuthn), unlock, auto-lock, full reset |
| **Keys**  | CRUD with unique label, tags, description, multi-line secrets             |
| **Find**  | Search label / tag / description / secret; filter by tag                  |
| **Sync**  | PeerJS + WebRTC; QR for peer discovery                                    |
| **PWA**   | Installable; service worker caches static assets only                     |

## Security

```text
PIN ──PBKDF2(600k, SHA-256)──► KEK ──AES-GCM──► master key
WebAuthn PRF ──HKDF──► KEK ──AES-GCM──► master key
Master key ──AES-GCM──► each secret value
```

| Encrypted                          | Plaintext (by design)                               |
| ---------------------------------- | --------------------------------------------------- |
| Secret values + wrapped master key | Labels, tags, descriptions (browsable while locked) |

**Limits:** client-only WebAuthn (no server attestation); BiometricSimulator is DEV-only fixed material — never enable in production (`VITE_ENABLE_BIOMETRIC_SIMULATOR`).

Report crypto/vault issues privately (e.g. GitHub Security Advisory), not as public issues.

## Development

| Command                     | Description                            |
| --------------------------- | -------------------------------------- |
| `pnpm dev`                  | Vite dev server                        |
| `pnpm build`                | Typecheck + production build           |
| `pnpm preview`              | Serve `dist/`                          |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                      |
| `pnpm test`                 | Cypress component tests                |
| `pnpm test:dual-sync`       | Dual-browser WebRTC smoke (Playwright) |

Optional env (copy `.env.example` → `.env.local`): `VITE_ENABLE_BIOMETRIC_SIMULATOR=true` for non-DEV simulator (preview sandboxes only).

**Stack:** React 19 · React Router 8 · Vite 8 · TypeScript · Tailwind v4 · Web Crypto / WebAuthn · PeerJS  
**Conventions:** [AGENTS.md](./AGENTS.md) · design notes in [`docs/requirements/`](./docs/requirements/)

```text
src/components/  vault & UI
src/hooks/       useVault, useAutoLock, usePWA, …
src/lib/         crypto, webauthn, IndexedDB, sync
src/pages/       routes
demo/            reference prototype — do not modify for app features
```

### Contributing

1. Branch from `main`; use **pnpm**; keep diffs focused.
2. Run `pnpm lint` and `pnpm test` (`pnpm build` for larger changes).
3. PRs explain **why**; commits use [Conventional Commits](https://www.conventionalcommits.org/) (English), e.g. `feat: add tag filter`.

## License

[MIT](./LICENSE) © 微笑の辛翼
