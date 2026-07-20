import type { Metadata } from "next";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { loginAction } from "../actions";

export const metadata: Metadata = {
  title: "Вход в админку | TireStock",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-light px-4">
      <div className="w-full max-w-100 rounded-container border border-line bg-white p-8">
        <p className="text-nav font-extrabold tracking-wide text-black">TIRESTOCK</p>
        <h1 className="mt-6 text-h2 text-black">Вход в админку</h1>
        <p className="mt-2 text-body text-grey">
          Панель управления магазином. Доступ только для сотрудников.
        </p>

        <form action={loginAction} className="mt-6 flex flex-col gap-3">
          <Field
            name="username"
            autoComplete="username"
            required
            placeholder="Логин…"
            aria-label="Логин"
          />
          <Field
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Пароль…"
            aria-label="Пароль"
          />
          {error && (
            <p className="text-body text-red">
              {error === "empty"
                ? "Введите логин и пароль."
                : "Неверный логин или пароль."}
            </p>
          )}
          <Button type="submit" className="mt-1 w-full">
            Войти
          </Button>
        </form>
      </div>
    </main>
  );
}
