import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { submitServiceRequest } from "@/app/(storefront)/services/actions";

// Блок «Онлайн запись» сервисных страниц — тот же паттерн, что форма
// на /services/storage: server action без клиентского JS, состояние через
// query-параметры sent/error.

export function ServiceSignup({
  service,
  back,
  sent,
  error,
}: {
  service: string;
  back: string;
  sent?: string;
  error?: string;
}) {
  return (
    <section id="signup" aria-labelledby="signup-h" className="mt-20">
      <div className="flex flex-col gap-6 rounded-container bg-light p-5 lg:p-10">
        <div>
          <h2 id="signup-h" className="text-h2 text-black">
            Онлайн запись
          </h2>
          <p className="mt-2 text-body text-grey">
            Оставьте телефон — перезвоним, подберём удобное время.
          </p>
        </div>
        {sent === "1" ? (
          <p className="text-subtitle font-semibold text-dark">
            Заявка отправлена — перезвоним в рабочее время.
          </p>
        ) : (
          <form
            action={submitServiceRequest}
            className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start"
          >
            <input type="hidden" name="service" value={service} />
            <input type="hidden" name="back" value={back} />
            <div className="flex-1">
              <Field name="name" autoComplete="name" placeholder="Например: Иван…" aria-label="Имя" />
            </div>
            <div className="flex-1">
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
            </div>
            <Button type="submit">Записаться</Button>
          </form>
        )}
        {error && (
          <p className="text-body text-dark">
            {error === "phone"
              ? "Укажите телефон — без него не сможем перезвонить."
              : "Не получилось отправить заявку. Позвоните нам: +7 (812) 614-64-42."}
          </p>
        )}
      </div>
    </section>
  );
}
