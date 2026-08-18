"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { submitCallback, type CallbackState } from "@/app/(storefront)/callback-action";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { Field } from "@/components/ui/Field";

// Модалка обратного звонка/уточнения поверх любой страницы. Заявка уходит в
// tradesk (раздел «Обратный звонок») через outbox, поэтому не теряется при сбое.
// Два контекста (один компонент): «Заказать звонок» (шапка/футер, ссылка) и
// «Уточнить при наличии» (карточка нет-в-наличии, кнопка + предзаполненный товар).
// Доступность: закрытие по Escape и клику вне, фокус уходит в первое поле,
// возвращается на кнопку при закрытии; фон под модалкой не скроллится.

const initial: CallbackState = { status: "idle" };

export function CallbackModal({
  className,
  triggerLabel = "Заказать звонок",
  variant = "link",
  title = "Заказать звонок",
  description = "Оставьте телефон — менеджер перезвонит, поможет с подбором и оформит заказ.",
  defaultComment,
  submitLabel = "Жду звонка",
}: {
  className?: string;
  triggerLabel?: string;
  variant?: "link" | "button";
  title?: string;
  description?: string;
  defaultComment?: string;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submitCallback, initial);
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.body.style.overflow = "";
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          variant === "button"
            ? buttonClasses("secondary", "sm", `w-full ${className ?? ""}`)
            : "min-h-touch cursor-pointer text-caption-lg font-semibold text-blue hover:underline " +
              (className ?? "")
        }
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="callback-h"
            className="w-full max-w-125 rounded-container bg-white p-6 lg:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="callback-h" className="text-h2 text-black">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="min-h-touch cursor-pointer px-2 text-subtitle text-grey hover:text-dark"
              >
                ×
              </button>
            </div>

            {state.status === "sent" ? (
              <div className="mt-6">
                <p className="text-subtitle font-semibold text-dark">
                  Заявка принята — перезвоним в рабочее время.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 min-h-touch cursor-pointer text-body font-semibold text-blue hover:underline"
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <form action={action} className="mt-6 flex flex-col gap-3">
                <p className="text-body text-grey">{description}</p>
                <Field ref={firstFieldRef} name="name" autoComplete="name" placeholder="Например: Иван…" aria-label="Имя" />
                <Field
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  spellCheck={false}
                  required
                  placeholder="Например: +7 (921) 123-45-67…"
                  aria-label="Телефон"
                />
                <Field
                  name="comment"
                  defaultValue={defaultComment}
                  placeholder="Что вас интересует? Например: зимние 205/55 R16…"
                  aria-label="Комментарий"
                />
                {state.status === "error" && (
                  <p className="text-body text-dark">{state.message}</p>
                )}
                <Button type="submit" disabled={pending} className="mt-1">
                  {pending ? "Отправляем…" : submitLabel}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
