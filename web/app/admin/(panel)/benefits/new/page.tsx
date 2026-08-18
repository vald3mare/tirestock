import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { createBenefitAction } from "@/app/admin/actions";
import { BenefitForm } from "@/components/admin/BenefitForm";

// Новый оффер строки «Преимущества».
export default async function AdminNewBenefit({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/benefits" className="hover:text-dark">
          Преимущества
        </Link>{" "}
        / Новый оффер
      </nav>
      <h1 className="mt-2 text-h2 text-black">Новый оффер</h1>

      <BenefitForm action={createBenefitAction} submitLabel="Создать" error={error} />
    </main>
  );
}
