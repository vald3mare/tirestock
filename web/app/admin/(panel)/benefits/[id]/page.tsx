import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/admin-session";
import { adminBenefit } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { updateBenefitAction } from "@/app/admin/actions";
import { BenefitForm } from "@/components/admin/BenefitForm";

// Редактор оффера строки «Преимущества».
export default async function AdminEditBenefit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;

  const benefit = await adminBenefit(token, Number(id)).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/benefits" className="hover:text-dark">
          Преимущества
        </Link>{" "}
        / {benefit.title}
      </nav>
      <h1 className="mt-2 text-h2 text-black">Оффер</h1>

      <BenefitForm
        action={updateBenefitAction}
        submitLabel="Сохранить"
        benefit={benefit}
        error={error}
      />
    </main>
  );
}
