import Link from "next/link";

export type Crumb = { label: string; href?: string };

// Хлебные крошки: 13 grey, разделитель «/», текущая страница без ссылки.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="pt-10">
      <ol className="flex flex-wrap items-center gap-2 text-caption text-grey">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-blue">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
