# eCitizen Service Command Centre — Deploy Playbook

> Last updated: 2026-04-24. Written from live observations while the pipeline was running.

---

## How It Works — The Big Picture

```
Developer pushes to staging branch
         │
         ▼
GitHub Actions (CI - Staging) runs on self-hosted wasaa-org-runners
         │
    ┌────┴────────────────────────────────────────┐
    │  1. Build & Test      (npm ci + lint + test) │
    │  2. Security Scan     (Gitleaks + Trivy)     │
    │  3. Build & Push      (Docker → GHCR)        │
    │  4. Update Helm       (values.yaml tag bump) │
    │  5. Trigger ArgoCD    (POST /sync)           │
    │  6. Report            (GitHub Step Summary)  │
    └────────────────────────────────────────────┘
         │
         ▼
ArgoCD detects values.yaml change in Ventures-Helm-Charts (staging branch)
         │
         ▼
Kubernetes pulls new image from GHCR, rolls out new pod
         │
         ▼
Pod starts → docker-entrypoint.sh runs:
  1. npx prisma migrate deploy   (schema migrations)
  2. npx prisma db seed          (seed data — idempotent)
  3. node dist/main.js           (app starts on port 4010 / 3001)
```

---

## Repositories & What They Deploy

| Repo | Branch | Helm key | Port | URL |
|------|--------|----------|------|-----|
| `ecitizen-support-backend` | `staging` | `backend.image.tag` | 4010 | `api-ecitizen.wasaahost.com/api/v1` |
| `ecitizen-support-admin` | `staging` | `admin.image.tag` | 3001 | `admin-ecitizen.wasaahost.com` |
| `ecitizen-support-webclient` | `staging` | `webclient.image.tag` | 3003 | `ecitizen.wasaahost.com` |

All three share **one Helm chart**: `web-masters-ke/Ventures-Helm-Charts` → `charts/ecitizen-support-service/values.yaml`, **one ArgoCD app**: `ecitizen-support-service` at `argocd.wasaahost.com`.

---

## Step-by-Step Pipeline Detail

### Step 1 — Build & Test (`build-test`)
- Runner: `wasaa-org-runners` (self-hosted, on-prem)
- `npm ci --ignore-scripts && npm rebuild` — reproducible install
- Lint and tests run with `continue-on-error: true` / `|| true` — failures don't block the deploy (tests are advisory, not gate)
- Timeout: 20 min

### Step 2 — Security Scan (`security-scan`)
- **Gitleaks** — scans for accidentally committed secrets (API keys, passwords). `continue-on-error: true` so it never blocks a deploy but results appear in the run log.
- **npm audit** — dependency vulnerability check at `high` severity level.
- **Trivy** — filesystem scan for `CRITICAL,HIGH` CVEs; results uploaded as SARIF to GitHub Security tab.
- Timeout: 15 min

### Step 3 — Build & Push Image (`build-push`)
- Skipped on pull requests (only runs on `push` to `staging`)
- **Version tag**: `staging-{YYYYMMDDHHMM}-{git-short-sha}` e.g. `staging-202604241051-ee1ff2d`
- Two tags pushed to GHCR:
  - `ghcr.io/web-masters-ke/{service}:{version-tag}` — pinned, immutable
  - `ghcr.io/web-masters-ke/{service}:latest-staging` — floating, always points to newest
- Docker layer cache via GitHub Actions cache (`cache-from: type=gha`) — makes rebuilds fast
- Timeout: 30 min

### Step 4 — Update Helm Values (`update-helm`)
- Checks out `web-masters-ke/Ventures-Helm-Charts` at the `staging` branch using `ARC_GITHUB_PAT`
- Python script surgically patches `charts/ecitizen-support-service/values.yaml`:
  - Backend pushes → updates `backend.image.tag`
  - Admin pushes → updates `admin.image.tag`
  - Webclient pushes → updates `webclient.image.tag`
- Commits: `ci(staging): update ecitizen-{service} → {version-tag}`
- Push triggers ArgoCD's built-in git polling (even without the explicit sync step below)
- Timeout: 10 min

### Step 5 — Trigger ArgoCD Sync (`trigger-argocd`)
- POSTs to `https://argocd.wasaahost.com/api/v1/applications/ecitizen-support-service/sync`
- Uses `ARGOCD_TOKEN` secret — if token is unset, step is skipped gracefully (ArgoCD will still self-sync via git polling within ~3 min)
- Sync flags: `prune: true` (remove deleted resources), `force: false` (safe rolling update)
- Timeout: 10 min

### Step 6 — Report (`report`)
- Writes a markdown summary table to the GitHub Actions Step Summary tab showing image name, helm path, ArgoCD app, and pass/fail for each job

---

## Container Startup (docker-entrypoint.sh)

Every time a pod starts — on deploy, crash-restart, or scale-up — this runs:

```sh
# 1. Append DB connection pool settings if not already set
DATABASE_URL="${DATABASE_URL}?connection_limit=20&pool_timeout=30"

# 2. Apply any pending migrations
npx prisma migrate deploy

# 3. Seed (idempotent — uses upsert everywhere, safe to run repeatedly)
npx prisma db seed

# 4. Start the app
exec node dist/main.js
```

