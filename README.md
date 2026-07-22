# kbox

Local-first API key vault. Secrets are encrypted on-device with a PIN (and optional WebAuthn PRF biometrics). Optional peer-to-peer device sync uses WebRTC.

## Stack

Vite + React + TypeScript + Tailwind CSS.

## Commands

Use **pnpm** only:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## Notes

- Encrypted secret values live in IndexedDB (with a localStorage backup). Labels and tags are stored in plaintext so the vault stays browsable while locked.
- Device sync transfers plaintext secrets over a WebRTC data channel after both peers confirm; treat QR / peer IDs as sensitive.
