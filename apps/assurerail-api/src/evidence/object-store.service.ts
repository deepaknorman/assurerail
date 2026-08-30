import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type StoredObject = { storageRef: string; objectVersionRef: string | null };
export type RetrievedObject = { body: Readable; contentLength: number | null; contentType: string | null };

export abstract class EvidenceObjectStore {
  abstract put(input: { key: string; path: string; size: number; contentType: string; digestHex: string }): Promise<StoredObject>;
  abstract get(storageRef: string): Promise<RetrievedObject>;
  abstract delete(storageRef: string): Promise<void>;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ServiceUnavailableException(`${name} is required for neutral document storage`);
  return value;
}

function objectStoreEndpoint(): string {
  const raw = requiredEnv("ARAIL_OBJECT_STORE_ENDPOINT");
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new ServiceUnavailableException("ARAIL_OBJECT_STORE_ENDPOINT is malformed"); }
  if (parsed.username || parsed.password) throw new ServiceUnavailableException("object-store endpoint must not contain credentials");
  if (parsed.protocol !== "https:" && process.env.ARAIL_OBJECT_STORE_ALLOW_HTTP !== "true") {
    throw new ServiceUnavailableException("object-store endpoint must use HTTPS");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) throw new ServiceUnavailableException("object-store endpoint protocol is unsupported");
  return parsed.toString();
}

function parseRef(storageRef: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(storageRef);
  if (!match || match[2].includes("..")) throw new ServiceUnavailableException("invalid evidence storage reference");
  return { bucket: match[1], key: match[2] };
}

@Injectable()
export class S3EvidenceObjectStore extends EvidenceObjectStore {
  private client(): S3Client {
    const endpoint = objectStoreEndpoint();
    const accessKeyId = process.env.ARAIL_OBJECT_STORE_ACCESS_KEY?.trim();
    const secretAccessKey = process.env.ARAIL_OBJECT_STORE_SECRET_KEY?.trim();
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
      throw new ServiceUnavailableException("object-store access and secret keys must be configured together");
    }
    return new S3Client({
      endpoint,
      region: process.env.ARAIL_OBJECT_STORE_REGION?.trim() || "ap-south-1",
      forcePathStyle: process.env.ARAIL_OBJECT_STORE_FORCE_PATH_STYLE === "true",
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
  }

  async put(input: { key: string; path: string; size: number; contentType: string; digestHex: string }): Promise<StoredObject> {
    const bucket = requiredEnv("ARAIL_OBJECT_STORE_BUCKET");
    const kmsKey = requiredEnv("ARAIL_OBJECT_STORE_KMS_KEY_ID");
    const response = await this.client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: createReadStream(input.path),
      ContentLength: input.size,
      ContentType: input.contentType,
      ChecksumSHA256: Buffer.from(input.digestHex, "hex").toString("base64"),
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: kmsKey,
      Metadata: { sha256: input.digestHex },
    }));
    return { storageRef: `s3://${bucket}/${input.key}`, objectVersionRef: response.VersionId ?? null };
  }

  async get(storageRef: string): Promise<RetrievedObject> {
    const ref = parseRef(storageRef);
    const response = await this.client().send(new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
    if (!response.Body) throw new ServiceUnavailableException("evidence object store returned no content");
    const body = response.Body as unknown as Readable;
    return { body, contentLength: response.ContentLength ?? null, contentType: response.ContentType ?? null };
  }

  async delete(storageRef: string): Promise<void> {
    const ref = parseRef(storageRef);
    await this.client().send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
  }
}
