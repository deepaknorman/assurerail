---
title: AssureRail DA commercial policy source and repository boundary
type: decision
date: 2026-09-16
author: coder
status: active
tags: [assurerail, pricing, coordination, repository]
---

# AssureRail DA commercial policy source and repository boundary

The standalone AssureRail repository is the Phase 1 product release target. Its machine-readable pricing and operating source is `config/assurerail-da-commercial-policy.json`, currently policy version `DA-2026-09-16-PILOT-1`. Generated API and web snapshots must pass `npm run policy:check`.

The company monorepo still contains the commercial-pack generator and historical AssureRail models. Treat its current pricing inputs as stale unless they declare the same policy version. Do not patch both public applications independently. Port or regenerate deliberate artifacts into the standalone product and identify their audience in the AssureRail download manifest.

The old 50/40/35/30 bps execution schedule, ₹5L/₹6.5L fixed-stage minima, 20% blanket channel share, and human-reviewed Initial Assessment claims are retired for new pilot quotes. Accepted historical quotes retain their own versioned terms.

Related: [[assurerail-cohort-planning-budgets]]
