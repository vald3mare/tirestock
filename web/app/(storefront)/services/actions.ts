"use server";

import { redirect } from "next/navigation";
import { createServiceRequest } from "@/lib/api/client";

// Общая заявка «Онлайн запись» сервисных страниц (шиномонтаж, ремонт/покраска
// дисков, мотошиномонтаж, хранение) → POST /api/v1/requests → outbox →
// tradesk `POST /api/request`. Тип услуги уходит отдельным полем — менеджер
// видит, на что заявка, без разбора текста комментария.
// service/back приходят hidden-полями формы (см. ServiceSignup).
export async function submitServiceRequest(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const back = String(formData.get("back") ?? "/").trim();
  if (!phone) redirect(`${back}?error=phone#signup`);

  try {
    await createServiceRequest({
      name,
      phone,
      type: service,
      comment: `Заявка со страницы «${service}» нового сайта`,
    });
  } catch {
    redirect(`${back}?error=api#signup`);
  }
  redirect(`${back}?sent=1#signup`);
}
