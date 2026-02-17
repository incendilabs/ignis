import { type ReactNode } from "react";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface HeadingProps {
  as?: HeadingLevel;
  children: ReactNode;
  className?: string;
}

const styles: Record<HeadingLevel, string> = {
  h1: "text-4xl font-bold text-gray-900 dark:text-white",
  h2: "text-2xl font-semibold text-gray-900 dark:text-white",
  h3: "text-xl font-semibold text-gray-900 dark:text-white",
  h4: "text-lg font-semibold text-gray-900 dark:text-white",
  h5: "text-base font-semibold text-gray-900 dark:text-white",
  h6: "text-sm font-semibold text-gray-900 dark:text-white",
};

export function Heading({ as: level = "h1", children, className = "" }: HeadingProps) {
  const Component = level;
  const baseStyles = styles[level];
  
  return (
    <Component className={`${baseStyles} ${className}`.trim()}>
      {children}
    </Component>
  );
}
