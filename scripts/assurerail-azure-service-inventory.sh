#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || "$1" != /* ]]; then
  echo "usage: ARAIL_AZURE_SUBSCRIPTION_ID=<id> $0 /absolute/output/directory" >&2
  exit 2
fi

: "${ARAIL_AZURE_SUBSCRIPTION_ID:?ARAIL_AZURE_SUBSCRIPTION_ID is required}"
command -v az >/dev/null || { echo "Azure CLI (az) is required" >&2; exit 2; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

output_dir="$1"
umask 077
mkdir -p "$output_dir"

az account show --subscription "$ARAIL_AZURE_SUBSCRIPTION_ID" \
  --query '{subscriptionId:id,tenantId:tenantId,name:name,state:state}' --output json \
  > "$output_dir/subscription.json"
az account list-locations --subscription "$ARAIL_AZURE_SUBSCRIPTION_ID" \
  --query "[?name=='indiasouthcentral' || name=='centralindia'].{name:name,displayName:displayName,regionalDisplayName:regionalDisplayName,metadata:metadata}" \
  --output json > "$output_dir/target-regions.json"

providers=(
  Microsoft.Cdn
  Microsoft.ContainerRegistry
  Microsoft.DBforPostgreSQL
  Microsoft.Insights
  Microsoft.KeyVault
  Microsoft.Network
  Microsoft.OperationalInsights
  Microsoft.Storage
)

for provider in "${providers[@]}"; do
  safe_name="${provider//./-}"
  az provider show --subscription "$ARAIL_AZURE_SUBSCRIPTION_ID" --namespace "$provider" \
    --query '{namespace:namespace,registrationState:registrationState,resourceTypes:resourceTypes[].{resourceType:resourceType,locations:locations,zoneMappings:zoneMappings}}' \
    --output json > "$output_dir/${safe_name}.json"
done

jq -e 'length == 2 and any(.[]; .name == "indiasouthcentral") and any(.[]; .name == "centralindia")' \
  "$output_dir/target-regions.json" >/dev/null || {
    echo "The subscription did not return both target regions; keep SEC-01 availability OPEN." >&2
    exit 1
  }

echo "Read-only Azure inventory captured in $output_dir"
echo "This is availability metadata only; it is not provisioning or security-closure evidence."
