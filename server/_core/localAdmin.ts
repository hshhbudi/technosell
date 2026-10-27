import { parse as parseCookie } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

export const LOCAL_ADMIN_COOKIE = "technosell_admin";
const secret = () => new TextEncoder().encode(ENV.cookieSecret || "technosell-development-secret");

export function localAdminUser(): User {
  const now = new Date();
  return { id: 0, openId: "local-admin", name: "TechnoSell Owner", email: ENV.localAdminEmail, loginMethod: "local", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now };
}

export async function signLocalAdmin(res: Response) {
  const token = await new SignJWT({ kind: "local-admin" }).setProtectedHeader({ alg: "HS256" }).setSubject("local-admin").setIssuedAt().setExpirationTime("30d").sign(secret());
  res.cookie(LOCAL_ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 60 * 60 * 24 * 30 * 1000 });
}

export async function localAdminFromRequest(req: Request): Promise<User | null> {
  const token = parseCookie(req.headers.cookie ?? "")[LOCAL_ADMIN_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub === "local-admin" && payload.kind === "local-admin" && ENV.localAdminEmail && ENV.localAdminPassword ? localAdminUser() : null;
  } catch { return null; }
}

export function clearLocalAdmin(res: Response) {
  res.clearCookie(LOCAL_ADMIN_COOKIE, { httpOnly: true, secure: true, sameSite: "none", path: "/" });
}
