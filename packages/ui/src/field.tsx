import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("adb-field", className)}>
      {label ? <span className="adb-field-label">{label}</span> : null}
      {children}
      {error ? <span className="adb-field-error">{error}</span> : hint ? <span className="adb-field-hint">{hint}</span> : null}
    </div>
  );
}

export function Input({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cn("adb-input", error && "adb-input-error", className)} {...props} />;
}

export function TextArea({
  className,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cn("adb-input", error && "adb-input-error", className)} {...props} />;
}

/** Native select — arama için `SearchableSelect` kullanın. */
export function Select({
  className,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select className={cn("adb-input adb-select-native", error && "adb-input-error", className)} {...props}>
      {children}
    </select>
  );
}

export function InputGroup({
  prefix,
  suffix,
  children,
  className,
}: {
  prefix?: ReactNode;
  suffix?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("adb-input-group", className)}>
      {prefix ? <span className="adb-input-affix">{prefix}</span> : null}
      {children}
      {suffix ? <span className="adb-input-affix">{suffix}</span> : null}
    </div>
  );
}
