import {
  TextField as AriaTextField,
  Label,
  Input,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";

interface TextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string;
  className?: string;
}

export function TextField({
  label,
  description,
  errorMessage,
  className = "",
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      className={`flex flex-col gap-1 ${className}`}
      {...props}
      isInvalid={!!errorMessage}
    >
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
      )}
      <Input className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" />
      {description && !errorMessage && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </span>
      )}
      {errorMessage && (
        <span className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </span>
      )}
    </AriaTextField>
  );
}
