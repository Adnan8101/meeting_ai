import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import sys
import time
import json
import subprocess
import shutil
import html
from dotenv import load_dotenv

# Import lightweight logging helpers
from app_logging import email_logger, log_email_operation, log_error

def _elog(msg: str) -> None:
    """Verbose log to stderr for Vercel Function Logs."""
    print(f"[EMAIL] {msg}", file=sys.stderr, flush=True)

email_logger.info("Email service module loaded")
_elog("Email service module loaded")


# Load .env in this module to avoid import-order issues.
load_dotenv()

GMAIL_USER = os.environ.get("GMAIL_USER", "").strip()
GMAIL_CLIENT_ID = os.environ.get("GMAIL_CLIENT_ID", "").strip()
GMAIL_CLIENT_SECRET = os.environ.get("GMAIL_CLIENT_SECRET", "").strip()
GMAIL_REFRESH_TOKEN = os.environ.get("GMAIL_REFRESH_TOKEN", "").strip()

SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "").strip() or GMAIL_USER
SENDER_PASSWORD = (
        os.environ.get("SENDER_PASSWORD", "").strip()
        or os.environ.get("SENDER_APP_PASSWORD", "").strip()
        or os.environ.get("GMAIL_APP_PASSWORD", "").strip()
)
EMAIL_SMTP_CONFIGURED = bool(SENDER_EMAIL and SENDER_PASSWORD)
EMAIL_OAUTH_CONFIGURED = bool(GMAIL_USER and GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN)
EMAIL_SENDER_CONFIGURED = bool(EMAIL_SMTP_CONFIGURED or EMAIL_OAUTH_CONFIGURED)
APP_URL = os.environ.get("APP_URL", "http://localhost:5001").strip() or "http://localhost:5001"
NODEMAILER_SCRIPT = os.path.join(os.path.dirname(__file__), "frontend", "scripts", "send-email.mjs")

email_logger.info(
        "Email configuration: enabled=%s oauth=%s smtp=%s",
        EMAIL_SENDER_CONFIGURED,
        EMAIL_OAUTH_CONFIGURED,
        EMAIL_SMTP_CONFIGURED,
)


def _safe(value):
        return html.escape(str(value or ""), quote=True)


def _render_email_layout(preheader, title, subtitle, body_html, cta_text=None, cta_url=None):
        cta_block = ""
        if cta_text and cta_url:
                cta_block = f"""
                <tr>
                    <td style=\"padding: 0 40px 36px 40px;\">
                        <a href=\"{_safe(cta_url)}\" style=\"display:inline-block;background:#f5f5f5;color:#0a0a0a;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;\">{_safe(cta_text)}</a>
                    </td>
                </tr>
                """

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=\"utf-8\" />
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
            <title>{_safe(title)}</title>
        </head>
        <body style=\"margin:0;padding:0;background:#030303;font-family:'Segoe UI',Arial,sans-serif;\">
            <span style=\"display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;\">{_safe(preheader)}</span>
            <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#030303;padding:26px 10px;\">
                <tr>
                    <td align=\"center\">
                        <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#0e0e0e;border:1px solid #232323;border-radius:18px;overflow:hidden;\">
                            <tr>
                                <td style=\"padding:18px 28px;background:linear-gradient(90deg,#141414,#0d0d0d);border-bottom:1px solid #252525;\">
                                    <div style=\"font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#d4d4d4;font-weight:700;\">AI Meeting Agent</div>
                                </td>
                            </tr>
                            <tr>
                                <td style=\"padding:30px 40px 16px 40px;\">
                                    <h1 style=\"margin:0;color:#fafafa;font-size:30px;line-height:1.2;font-weight:700;\">{_safe(title)}</h1>
                                    <p style=\"margin:12px 0 0 0;color:#b8b8b8;font-size:15px;line-height:1.6;\">{_safe(subtitle)}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style=\"padding: 0 40px 14px 40px;\">{body_html}</td>
                            </tr>
                            {cta_block}
                            <tr>
                                <td style=\"padding:22px 40px;border-top:1px solid #252525;background:#0a0a0a;\">
                                    <p style=\"margin:0;color:#8f8f8f;font-size:12px;line-height:1.6;\">This is an automated message from AI Meeting Agent. For support, use your account dashboard.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """


