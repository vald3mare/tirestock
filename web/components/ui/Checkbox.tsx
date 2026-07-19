import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

// Checkbox: 20×20, radius 5, бордер line 1.5. Всё подписано — label обязателен.
// Строка-label даёт тач-таргет ≥44px.
export function Checkbox({ label, className = "", ...props }: Props) {
  return (
    <label
      className={
        "flex min-h-touch cursor-pointer select-none items-center gap-2.5 text-field text-dark " +
        "has-disabled:cursor-not-allowed has-disabled:text-grey " +
        className
      }
    >
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className={
            "peer size-5 appearance-none rounded-checkbox border-[1.5px] border-line bg-white " +
            "transition-colors checked:border-blue checked:bg-blue hover:border-grey checked:hover:border-blue " +
            "disabled:bg-light"
          }
          {...props}
        />
        <svg
          className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2 6.5L4.8 9L10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </label>
  );
}
