# Public Assets Directory

This directory contains static assets served by the AI Coding Agent.

## Directory Structure

```
public/
├── js/
│   └── prompt-utils.js     # Shared prompt processing utilities
├── favicon.svg             # Site favicon (robot icon)
└── README.md              # This file
```

## Files

### JavaScript (`js/prompt-utils.js`)
- Shared utilities for prompt parameter processing
- Used by both backend services and frontend components
- Functions for merging parameters, processing prompts, and validation

### Favicon (`favicon.svg`)
- Simple robot-themed SVG icon
- Scalable vector format for crisp display
- Blue color scheme matching the application theme

## Usage

These files are automatically served by Express.js from the `/static` route:

- Utilities: `http://localhost:3000/static/js/prompt-utils.js`
- Favicon: `http://localhost:3000/static/favicon.svg`

Note: The main web interface is now a React SPA served from the frontend build.

## Development

When making changes to prompt-utils.js:
- Changes will be reflected immediately in backend services on restart
- Frontend may require rebuilding if importing these utilities
3. **Adding New Files**: Place them in the appropriate subdirectory

## Asset Organization

- **CSS**: Keep styles modular and well-commented
- **JavaScript**: Use modern ES6+ features, maintain separation of concerns
- **Images**: Store in `images/` subdirectory if needed
- **Fonts**: Store in `fonts/` subdirectory if custom fonts are added

The current setup provides a clean separation between server-side rendering (HTML templates) and client-side assets (CSS/JS), following modern web development best practices.