def _send_via_nodemailer(to_email, subject, html_body, text_body=None):
        if not os.path.exists(NODEMAILER_SCRIPT):
                _elog(f"Nodemailer script not found at: {NODEMAILER_SCRIPT}")
                return False, "Nodemailer bridge missing at frontend/scripts/send-email.mjs"

        node_path = shutil.which("node")
        if not node_path:
                _elog("Node.js binary not found in PATH")
                return False, "Node.js is not installed or not available in PATH"

        _elog(f"Sending email to {to_email} via Nodemailer (node: {node_path})")
        payload = {
                "to": to_email,
                "subject": subject,
                "html": html_body,
                "text": text_body,
        }

        try:
                result = subprocess.run(
                        [node_path, NODEMAILER_SCRIPT],
                        input=json.dumps(payload),
                        capture_output=True,
                        text=True,
                        timeout=45,
                        check=False,
                )
        except Exception as exc:
                _elog(f"Nodemailer subprocess error: {exc}")
                return False, f"Nodemailer execution failed: {exc}"

        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()

        if stderr:
                _elog(f"Nodemailer stderr: {stderr[:500]}")

        parsed = None
        if stdout:
                try:
                        parsed = json.loads(stdout)
                except json.JSONDecodeError:
                        parsed = None

        if result.returncode == 0 and isinstance(parsed, dict) and parsed.get("ok"):
                _elog(f"Email sent successfully to {to_email}")
                return True, parsed.get("message", "Email sent successfully")

        if isinstance(parsed, dict) and parsed.get("error"):
                _elog(f"Nodemailer error: {parsed.get('error')}")
                return False, parsed.get("error")
        if stderr:
                return False, stderr
        if stdout:
                return False, stdout

        return False, "Unknown Nodemailer failure"

def send_email(to_email, subject, html_body, text_body=None):
    """
    Send an email with HTML content
    """
    email_logger.info(f"Preparing to send email to: {to_email}, Subject: {subject}")
    start_time = time.time()

    if not EMAIL_SENDER_CONFIGURED:
        message = (
            "Email credentials missing. Configure Gmail OAuth (GMAIL_USER, GMAIL_CLIENT_ID, "
            "GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) or SMTP app password vars."
        )
        email_logger.warning(message)
        log_email_operation(email_logger, "send", to_email, subject, success=False, error=message)
        return False, message

    if EMAIL_OAUTH_CONFIGURED:
        success, message = _send_via_nodemailer(to_email, subject, html_body, text_body)
        if success:
            send_time = (time.time() - start_time) * 1000
            email_logger.info(f"Email sent via Nodemailer to {to_email} in {send_time:.2f}ms")
            log_email_operation(email_logger, "send", to_email, subject, success=True)
            return True, message

        email_logger.warning(
            "Nodemailer send failed for %s: %s. Falling back to SMTP if available.",
            to_email,
            message,
        )
        if not EMAIL_SMTP_CONFIGURED:
            log_email_operation(email_logger, "send", to_email, subject, success=False, error=message)
            return False, message
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SENDER_EMAIL
        msg['To'] = to_email
        
        email_logger.debug("Email message created with headers")
        
        # Add text version if provided
        if text_body:
            part1 = MIMEText(text_body, 'plain')
            msg.attach(part1)
            email_logger.debug("Text body attached")
        
        # Add HTML version
        part2 = MIMEText(html_body, 'html')
        msg.attach(part2)
        email_logger.debug("HTML body attached")
        
        # Send email
        email_logger.debug("Connecting to SMTP server...")
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            email_logger.debug("SMTP connection established")
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            email_logger.debug("SMTP authentication successful")
            server.send_message(msg)
            
        send_time = (time.time() - start_time) * 1000
        email_logger.info(f"Email sent successfully to {to_email} in {send_time:.2f}ms")
        log_email_operation(email_logger, "send", to_email, subject, success=True)
        
        return True, "Email sent successfully"
    except smtplib.SMTPAuthenticationError as e:
        send_time = (time.time() - start_time) * 1000
        message = (
            "SMTP authentication failed. Verify SENDER_EMAIL and Gmail App Password. "
            "If 2-Step Verification is enabled, use an App Password instead of your account password."
        )
        email_logger.error(f"Failed to send email to {to_email} after {send_time:.2f}ms: {str(e)}")
        log_error(email_logger, e, {"recipient": to_email, "subject": subject})
        log_email_operation(email_logger, "send", to_email, subject, success=False, error=message)

        return False, message
    except Exception as e:
        send_time = (time.time() - start_time) * 1000
        email_logger.error(f"Failed to send email to {to_email} after {send_time:.2f}ms: {str(e)}")
        log_error(email_logger, e, {"recipient": to_email, "subject": subject})
        log_email_operation(email_logger, "send", to_email, subject, success=False, error=str(e))
        
        return False, f"Failed to send email: {e}"

