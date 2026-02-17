interface LinkCardProps {
  href: string;
  title: string;
  description?: string;
  external?: boolean;
  className?: string;
}

export function LinkCard({
  href,
  title,
  description,
  external = false,
  className = "",
}: LinkCardProps) {
  const linkProps = external
    ? {
        target: "_blank" as const,
        rel: "noopener noreferrer",
      }
    : {};

  return (
    <a
      href={href}
      {...linkProps}
      className={`block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors ${className}`}
    >
      <div className="font-medium text-gray-900 dark:text-white">{title}</div>
      {description && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {description}
        </div>
      )}
    </a>
  );
}
