"use server";

import { redirect } from "next/navigation";
import { createCallback } from "@/lib/api/client";

// Заявка на хранение → POST /api/v1/callbacks → outbox → tradesk (пока мок).
export async function submitStorageRequest(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) redirect("/services/storage?error=phone#signup");

  try {
    await createCallback({ name, phone, comment: "Заявка со страницы «Хранение шин и колёс»" });
  } catch {
    redirect("/services/storage?error=api#signup");
  }
  redirect("/services/storage?sent=1#signup");
}
