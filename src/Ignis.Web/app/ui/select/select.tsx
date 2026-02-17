import {
  Select as AriaSelect,
  Label,
  Button,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
  type SelectProps as AriaSelectProps,
} from "react-aria-components";

interface SelectProps<T extends object>
  extends Omit<AriaSelectProps<T>, "children"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  items?: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
  className?: string;
}

export function Select<T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  className = "",
  ...props
}: SelectProps<T>) {
  return (
    <AriaSelect
      {...props}
      className={`flex flex-col gap-1 ${className}`}
      isInvalid={!!errorMessage}
    >
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
      )}
      <Button className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
        <SelectValue />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
          />
        </svg>
      </Button>
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
      <Popover className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
        <ListBox
          items={items}
          className="outline-none p-1"
        >
          {children}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

export { ListBoxItem as SelectItem };
