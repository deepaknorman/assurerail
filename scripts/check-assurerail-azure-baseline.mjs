#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(
  root,
  "deploy/azure/assurerail/security-baseline.json",
);
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const failures = [];

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

requireValue(baseline.status === "TARGET_NOT_DEPLOYED", "baseline must not imply an existing deployment");
requireValue(baseline.approvedOn === null, "approval remains empty until an accountable owner signs it");
requireValue(baseline.geography === "India", "data geography must be India");
requireValue(baseline.regions.primary.azureName === "indiasouthcentral", "primary region must be India South Central (Hyderabad)");
requireValue(baseline.regions.recovery.azureName === "centralindia", "recovery region must be Central India (Pune)");
requireValue(baseline.regions.symmetricManagedRegionPairAssumed === false, "Pune and Hyderabad must not be described as a symmetric managed region pair");
requireValue(baseline.regions.dataPlaneRestrictedToIndia === true, "data plane must remain in India");
requireValue(baseline.network.internetIngress === "AZURE_FRONT_DOOR_PREMIUM_WAF_ONLY", "internet ingress must terminate at Front Door Premium/WAF");
requireValue(baseline.network.wafModeForControlledLive === "PREVENTION", "controlled-live WAF mode must be prevention");
requireValue(Number(baseline.network.minimumTls) >= 1.2, "minimum TLS must be 1.2 or higher");
requireValue(baseline.network.originPublicIngressAllowed === false, "public origin ingress must be denied");
for (const resource of ["POSTGRESQL", "KEY_VAULT", "OBJECT_STORAGE", "CONTAINER_REGISTRY"]) {
  requireValue(baseline.network.privateEndpointsRequired.includes(resource), `${resource} must require a private endpoint`);
}
requireValue(baseline.network.egressDefault === "DENY", "egress must default deny");
requireValue(baseline.identity.workloadIdentity === "MANAGED_IDENTITY", "workloads must use managed identity");
requireValue(baseline.identity.phishingResistantMfaForPrivilegedUsers === true, "privileged users require phishing-resistant MFA");
requireValue(baseline.identity.privilegedIdentityManagementRequired === true, "PIM must be required");
requireValue(baseline.identity.sharedAccountsAllowed === false, "shared accounts must be prohibited");
requireValue(baseline.secrets.store === "AZURE_KEY_VAULT", "Key Vault must be the secret store");
requireValue(baseline.secrets.publicNetworkAccessAllowed === false, "Key Vault public access must be denied");
requireValue(baseline.secrets.purgeProtectionRequired === true, "Key Vault purge protection must be enabled");
requireValue(baseline.secrets.applicationSecretsInEnvironmentFilesAllowed === false, "controlled environments must not keep secrets in env files");
requireValue(baseline.data.databasePublicNetworkAccessAllowed === false, "PostgreSQL public access must be denied");
requireValue(baseline.data.entraAuthenticationRequired === true, "PostgreSQL must support Entra authentication");
requireValue(baseline.data.zoneRedundantHighAvailabilityRequired === true, "zone-redundant HA must be required");
requireValue(baseline.data.backupRestoreTestRequired === true, "backup restoration must be tested");
requireValue(baseline.platform.productionAndNonProductionSubscriptionsSeparated === true, "production and non-production subscriptions must be separated");
requireValue(baseline.platform.assureRailAndAssureLockerRuntimeIdentitiesSeparated === true, "Rail and Locker runtime identities must be separated");
requireValue(baseline.platform.productionChangesRequireTwoPeople === true, "production changes must require two people");
requireValue(baseline.platform.demoModesProhibitedInControlledEnvironments === true, "demo mode must be prohibited in controlled environments");
requireValue(baseline.logging.securityRetentionDaysMinimum >= 365, "security logs must be retained at least 365 days");
requireValue(baseline.logging.applicationLogsMayContainSecrets === false, "logs must not contain secrets");
requireValue(baseline.logging.applicationLogsMayContainRawEvidence === false, "logs must not contain raw evidence");
requireValue(baseline.resilience.providerReconciliationAfterRecoveryRequired === true, "recovery must reconcile to external authorities");
requireValue(baseline.securityTesting.independentVaptRequiredBeforeControlledLive === true, "independent VAPT must gate controlled-live");
requireValue(baseline.securityTesting.vaptRetestRequiredForMaterialFindings === true, "material VAPT findings must be independently retested");
requireValue(baseline.futureTokenNetwork.inCurrentTopology === false, "future token nodes must stay outside the current topology");
requireValue(baseline.futureTokenNetwork.azureHostingRequired === false, "future token nodes must remain cloud-provider neutral");
requireValue(baseline.futureTokenNetwork.requiresSeparateThreatModelAndApproval === true, "future token nodes require a separate threat model and approval");

if (failures.length) {
  console.error("AssureRail Azure SEC-01 baseline FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("AssureRail Azure SEC-01 baseline PASS — target only, not deployment evidence.");
