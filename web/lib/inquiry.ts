import type { Product } from "@/lib/api/client";

// Комментарий заявки «Уточнить при наличии» → уходит в tradesk (обратный звонок),
// чтобы менеджер сразу видел, какой именно товар нужен клиенту (с артикулом).
export function inquiryComment(product: Pick<Product, "name" | "code">): string {
  const code = product.code ? ` (арт. ${product.code})` : "";
  return `Уточнить наличие: ${product.name}${code}`;
}
