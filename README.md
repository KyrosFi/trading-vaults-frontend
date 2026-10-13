# Kyros Trading Vault

A web dashboard for Kyros trading vaults on Solana. Each vault is an on-chain
program where depositors subscribe capital in exchange for share tokens, and an
operator deploys that capital to run a trading strategy. The app lets anyone
view a vault's state and strategy, and lets authorized wallets interact with it
according to their role.

One codebase builds two React single-page apps, each served by its own
Cloudflare Worker:

| App | URL | Who it's for | Worker config |
|-----|-----|--------------|---------------|
| Public | `vaults.kyros.fi` | Everyone; deposit/withdraw for allowlisted depositors | `wrangler.toml` |
| Backoffice | `backoffice.kyros.fi` | Operators, admins, vault creator, protocol admin — behind Cloudflare Access | `wrangler.backoffice.toml` |

Each Worker also exposes a small `/api` for off-chain data (strategy notes and
a per-wallet depositor check) backed by the same Cloudflare KV namespace; only
the backoffice accepts strategy-note writes. All value-moving actions are
on-chain Solana transactions signed by the connected wallet.

## What you can see

Anyone (no wallet required) can browse the vault list and open a vault to see:

- **Vault state** — deposit asset, share token, AUM (local vs. deployed),
  withdrawal fee, paused status, and the admin/operator authorities.
- **Strategy** — a human-readable overview, trading conditions, and take-profit
  levels, plus subscription progress against the vault's maximum size.

Action controls only appear for wallets that hold a role. A connected wallet
with no role sees a "no actions for this vault" note. The public app only has
the depositor panel; every other role's tooling is in the backoffice.

## Roles and what they can do

### Depositors (Users)

Depositors are wallets on a global allowlist (stored in KV). When a whitelisted
depositor connects and opens a vault, a **Deposit & withdraw** panel appears:

- **Deposit** — supply the vault's deposit asset and receive newly minted share
  tokens representing the position.
- **Withdraw** — redeem share tokens to get assets back. The configured
  withdrawal fee is sent to the vault's fee recipient; the rest goes to the
  depositor.

Depositors cannot move vault capital, change AUM, or alter any vault settings.

### Operators

The operator is the single on-chain operator wallet for a vault. When connected,
an **Operator actions** panel appears:

- **Deposit / Withdraw** — move capital between the vault and the operator's
  trading accounts (operator deposit / operator withdraw).
- **Update AUM** — report the vault's deployed assets-under-management. The
  program enforces a small per-update drift constraint.
- **Edit strategy** — create or update the off-chain strategy notes shown on the
  vault page (signed request, authorized via the operator allowlist).

### Admins

The admin is the on-chain admin wallet for a vault — vault governance:

- Set the operator, fee recipient, and withdrawal fee.
- Pause / unpause the vault.
- Nominate a new admin and accept an admin nomination (two-step transfer).
- Create the share token's on-chain metadata.

## Access model

| What | Who | Where it's defined |
|------|-----|--------------------|
| View vault & strategy | Everyone | Public |
| Deposit / withdraw (mint / redeem shares) | Depositor allowlist | KV key `depositors` |
| Open the backoffice | Emails on the Access policy | Cloudflare Zero Trust Access app for `backoffice.kyros.fi`; the Worker re-verifies the Access token on every request (see Deployment) |
| Operator capital moves & AUM | On-chain `operator` | On-chain vault state |
| Edit strategy notes | Operator allowlist (backoffice only) | `OPERATOR_WHITELIST` on the backoffice Worker |
| Vault governance | On-chain `admin` | On-chain vault state |

On-chain actions (deposit, redeem, operator moves, admin settings) are enforced
by the Solana program regardless of the UI. Cloudflare Access, the depositor
allowlist and `OPERATOR_WHITELIST` only control what the apps surface and the
off-chain strategy API — they are not a substitute for on-chain authorization.

## Tech stack

- **React 19 + Vite** SPA, Tailwind CSS. Entries: `src/main.tsx` (public) and
  `src/backoffice/main.tsx` (backoffice, selected with `KYROS_APP=backoffice`;
  see `vite.config.ts`). Pages only the backoffice serves live in
  `src/backoffice/`.
- **Cloudflare Workers** (`worker/public.ts`, `worker/backoffice.ts`, sharing
  `worker/handler.ts`) serving the SPA assets and `/api`:
  `GET /api/depositors/:wallet` → `{ "depositor": boolean }` (`400` for a
  malformed wallet), `GET /api/vaults/:vaultState/strat`, and `PUT`/`DELETE` on
  the same path (backoffice only, wallet-signed). Any other `/api/*` path
  answers `404` JSON.
