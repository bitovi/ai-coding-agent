# Public Assets Directory

This directory contains static assets served by the AI Coding Agent web interface.

## Directory Structure

```
public/
├── css/
│   └── styles.css          # Main stylesheet for the dashboard
├── js/
│   └── dashboard.js        # Interactive JavaScript functionality
├── favicon.svg             # Site favicon (robot icon)
└── README.md              # This file
```

## Files

### CSS (`css/styles.css`)
- Complete styling for the web dashboard
- Responsive design with mobile support
- Clean, modern interface design
- Color scheme based on flat design principles

### JavaScript (`js/dashboard.js`)
- Interactive functionality for the dashboard
- OAuth authorization flow handling
- Prompt execution interface
- Real-time notification system
- Keyboard shortcuts and UX enhancements

### Favicon (`favicon.svg`)
- Simple robot-themed SVG icon
- Scalable vector format for crisp display
- Blue color scheme matching the dashboard

## Usage

These files are automatically served by Express.js from the `/static` route:

- CSS: `http://localhost:3000/static/css/styles.css`
- JS: `http://localhost:3000/static/js/dashboard.js`
- Favicon: `http://localhost:3000/static/favicon.svg`

## Development

When making changes to these files:

1. **CSS Changes**: Will be reflected immediately on page refresh
2. **JavaScript Changes**: May require a hard refresh (Ctrl+F5) to bypass cache
3. **Adding New Files**: Place them in the appropriate subdirectory

## Asset Organization

- **CSS**: Keep styles modular and well-commented
- **JavaScript**: Use modern ES6+ features, maintain separation of concerns
- **Images**: Store in `images/` subdirectory if needed
- **Fonts**: Store in `fonts/` subdirectory if custom fonts are added

The current setup provides a clean separation between server-side rendering (HTML templates) and client-side assets (CSS/JS), following modern web development best practices.
