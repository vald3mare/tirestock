import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

// Chip: white, radius 8, px12 py6, 14 Medium.
// Визуально компактный, но кликабельная зона добита до ≥44px невидимым слоем.
export function Chip({ active = false, className = "", type = "button", children, ...props }: Props) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={
        "relative inline-flex cursor-pointer items-center rounded-chip border px-3 py-1.5 text-caption-lg " +
        "transition-colors after:absolute after:left-0 after:right-0 after:top-1/2 " +
        "after:h-touch after:-translate-y-1/2 after:content-[''] " +
        (active
          ? "border-blue bg-blue text-white "
          : "border-line bg-white text-dark hover:border-grey ") +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
