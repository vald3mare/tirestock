import type { ComponentPropsWithRef } from "react";

// ComponentPropsWithRef, а не InputHTMLAttributes: в React 19 ref — обычный проп,
// и модалке обратного звонка нужно ставить фокус в первое поле при открытии.
type Props = ComponentPropsWithRef<"input"> & {
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