def send_welcome_email(user_email, username):
    """Send welcome email after successful account creation"""
    email_logger.info(f"Sending welcome email to new user: {username} ({user_email})")
    safe_username = _safe(username)
    subject = "Welcome to AI Meeting Agent"

    body_html = f"""
    <p style=\"margin:0 0 20px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_username}</strong>, your workspace is now ready.</p>
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:separate;border-spacing:0 10px;\">
      <tr><td style=\"background:#141414;border:1px solid #262626;border-radius:10px;padding:14px 16px;color:#dedede;font-size:14px;\"><strong style=\"color:#ffffff;\">AI Analysis</strong><br/>Extract summaries, decisions, and action items from any meeting transcript.</td></tr>
      <tr><td style=\"background:#141414;border:1px solid #262626;border-radius:10px;padding:14px 16px;color:#dedede;font-size:14px;\"><strong style=\"color:#ffffff;\">Workflow Sync</strong><br/>Push tasks to connected tools and keep execution aligned with your team.</td></tr>
      <tr><td style=\"background:#141414;border:1px solid #262626;border-radius:10px;padding:14px 16px;color:#dedede;font-size:14px;\"><strong style=\"color:#ffffff;\">Execution Clarity</strong><br/>Track ownership, deadlines, and outcomes in a single operational view.</td></tr>
    </table>
    """

    html_body = _render_email_layout(
        preheader="Your AI Meeting Agent workspace is ready.",
        title="Welcome aboard",
        subtitle="Professional meeting intelligence for fast-moving teams.",
        body_html=body_html,
        cta_text="Open Dashboard",
        cta_url=APP_URL,
    )

    text_body = (
        f"Welcome aboard, {username}.\n\n"
        "Your AI Meeting Agent workspace is ready.\n"
        "- AI Analysis for summaries and decisions\n"
        "- Workflow Sync with integrations\n"
        "- Execution Clarity for owners and due dates\n\n"
        f"Open dashboard: {APP_URL}"
    )

    return send_email(user_email, subject, html_body, text_body)

