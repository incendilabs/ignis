# UI Components

A library of reusable UI components built with React Aria and Tailwind CSS.

## Structure

Each component has its own folder with the following structure:

```text
ui/
├── button/
│   ├── button.tsx      # Component logic
│   └── index.ts        # Exports
├── navbar/
│   ├── navbar.tsx
│   └── index.ts
├── text-field/
│   ├── text-field.tsx
│   └── index.ts
├── dialog/
│   ├── dialog.tsx
│   └── index.ts
├── select/
│   ├── select.tsx
│   └── index.ts
├── grid/
│   ├── grid.tsx
│   └── index.ts
├── link-card/
│   ├── link-card.tsx
│   └── index.ts
└── index.ts            # Main export for all components
```

This makes it easy to add tests, variants, and other related files later.
