# Magic Link Authentication System

The AI Coding Agent now supports secure, passwordless "magic link" email authentication. This system provides enhanced security by eliminating the need for exposed access tokens in the frontend while maintaining ease of use.

## How It Works

1. **Email-Based Login**: Users enter their email address on the login page
2. **Magic Link Generation**: A secure, one-time login token is generated and emailed to the user
3. **Secure Login**: Clicking the email link creates a secure session and logs the user in
4. **Session Management**: The system uses secure HTTP-only cookies for session management

## Key Security Features

- **No Frontend Token Exposure**: Access tokens are never exposed to the browser
- **Session-Based Authentication**: Uses secure, HTTP-only cookies 
- **One-Time Magic Links**: Login links expire after 15 minutes and can only be used once
- **Email Authorization**: Only configured email addresses can access the system
- **Automatic Session Management**: 24-hour session timeout with automatic renewal

## Configuration

### Environment Variables

```bash
# Authorized email addresses (comma-separated)
AUTHORIZED_EMAILS=user1@example.com,user2@example.com

# Email configuration for sending magic links
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=AI Coding Agent <your-email@gmail.com>

# Base URL for magic link generation
BASE_URL=http://localhost:3000
```

### Development Mode

If no `AUTHORIZED_EMAILS` is configured, the system allows any email address (for development only). In production, always configure specific authorized emails.

## Authentication Flow

### 1. Protected Dashboard Access
- **Unauthenticated users**: Automatically redirected to `/login`
- **Dashboard content**: Only visible to authenticated users
- **User information**: Displays logged-in user's email and logout button
- **Session persistence**: Users remain logged in for 24 hours with automatic renewal

### 2. Login Process
- Navigate to `/login` (or get redirected there)
- Enter your email address
- Check your email for the magic link
- Click the link to authenticate and access the dashboard

### 3. Session Management
- Sessions last 24 hours
- Automatic renewal on activity
- Secure logout functionality with user feedback
- Session validation on all protected routes

### 3. API Access
- Frontend uses session cookies automatically
- Legacy ACCESS_TOKEN still supported for API access
- Session-based auth takes precedence

## Usage Examples

### Frontend Usage
```javascript
// All API calls now use session cookies automatically
fetch('/prompt/my-prompt/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // Include session cookies
    body: JSON.stringify({ parameters: {} })
});
```

### Logout
```javascript
// Logout and clear session
fetch('/auth/logout', {
    method: 'POST',
    credentials: 'same-origin'
});
```

## Security Improvements

1. **Eliminated Frontend Token Exposure**: No more access tokens in browser JavaScript
2. **Secure Session Cookies**: HTTP-only, secure, SameSite protection
3. **Time-Limited Magic Links**: 15-minute expiration prevents replay attacks
4. **One-Time Use**: Magic links become invalid after first use
5. **Email-Based Authorization**: Only whitelisted emails can access the system

## Email Templates

The system includes beautifully formatted HTML and text email templates for magic links with:
- Clear security notices
- Professional branding
- Responsive design
- Fallback plain text versions

## Backward Compatibility

The system maintains backward compatibility with the existing ACCESS_TOKEN system:
- API clients can still use Bearer tokens
- Session authentication takes precedence when available
- Gradual migration path for existing integrations

## Development and Testing

During development, magic link emails are logged to the console if no email configuration is provided:

```
📧 EMAIL NOTIFICATION (would be sent to: user@example.com)
Subject: Login to AI Coding Agent
Content: [magic link content]
```

## Deployment Considerations

1. **Email Service**: Configure a reliable SMTP service (Gmail, SendGrid, etc.)
2. **HTTPS**: Use HTTPS in production for secure cookies
3. **Session Storage**: Consider Redis for session storage in multi-instance deployments
4. **Rate Limiting**: Implement rate limiting for magic link requests

This implementation provides enterprise-grade security while maintaining the simplicity and ease of use that makes the AI Coding Agent accessible to all users.

## Dashboard Security Features

### Protected Content
- **Authentication Required**: Dashboard content is only visible to authenticated users
- **Automatic Redirects**: Unauthenticated users are automatically redirected to login
- **User Context**: Dashboard displays the logged-in user's email address
- **Integrated Logout**: Logout button prominently displayed in the dashboard header

### Session Indicators
- **User Email Display**: Shows which user is currently logged in
- **Session Status**: Clear visual indicators of authentication state
- **Logout Confirmation**: User feedback during logout process
- **Login Success**: Welcome message upon successful authentication
