import { exactMinor } from "./fee-calculation";

export function invoicePaymentPosition(netFeeMinor: string, verifiedAmounts: string[]) {
  const due = BigInt(exactMinor(netFeeMinor, "netFeeMinor"));
  const received = verifiedAmounts.reduce((sum, v) => sum + BigInt(exactMinor(v, "verified receipt", false)), 0n);
  return { invoiceNetMinor: due.toString(), verifiedReceiptsMinor: received.toString(),
    outstandingMinor: (received < due ? due - received : 0n).toString(),
    overpaymentMinor: (received > due ? received - due : 0n).toString(),
    reconciliationRequired: received > due,
    fullyReconciled: received === due && due > 0n };
}

export function validateReceiptReview(input: { proposer: string; reviewer: string; status: string; netFeeMinor: string; verifiedAmounts: string[]; proposedAmountMinor: string }) {
  if (input.proposer === input.reviewer) throw new Error("receipt proposer cannot review their own receipt");
  if (input.status !== "PROPOSED") throw new Error("receipt is already decided");
  const amount = BigInt(exactMinor(input.proposedAmountMinor, "receipt amount", false));
  const position = invoicePaymentPosition(input.netFeeMinor, input.verifiedAmounts);
  if (position.reconciliationRequired || amount > BigInt(position.outstandingMinor)) throw new Error("overpayment requires separate allocation or refund reconciliation");
  return invoicePaymentPosition(input.netFeeMinor, [...input.verifiedAmounts, amount.toString()]);
}
