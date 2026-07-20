import { redirect } from "next/navigation";

// /admin → раздел «Заказы» (дефолт по макету).
export default function AdminIndex() {
  redirect("/admin/orders");
}
