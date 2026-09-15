# Production deploy checklist

Target: Vercel + Neon Postgres + Vercel Blob. Work top to bottom; every box
matters. The **first deploy** section is one-off; **every deploy** applies to
each release after that.

## First deploy

### 1. Secrets (Vercel → Project → Settings → Environment Variables, *Production*)

Generate fresh values for production — never reuse ones from `.env`.

| Variable | How to generate | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` | Rotating it signs everyone out. |
| `FIELD_ENCRYPTION_KEY` | `openssl rand -base64 32` | **Store a copy in your password manager.** Losing it makes every strategy note and hearing note unrecoverable. |
| `CRON_SECRET` | `openssl rand -hex 24` | Vercel Cron sends it automatically. If unset, the reminder crons refuse to run. |
| `BLOB_READ_WRITE_TOKEN` | Created by connecting a Vercel Blob store | If unset in production, document upload and download refuse to run rather than write to the throwaway serverless disk. |
| `NEXT_PUBLIC_FIRM_NAME` | — | Branding. |
| `DB_PRISMA_URL` / `DB_URL_NON_POOLING` | Created by the Neon integration | The app also accepts the integration's own names (see `src/lib/env.ts`). Pooled for the app, direct for migrations. |

Leave `FIELD_ENCRYPTION_KEY_PREVIOUS` empty; it is only for key rotation.

- [ ] All of the above set for **Production** (and separately for Preview, with *different* values and a separate database branch).

### 2. Database

```bash
# Against production, from a trusted machine, with the DIRECT url:
DB_URL_NON_POOLING="postgres://…" npm run db:deploy
```

- [ ] `npm run db:deploy` applied every migration with no errors.
- [ ] **Do not run `npm run db:seed` against production.** The placeholder accounts are for development only; the script refuses to run in production unless forced.
- [ ] Neon: point-in-time restore / backups are enabled on the production branch.

### 3. First administrator

```bash
DB_URL_NON_POOLING="postgres://…" \
ADMIN_EMAIL="partner@yourfirm.com" \
ADMIN_PASSWORD="a long, unique passphrase (12+ chars)" \
ADMIN_NAME="Full Name" \
npm run admin:create
```

- [ ] Output shows `password verifies: true`.
- [ ] Clear the command from shell history (`history -d` / close the terminal); the password was on the command line.
- [ ] Sign in, then create the rest of the team from **Settings → Team**.
- [ ] If the database was ever seeded: no `@example.com` accounts remain (deactivate them in Settings → Team).

### 4. Verify after the first deploy

- [ ] `/login` loads over HTTPS; `/dashboard` while signed out redirects to `/login`.
- [ ] Sign in as the partner; upload a document, download it back.
- [ ] Add a strategy note, reload, and confirm it still reads correctly (proves `FIELD_ENCRYPTION_KEY` is right).
- [ ] Sign in as a paralegal test account and confirm the strategy note is **not** visible.
- [ ] Six wrong passwords on a test account show the lockout message; unlock it from Settings → Team.
- [ ] Vercel → Cron Jobs shows both jobs; trigger one manually and check it returns `ok: true`:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/task-deadlines
  ```
- [ ] The same request **without** the header returns 401.

## Every deploy

- [ ] CI is green on the PR (typecheck, lint, tests, migrations-vs-schema).
- [ ] If the PR adds a migration: run `npm run db:deploy` against production **before** promoting the deploy (migrations here are additive; if one is not, plan the order explicitly).
- [ ] After promoting, the post-deploy smoke checks in step 4 that touch the changed area still pass.

## Rolling back

- Vercel → Deployments → *Promote* the previous deployment. Code rollback is instant.
- Migrations are **not** rolled back automatically. Additive migrations (new tables/columns) are safe to leave in place under older code.
- **Encryption format:** values written by this version use the `v2` envelope. Code older than commit `07ee76a` cannot read them — do not roll back past that commit once notes have been written.

## Rotating the field encryption key

Only when the key may be exposed, or on a fixed schedule.

1. Generate a new key and store it in the password manager.
2. Set `FIELD_ENCRYPTION_KEY_PREVIOUS` = old key, `FIELD_ENCRYPTION_KEY` = new key; redeploy.
3. From a trusted machine with the same two values and the direct DB URL:
   ```bash
   npm run crypto:rotate            # dry run
   npm run crypto:rotate -- --apply
   npm run crypto:rotate            # must report 0 to rotate, 0 unreadable
   ```
4. Clear `FIELD_ENCRYPTION_KEY_PREVIOUS` and redeploy. Keep the old key archived until backups made before rotation have expired.

## Account recovery

- A locked-out user: partner uses **Unlock sign-in** in Settings → Team (or resets the password, which also unlocks).
- The only partner is locked out or forgot the password: re-run `npm run admin:create` with their email.
