import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "")
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD", "")

def send_email(to_email, subject, html_body, text_body=None):
    """
    Send an email with HTML content
    """
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SENDER_EMAIL
        msg['To'] = to_email
        
        # Add text version if provided
        if text_body:
            part1 = MIMEText(text_body, 'plain')
            msg.attach(part1)
        
        # Add HTML version
        part2 = MIMEText(html_body, 'html')
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        return True, "Email sent successfully"
    except Exception as e:
        return False, f"Failed to send email: {e}"

def send_welcome_email(user_email, username):
    """Send welcome email after successful account creation"""
    subject = "Welcome to AI Meeting Agent! 🎉"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #000000; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 20px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }}
            .content {{ padding: 40px 30px; color: #ffffff; }}
            .button {{ display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: bold; margin: 20px 0; }}
            .feature {{ background: #2a2a2a; padding: 20px; margin: 15px 0; border-radius: 10px; border-left: 4px solid #667eea; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; color: white; font-size: 32px;">Welcome to AI Meeting Agent!</h1>
                <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">Your intelligent meeting companion</p>
            </div>
            <div class="content">
                <h2 style="color: #667eea;">Hi {username}! 👋</h2>
                <p>Thank you for creating your account. You're now ready to transform your meetings with AI-powered insights!</p>
                
                <div class="feature">
                    <h3 style="color: #667eea; margin-top: 0;">🤖 AI Analysis</h3>
                    <p>Get intelligent summaries, decisions, and action items from your meeting transcripts.</p>
                </div>
                
                <div class="feature">
                    <h3 style="color: #667eea; margin-top: 0;">📋 Trello Integration</h3>
                    <p>Automatically create Trello cards for action items with assignees and due dates.</p>
                </div>
                
                <div class="feature">
                    <h3 style="color: #667eea; margin-top: 0;">👥 Team Collaboration</h3>
                    <p>Create teams and share meeting insights with your colleagues.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="#" class="button">Start Your First Analysis</a>
                </div>
                
                <p style="color: #888; font-size: 14px; margin-top: 30px;">
                    Need help? Reply to this email or check our documentation for getting started tips.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_body = f"""
    Welcome to AI Meeting Agent!
    
    Hi {username}!
    
    Thank you for creating your account. You're now ready to transform your meetings with AI-powered insights!
    
    Features available to you:
    - AI Analysis: Get intelligent summaries, decisions, and action items
    - Trello Integration: Automatically create cards for action items
    - Team Collaboration: Share insights with your colleagues
    
    Get started by uploading your first meeting transcript!
    
    Need help? Reply to this email for support.
    """
    
    return send_email(user_email, subject, html_body, text_body)

def send_integration_success_email(user_email, username, integration_name):
    """Send email after successful integration"""
    subject = f"{integration_name} Integration Successful! ✅"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #000000; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 20px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; }}
            .content {{ padding: 40px 30px; color: #ffffff; }}
            .success-icon {{ font-size: 48px; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="success-icon">✅</div>
                <h1 style="margin: 0; color: white; font-size: 28px;">{integration_name} Connected!</h1>
            </div>
            <div class="content">
                <h2 style="color: #10b981;">Great news, {username}!</h2>
                <p>Your {integration_name} integration has been successfully set up. You can now:</p>
                
                <ul style="color: #e5e5e5; line-height: 1.6;">
                    <li>Automatically create {integration_name.lower()} items from meeting action items</li>
                    <li>Keep your workflow synchronized with AI Meeting Agent</li>
                    <li>Save time on manual task creation</li>
                </ul>
                
                <p>Start your next meeting analysis and watch the magic happen!</p>
                
                <p style="color: #888; font-size: 14px; margin-top: 30px;">
                    You can manage your integrations anytime from your account settings.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(user_email, subject, html_body)

def send_password_reset_email(user_email, username, otp_code):
    """Send password reset email with OTP"""
    subject = "Password Reset Code - AI Meeting Agent 🔐"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #000000; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 20px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center; }}
            .content {{ padding: 40px 30px; color: #ffffff; text-align: center; }}
            .otp-code {{ font-size: 36px; font-weight: bold; background: #2a2a2a; padding: 20px; border-radius: 10px; letter-spacing: 8px; color: #f59e0b; margin: 20px 0; }}
            .warning {{ background: #fef3c7; color: #92400e; padding: 15px; border-radius: 10px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; color: white; font-size: 28px;">Password Reset Request</h1>
                <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9);">🔐 Secure verification code</p>
            </div>
            <div class="content">
                <h2 style="color: #f59e0b;">Hi {username},</h2>
                <p>You requested to reset your password. Use the verification code below:</p>
                
                <div class="otp-code">{otp_code}</div>
                
                <p><strong>This code expires in 15 minutes.</strong></p>
                
                <div class="warning">
                    <strong>Security Note:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure.
                </div>
                
                <p style="color: #888; font-size: 14px; margin-top: 30px;">
                    Enter this code in the password reset form to continue with changing your password.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_body = f"""
    Password Reset Code - AI Meeting Agent
    
    Hi {username},
    
    You requested to reset your password. Use this verification code:
    
    {otp_code}
    
    This code expires in 15 minutes.
    
    If you didn't request this password reset, please ignore this email.
    """
    
    return send_email(user_email, subject, html_body, text_body)

def send_email_verification(user_email, username, otp_code):
    """Send email verification OTP after account creation"""
    subject = "Verify Your Email - AI Meeting Agent"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #000000; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 20px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 20px; text-align: center; }}
            .content {{ padding: 40px 30px; color: #ffffff; }}
            .otp-code {{ background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 30px 0; border-radius: 15px; letter-spacing: 8px; font-family: 'Courier New', monospace; }}
            .feature {{ display: flex; align-items: center; margin: 20px 0; }}
            .feature-icon {{ width: 24px; height: 24px; margin-right: 12px; }}
            .footer {{ background-color: #111111; padding: 30px; text-align: center; color: #666666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; color: white; font-size: 28px;">🔐 Verify Your Email</h1>
                <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9);">Complete your AI Meeting Agent registration</p>
            </div>
            
            <div class="content">
                <p style="font-size: 18px; margin-bottom: 10px;">Hi <strong>{username}</strong>!</p>
                
                <p style="color: #cccccc; line-height: 1.6; margin-bottom: 30px;">
                    Thanks for signing up with AI Meeting Agent! To complete your registration and secure your account, 
                    please verify your email address using the code below.
                </p>
                
                <div class="otp-code">
                    {otp_code}
                </div>
                
                <p style="color: #cccccc; line-height: 1.6; text-align: center; margin-bottom: 30px;">
                    <strong>This code expires in 30 minutes.</strong><br>
                    Enter this code on the verification page to activate your account.
                </p>
                
                <div style="border: 2px solid #374151; border-radius: 12px; padding: 20px; margin: 30px 0; background-color: #111111;">
                    <h3 style="color: #f59e0b; margin-top: 0; font-size: 16px;">⚠️ Security Notice</h3>
                    <ul style="color: #cccccc; line-height: 1.6; padding-left: 20px;">
                        <li>Never share this verification code with anyone</li>
                        <li>We will never ask for this code via phone or email</li>
                        <li>If you didn't create this account, please ignore this email</li>
                    </ul>
                </div>
            </div>
            
            <div class="footer">
                <p>AI Meeting Agent Team<br>
                Transforming meetings with AI-powered insights</p>
                <p style="margin-top: 20px; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_body = f"""
    Verify Your Email - AI Meeting Agent
    
    Hi {username}!
    
    Thanks for signing up with AI Meeting Agent! To complete your registration, 
    please use this verification code:
    
    {otp_code}
    
    This code expires in 30 minutes.
    
    Security Notice:
    - Never share this code with anyone
    - We will never ask for this code via phone or email
    - If you didn't create this account, please ignore this email
    
    AI Meeting Agent Team
    """
    
    return send_email(user_email, subject, html_body, text_body)