def send_integration_success_email(user_email, username, integration_name):
    """Send email after successful integration"""
    email_logger.info(f"Sending integration success email for {integration_name} to: {username} ({user_email})")
    safe_name = _safe(integration_name)
    safe_user = _safe(username)
    subject = f"{integration_name} integration connected"

    body_html = f"""
    <p style=\"margin:0 0 18px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_user}</strong>, <strong style=\"color:#ffffff;\">{safe_name}</strong> is now connected to your workspace.</p>
    <div style=\"background:#131313;border:1px solid #2a2a2a;border-radius:12px;padding:16px;\">
      <p style=\"margin:0;color:#d6d6d6;font-size:14px;line-height:1.7;\">Your automations can now create records directly from meeting action items, keeping planning and execution synchronized.</p>
    </div>
    """

    html_body = _render_email_layout(
        preheader=f"{integration_name} has been connected successfully.",
        title=f"{integration_name} connected",
        subtitle="Your integration is active and ready for workflow automation.",
        body_html=body_html,
        cta_text="Manage Integrations",
        cta_url=f"{APP_URL.rstrip('/')}/integrations",
    )

    text_body = (
        f"Hello {username},\n\n"
        f"{integration_name} is now connected to your AI Meeting Agent workspace.\n"
        "You can use meeting action items to trigger workflow automation.\n\n"
        f"Manage integrations: {APP_URL.rstrip('/')}/integrations"
    )

    return send_email(user_email, subject, html_body, text_body)

def send_password_reset_email(user_email, username, otp_code):
    """Send password reset email with OTP"""
    email_logger.info(f"Sending password reset email to: {username} ({user_email})")
    email_logger.debug(f"OTP code generated: {otp_code}")
    safe_user = _safe(username)
    safe_code = _safe(otp_code)
    subject = "Password reset code"

    body_html = f"""
    <p style=\"margin:0 0 14px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_user}</strong>, use the code below to reset your password.</p>
    <div style=\"margin:16px 0 18px 0;background:#141414;border:1px solid #2c2c2c;border-radius:12px;padding:16px;text-align:center;\">
      <div style=\"font-size:34px;letter-spacing:8px;font-weight:700;color:#f5f5f5;font-family:'Courier New',monospace;\">{safe_code}</div>
      <p style=\"margin:10px 0 0 0;color:#a7a7a7;font-size:13px;\">Valid for 15 minutes</p>
    </div>
    <p style=\"margin:0;color:#9d9d9d;font-size:13px;line-height:1.7;\">If you did not request this, you can safely ignore this email and your account remains protected.</p>
    """

    html_body = _render_email_layout(
        preheader="Your password reset verification code.",
        title="Reset your password",
        subtitle="Security verification for your account.",
        body_html=body_html,
    )

    text_body = (
        f"Hello {username},\n\n"
        "Use this code to reset your password:\n"
        f"{otp_code}\n\n"
        "This code is valid for 15 minutes. If you did not request this, ignore this message."
    )

    return send_email(user_email, subject, html_body, text_body)

def send_email_verification(user_email, username, otp_code):
    """Send email verification OTP after account creation"""
    email_logger.info(f"Sending email verification to new user: {username} ({user_email})")
    email_logger.debug(f"Verification OTP generated: {otp_code}")
    subject = "Verify Your Email - AI Meeting Agent"

    safe_user = _safe(username)
    safe_code = _safe(otp_code)

    body_html = f"""
    <p style=\"margin:0 0 14px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_user}</strong>, confirm this email address to activate your account.</p>
    <div style=\"margin:16px 0 18px 0;background:#141414;border:1px solid #2c2c2c;border-radius:12px;padding:16px;text-align:center;\">
      <div style=\"font-size:34px;letter-spacing:8px;font-weight:700;color:#f5f5f5;font-family:'Courier New',monospace;\">{safe_code}</div>
      <p style=\"margin:10px 0 0 0;color:#a7a7a7;font-size:13px;\">Valid for 30 minutes</p>
    </div>
    <p style=\"margin:0;color:#9d9d9d;font-size:13px;line-height:1.7;\">Never share this code. AI Meeting Agent support will never ask for it.</p>
    """

    html_body = _render_email_layout(
        preheader="Verify your email to complete signup.",
        title="Verify your email",
        subtitle="One-time verification to secure your account.",
        body_html=body_html,
    )

    text_body = (
        f"Hello {username},\n\n"
        "Use this verification code to activate your account:\n"
        f"{otp_code}\n\n"
        "This code is valid for 30 minutes. Never share this code with anyone."
    )

    return send_email(user_email, subject, html_body, text_body)


