import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../store/prisma.service";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = new Set(["application/pdf", "text/csv", "application/json", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Deal-room document store: offer docs, trustee letters, audited financials — held in the venue's OWN
// DB (Bytes), keyed to a Note where relevant. Content-type allow-list + size cap; downloads stream back.
@Injectable()
export class DocumentsService {
  constructor(private readonly db: PrismaService) {}

  async upload(file: UploadedFile | undefined, noteId?: string, uploadedBy?: string) {
    if (!file || !file.buffer?.length) throw new BadRequestException("no file provided");
    if (file.size > MAX_BYTES) throw new BadRequestException(`file exceeds ${MAX_BYTES} bytes`);
    if (!ALLOWED.has(file.mimetype)) throw new BadRequestException(`content-type not allowed: ${file.mimetype}`);
    if (noteId) {
      const note = await this.db.note.findUnique({ where: { id: noteId }, select: { id: true } });
      if (!note) throw new BadRequestException("noteId does not exist");
    }
    const d = await this.db.document.create({
      data: { id: `doc_${randomUUID()}`, filename: file.originalname.slice(0, 255), contentType: file.mimetype, size: file.size, noteId: noteId ?? null, uploadedBy: uploadedBy ?? null, data: new Uint8Array(file.buffer) },
    });
    return { id: d.id, filename: d.filename, contentType: d.contentType, size: d.size, noteId: d.noteId, createdAt: d.createdAt };
  }

  list(noteId?: string) {
    return this.db.document.findMany({
      where: noteId ? { noteId } : {},
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, contentType: true, size: true, noteId: true, uploadedBy: true, createdAt: true },
    });
  }

  async download(id: string) {
    const d = await this.db.document.findUnique({ where: { id } });
    if (!d) throw new NotFoundException("document not found");
    return d;
  }
}
