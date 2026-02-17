import { type ReactNode } from "react";

interface HeaderProps {
  children: ReactNode;
  className?: string;
}

export function Header({ children, className = "" }: HeaderProps) {
  return (
    <header className={className}>
      {children}
    </header>
  );
}
