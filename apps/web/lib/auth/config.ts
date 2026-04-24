import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

function normalizeHost(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`,
    ).host;
  } catch {
    return null;
  }
}

function getWildcardHostPattern(host: string): string | null {
  const hostname = host.split(":")[0];
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("[")
  ) {
    return null;
  }

  return `*.${host}`;
}

function getAuthBaseURLFallback(): string | undefined {
  return (
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(
  record: Record<string, unknown>,
  field: string,
): string | null {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStringFromPath(value: unknown, path: string[]): string | null {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[segment];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function getAvatarUsername(profile: unknown): string | null {
  const image =
    getStringFromPath(profile, ["image"]) ??
    getStringFromPath(profile, ["picture"]) ??
    getStringFromPath(profile, ["avatarUrl"]) ??
    getStringFromPath(profile, ["avatar_url"]);

  if (!image) {
    return null;
  }

  try {
    const url = new URL(image);
    return url.searchParams.get("u");
  } catch {
    return null;
  }
}

function normalizeUsername(value: string): string | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || null;
}

function mapProfileToUser(profile: unknown): { username: string } {
  const profileRecord = isRecord(profile) ? profile : {};
  const email = readStringField(profileRecord, "email");
  const emailName = email?.split("@")[0] ?? null;

  const username =
    readStringField(profileRecord, "username") ??
    readStringField(profileRecord, "login") ??
    readStringField(profileRecord, "user_name") ??
    readStringField(profileRecord, "preferred_username") ??
    readStringField(profileRecord, "nickname") ??
    getAvatarUsername(profile) ??
    readStringField(profileRecord, "name") ??
    emailName ??
    nanoid();

  return { username: normalizeUsername(username) ?? nanoid() };
}

function getAllowedAuthHosts(): string[] {
  const hosts = new Set<string>(["localhost:3000", "127.0.0.1:3000"]);

  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const host = normalizeHost(value);
    if (!host) {
      continue;
    }

    hosts.add(host);

    const wildcardPattern = getWildcardHostPattern(host);
    if (wildcardPattern) {
      hosts.add(wildcardPattern);
    }
  }

  return [...hosts];
}

const authBaseURLFallback = getAuthBaseURLFallback();
const authAllowedHosts = getAllowedAuthHosts();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: {
    allowedHosts: authAllowedHosts,
    ...(authBaseURLFallback ? { fallback: authBaseURLFallback } : {}),
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users: schema.users,
      auth_sessions: schema.authSessions,
      account: schema.accounts,
      verification: schema.verification,
    },
  }),

  user: {
    modelName: "users",
    fields: {
      image: "avatarUrl",
    },
    additionalFields: {
      username: { type: "string", required: true },
      lastLoginAt: { type: "date", required: false },
    },
  },

  session: {
    modelName: "auth_sessions",
  },

  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["vercel", "github"],
      allowDifferentEmails: true,
    },
  },

  socialProviders: {
    vercel: {
      clientId: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID ?? "",
      clientSecret: process.env.VERCEL_APP_CLIENT_SECRET ?? "",
      scope: ["openid", "email", "profile", "offline_access"],
      overrideUserInfoOnSignIn: true,
      mapProfileToUser,
    },
    github: {
      clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      mapProfileToUser,
    },
  },

  advanced: {
    database: {
      generateId: () => nanoid(),
    },
  },
});
