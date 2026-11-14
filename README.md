# AssetDNA
Two terminals:
1. `python3 server/server.py` (API on :8000, SQLite file `server/assetdna.db`, no installs; install `tesseract` for real Ledger Rescue OCR)
2. `npm install && npm run dev`, then open http://localhost:5173

Pages: `/` home, `/signin`, `/signup`, then each office dashboard at `/maintenance`, `/procurement`, `/finance`, `/admin`, `/auditor` (sidebar layout, forest-green design system in `src/index.css`).
Signed in already? Going to your office URL opens it directly. Another office's URL sends you back to your own.
Demo accounts (password `Demo@1234`): `maintenance@funaab.edu.ng`, `procurement@`, `finance@`, `admin@`, `auditor@` (same domain).
New sign-ups stay pending until Admin approves them in the Users tab.
Sessions are server-side cookies; passwords are PBKDF2-hashed. Reset all data: stop the server, delete `server/assetdna.db` and `server/uploads`.
Production: `npm run build`, then the same server also serves `dist/` on :8000.
