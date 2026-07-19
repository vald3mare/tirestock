import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

// Tab: active — blue bg / white text; inactive — white bg / grey text; px20 py10, radius 10.
// Табы поиска/каталога; состояние живёт в URL, компонент — тупой.
export function Tab({ active = false, className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={active}
      className={
        "inline-flex min-h-touch cursor-pointer items-center rounded-field px-5 py-2.5 text-nav transition-colors " +
        (active ? "bg-blue text-white " : "bg-white text-grey hover:text-dark ") +
        className
      }
      {...props}
    />
  );
}