def build_meeting_summary_email(analysis):
    """Build premium themed HTML/text email bodies for meeting summary delivery."""
    summary = _safe(analysis.get("summary", "No summary provided."))
    decisions = analysis.get("decisions", []) or []
    action_items = analysis.get("action_items", []) or []

    if decisions:
        decisions_html = "".join(
            f"<li style=\"margin:0 0 8px 0;\">{_safe(item)}</li>" for item in decisions
        )
    else:
        decisions_html = "<li style=\"margin:0;\">No explicit decisions captured.</li>"

    if action_items:
        item_rows = []
        for item in action_items:
            task = _safe(item.get("task", "Untitled"))
            assignee = _safe(item.get("assignee", "Unassigned"))
            due_date = _safe(item.get("due_date", "Not set"))
            item_rows.append(
                f"<tr>"
                f"<td style=\"padding:10px;border-top:1px solid #2a2a2a;color:#e7e7e7;font-size:13px;\">{task}</td>"
                f"<td style=\"padding:10px;border-top:1px solid #2a2a2a;color:#c8c8c8;font-size:13px;\">{assignee}</td>"
                f"<td style=\"padding:10px;border-top:1px solid #2a2a2a;color:#c8c8c8;font-size:13px;\">{due_date}</td>"
                f"</tr>"
            )
        action_items_html = "".join(item_rows)
    else:
        action_items_html = (
            "<tr><td colspan=\"3\" style=\"padding:10px;border-top:1px solid #2a2a2a;color:#b1b1b1;font-size:13px;\">"
            "No action items captured."
            "</td></tr>"
        )

    body_html = f"""
    <h3 style=\"margin:0 0 8px 0;color:#f8f8f8;font-size:16px;\">Summary</h3>
    <p style=\"margin:0 0 18px 0;color:#d4d4d4;font-size:14px;line-height:1.7;\">{summary}</p>

    <h3 style=\"margin:0 0 8px 0;color:#f8f8f8;font-size:16px;\">Decisions</h3>
    <ul style=\"margin:0 0 18px 18px;padding:0;color:#d4d4d4;font-size:14px;line-height:1.7;\">{decisions_html}</ul>

    <h3 style=\"margin:0 0 8px 0;color:#f8f8f8;font-size:16px;\">Action items</h3>
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;background:#131313;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden;\">
      <tr>
        <th align=\"left\" style=\"padding:10px;color:#f5f5f5;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #2a2a2a;\">Task</th>
        <th align=\"left\" style=\"padding:10px;color:#f5f5f5;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #2a2a2a;\">Assignee</th>
        <th align=\"left\" style=\"padding:10px;color:#f5f5f5;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #2a2a2a;\">Due</th>
      </tr>
      {action_items_html}
    </table>
    """

    html_body = _render_email_layout(
        preheader="Meeting summary, decisions, and action items.",
        title="Meeting summary report",
        subtitle="Structured output generated by AI Meeting Agent.",
        body_html=body_html,
    )

    text_lines = ["Meeting summary report", "", f"Summary: {analysis.get('summary', 'No summary provided.')}", "", "Decisions:"]
    if decisions:
        text_lines.extend([f"- {item}" for item in decisions])
    else:
        text_lines.append("- No explicit decisions captured.")

    text_lines.append("")
    text_lines.append("Action items:")
    if action_items:
        for item in action_items:
            text_lines.append(
                "- Task: {task} | Assignee: {assignee} | Due: {due}".format(
                    task=item.get("task", "Untitled"),
                    assignee=item.get("assignee", "Unassigned"),
                    due=item.get("due_date", "Not set"),
                )
            )
    else:
        text_lines.append("- No action items captured.")

    return html_body, "\n".join(text_lines)

