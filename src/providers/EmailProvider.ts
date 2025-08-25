import nodemailer, { Transporter } from 'nodemailer';
import nodemailerSendgrid from 'nodemailer-sendgrid';
interface EmailTestResult {
  success: boolean;
  message: string;
}

/**
 * Provider for sending email notifications
 */
export class EmailProvider {
  private transporter: Transporter | null = null;

  constructor() {
    this.setupTransporter();
  }

  private setupTransporter(): void {
    const apiKey = process.env.SENDGRID_API_KEY;

    // If no email configuration, create a test account for development
    if (!apiKey) {
      console.warn('⚠️  No email configuration found. Email notifications will be logged to console.');
      this.transporter = null;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport(
        nodemailerSendgrid({ apiKey })
      );
      console.log('✅ Email service configured');
    } catch (error) {
      console.error('❌ Failed to setup email service:', error);
      this.transporter = null;
    }
  }

  /**
   * Send authorization needed email
   */
  async sendAuthorizationNeededEmail(userEmail: string, unauthorizedServers: string[]): Promise<void> {
    const subject = 'Authorization Required - AI Coding Agent';
    const htmlContent = this.buildAuthorizationEmailHTML(unauthorizedServers);
    const textContent = this.buildAuthorizationEmailText(unauthorizedServers);

    await this.sendEmail(userEmail, subject, textContent, htmlContent);
  }

  /**
   * Build HTML email content for authorization needed
   */
  private buildAuthorizationEmailHTML(unauthorizedServers: string[]): string {
    const serverList = unauthorizedServers.map(server => 
      `<li><strong>${server}</strong></li>`
    ).join('');

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f4f4f4; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .server-list { background: #f9f9f9; padding: 15px; border-left: 4px solid #007cba; }
            .cta { text-align: center; margin: 30px 0; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #007cba; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Authorization Required</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>A prompt was attempted to run but requires authorization for the following MCP services:</p>
              <div class="server-list">
                <ul>
                  ${serverList}
                </ul>
              </div>
              <p>Please return to the AI Coding Agent dashboard to authorize these services before the prompt can be executed.</p>
              <div class="cta">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}" class="button">
                  Go to Dashboard
                </a>
              </div>
              <p>Best regards,<br>Your AI Coding Agent</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Build text email content for authorization needed
   */
  private buildAuthorizationEmailText(unauthorizedServers: string[]): string {
    const serverList = unauthorizedServers.map(server => `- ${server}`).join('\n');

    return `
Authorization Required - AI Coding Agent

Hello,

A prompt was attempted to run but requires authorization for the following MCP services:

${serverList}

Please return to the AI Coding Agent dashboard to authorize these services before the prompt can be executed.

Dashboard: ${process.env.BASE_URL || 'http://localhost:3000'}

Best regards,
Your AI Coding Agent
    `.trim();
  }

  /**
   * Send magic login link email
   */
  async sendMagicLoginEmail(email: string, magicToken: string): Promise<void> {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const loginUrl = `${baseUrl}/auth/login?token=${magicToken}`;
    
    const subject = 'Login to AI Coding Agent';
    const htmlContent = this.buildMagicLoginEmailHTML(loginUrl);
    const textContent = this.buildMagicLoginEmailText(loginUrl);

    await this.sendEmail(email, subject, textContent, htmlContent);
  }

  /**
   * Build HTML email content for magic login
   */
  private buildMagicLoginEmailHTML(loginUrl: string): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f4f4f4; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .login-box { background: #f9f9f9; padding: 20px; border-left: 4px solid #007cba; margin: 20px 0; }
            .cta { text-align: center; margin: 30px 0; }
            .button { 
              display: inline-block; 
              padding: 15px 30px; 
              background: #007cba; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: bold;
            }
            .warning { color: #666; font-size: 14px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔑 Login to AI Coding Agent</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Click the button below to securely log into your AI Coding Agent dashboard:</p>
              
              <div class="cta">
                <a href="${loginUrl}" class="button">
                  🚀 Login to Dashboard
                </a>
              </div>
              
              <div class="login-box">
                <p><strong>🔐 Security Notice:</strong></p>
                <ul>
                  <li>This link will expire in 15 minutes</li>
                  <li>The link can only be used once</li>
                  <li>If you didn't request this login, you can safely ignore this email</li>
                </ul>
              </div>
              
              <p class="warning">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${loginUrl}">${loginUrl}</a>
              </p>
              
              <p>Best regards,<br>Your AI Coding Agent</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Build text email content for magic login
   */
  private buildMagicLoginEmailText(loginUrl: string): string {
    return `
Login to AI Coding Agent

Hello,

Click the link below to securely log into your AI Coding Agent dashboard:

${loginUrl}

Security Notice:
- This link will expire in 15 minutes
- The link can only be used once  
- If you didn't request this login, you can safely ignore this email

Best regards,
Your AI Coding Agent
    `.trim();
  }

  /**
   * Send email notification
   */
  async sendEmail(to: string, subject: string, text: string, html: string): Promise<any> {
    if (!this.transporter) {
      // Log to console if no email configuration
      console.log('\n📧 EMAIL NOTIFICATION (would be sent to:', to, ')');
      console.log('Subject:', subject);
      console.log('Content:');
      console.log(text);
      console.log('---\n');
      return;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        text,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result[0].statusMessage);
      return result;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      // Fallback to console logging
      console.log('\n📧 EMAIL NOTIFICATION (failed to send, logging instead):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Content:');
      console.log(text);
      console.log('---\n');
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<EmailTestResult> {
    if (!this.transporter) {
      return { success: false, message: 'No email configuration found' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }
}
