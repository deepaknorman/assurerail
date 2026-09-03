# AssureRail replay/shadow security and integration brief

## Start with the lowest data and integration burden

Replay begins file-in/workbook-and-dossier-out after an approved NDA/data map and secure channel.
Shadow adds only the minimum approved feeds needed to compare the incumbent process. API integration
is a later carrier over the same versioned contracts, not a prerequisite for discovery.

## Control boundary

- Separate AssureRail runtime, database, identities, secrets and provider credentials.
- Institution, membership, mandate, appointment and route entitlement are independently scoped.
- Internal personnel have no default customer transaction authority.
- Evidence records source, version, digest, as-of, expiry, qualification and access policy.
- External instructions require idempotency, authenticated acknowledgement and reconciliation.
- Customer and provider exit/export remain design and acceptance requirements.

## Hosting target and current truth

The selected target is Azure India with Hyderabad primary and Pune recovery. Service-by-service
availability, infrastructure policy, private networking, logging, backup/restore and regional
recovery remain to be configured and evidenced. The two locations are not presented as a symmetric
automatic managed pair.

SEC-01 has remediated the production dependency tree to zero critical/high findings and supplied the
Azure threat model plus authenticated E2E/DAST harness. The staged authenticated runs and independent
external VAPT/retest are still open. No prospect should receive a statement that VAPT, Azure
resilience or production security is complete.

## First security review pack

Provide the exact architecture/data-flow diagram, data inventory, role/authority matrix, retention
plan, dependency/SAST/secret-scan evidence, incident contacts, open-risk register and proposed test
scope. Do not provide production secrets, unrestricted cloud access or another customer's evidence.

## Integration progression

1. replay: bounded manual/file intake and export;
2. shadow: allow-listed read-only connectors or signed submissions;
3. partner-executed pilot: provider UAT plus authenticated acknowledgement/reconciliation; and
4. controlled activation: exact build, environment, route, function and cohort only.

Token-network nodes are outside the current Azure application topology and require a separate threat
model, hosting and key/governance decision.
