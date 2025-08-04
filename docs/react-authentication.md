# React Authentication Implementation

This document describes the authentication system implemented in the React frontend.

## Overview

The React app now handles authentication entirely on the frontend, with the following behavior:
- Unauthenticated users are shown the login page
- Authenticated users can access the dashboard and other protected routes
- The login system uses the same magic link authentication as the original HTML interface

## Components

### 1. Authentication Hook (`src/hooks/useAuth.ts`)

- **`useAuth()`**: Checks authentication status by calling `/api/user`
- **`useRequestLogin()`**: Sends magic link to provided email
- **`useLogout()`**: Logs out the user and redirects to login

### 2. Login Component (`src/components/auth/Login.tsx`)

- Clean, modern login form with email input
- Shows success/error messages
- Handles loading states
- Styled with Tailwind CSS and shadcn/ui components

### 3. AuthGuard Component (`src/components/auth/AuthGuard.tsx`)

- Protects routes that require authentication
- Shows loading state while checking auth
- Redirects to login if not authenticated
- Can accept a custom fallback component

## Routes

The React app now handles all main routes:

- **`/login`** - Login page (public)
- **`/`** - Dashboard (protected)
- **`/prompts/:promptName/activity`** - Prompt activity page (protected)

## Backend Changes

### Removed Routes
- `GET /` - Now handled by React
- `GET /login` - Now handled by React (moved to `/login-static` for API access)
- `GET /prompts/:promptName/activity.html` - Now redirects to React route

### Modified Routes
- All routes now serve the React app unless they match API patterns
- SPA fallback serves React `index.html` for all unmatched routes

## Authentication Flow

### 1. Initial Load
```
User visits any route
↓
AuthGuard checks authentication via /api/user
↓
If authenticated: Show protected content
If not authenticated: Show login page
```

### 2. Login Process
```
User enters email on login page
↓
POST /auth/request-login
↓
Magic link sent to email
↓
User clicks link (goes to /auth/login?token=...)
↓
Backend validates token and sets session
↓
Redirects to React app
↓
AuthGuard detects authentication and shows protected content
```

### 3. Logout Process
```
User clicks logout button
↓
POST /auth/logout
↓
Session cleared
↓
Redirect to /login
```

## Development vs Production

- **Development**: React dev server runs on :5173, proxies API calls to :3000
- **Production**: Integrated server on :3000 serves both React app and API

## Testing the Implementation

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Visit http://localhost:3000**:
   - Should show login page if not authenticated
   - Should show dashboard if authenticated

3. **Test login**:
   - Enter email address
   - Check for success message
   - Check email for magic link
   - Click magic link to authenticate

4. **Test protected routes**:
   - Visit `/prompts/example/activity` while not logged in
   - Should redirect to login
   - After login, should show the prompt activity page

## File Structure

```
frontend/src/
├── components/
│   ├── auth/
│   │   ├── Login.tsx              # Login form component
│   │   └── AuthGuard.tsx          # Route protection
│   ├── dashboard/
│   │   └── Dashboard.tsx          # Updated to use useAuth
│   └── layout/
│       └── Layout.tsx             # Updated logout button
├── hooks/
│   └── useAuth.ts                 # Authentication hooks
└── App.tsx                        # Updated with auth routes
```

## Backend Integration

The React app integrates seamlessly with the existing backend:
- Uses existing `/api/user` endpoint for auth checks
- Uses existing `/auth/request-login` for magic links
- Uses existing `/auth/logout` for logout
- All existing API endpoints work unchanged
