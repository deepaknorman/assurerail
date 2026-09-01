#!/usr/bin/env bash
# PR-15 disposable Postgres structural rehearsal. Synthetic rows never close external live gates.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr15.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65500 + ($$ % 30)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr15_fresh"
RESTORE_DB="assurerail_pr15_restore"

case "$TEST_ROOT" in */assurerail-pr15.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore node npm npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr15.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR15-DB] compile and fresh migration deploy"
(cd "$RAIL_DIR"; npm run build >/dev/null)
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
model_count="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='TokenConnectorBinding';")"
[[ "$model_count" == "1" ]] || { echo "expected PR-15 binding model" >&2; exit 1; }

echo "[PR15-DB] reuse PR-11 mirror fixture then bind certified connector and external evidence references"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" node dist/token-representation/token-representation-db-rehearsal.js)
psql_db "$FRESH_DB" -c '
  INSERT INTO "CaseFunctionAssignment" ("id","transactionCaseId","materialFunction","performer","performerInstitutionId","authorityEvidenceRef","status","effectiveAt","expiresAt","createdByUserId","createdAt","updatedAt") VALUES
    ($$pr15_custody_function$$,$$pr11_case$$,$$CUSTODY$$,$$PARTICIPANT_OWNED$$,$$pr11_institution$$,$$synthetic://custody-authority$$,$$ACTIVE$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$1 day$$,$$pr11_user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "ConnectorRegistration" ("id","institutionId","providerReferenceId","connectorKey","connectorType","displayName","transport","endpoint","schemaProfiles","credentialVaultRef","status","createdByUserId","createdAt","updatedAt") VALUES
    ($$pr15_connector$$,$$pr11_institution$$,$$pr11_provider$$,$$token-live-fixture$$,$$TOKEN_NETWORK$$,$$Synthetic connector$$,$$API$$,$$https://connector.example.invalid/instructions$$,$$["assurerail.token-instruction.v1"]$$::jsonb,$$vault-kv-v2://secret/assurerail/connectors/pr15#hmacSecret$$,$$CERTIFIED_LIVE$$,$$pr11_user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "ConnectorCertification" ("id","connectorRegistrationId","profileRef","schemaId","schemaVersion","operatingMode","status","conformanceEvidenceDigest","conformanceResult","qualifications","reason","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","effectiveAt","expiresAt","createdAt","updatedAt") VALUES
    ($$pr15_certification$$,$$pr15_connector$$,$$assurerail://connector-profiles/token-da/v1$$,$$assurerail.token-instruction$$,$$1.0.0$$,$$CONTROLLED_LIVE$$,$$APPROVED$$,$$sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$$,$${"synthetic":true,"externalEvidence":false}$$::jsonb,$$["STRUCTURAL_ONLY"]$$::jsonb,$$Synthetic schema rehearsal only$$,$$pr11_user$$,$$step-propose$$,$$pr15-reviewer$$,$$step-review$$,$$Structural acceptance only$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$1 day$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "TokenConnectorBinding" ("id","tokenRepresentationId","version","connectorRegistrationId","connectorCertificationId","connectorProfileRef","custodyInstitutionId","custodyModel","signingKeyReference","signingPolicyDigest","supportedActionTypes","custodyEvidenceObjectId","custodyEvidenceDigest","legalFinalityEvidenceObjectId","legalFinalityEvidenceDigest","operatingAcceptanceEvidenceObjectId","operatingAcceptanceEvidenceDigest","status","proposalDigest","proposedByUserId","proposedByMandateId","proposalStepUpId","reviewedByUserId","reviewedByMandateId","reviewStepUpId","reviewReason","reviewedAt","effectiveAt","expiresAt","createdAt","updatedAt")
    SELECT $$pr15_binding$$,"id",1,$$pr15_connector$$,$$pr15_certification$$,$$assurerail://connector-profiles/token-da/v1$$,$$pr11_institution$$,$$INSTITUTION_CONTROLLED$$,$$hsm://synthetic/key/1$$,$$sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$$,$$["TRANSFER"]$$::jsonb,$$pr11_declaration_evidence$$,$$sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc$$,$$pr11_declaration_evidence$$,$$sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd$$,$$pr11_declaration_evidence$$,$$sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$$,$$ACTIVE$$,$$sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff$$,$$pr11_user$$,$$pr11_mandate$$,$$step-binding-propose$$,$$pr15-reviewer$$,$$pr15-reviewer-mandate$$,$$step-binding-review$$,$$Synthetic structural review only$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$1 day$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    FROM "TokenRepresentation" WHERE "transactionCaseId"=$$pr11_case$$;
  UPDATE "TokenAction" SET "connectorBindingId"=$$pr15_binding$$ WHERE "tokenRepresentationId"=(SELECT "id" FROM "TokenRepresentation" WHERE "transactionCaseId"=$$pr11_case$$);
  DO $rehearsal$ BEGIN
    BEGIN DELETE FROM "TokenConnectorBinding" WHERE id=$$pr15_binding$$; RAISE EXCEPTION $$binding with action unexpectedly deleted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN INSERT INTO "TokenConnectorBinding" SELECT * FROM "TokenConnectorBinding" WHERE id=$$pr15_binding$$; RAISE EXCEPTION $$duplicate binding unexpectedly accepted$$; EXCEPTION WHEN unique_violation THEN NULL; END;
  END $rehearsal$;' >/dev/null

echo "[PR15-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *TokenConnectorBinding*|*connectorBindingId*) echo "PR-15 schema drift detected:" >&2; echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "TokenConnectorBinding") || $$|$$ || (SELECT count(*) FROM "TokenAction" WHERE "connectorBindingId" IS NOT NULL);')"
[[ "$restored" == "1|1" ]] || { echo "restore count mismatch: $restored" >&2; exit 1; }
echo "[PR15-DB] PASS binding=1 restrictive-action-history=verified schema-parity=verified restore=1|1 live-dispatch=not-executed external-evidence=open"
