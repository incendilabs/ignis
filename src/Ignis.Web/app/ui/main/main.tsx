import { type ReactNode } from "react";

interface MainProps {
  children: ReactNode;
  className?: string;
}

export function Main({ children, className = "" }: MainProps) {
  return (
    <main className={`py-16 ${className}`.trim()}>
      {children}
    </main>
  );
}
