import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";

interface ButtonProps extends AriaButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600",
    secondary:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
    ghost:
      "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-500 dark:hover:bg-gray-800 dark:text-gray-300",
  };

  return (
    <AriaButton
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </AriaButton>
  );
}
