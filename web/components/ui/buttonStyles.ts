// Общие классы Button — используются и <button> (Button), и <a> (ButtonLink),
// чтобы кнопки-ссылки не расходились со спекой Button из DESIGN_SYSTEM.md.

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex min-h-touch cursor-pointer items-center justify-center gap-2 " +
  "rounded-field text-nav transition-colors";

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
