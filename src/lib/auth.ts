import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { normalizeEmail } from "@/lib/auth-helpers";

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "ieee-embs-cusb-better-auth-secret-development-key-default-32ch",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: false, // Strict whitelist: zero self-registration & no passwords
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // In development/staging, log to server console. In production, wires to transactional email.
        const normalized = normalizeEmail(email);
        console.log(
          `[IEEE-EMBS-AUTH] Sent 6-digit verification code to ${normalized}: ${otp} (type: ${type})`
        );
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          // Strict Whitelist Authorization Guard:
          // User email MUST exist in active roster_memberships (or archived for alumni)
          const normalized = normalizeEmail(userData.email);

          const membership = await db.query.rosterMemberships.findFirst({
            where: (tbl, { eq }) => eq(tbl.email, normalized),
            with: { season: true },
          });

          if (!membership) {
            throw new Error(
              `Unauthorized: ${normalized} is not registered on the active roster. Please contact your HR lead.`
            );
          }

          if (!membership.isActive) {
            throw new Error(
              `Account deactivated: Your profile for ${normalized} is inactive. Please contact your HR lead.`
            );
          }

          return {
            data: {
              ...userData,
              email: normalized,
            },
          };
        },
      },
    },
  },
});