- **Cloudflare KV** (`VAULTS_GENERAL`) for strategy notes and the depositor
  allowlist. The allowlist is never served: the Worker only says whether one
  wallet is on it.
- **Solana** via `@solana/kit` and `@solana/react-hooks`; instruction clients are
  generated with Codama into `src/lib/solana/generated`.
- RPC via Helius. Supports `mainnet` and `devnet` (toggle in the header).

## Getting started

```bash
npm install
npm run dev                  # public app: Vite + local Worker
npm run dev:backoffice       # backoffice (no Access locally)
npm run preview              # build the public app, then serve the build
npm run preview:backoffice   # build the backoffice, then serve the build
```

`KYROS_APP` (`public`, the default, or `backoffice`) picks which app Vite builds
or serves: `dev:backoffice` and `preview:backoffice` set it to `backoffice`, and
so does the backoffice half of `npm run build`. The public scripts (`dev`,
`preview` and the public half of `build`) set `KYROS_APP=public` themselves, so a
value exported in your shell can't change what they build. It is an environment
variable, not a Vite mode, so `.env.production` and `.env.development*` apply to
both apps. `vite preview` serves whichever app was built last, which is why each
preview script builds its app first. Run one dev server at a time: both use
Vite's dependency cache (`node_modules/.vite`) and each re-optimizes it for its
own app when it starts.

Create `.env.local` with the build-time RPC key:

```
VITE_HELIUS_API_KEY=your-helius-key
```

Create `.dev.vars` with the operator allowlist used by the local Worker:

```
OPERATOR_WHITELIST="Wallet1,Wallet2"   # comma-separated base58 wallets
```

Useful scripts: `npm run build` (both apps), `npm run typecheck`,
`npm run lint`, `npm run deploy` (both Workers), `npm run gen` (regenerate
Solana clients).

## Regenerating the Solana client (after any IDL change)

The instruction/account/PDA clients in `src/lib/solana/generated/` are generated
from `src/idl/kyros_vault.json` by Codama. **Any time the IDL changes — a program
redeploy at a new address, added/removed accounts, changed args or errors — you
must regenerate**, or the frontend builds transactions against a stale interface
(a common symptom is a simulation failure with an Anchor `AccountDiscriminatorMismatch`,
custom program error `#3002`):

```bash
npm run gen   # node codama.config.mjs — deletes and rewrites src/lib/solana/generated/
npm run typecheck
```

Two things to check after regenerating:

- **Call sites may break.** If an instruction gained a required account, its input
  type changes. When that account is a PDA (e.g. `config`), only the `*Async`
  builder auto-derives it — prefer `get<Ix>InstructionAsync` over the sync
  `get<Ix>Instruction` so you don't have to pass it by hand.
- **A program-address change shifts every PDA.** Update any hardcoded expected
  PDAs in tests (e.g. the canonical config PDA in `src/lib/solana/pdas.test.ts`).

## Managing the allowlists

**Depositors** — global KV list, one JSON array of base58 wallets:

```bash
# production
npx wrangler kv key put --binding VAULTS_GENERAL --remote \
  "depositors" '["Wallet1","Wallet2"]'

# local dev (use --local)
npx wrangler kv key get --binding VAULTS_GENERAL --local "depositors"
```

The same list applies to every vault. To add or remove a depositor, rewrite the
whole array (read-modify-write).

