import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type Props = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

// Ссылка в виде кнопки (навигация: «Корзина», «Показать ещё», tel:).
// Стили общие с Button — см. buttonStyles.ts.
export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: Props) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