def send_team_creation_email(user_email, username, team_name, join_code):
    """Send email after successful team creation"""
    email_logger.info(f"Sending team creation email to: {username} ({user_email})")
    safe_user = _safe(username)
    safe_team = _safe(team_name)
    safe_code = _safe(join_code)
    subject = f"Your team '{team_name}' is ready"

    body_html = f"""
    <p style=\"margin:0 0 18px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_user}</strong>, your team <strong style=\"color:#ffffff;\">{safe_team}</strong> has been successfully created.</p>
    <div style=\"background:#131313;border:1px solid #2a2a2a;border-radius:12px;padding:16px;\">
      <p style=\"margin:0 0 10px 0;color:#d6d6d6;font-size:14px;line-height:1.7;\">Share this join code with your colleagues to invite them to your team workspace:</p>
      <div style=\"font-size:28px;letter-spacing:6px;font-weight:700;color:#f5f5f5;font-family:'Courier New',monospace;text-align:center;\">{safe_code}</div>
    </div>
    """

    html_body = _render_email_layout(
        preheader=f"Team '{team_name}' created successfully.",
        title="Team Workspace Ready",
        subtitle="Start collaborating and executing on your meeting insights.",
        body_html=body_html,
        cta_text="Go to Team Settings",
        cta_url=f"{APP_URL.rstrip('/')}/settings",
    )

    text_body = (
        f"Hello {username},\n\n"
        f"Your team '{team_name}' has been successfully created.\n\n"
        "Share this join code with your colleagues to invite them:\n"
        f"{join_code}\n\n"
        f"Go to team settings: {APP_URL.rstrip('/')}/settings"
    )

    return send_email(user_email, subject, html_body, text_body)

def send_team_join_member_email(user_email, username, team_name, leader_name):
    """Send email to the user who just joined a team"""
    email_logger.info(f"Sending team join (member) email to: {username} ({user_email})")
    safe_user = _safe(username)
    safe_team = _safe(team_name)
    safe_leader = _safe(leader_name)
    subject = f"You've joined {team_name}"

    body_html = f"""
    <p style=\"margin:0 0 18px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_user}</strong>, you are now a member of <strong style=\"color:#ffffff;\">{safe_team}</strong>.</p>
    <div style=\"background:#131313;border:1px solid #2a2a2a;border-radius:12px;padding:16px;\">
      <p style=\"margin:0;color:#d6d6d6;font-size:14px;line-height:1.7;\">You will now see team meetings, insights, and shared tasks. {safe_leader} is the team leader.</p>
    </div>
    """

    html_body = _render_email_layout(
        preheader=f"You successfully joined {team_name}.",
        title="Welcome to the Team",
        subtitle="Your collaborative workspace is ready.",
        body_html=body_html,
        cta_text="View Team Dashboard",
        cta_url=f"{APP_URL.rstrip('/')}/dashboard",
    )

    text_body = (
        f"Hello {username},\n\n"
        f"You are now a member of {team_name}, led by {leader_name}.\n"
        "You will now see team meetings, insights, and shared tasks.\n\n"
        f"View team dashboard: {APP_URL.rstrip('/')}/dashboard"
    )

    return send_email(user_email, subject, html_body, text_body)

