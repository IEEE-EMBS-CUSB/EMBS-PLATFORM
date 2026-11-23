import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/leaderboards"],
        disallow: ["/hr", "/member", "/attendee", "/login", "/checkin", "/api"],
      },
    ],
  };
}
