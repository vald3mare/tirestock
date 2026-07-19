import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

// Field: white, бордер line, radius 10, px20 py14 (высота 52), плейсхолдер grey.
// Плейсхолдеры — с примером и многоточием «…», не инструкция.
export function Field({ label, id, className = "", ...props }: Props) {
  const input = (
    <input
      id={id}
      className={
        "w-full rounded-field border border-line bg-white px-5 py-3.5 text-field text-dark " +
        "placeholder:text-grey hover:border-grey " +
        "disabled:cursor-not-allowed disabled:bg-light disabled:text-grey " +
        className
      }
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-caption text-grey">{label}</span>
      {input}
    </label>
  );
}
