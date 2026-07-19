import type { ButtonHTMLAttributes } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

// Button/Primary: blue, radius 10, px40 py14, 16 SemiBold white, hover темнее ~8%.
// Button/Secondary: white, бордер line, текст dark.
// size="sm" — CTA в карточке товара (py10). Для ссылок-кнопок — ButtonLink.
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: Props) {
  const disabledClasses =
    "disabled:cursor-not-allowed disabled:opacity-50 " +
    (variant === "primary" ? "disabled:hover:bg-blue" : "disabled:hover:border-line");
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, `${disabledClasses} ${className}`)}
      {...props}
    />
  );
}
