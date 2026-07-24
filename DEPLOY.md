# Deploy — Covenant Sentinel on Render

The app is a single Node/Express service (`npm start` → `src/server/app.ts`, serves the UI + API).
It reads `PORT` from the environment (Render sets it) and `YDC_API_KEY` for live You.com.

## One-time, in the Render dashboard (needs your login)

1. **Redeem your $50 credit** — Render dashboard → **Billing** → **Redeem code** → paste the code.
2. **Deploy** — **New +** → **Blueprint** → connect the GitHub repo `jymiller/hack-you`
   (authorize Render's GitHub app so it can read the private repo) → Render detects
   [`render.yaml`](render.yaml) → **Apply**. First build runs `npm ci` then `npm start`.
3. **Add the You.com key** — open the **covenant-sentinel** service → **Environment** →
   add `YDC_API_KEY = <your key>` → **Save** (triggers a redeploy). This is what makes the
   demo cite **live** sources. *(You paste the key — I never handle it.)*
4. **Add the Parasail key** — same **Environment** panel → add `PARASAIL_API_KEY = <your key>` →
   **Save**. `PARASAIL_MODEL` is already pinned to `parasail-glm-52` in the blueprint. Powers the
   Parasail/GLM-5.2 inference path. *(You paste the key — I never handle it.)*
5. **For the live demo, avoid cold starts** — the blueprint defaults to the **free** instance,
   which sleeps after ~15 min idle (~30–50 s wake-up). Bump it to **Starter** in the service's
   **Settings → Instance Type** (your $50 covers it for months). Or just pre-warm the URL right
   before you go on stage.

## Verify

- `https://covenant-sentinel.onrender.com/api/health` → `{"ok":true,"youcom_key":true,...}`
  (`youcom_key:true` confirms the key is set → live You.com).
- Open the URL, click **Scan live web** → the tile flips **6.47× → 7.59×**, the ARI brief shows
  `[REAL]` with live cited sources, and **Attest** commits the breach notice.

## Before final submission

The submission rules require a **public** repo. Keep it private while iterating, then flip
`jymiller/hack-you` to public (GitHub → Settings → Danger Zone → Change visibility) before you submit.

## Local run (unchanged)

```bash
npm install
npm start          # http://localhost:8080
npm run smoke      # verify live You.com endpoints (needs .env with YDC_API_KEY)
```
