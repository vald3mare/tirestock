// Таблица цен сервисных страниц (Figma → «Инфо — Шиномонтаж» и соседние).
// Широкие таблицы (до 10 радиусов) скроллятся внутри своего контейнера
// (overflow-x-auto), страница горизонтально не скроллится. Цены — tabular-nums.

export function PriceTable({
  head,
  rows,
  note,
}: {
  head: string[];
  rows: string[][];
  note?: string;
}) {
  return (
    <>
      <div className="mt-5 overflow-x-auto rounded-card-lg border border-line">
        <table className="w-full min-w-160 border-collapse text-left">
          <thead>
            <tr className="bg-light">
              {head.map((h, i) => (
                <th
                  key={h + i}
                  scope="col"
                  className={`px-4 py-3 text-caption-lg font-semibold text-dark ${i > 0 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? "bg-[#FAFBFC]" : "bg-white"}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={
                      ci === 0
                        ? "px-4 py-3 text-caption-lg text-dark"
                        : "tnum whitespace-nowrap px-4 py-3 text-right text-caption-lg font-semibold text-black"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-3 text-caption text-grey">{note}</p>}
    </>
  );
}
