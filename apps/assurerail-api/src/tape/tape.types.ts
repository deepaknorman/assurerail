// The tape shape is the shared contract (@code/shared) — the venue does not redefine it, it aliases
// the names it uses. (In the monorepo this is a shared type; at the licence split it stays a type
// dependency on AssureLocker's product — the coupling is still the runtime tape.json API, not this.)
import { CoLending } from "@code/shared";

export type AssurePoolTape = CoLending.AssurePoolTape;
export type TapeLoan = CoLending.TapeLoan;
export type TapeLock = CoLending.TapeInputLock;
export type PoolVerdict = CoLending.PoolLoanVerdict["verdict"];
export const SUPPORTED_TAPE_VERSION = CoLending.ASSUREPOOL_TAPE_VERSION;
