import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/admin-session";
import { adminPickupPoint } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { updatePickupAction } from "@/app/admin/actions";
import { PickupForm } from "@/components/admin/PickupForm";

export default async function AdminEditPickup({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;

  const point = await adminPickupPoint(token, Number(id)).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <main id="main" className="mx-auto max-w-content">
      <nav className="text-caption text-grey" aria-label="Хлебные крошки">
        <Link href="/admin/pickups" className="hover:text-dark">
          Пункты выдачи
        </Link>{" "}
        / {point.address}
      </nav>
      <h1 className="mt-2 text-h2 text-black">Пункт выдачи</h1>

      <PickupForm action={updatePickupAction} submitLabel="Сохранить" point={point} error={error} />
    </main>
  );
}