The Worker never serves the list. The apps call `GET /api/depositors/:wallet`,
which answers `{ "depositor": true }` or `{ "depositor": false }` for that one
wallet (`400` if it isn't a base58 address). Anyone can still test a wallet they
already know, but the API can't be used to download the allowlist.

**Operators (strategy editing)** — set the `OPERATOR_WHITELIST` env var
(comma-separated base58 wallets). Locally via `.dev.vars`; in production as a
**secret** on the **backoffice** Worker
(`npx wrangler secret put OPERATOR_WHITELIST --name vaults-backoffice`). Don't
use a plain dashboard variable: deploys remove plain variables that aren't in
`wrangler.backoffice.toml`.

**Backoffice users** — add or remove their email on the Access application's
policy in Cloudflare Zero Trust (see Deployment).

## Environment variables

| Name | Kind | Purpose |
|------|------|---------|
| `VITE_HELIUS_API_KEY` | Build-time (Vite) | Helius RPC key; baked into the client bundle, so it must be present when the app is **built** (locally or in CI). |
| `OPERATOR_WHITELIST` | Runtime secret (backoffice Worker) | Comma-separated base58 wallets allowed to edit strategy notes. |
| `ACCESS_TEAM_DOMAIN` | Runtime (backoffice Worker, in `wrangler.backoffice.toml`) | Cloudflare Access team domain (`<team>.cloudflareaccess.com`) whose keys the Worker verifies Access tokens against. A public identifier. |
| `ACCESS_AUD` | Runtime (backoffice Worker, in `wrangler.backoffice.toml`) | AUD tag of the Access application protecting `backoffice.kyros.fi`. A public identifier; it changes if the application is recreated. |

## Deployment

Both apps always ship together, from one build:

- `npm run build` builds the backoffice (`dist/backoffice/`), then the public
  app (`dist/`). The public build fails if its module graph contains any
  `src/backoffice/` module or a builder for any program instruction other than
  `deposit` and `redeem` (`scripts/publicBundleGuard.ts`). ESLint also keeps
  shared code from importing `src/backoffice/` (`npm run lint`).
- `npm run deploy:prebuilt` deploys the backoffice Worker, then the public one,
  so a failed backoffice deploy leaves the public app untouched.
  Inside the Workers Build connected to `vaults-frontend`, Cloudflare sets
  `WRANGLER_CI_OVERRIDE_NAME` / `WRANGLER_CI_MATCH_TAG`, which would rename the
  backoffice deploy to `vaults-frontend`. The script unsets both for the
  backoffice step only, so it really deploys `vaults-backoffice`; the public step
  keeps Cloudflare's name check.
- `npm run deploy` does both steps.

The git-connected Cloudflare build is configured on the `vaults-frontend` Worker
only (build command `npm run build`, deploy command `npm run deploy:prebuilt`);
`vaults-backoffice` has no build of its own. `VITE_HELIUS_API_KEY` (and the
optional `VITE_WALLETCONNECT_PROJECT_ID`) go in that build's environment
variables: Vite bakes them into both apps' browser code, so restrict the key's
allowed origins on Helius to `https://vaults.kyros.fi`,
`https://backoffice.kyros.fi` and the `*-vaults-frontend.kyrosfi.workers.dev`
preview URLs, or use a separate key for previews and local dev. If the
WalletConnect (Reown) project has an allowed-domains list, add
`https://backoffice.kyros.fi` to it. Set `OPERATOR_WHITELIST` as a **runtime**
secret on `vaults-backoffice`, then seed the `depositors` KV key as shown above.

**Backoffice access gate.** `backoffice.kyros.fi` must sit behind a Cloudflare
Access application **before** the backoffice Worker's first deploy (the deploy
attaches the custom domain):

1. Zero Trust → Integrations → Identity providers → add **One-time PIN**.
2. Zero Trust → Access controls → Applications → Create new application →
   Self-hosted → public hostname `backoffice.kyros.fi`; policy **Allow**, include
   **Emails** (the operators' addresses); login method One-time PIN only.

`wrangler.backoffice.toml` keeps `workers_dev` and `preview_urls` off: those
URLs would reach the Worker without passing through Access.

**Previews of the public Worker.** `vaults-frontend` keeps its preview URLs, and
they must be protected with Cloudflare Access too (Worker → Domains → Preview →
Enable Access, with the same operator email policy), because versions built
before the split still contain the old operator console.

**Never roll back past the split.** Rolling `vaults-frontend` back (dashboard
Rollback, or `wrangler rollback`) to a version from before the split brings back
two things on `vaults.kyros.fi`: `GET /api/depositors`, which serves the whole
depositor allowlist (the KV namespace is shared, so the live list), and the old
operator console with no Access in front of it. To undo a bad change, revert it
and deploy forward instead. Likewise don't roll `vaults-backoffice` back to a
version older than commit `ba75a7c`, which added the Worker's own Access token
check: before it, the Access application was the only gate.

**Token check in the Worker.** The backoffice Worker doesn't just trust that
Access sits in front of it: on every request (pages, static assets and `/api`)
it verifies the `Cf-Access-Jwt-Assertion` token Access attaches (RS256
signature against the team's published keys, audience, issuer, expiry) and
answers `403` otherwise, so a request that reaches the Worker around Access (a
stray route, a preview URL, an Access application that was removed or detached)
is refused. Who may log in is still decided by the Access policy, not by the
Worker. This relies on `run_worker_first = true`
(so static assets go through the Worker too) and on `ACCESS_TEAM_DOMAIN` /
`ACCESS_AUD` in `wrangler.backoffice.toml`; both are public identifiers, not
secrets. The check is skipped on localhost, so `npm run dev:backoffice` and
`npm run preview:backoffice` need no token. **If the Access application is
recreated, update both values** (the AUD tag changes with the application)
before redeploying, or every request gets `403`.
