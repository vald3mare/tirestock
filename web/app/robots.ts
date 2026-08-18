import type { MetadataRoute } from "next";
import { isIndexable } from "@/lib/site-env";

// /robots.txt. На тестовом домене (SITE_INDEXABLE≠true) — полный Disallow.
// На боевом — открыт весь сайт, кроме приватных/технических разделов.
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", disallow: ["/admin", "/cart", "/dev"] },
  };
}
