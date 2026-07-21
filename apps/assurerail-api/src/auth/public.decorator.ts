import { SetMetadata } from "@nestjs/common";

// Marks a route as public — the global AuthGuard skips token verification for it.
export const IS_PUBLIC_KEY = "arail:isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
