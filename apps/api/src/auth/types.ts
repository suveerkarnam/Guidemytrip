import type { RoleCode } from "@prisma/client";

export type AuthUser = { id: string; email: string | null; phone: string | null; displayName: string; roles: RoleCode[] };

declare module "express-serve-static-core" { interface Request { auth?: AuthUser; csrfToken?: string; } }
