import { createHash } from "node:crypto";

export type CanonicalPrimitive = null | boolean | string | number;
export type CanonicalValue = CanonicalPrimitive | readonly CanonicalValue[] | CanonicalObject;
export interface CanonicalObject { readonly [key: string]: CanonicalValue }

declare const sha256DigestBrand: unique symbol;
export type Sha256Digest = string & { readonly [sha256DigestBrand]: true };

const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;

/**
 * Convert a JSON-shaped source record to the strict canonical domain. Undefined object properties
 * are omitted because they have no JSON wire representation; undefined array entries, unsafe
 * numbers, BigInt, Dates, class instances and executable values are rejected.
 */
function convertCanonicalValue(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  omitUndefinedObjectProperties: boolean,
): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error(`${path} must use a safe canonical integer number; exact decimal values belong in strings`);
    }
    return value;
  }
  if (typeof value === "undefined") throw new Error(`${path} cannot be undefined`);
  if (typeof value === "bigint") throw new Error(`${path} cannot be BigInt; encode exact integers as canonical decimal strings`);
  if (typeof value === "function" || typeof value === "symbol") throw new Error(`${path} contains a non-data value`);
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error(`${path} contains a cycle`);
    seen.add(value);
    const converted = value.map((entry, index) => {
      if (entry === undefined) throw new Error(`${path}[${index}] cannot be undefined`);
      return convertCanonicalValue(entry, `${path}[${index}]`, seen, omitUndefinedObjectProperties);
    });
    seen.delete(value);
    return converted;
  }
  if (typeof value === "object") {
    const object = value as object;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} must be a plain object`);
    }
    if (seen.has(object)) throw new Error(`${path} contains a cycle`);
    seen.add(object);
    const converted: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(object).sort()) {
      const nested = (object as Record<string, unknown>)[key];
      if (nested === undefined && omitUndefinedObjectProperties) continue;
      // Define an own data property so hostile JSON keys such as "__proto__" cannot invoke the
      // legacy Object.prototype setter while a provider payload is canonicalised.
      Object.defineProperty(converted, key, {
        value: convertCanonicalValue(nested, `${path}.${key}`, seen, omitUndefinedObjectProperties),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    seen.delete(object);
    return converted;
  }
  throw new Error(`${path} is not canonical data`);
}

/** JSON-source conversion: omit object properties that could not cross JSON.stringify. */
export function toCanonicalValue(value: unknown, path = "$", seen = new WeakSet<object>()): CanonicalValue {
  return convertCanonicalValue(value, path, seen, true);
}

function render(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => render(entry)).join(",")}]`;
  const object = value as CanonicalObject;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${render(object[key])}`).join(",")}}`;
}

export function canonicalSerialize(value: unknown): string {
  return render(convertCanonicalValue(value, "$", new WeakSet<object>(), false));
}

export function sha256Digest(value: unknown): Sha256Digest {
  return `sha256:${createHash("sha256").update(canonicalSerialize(value), "utf8").digest("hex")}` as Sha256Digest;
}

export function assertSha256Digest(value: unknown, fieldName = "digest"): Sha256Digest {
  if (typeof value !== "string" || !SHA256_DIGEST.test(value)) {
    throw new Error(`${fieldName} must be lowercase sha256:<64 hex characters>`);
  }
  return value as Sha256Digest;
}
