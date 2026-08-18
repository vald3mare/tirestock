"use server";

import { createCallback } from "@/lib/api/client";

// Обратный звонок из шапки/футера → POST /api/v1/callbacks → outbox →
// tradesk `GET /data/backcall`. Возвращает состояние формы (без redirect):
// модалка живёт на любой странице, уводить с неё пользователя не нужно.
export type CallbackState = { status: "idle" | "sent" | "error"; message?: string };

export async function submitCallback(
  _prev: CallbackState,
  formData: FormData,
): Promise<CallbackState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();

  if (!phone) {
    return { status: "error", message: "Укажите телефон — без него не сможем перезвонить." };
  }
  try {
    await createCallback({ name, phone, comment });
  } catch {
    return {
      status: "error",
      message: "Не получилось отправить. Позвоните нам: +7 (812) 614-64-42.",
    };
  }
  return { status: "sent" };
}
