# AssureRail

Private standalone source repository for AssureRail's provider-neutral DA and PTC transaction
infrastructure.

## Ownership and status

Before AssureRail is incorporated, this repository is controlled by Deepak Norman and forms part of
the Founder IP Register, subject to the contributor and third-party rights recorded there. On
incorporation, the approved signed baseline is intended to be assigned directly by Deepak Norman to
AssureRail. AssureLocker is not a repository owner, transferor or source-code dependency.

Code presence does not mean that a regulated function, controlled-live route or production route is
authorised or available. Capability flags and external-evidence gates remain fail-closed.

## Workspaces

- `apps/assurerail`: Next.js web application on port 3007.
- `apps/assurerail-api`: NestJS API and its independent Prisma/PostgreSQL schema on port 3006.

## Local verification

Use Node.js 22 and npm 10.

```bash
npm ci
npm run build
npm test
npm run check
```

The Docker demonstration stack defaults to `ASSURERAIL_OPERATING_MODE=DEMO`; all product and
controlled-environment capability flags remain off unless expressly configured. Never infer live or
production readiness from a successful local build.

See `docs/design/AssureRail_Standalone_Repository_Separation_Plan.md` for the extraction and
incorporation cutover controls.
