/** Whole contractor-day cost allocation. A partial day worked still costs a full day. */
export type ContractorDay = {
  contractorId: string; workDate: string; worked: boolean;
  allocations: { engagementId: string; shareBps: number }[];
};
export function allocateContractorDays(days: ContractorDay[]) {
  if (!Array.isArray(days) || days.length > 10_000) throw new Error("bounded contractor-day list required");
  const seen = new Set<string>();
  return days.map(day => {
    if (typeof day.contractorId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(day.contractorId)) throw new Error("contractor reference required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.workDate) || !Number.isFinite(Date.parse(day.workDate)) || new Date(day.workDate).toISOString().slice(0, 10) !== day.workDate) throw new Error("valid work date required");
    const key = `${day.contractorId}/${day.workDate}`;
    if (seen.has(key)) throw new Error("duplicate person-day; combine all engagement allocations");
    seen.add(key);
    if (typeof day.worked !== "boolean" || !Array.isArray(day.allocations)) throw new Error("explicit worked status and allocations required");
    const engagements = new Set<string>(); let share = 0;
    const allocations = day.allocations.map(a => {
      if (typeof a.engagementId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(a.engagementId) || engagements.has(a.engagementId)) throw new Error("unique engagement references required");
      engagements.add(a.engagementId);
      if (!Number.isInteger(a.shareBps) || a.shareBps <= 0 || a.shareBps > 10_000) throw new Error("allocation must be 1–10000 basis points of a day");
      share += a.shareBps;
      // 25,000 INR = 2,500,000 paise, exactly divisible by 10,000 shares.
      return { ...a, costMinor: (BigInt(a.shareBps) * 250n).toString() };
    });
    if (share > 10_000 || (!day.worked && share > 0)) throw new Error("day is overallocated or was not worked");
    const total = day.worked ? 2_500_000n : 0n;
    return { contractorId: day.contractorId, workDate: day.workDate, totalCostMinor: total.toString(), allocations, unallocatedCostMinor: (total - BigInt(share) * 250n).toString() };
  });
}
