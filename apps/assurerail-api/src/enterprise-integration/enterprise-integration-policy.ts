export const ENTERPRISE_CONNECTOR_CLASSES = [
  "LENDER_REGISTRY",
  "TRUSTEE",
  "RTA_DEPOSITORY_REGISTER",
  "PAYMENT",
  "E_SIGNATURE",
  "E_STAMPING",
  "RATING_AGENCY",
  "SERVICER",
  "FINANCE_TAX",
  "CRM",
  "NOTIFICATION",
] as const;
export type EnterpriseConnectorClass =
  (typeof ENTERPRISE_CONNECTOR_CLASSES)[number];

export type EnterpriseGateDefinition = Readonly<{
  code: string;
  kind: "SOFTWARE_CONFORMANCE" | "EXTERNAL_EVIDENCE";
  accountableParty: string;
}>;

const COMMON_EXTERNAL: readonly EnterpriseGateDefinition[] = [
  {
    code: "SECURITY_REVIEW",
    kind: "EXTERNAL_EVIDENCE",
    accountableParty: "ASSURERAIL_SECURITY_AND_CUSTOMER",
  },
  {
    code: "PROVIDER_UAT",
    kind: "EXTERNAL_EVIDENCE",
    accountableParty: "PROVIDER",
  },
  {
    code: "CUSTOMER_UAT",
    kind: "EXTERNAL_EVIDENCE",
    accountableParty: "CUSTOMER",
  },
  {
    code: "DATA_PROTECTION_ACCEPTANCE",
    kind: "EXTERNAL_EVIDENCE",
    accountableParty: "CUSTOMER_AND_ASSURERAIL",
  },
  {
    code: "OPERATING_ACCEPTANCE",
    kind: "EXTERNAL_EVIDENCE",
    accountableParty: "ASSIGNED_OPERATIONS_OWNERS",
  },
  {
    code: "EXIT_REHEARSAL",
    kind: "EXTERNAL_EVIDENCE",
    accountableParty: "CUSTOMER_AND_ASSURERAIL",
  },
];

const CLASS_GATES: Readonly<
  Record<EnterpriseConnectorClass, readonly EnterpriseGateDefinition[]>
> = {
  LENDER_REGISTRY: [
    {
      code: "SOURCE_AUTHORITY_ACCEPTANCE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "LENDER",
    },
    {
      code: "DATA_QUALITY_AND_LINEAGE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "LENDER_AND_ASSURERAIL",
    },
  ],
  TRUSTEE: [
    {
      code: "LEGAL_ROUTE_ACCEPTANCE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "COUNSEL_AND_TRUSTEE",
    },
    {
      code: "TRUSTEE_AUTHORITY_ACKNOWLEDGEMENT",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "TRUSTEE",
    },
  ],
  RTA_DEPOSITORY_REGISTER: [
    {
      code: "LEGAL_ROUTE_ACCEPTANCE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "COUNSEL_AND_RECORDKEEPER",
    },
    {
      code: "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "TRUSTEE_AND_RECORDKEEPER",
    },
  ],
  PAYMENT: [
    {
      code: "PAYMENT_FINALITY_AND_REVERSAL",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "PAYMENT_PROVIDER_AND_COUNSEL",
    },
    {
      code: "CASH_RECONCILIATION_REHEARSAL",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "FINANCE_AND_OPERATIONS",
    },
  ],
  E_SIGNATURE: [
    {
      code: "LEGAL_VALIDITY_ACCEPTANCE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "COUNSEL_AND_CUSTOMER",
    },
  ],
  E_STAMPING: [
    {
      code: "LEGAL_VALIDITY_ACCEPTANCE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "COUNSEL_AND_CUSTOMER",
    },
  ],
  RATING_AGENCY: [
    {
      code: "DATA_QUALITY_AND_TIMELINESS",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "RATING_AGENCY_AND_TRUSTEE",
    },
  ],
  SERVICER: [
    {
      code: "LIFECYCLE_DATA_RECONCILIATION",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "SERVICER_AND_TRUSTEE",
    },
  ],
  FINANCE_TAX: [
    {
      code: "ACCOUNTING_AND_TAX_SIGNOFF",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "FINANCE_AND_TAX_OWNER",
    },
  ],
  CRM: [
    {
      code: "PRIVACY_AND_PURPOSE_ACCEPTANCE",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "PRIVACY_OWNER",
    },
  ],
  NOTIFICATION: [
    {
      code: "DELIVERABILITY_AND_ESCALATION_REHEARSAL",
      kind: "EXTERNAL_EVIDENCE",
      accountableParty: "SERVICE_OPERATIONS",
    },
  ],
};

export function gatesForConnectorClass(
  connectorClass: EnterpriseConnectorClass
): readonly EnterpriseGateDefinition[] {
  return [
    {
      code: "SOFTWARE_CONFORMANCE",
      kind: "SOFTWARE_CONFORMANCE",
      accountableParty: "INTEGRATION_OWNER",
    },
    ...COMMON_EXTERNAL,
    ...CLASS_GATES[connectorClass],
  ];
}

export function currentGateStatus(
  gate: { status: string; expiresAt?: Date | string | null },
  now = new Date()
): string {
  return gate.expiresAt &&
    new Date(gate.expiresAt) <= now &&
    ["SOFTWARE_PASSED", "VERIFIED"].includes(gate.status)
    ? "EXPIRED"
    : gate.status;
}

export function deriveEnterpriseReadiness(
  gates: readonly {
    gateCode: string;
    gateKind: string;
    status: string;
    expiresAt?: Date | string | null;
  }[],
  healthStatus: string | null,
  now = new Date(),
  healthAsOf?: Date | string | null
) {
  const evaluated = gates.map((gate) => ({
    ...gate,
    currentStatus: currentGateStatus(gate, now),
  }));
  const softwarePassed = evaluated.some(
    (gate) =>
      gate.gateCode === "SOFTWARE_CONFORMANCE" &&
      gate.currentStatus === "SOFTWARE_PASSED"
  );
  const externalVerified = evaluated
    .filter((gate) => gate.gateKind === "EXTERNAL_EVIDENCE")
    .every((gate) => gate.currentStatus === "VERIFIED");
  const openGates = evaluated.filter(
    (gate) => !["SOFTWARE_PASSED", "VERIFIED"].includes(gate.currentStatus)
  );
  const healthTime = healthAsOf ? new Date(healthAsOf) : null;
  const healthCurrent = Boolean(
    healthTime &&
      healthTime <= now &&
      healthTime.getTime() > now.getTime() - 24 * 60 * 60 * 1_000
  );
  const healthy = healthStatus === "HEALTHY" && healthCurrent;
  return {
    softwareConformant: softwarePassed,
    externalEvidenceVerified: externalVerified,
    shadowReady: softwarePassed && externalVerified && healthy,
    safePaused: healthStatus !== null && !healthy,
    healthCurrent,
    openGates,
  };
}

export const ENTERPRISE_INTEGRATION_BOUNDARY = Object.freeze({
  operatingMode: "SHADOW",
  dispatchPermitted: false,
  credentialsStored: false,
  softwareConformanceIsCertification: false,
  profileIsCaseAuthority: false,
  externalEvidenceRequired: true,
});
