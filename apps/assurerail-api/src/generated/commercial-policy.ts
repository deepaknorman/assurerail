/* Generated from config/assurerail-da-commercial-policy.json. Do not edit. */
export const commercialPolicy = {
  "policyVersion": "DA-2026-09-17-PILOT-3",
  "effectiveDate": "2026-09-17",
  "currency": "INR",
  "currencyScale": 2,
  "phase": {
    "productionPriority": "CONVENTIONAL_DA",
    "deferred": [
      "PTC"
    ]
  },
  "fixedStages": {
    "counting": {
      "primaryUnit": "UNIQUE_SELLER_LOAN_BORROWER_PAIR",
      "linkedPartyUnit": "UNIQUE_LOAN_LINKED_PARTY_PAIR",
      "reconcileEveryVariance": true
    },
    "committed": {
      "primaryUnitFeeMinor": "50000",
      "linkedPartyFeeMinor": "25000",
      "minimumFeeMinor": "80000000",
      "largeProgrammeThresholdMinor": "100000000000",
      "largeProgrammeSupplementBps": 10
    },
    "standalone": {
      "primaryUnitFeeMinor": "65000",
      "linkedPartyFeeMinor": "32500",
      "minimumFeeMinor": "104000000",
      "largeProgrammeThresholdMinor": "100000000000",
      "largeProgrammeSupplementBps": 13
    },
    "initialAssessment": {
      "invoicePercentOfStandaloneFixedQuote": 30,
      "deliveryModel": "AUTOMATED_UNSIGNED_NO_HUMAN_CONTENT_REVIEW",
      "includedAutomatedReassessments": 3,
      "reassessmentWindowDays": 30,
      "reassessmentAllowanceStatus": "APPROVED_PILOT_DEFAULT"
    },
    "portfolioPreparation": {
      "deliveryModel": "QUALIFIED_EXPERT_REVIEW_AND_SIGNOFF",
      "remainingAcceptedRouteBalanceDueUpfront": true
    },
    "scopeReconciliation": {
      "tolerancePercent": 0,
      "refundRequiresFormalClosure": true,
      "maximumRefundPercentOfOriginalEstimate": 20,
      "otherwiseRetainAsCustomerCredit": true,
      "customerCreditValidityMonths": 12,
      "workspaceInactivityRefreshDays": 90
    }
  },
  "execution": {
    "feeBasis": "SELLER_SHARE_OF_ACTUAL_PURCHASE_CONSIDERATION_SETTLED",
    "perSellerCumulative": true,
    "minimumFeeMinor": "50000000",
    "slabs": [
      {
        "throughConsiderationMinor": "25000000000",
        "rateBps": 40
      },
      {
        "throughConsiderationMinor": null,
        "rateBps": 30
      }
    ],
    "noSuccessfulCloseNoSuccessFee": true,
    "standalonePremiumConversionCredit": {
      "eligible": true,
      "cashRefund": false,
      "applyOnce": true,
      "capAtEligibleExecutionFeesEarned": true
    },
    "committedRouteTopUp": {
      "onlyForVoluntarySwitchOrWithdrawal": true,
      "failedCloseExcluded": true,
      "buyerRejectionExcluded": true
    }
  },
  "additionalServices": {
    "customerSelectionRequired": true,
    "routineThirdPartyServices": {
      "publishedAssureRailRate": true,
      "supplierCostBufferPercent": 25,
      "ordinaryInScopeOverrunsAbsorbedByAssureRail": true,
      "deliveryEfficiencyRetainedByAssureRail": true
    },
    "secureFileConnection": {
      "feeMinor": "5000000",
      "unit": "ACCEPTED_POINT_TO_POINT_CONNECTION",
      "includes": [
        "SETUP",
        "TESTING",
        "VALIDATION"
      ]
    },
    "apiIntegration": "QUOTE_ON_REQUEST",
    "ongoingMonitoring": "OPTIONAL",
    "monitoringPayer": {
      "DA": "SELLER_FIRST_12_MONTHS_THEN_BUYER_UNLESS_SELLER_REMAINS_SERVICER_OR_DOCUMENTS_OVERRIDE",
      "PTC": "BUYER_ORIGINATOR_50_50_UNLESS_DOCUMENTS_OVERRIDE"
    }
  },
  "commercialGovernance": {
    "internalAssureRailRevenueBenchmarkBps": 60,
    "benchmarkIsInvoiceFormula": false,
    "benchmarkMayBePubliclyDisclosed": false,
    "quotesDependOnServiceAndCorpus": true,
    "gstSeparate": true,
    "contractorDayCostMinor": "2500000",
    "contractorBillingRule": "FULL_DAY_WHEN_PERSON_WORKS_SHARE_ACROSS_ENGAGEMENTS"
  },
  "designPartnerProgramme": {
    "programmeCode": "DESIGN_PARTNER_30",
    "maximumSellerInstitutionsEver": 2,
    "discountPercent": 30,
    "eligibility": "FIRST_TWO_NBFC_SELLER_ENTITIES_TO_SIGN_AN_ASSESSMENT_SCOPE_AND_RECEIVE_INDEPENDENT_APPROVAL",
    "term": "ENTITY_BOUND_LIFETIME_NON_EXPIRING",
    "application": "MAKER_CHECKER_APPROVED_INVOICE_CREDIT_BEFORE_GST",
    "eligibleFeeClasses": [
      "INITIAL_ASSESSMENT",
      "PORTFOLIO_PREPARATION",
      "CORE_EXECUTION_SUCCESS_FEE",
      "LARGE_PROGRAMME_SUPPLEMENT"
    ],
    "excludedFeeClasses": [
      "ADDITIONAL_SERVICES",
      "THIRD_PARTY_PASS_THROUGHS",
      "SECURE_FILE_CONNECTION",
      "API_INTEGRATION",
      "ONGOING_MONITORING",
      "CONTRACTOR_DAY_RATES"
    ],
    "exclusionSetStatus": "PILOT_DEFAULT_PENDING_FOUNDER_CONFIRMATION",
    "standardRateCardRemainsUnchanged": true
  },
  "referral": {
    "basePercent": 8.5,
    "basis": "COLLECTED_DISCOUNTED_ASSURERAIL_FEES_ACROSS_THREE_CORE_STAGES_ONLY",
    "eligible": [
      "INITIAL_ASSESSMENT",
      "PORTFOLIO_PREPARATION",
      "CORE_EXECUTION"
    ],
    "excludes": [
      "ADDITIONAL_SERVICES",
      "ARRANGEMENT",
      "INTEGRATION",
      "LARGE_PROGRAMME_SUPPLEMENT",
      "MONITORING",
      "THIRD_PARTY_PASS_THROUGHS",
      "GST",
      "REFUNDS",
      "CREDITS"
    ],
    "largeProgrammeSupplementExclusionStatus": "PILOT_DEFAULT_EXCLUDED_PENDING_FOUNDER_CONFIRMATION",
    "paymentTiming": "QUARTERLY_IN_ARREARS",
    "acceptedRegistrationWindowMonths": 6,
    "lapseWithoutEvidencedIntroductionDays": 60,
    "ingestFormattingPaidBySeller": true
  },
  "cohortMinimumTreatment": {
    "version": "1.0",
    "status": "FOUNDER_APPROVED_PILOT_POLICY",
    "appliesTo": "FORMED_MULTI_SELLER_ANALYTICAL_DA_COHORT",
    "standardUnitRatesAndExecutionSlabsRemainUnchanged": true,
    "cohortMinimums": {
      "fixedStageMinimumApplication": "ONCE_PER_COHORT_FOR_THE_ACCEPTED_ROUTE",
      "executionMinimumApplication": "ALLOCATED_ONCE_AT_COHORT_FORMATION_ACROSS_EXPECTED_MEMBER_CLOSINGS",
      "fixedStageMinimumMinorByRoute": {
        "COMMITTED": "80000000",
        "STANDALONE": "104000000"
      },
      "executionMinimumMinor": "50000000",
      "minimumIsBackstop": true,
      "aggregateVariableChargesGovernWhenHigher": true
    },
    "counting": {
      "primaryUnit": "UNIQUE_SELLER_LOAN_BORROWER_PAIR",
      "coBorrowerTreatment": "EACH_COBORROWER_IS_A_SEPARATE_PRIMARY_UNIT",
      "linkedPartyUnit": "UNIQUE_LOAN_LINKED_PARTY_PAIR",
      "linkedPartyExamples": [
        "GUARANTOR",
        "SECURITY_PROVIDER",
        "OTHER_SEPARATELY_LINKED_PARTY"
      ],
      "crossSellerBorrowerTreatment": "COUNT_SEPARATELY_PER_SELLER_AND_FLAG_AS_COHORT_CONCENTRATION",
      "crossSellerDeduplicationForBilling": false
    },
    "allocation": {
      "fixedStageMinimumBasis": "PRO_RATA_BY_EACH_SELLERS_DECLARED_UNIQUE_PRIMARY_AND_LINKED_PARTY_PAIR_CHARGES_AT_THE_ACCEPTED_ROUTE_RATES",
      "executionMinimumBasis": "PRO_RATA_BY_EACH_SELLERS_EXPECTED_SHARE_OF_SETTLED_PURCHASE_CONSIDERATION",
      "formationPoint": "BEFORE_MEMBER_ORDER_ACCEPTANCE_USING_RECONCILED_DECLARED_SCOPE_AND_EXPECTED_SETTLED_SHARES",
      "sellerOrderTreatment": "FREEZE_EACH_SELLERS_ALLOCATED_AMOUNT_IN_ITS_OWN_ORDER",
      "reallocationAfterFormation": false,
      "membershipOrScopeUnderfillRisk": "ASSURERAIL",
      "designPartnerDiscountOrder": "AFTER_COHORT_ALLOCATION",
      "collectedTotalMayFallBelowCohortMinimumAfterApprovedDiscount": true,
      "declaredScopeVarianceBeforeFormation": "RECALCULATE_COUNTS_CORPUS_EXPECTED_SETTLED_SHARES_AND_ALLOCATIONS",
      "memberChangeAfterFormation": "NO_REALLOCATION_TO_OTHER_SELLERS"
    },
    "executionTreatment": {
      "variableFeeBasis": "EACH_SELLERS_ACTUAL_PURCHASE_CONSIDERATION_SETTLED",
      "noSuccessfulCloseNoSuccessFee": true,
      "minimumAllocationDoesNotCombineSettlements": true
    },
    "legalAndOperationalSeparation": {
      "cohortPurpose": "ANALYTICAL_PREPARATION_AND_BUYER_PRESENTATION",
      "legalCommingling": false,
      "sellerSpecific": [
        "OWNERSHIP",
        "MANDATE",
        "REPRESENTATIONS",
        "ORDER",
        "INVOICE",
        "PURCHASE_CONSIDERATION",
        "SETTLEMENT_WATERFALL",
        "CLOSING"
      ],
      "buyerRunsSeparateSellerClosings": true,
      "closingMayBeSequenced": true
    }
  },
  "payments": {
    "checkoutPrimary": "RAZORPAY",
    "checkoutSecondary": "MAXIMUS_SUBJECT_TO_TECHNICAL_AND_COMMERCIAL_ACCEPTANCE",
    "successFeeCollection": "ACCEPTED_ESCROW_DISTRIBUTION_AT_SETTLEMENT"
  },
  "documentAutomation": {
    "primary": "gpt-5.6-luna",
    "fallback": "gemini-3-flash-preview",
    "humanReviewAtInitialAssessment": false,
    "humanExpertSignoffAtPortfolioPreparation": true
  }
} as const;
