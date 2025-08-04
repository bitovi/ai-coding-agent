# Frontend Integration Setup

This document describes how the frontend is integrated with the backend to serve a single application.

## How it works

1. **Frontend Build**: The React frontend is built using Vite and outputs to `frontend/dist/`
2. **Backend Serving**: The Express backend serves the built frontend files and handles React Router routes
3. **API Routes**: All API routes are preserved under `/api/`, `/auth/`, `/mcp/`, etc.
4. **SPA Fallback**: Any route that doesn't match an API endpoint serves the React app's `index.html`

## Development vs Production

### Development Mode
- Frontend: Run `npm run dev:frontend` (serves on :5173 with proxy to backend)
- Backend: Run `npm run dev` (serves on :3000)
- Use: `npm run dev:all` to run both simultaneously

### Production Mode
1. Build: `npm run build` (builds frontend then backend)
2. Start: `npm start` (serves integrated app on :3000)
3. Or use: `npm run start:prod` (builds and starts in one command)

## Routes Handled

### Backend API Routes (always served by Express)
- `/api/*` - Web client API endpoints
- `/auth/*` - Authentication endpoints
- `/mcp/*` - MCP server routes
- `/oauth/*` - OAuth callback routes
- `/prompt/*` - Prompt execution routes
- `/static/*` - Static assets from public directory
- `/assets/*` - Built frontend assets
- `/health` - Health check
- `/login` - Login page

### Frontend Routes (served by React Router)
- `/` - Dashboard
- `/prompts/:promptName/activity` - Prompt activity page
- Any other route - Falls back to React Router

## File Structure

```
/
├── frontend/
│   ├── dist/           # Built frontend (created by npm run build:frontend)
│   │   ├── assets/     # JS/CSS bundles
│   │   └── index.html  # Main HTML file
│   └── src/            # Frontend source code
├── public/             # Backend static assets (served under /static/)
└── index.ts            # Backend entry point
```

## VS Code Tasks

- **Build Full Application**: Builds both frontend and backend
- **Start Production Server**: Builds and starts the production server
- **Start Development Server**: Starts backend in dev mode
- Use Ctrl/Cmd+Shift+P → "Tasks: Run Task" to access these

## Docker

The Dockerfile has been updated to:
1. Install both backend and frontend dependencies
2. Build the frontend
3. Build the backend
4. Serve the integrated application

## Troubleshooting

### Route conflicts
If a new backend route conflicts with a frontend route, add it to the exclusion list in the catch-all route handler in `index.ts`.

### Assets not loading
Check that:
1. Frontend built successfully with `npm run build:frontend`
2. Assets are in `frontend/dist/assets/`
3. Backend is serving `/assets/*` correctly

### 404 on refresh
This is expected behavior for SPA routes. The backend catch-all handler should serve `index.html` for any non-API route, allowing React Router to handle the routing.
