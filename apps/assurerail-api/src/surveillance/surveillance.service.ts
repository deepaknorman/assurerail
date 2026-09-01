import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { audit } from "../common/audit";
import { MintRepository } from "../mint/note.repository";
import { fetchSurveillance } from "./surveillance.client";
import { selectHcsAdapter } from "./hcs.adapter";
import { assertLegacyExternalEffectPathAllowed } from "../runtime/legacy-external-effect.guard";

@Injectable()
export class SurveillanceService {
  constructor(private readonly repo: MintRepository) {}

  /** Pull the Note's pool surveillance from AssureLocker, anchor each cycle's verdict to HCS, mirror it. */
  async sync(noteId: string) {
    assertLegacyExternalEffectPathAllowed("legacy.note.surveillance-sync");
    const note = await this.repo.getNote(noteId);
    if (!note) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) {
      throw new BadRequestException("governed token representation: direct legacy surveillance anchoring is disabled; use case-scoped evidence and token actions");
    }

    const surveillance = await fetchSurveillance(note.poolId);
    const hcs = selectHcsAdapter();
    const mirrored = [];
    for (const cycle of surveillance.cycles) {
      const verdict = { period: cycle.period, waterfall: cycle.waterfall, triggers: cycle.triggers, problems: cycle.problems };
      const anchor = await hcs.anchor({ noteId, tapeHash: note.tapeHash, ...verdict });
      const rec = await this.repo.saveSurveillance({ noteId, period: cycle.period, verdict, anchorRef: `${anchor.topicId}#${anchor.sequenceNumber}` });
      mirrored.push(rec);
    }

    // First surveillance cycle moves the Note from ISSUED to ACTIVE.
    if (note.state === "ISSUED" && mirrored.length) await this.repo.updateNoteState(noteId, "ACTIVE");
    audit("surveillance.synced", { noteId, poolId: note.poolId, cycles: mirrored.length, poolStatus: surveillance.poolStatus, ok: surveillance.ok, adapter: hcs.mode });

    // Recording problem cycles IS the job — surface the status honestly, never hide it (and never
    // pretend a problem-surveillance is a failed sync).
    const problems = surveillance.cycles.flatMap((c) => c.problems);
    return { noteId, poolStatus: surveillance.poolStatus, ok: surveillance.ok, problems, periodGaps: surveillance.periodGaps, mirrored };
  }

  async list(noteId: string) {
    if (!(await this.repo.getNote(noteId))) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) throw new NotFoundException("note not found");
    return this.repo.listSurveillance(noteId);
  }
}