**Why this is safe:** All seed operations use `upsert` or `findFirst → create` patterns, so re-running never duplicates data. Migrations use `migrate deploy` (not `migrate dev`) — applies only pending migrations, no interactive prompts.

---

## How to Deploy

### Normal deploy (staging)
```bash
# From inside the sub-repo you changed (admin, backend, or webclient)
git add <files>
git commit -m "feat: your change"
git push origin staging   # CI kicks off automatically
```

### Watch the deploy live
```bash
# List recent runs
gh run list --repo web-masters-ke/ecitizen-support-backend --limit 5
gh run list --repo web-masters-ke/ecitizen-support-admin --limit 5
gh run list --repo web-masters-ke/ecitizen-support-webclient --limit 5

# Watch a specific run to completion
gh run watch <RUN_ID> --repo web-masters-ke/ecitizen-support-backend
```

### Force re-deploy without a code change
```bash
# Trigger manually from GitHub Actions UI or via CLI
gh workflow run ci-staging.yml --repo web-masters-ke/ecitizen-support-backend
```

---

## Image Registry

Images live in GitHub Container Registry (GHCR):

```
ghcr.io/web-masters-ke/ecitizen-support-backend:{version-tag}
ghcr.io/web-masters-ke/ecitizen-support-admin:{version-tag}
ghcr.io/web-masters-ke/ecitizen-support-webclient:{version-tag}
```

To pull any image locally:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u benjaminkakai001 --password-stdin
docker pull ghcr.io/web-masters-ke/ecitizen-support-backend:latest-staging
```

---

## Helm Chart Structure

```
Ventures-Helm-Charts (repo, staging branch)
└── charts/
    └── ecitizen-support-service/
        └── values.yaml          ← CI patches image tags here
```

Each service's image tag lives under its own key:
```yaml
backend:
  image:
    tag: staging-202604241051-ee1ff2d   # ← backend CI patches this

admin:
  image:
    tag: staging-202604241038-05c1f6d   # ← admin CI patches this

webclient:
  image:
    tag: staging-202604240920-abc1234   # ← webclient CI patches this
```

ArgoCD watches this file. When any tag changes, it automatically diffs the cluster state and rolls out only the changed service — the other two keep running untouched.

---

## ArgoCD

- **Dashboard**: `https://argocd.wasaahost.com`
- **App name**: `ecitizen-support-service`
- **Sync policy**: Automated (git-poll) + CI-triggered explicit sync
- **Prune enabled**: Resources removed from Helm are cleaned up from the cluster

If ArgoCD gets stuck, you can force-sync manually from the dashboard or:
```bash
curl -X POST https://argocd.wasaahost.com/api/v1/applications/ecitizen-support-service/sync \
  -H "Authorization: Bearer $ARGOCD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prune":true,"dryRun":false,"force":true}'
```

---

## Production Deploy (main branch)

There is a separate `deploy.yml` workflow that triggers when a PR is **merged to main**. It uses AWS SSM to:
1. `git clone` the repo to `/opt/ecitizen-support-{service}-new` on the EC2 instance
2. Copy `.env` from the current deployment
3. Swap directories (old → `-old`, new → live)
4. `docker compose build --no-cache && docker compose up -d`
5. Wait 45s, then health-check `http://localhost:4010/api/v1/health/live`

> **Staging → Production flow:** develop on `staging` branch → test on staging URLs → open a PR to `main` → merge triggers production deploy via SSM.

---

## Secrets Required

| Secret | Where used |
|--------|-----------|
| `GITHUB_TOKEN` | Auto-provided — GHCR push auth |
| `ARC_GITHUB_PAT` | PAT with `repo` scope — allows CI to push to Ventures-Helm-Charts |
| `ARGOCD_TOKEN` | ArgoCD API token — triggers explicit sync |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Production SSM deploy only |
| `EC2_INSTANCE_ID` | Production SSM deploy only |

---

## Timing Reference

From `git push` to pod live on staging:

| Step | Typical duration |
|------|-----------------|
| Build & Test | 3–5 min |
| Security Scan | 2–4 min |
| Build & Push Docker image | 4–8 min (layer cache helps) |
| Update Helm + commit | 1–2 min |
| ArgoCD sync + pod rollout | 1–3 min |
| **Total** | **~12–20 min** |

---

## Troubleshooting

**Build failing on `npm ci`** — check for `package-lock.json` drift; run `npm install` locally and commit the updated lockfile.

**Docker build fails** — usually a missing env var baked into the image or a TypeScript compile error. Check the `Build and push` step logs.

**Helm update step fails** — `ARC_GITHUB_PAT` expired or revoked. Renew and update the secret in GitHub repo settings.

**ArgoCD sync step skipped** — `ARGOCD_TOKEN` not set. ArgoCD will still self-sync from git polling within ~3 minutes. No action needed unless you need immediate rollout.

**Pod crashlooping** — check pod logs via kubectl or the ArgoCD dashboard. Most common causes:
- `DATABASE_URL` env var missing or wrong
- Migration failed (check `prisma migrate deploy` output in pod logs)
- App port mismatch (backend must bind to `0.0.0.0:4010`)

**Seed fails on startup** — non-fatal. The entrypoint catches seed errors and continues. The app still starts. Check if it's a constraint violation from a schema change — you may need a new migration.
