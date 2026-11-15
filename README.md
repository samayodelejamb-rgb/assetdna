# AssetDNA
## Run locally
1. `python3 server/server.py`  (SQLite file in `server/`; install `tesseract` for real Ledger Rescue OCR)
2. `npm install && npm run dev`, then open http://localhost:5173
3. First run: open **Sign up**. The first account created becomes the Administrator and is signed in straight away.
   Everyone after that signs up for an office and waits for the Admin to approve them (Users tab), or the Admin adds them directly.
Start fresh any time: stop the server and delete `server/assetdna.db`.

## Deploy on Render (free)
1. Push this folder to GitHub.
2. Render dashboard > New > Blueprint > pick the repo > Apply. `render.yaml` creates the free PostgreSQL database and the free web service and connects them.
3. As soon as it's live, open the site and sign up: the first account becomes the Administrator, so do this before sharing the link.
Free-tier notes: the web service sleeps without traffic, so open the site a minute before you present; the free database is time-limited.

## How accounts work
- Passwords are PBKDF2-hashed; sessions are server-side HttpOnly cookies (7 days, `Secure` over HTTPS); sign-in is rate-limited.
- Admin can add users, approve or disable sign-ups and reset passwords. Everyone can change their own password under Account.
- Optional env vars: `ADMIN_EMAIL` and `ADMIN_PASSWORD` create the first Admin on startup instead of the first-signup rule. `SEED_DEMO=1` adds sample data and demo accounts for presentations only.
