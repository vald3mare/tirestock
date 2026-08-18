import Link from "next/link";
import { requireUser } from "@/lib/admin-session";
import { createPickupAction } from "@/app/admin/actions";
import { PickupForm } from "@/components/admin/PickupForm";

export default async function AdminNewPickup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/pickups" className="hover:text-dark">
          Пункты выдачи
        </Link>{" "}
        / Новый пункт
      </nav>
      <h1 className="mt-2 text-h2 text-black">Новый пункт выдачи</h1>

      <PickupForm action={createPickupAction} submitLabel="Создать" error={error} />
    </main>
  );
}
