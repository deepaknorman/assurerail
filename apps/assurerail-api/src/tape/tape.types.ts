// Provider-boundary aliases. AssurePool remains an external product and supplies this profile over
// a versioned adapter; no AssureLocker source package is required by Rail.
import type {
  AssurePoolTapeV1,
  PoolVerdict,
  TapeLoanV1,
  TapeLockV1,
} from "../provider-contracts/v1";
import { SUPPORTED_ASSUREPOOL_TAPE_VERSION } from "../provider-contracts/v1";

export type AssurePoolTape = AssurePoolTapeV1;
export type TapeLoan = TapeLoanV1;
export type TapeLock = TapeLockV1;
export type { PoolVerdict };
export const SUPPORTED_TAPE_VERSION = SUPPORTED_ASSUREPOOL_TAPE_VERSION;
