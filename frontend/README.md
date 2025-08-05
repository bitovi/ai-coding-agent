# AI Coding Agent Frontend

A modern React frontend built with Vite, TypeScript, and shadcn/ui for the AI Coding Agent.

## Features

- ⚡ **Vite** - Fast build tool and dev server
- ⚛️ **React 18** - Modern React with hooks
- 🔧 **TypeScript** - Type-safe development
- 🎨 **shadcn/ui** - Beautiful, accessible UI components
- 🎯 **Tailwind CSS** - Utility-first CSS framework

## Development

### Prerequisites

Make sure you have Node.js 18+ installed.

### Installation

```bash
# Install dependencies
npm install
```

### Running the Development Server

```bash
# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173` with proxy configuration to forward API requests to the backend at `http://localhost:3000`.

### Building for Production

```bash
# Build for production
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   └── ui/          # shadcn/ui components
├── lib/
│   └── utils.ts     # Utility functions
├── App.tsx          # Main application component
├── main.tsx         # Application entry point
└── index.css        # Global styles with Tailwind
```

## API Integration

The frontend is configured to proxy API requests to the backend:

- `/api/*` → `http://localhost:3000/api/*`
- `/auth/*` → `http://localhost:3000/auth/*`
- `/mcp/*` → `http://localhost:3000/mcp/*`
- `/prompt/*` → `http://localhost:3000/prompt/*`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Adding shadcn/ui Components

To add new shadcn/ui components:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
# etc...
```

Components will be added to `src/components/ui/`.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
