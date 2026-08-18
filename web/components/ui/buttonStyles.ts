// Общие классы Button — используются и <button> (Button), и <a> (ButtonLink),
// чтобы кнопки-ссылки не расходились со спекой Button из DESIGN_SYSTEM.md.

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "sm";

// Анимация кнопок: плавный цвет + лёгкое «нажатие» (scale). Анимируем только
// конкретные свойства (не transition:all). Фокус — глобальный :focus-visible
// (globals.css), prefers-reduced-motion там же глушит все transition.
const base =
  "inline-flex min-h-touch cursor-pointer select-none items-center justify-center gap-2 " +
  "rounded-field text-nav " +
  "transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out " +
  "active:scale-[0.97]";

const sizes: Record<ButtonSize, string> = {
  md: "px-10 py-3.5",
  sm: "px-5 py-2.5",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-blue text-white hover:bg-blue-hover",
  secondary: "border border-line bg-white text-dark hover:border-grey",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}
