type Season = "summer" | "winter" | "allseason";

const labels: Record<Season, string> = {
  summer: "Лето",
  winter: "Зима",
  allseason: "Всесезонные",
};

function SunIcon() {
  return (
    <svg className="size-3.5 text-sun" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="3" fill="currentColor" />
      <path
        d="M7 .8v1.7M7 11.5v1.7M.8 7h1.7M11.5 7h1.7M2.6 2.6l1.2 1.2M10.2 10.2l1.2 1.2M2.6 11.4l1.2-1.2M10.2 3.8l1.2-1.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg className="size-3.5 text-blue" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1v12M1.8 4l10.4 6M1.8 10L12.2 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const icons: Record<Season, () => React.ReactNode> = {
  summer: SunIcon,
  winter: SnowIcon,
  allseason: () => (
    <span className="flex items-center gap-0.5">
      <SunIcon />
      <SnowIcon />
    </span>
  ),
};

// Badge/Season: white + бордер line, radius 6, иконка 14px + текст 12.
export function SeasonBadge({ season, spikes = false }: { season: Season; spikes?: boolean }) {
  const Icon = icons[season];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-badge border border-line bg-white px-2 py-1 text-legal text-dark">
      <Icon />
      {labels[season]}
      {season === "winter" && (spikes ? ", шипы" : ", липучка")}
    </span>
  );
}
