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
    "ongoingMonitoring": "OPTIONAL"
  }
} as const;
