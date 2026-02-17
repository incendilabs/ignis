# Ignis.Web

Frontend for Ignis - a FHIR experimentation platform.

## Tech Stack

- React Router 7
- Tailwind CSS v4
- React Aria Components
- TypeScript

## Development

```bash
npm install
npm run dev
```

Runs at `http://localhost:5202`

## UI Components

All components are in [`app/ui/`](app/ui/). Import with `@/ui/component`:

```tsx
import { Button } from "@/ui/button";
import { Heading } from "@/ui/heading";
```

See [`app/ui/README.md`](app/ui/README.md) for component documentation.

