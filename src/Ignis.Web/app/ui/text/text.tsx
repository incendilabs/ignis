import { type ReactNode } from "react";

type TextVariant = "body" | "lead" | "small" | "muted";

interface TextProps {
  children: ReactNode;
  variant?: TextVariant;
  className?: string;
}

const styles: Record<TextVariant, string> = {
  body: "text-gray-700 dark:text-gray-300",
  lead: "text-lg text-gray-600 dark:text-gray-400",
  small: "text-sm text-gray-600 dark:text-gray-400",
  muted: "text-gray-500 dark:text-gray-500",
};

export function Text({ children, variant = "body", className = "" }: TextProps) {
  return (
    <p className={`${styles[variant]} ${className}`.trim()}>
      {children}
    </p>
  );
}