def send_team_join_leader_email(leader_email, leader_name, team_name, joiner_name):
    """Send email to the team leader when a new member joins"""
    email_logger.info(f"Sending team join (leader) email to: {leader_name} ({leader_email})")
    safe_leader = _safe(leader_name)
    safe_team = _safe(team_name)
    safe_joiner = _safe(joiner_name)
    subject = f"New team member in {team_name}"

    body_html = f"""
    <p style=\"margin:0 0 18px 0;color:#d4d4d4;font-size:15px;line-height:1.7;\">Hello <strong style=\"color:#ffffff;\">{safe_leader}</strong>, a new member has joined your team <strong style=\"color:#ffffff;\">{safe_team}</strong>.</p>
    <div style=\"background:#131313;border:1px solid #2a2a2a;border-radius:12px;padding:16px;\">
      <p style=\"margin:0;color:#d6d6d6;font-size:14px;line-height:1.7;\"><strong style=\"color:#ffffff;\">{safe_joiner}</strong> is now a member and can view shared team meetings and tasks.</p>
    </div>
    """

    html_body = _render_email_layout(
        preheader=f"{joiner_name} just joined your team.",
        title="New Team Member",
        subtitle="Your team is growing.",
        body_html=body_html,
        cta_text="Manage Team",
        cta_url=f"{APP_URL.rstrip('/')}/settings",
    )

    text_body = (
        f"Hello {leader_name},\n\n"
        f"A new member, {joiner_name}, has joined your team {team_name}.\n"
        "They can now view shared team meetings and tasks.\n\n"
        f"Manage team: {APP_URL.rstrip('/')}/settings"
    )

    return send_email(leader_email, subject, html_body, text_body)

def send_password_changed_email(user_email, username):
    """Send email confirming password has been changed successfully"""
    email_logger.info(f"Sending password changed confirmation to: {username} ({user_email})")
    safe_user = _safe(username)
    subject = "Password Changed Successfully"

    body_html = f"""
    <p style="margin:0 0 18px 0;color:#d4d4d4;font-size:15px;line-height:1.7;">Hello <strong style="color:#ffffff;">{safe_user}</strong>, the password for your AI Meeting Agent account has been successfully changed.</p>
    <div style="background:#131313;border:1px solid #2a2a2a;border-radius:12px;padding:16px;">
      <p style="margin:0;color:#d6d6d6;font-size:14px;line-height:1.7;">If you did not make this change, please contact support immediately to secure your account.</p>
    </div>
    """

    html_body = _render_email_layout(
        preheader="Your password was recently changed.",
        title="Password Update",
        subtitle="Security notification for your account.",
        body_html=body_html,
        cta_text="Login to your account",
        cta_url=f"{APP_URL.rstrip('/')}/login",
    )

    text_body = (
        f"Hello {username},\n\n"
        "The password for your AI Meeting Agent account has been successfully changed.\n"
        "If you did not make this change, please contact support immediately.\n\n"
        f"Login: {APP_URL.rstrip('/')}/login"
    )

    return send_email(user_email, subject, html_body, text_body)

def send_team_leave_email(leader_email, leader_name, leaver_name, team_name):
    """Notify the team leader when a member leaves"""
    email_logger.info(f"Sending team leave notification to leader: {leader_name} ({leader_email})")
    
    subject = "A member has left your team"
    
    body_html = f"""
    <p style="margin:0 0 18px 0;color:#d4d4d4;font-size:15px;line-height:1.7;">Hello <strong style="color:#ffffff;">{_safe(leader_name)}</strong>,</p>
    <div style="background:#131313;border:1px solid #2a2a2a;border-radius:12px;padding:16px;">
      <p style="margin:0;color:#d6d6d6;font-size:14px;line-height:1.7;"><strong>{_safe(leaver_name)}</strong> has left your team <strong>{_safe(team_name)}</strong>.</p>
    </div>
    """
    
    html_body = _render_email_layout(
        preheader="Team member update.",
        title="Member Departure",
        subtitle="Someone left your workspace.",
        body_html=body_html,
        cta_text="View Team",
        cta_url=f"{APP_URL.rstrip('/')}/teams",
    )
    
    text_body = (
        f"Hello {leader_name},\n\n"
        f"A member, {leaver_name}, has left your team {team_name}.\n\n"
        f"View team: {APP_URL.rstrip('/')}/teams"
    )
    
    return send_email(leader_email, subject, html_body, text_body)
