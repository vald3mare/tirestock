import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireUser } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Админка | TireStock",
  robots: { index: false, follow: false },
};

// Каркас панели: тёмный сайдбар + область контента. Гард — requireUser
// (валидирует сессию в Go на каждый рендер; при провале уводит на /admin/login).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <div className="flex min-h-screen bg-light">
      <AdminSidebar userName={user.display_name} />
      <div className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</div>
    </div>
  );
}
