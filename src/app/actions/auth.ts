"use server";

import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = { error?: string };

const sessionCookie = "catalogbridge_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

function authSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured && (process.env.NODE_ENV !== "production" || configured.length >= 32)) return configured;
  return process.env.NODE_ENV === "production" ? null : "catalogbridge-local-development-secret";
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createSessionToken(email: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt: Date.now() + sessionMaxAgeSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function readSessionToken(token: string, secret: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; expiresAt?: number };
    return parsed.email && parsed.expiresAt && parsed.expiresAt > Date.now() ? { email: parsed.email } : null;
  } catch {
    return null;
  }
}

function verifyConfiguredPassword(password: string, encoded: string) {
  const [iterationsText, salt, expectedHex] = encoded.split(":");
  const iterations = Number(iterationsText);
  if (!iterations || !salt || !expectedHex) return false;
  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 6) return { error: "Password must contain at least 6 characters." };

  const configuredEmail = process.env.AUTH_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.AUTH_PASSWORD_HASH;
  const secret = authSecret();
  if (!secret || (process.env.NODE_ENV === "production" && (!configuredEmail || !configuredPassword))) return { error: "Sign-in is not configured." };

  if (configuredEmail && configuredPassword) {
    if (email !== configuredEmail || !verifyConfiguredPassword(password, configuredPassword)) return { error: "Invalid email or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, createSessionToken(email, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookie);
  redirect("/login");
}

export async function getSession() {
  const secret = authSecret();
  if (!secret) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  return token ? readSessionToken(token, secret) : null;
}
