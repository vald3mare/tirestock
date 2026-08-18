"use server";

import { redirect } from "next/navigation";
import { createServiceRequest } from "@/lib/api/client";

// Заявка на хранение → POST /api/v1/requests → outbox → tradesk `POST /api/request`
// (с типом «Хранение колёс» — у tradesk есть раздел хранения).
export async function submitStorageRequest(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) redirect("/services/storage?error=phone#signup");

  try {
    await createServiceRequest({
      name,
      phone,
      type: "Хранение колёс",
      comment: "Заявка со страницы «Хранение шин и колёс» нового сайта",
    });
  } catch {
    redirect("/services/storage?error=api#signup");
  }
  redirect("/services/storage?sent=1#signup");
}
