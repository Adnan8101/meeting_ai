import os
import json
import smtplib
from email.mime.text import MIMEText
import requests
from jira import JIRA  # Make sure this is imported
from jira.exceptions import JIRAError  # Import specific Jira errors

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
import google.generativeai as genai
from trello import TrelloClient
import mongoengine

from extensions import bcrypt, login_manager
from mongo_models import User, Team, TrelloCredentials, TrelloCard, JiraCredentials
from email_service import send_welcome_email, send_integration_success_email, send_password_reset_email, send_email_verification
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
# Get environment variables with fallbacks
TRELLO_API_KEY = os.environ.get("TRELLO_API_KEY", "")
TRELLO_API_SECRET = os.environ.get("TRELLO_API_SECRET", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "")
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD", "")
FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "mongodb-secret-key-v2")
MONGO_URL = os.environ.get("MONGO_URL", "")

# Log configuration status (without exposing secrets)
print(f"    - TRELLO_API_KEY: {'✓ Set' if TRELLO_API_KEY else '✗ Missing'}")
print(f"    - GEMINI_API_KEY: {'✓ Set' if GEMINI_API_KEY else '✗ Missing'}")
print(f"    - MONGO_URL: {'✓ Set' if MONGO_URL else '✗ Missing'}")
print(f"    - EMAIL: {'✓ Set' if SENDER_EMAIL and SENDER_PASSWORD else '✗ Missing'}")


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = FLASK_SECRET_KEY
    
    # Session configuration for better compatibility with serverless
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True if using HTTPS in production
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour

    # --- MongoDB Configuration ---
    print("\n" + "="*60)
    print("🗄️  MONGODB CONNECTION ATTEMPT")
    print("="*60)
    
    if MONGO_URL:
        try:
            
            mongoengine.connect(host=MONGO_URL)
            
            # Test the connection
            from mongoengine.connection import get_db
            db = get_db()
            print(f"[✓] Successfully connected to MongoDB")
            print(f"[✓] Database name: {db.name}")
            print(f"[✓] Collections: {db.list_collection_names()}")
            
        except Exception as e:
            print(f"[✗] MongoDB connection failed!")
            print(f"[✗] Error type: {type(e).__name__}")
            print(f"[✗] Error message: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    else:
        try:
            mongoengine.connect('ai_meeting_agent')
            print("[✓] Connected to local MongoDB")
        except Exception as e:
            print(f"[✗] Local MongoDB connection failed: {e}")
            raise
    
    print("="*60 + "\n")

    bcrypt.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'login'

    @login_manager.user_loader
    def load_user(user_id):
        try:
            # Handle MongoDB ObjectId properly
            from bson import ObjectId
            if isinstance(user_id, str) and len(user_id) == 24:
                try:
                    # Try to convert to ObjectId if it's a valid 24-character hex string
                    obj_id = ObjectId(user_id)
                    user = User.objects(id=obj_id).first()
                    if user:
                        print(f"[✓] User loaded: {user.username} (ID: {user.id})")
                    else:
                    return user
                except Exception as e:
                    # If conversion fails, it's an invalid ObjectId
                    print(f"[✗] Failed to load user: {e}")
                    return None
            else:
                # For invalid ID formats (like old integer IDs), silently return None
                # This handles the migration from SQLAlchemy to MongoDB
                return None
        except Exception as e:
            print(f"[ERROR] Failed to load user {user_id}: {e}")
            return None

    # --- AI MODEL AND HELPER FUNCTIONS (Unchanged) ---
    try:
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
        else:
    except Exception as e:

    def analyze_transcript_with_ai(transcript_text):
        if not model: return {"error": "AI model not configured."}
        # --- PROMPT RESTORED ---
        prompt = f"""
        Analyze the following meeting transcript. Provide your analysis ONLY in a valid JSON object format. Do not include any text, markdown formatting, or explanations before or after the JSON object.

        The JSON object must have these top-level keys: "summary", "decisions", "action_items".
        - "summary": (string) A concise, one-paragraph summary.
        - "decisions": (list of strings) A list of all concrete decisions made.
        - "action_items": (list of objects) A list of tasks. Each object must have: "task" (string), "assignee" (string), and "due_date" (string, use "Not specified" if none).

        Transcript:
        ---
        {transcript_text}
        ---

        JSON Analysis:
        """
        try:
            response = model.generate_content(prompt);
            print(f"Raw AI: {response.text}")
            json_text = response.text.strip().replace('```json', '').replace('```', '').strip()
            if not json_text: return {"error": "AI empty response."}
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            return {"error": f"AI JSON Parse Error: {e}. Raw: '{response.text}'"}
        except Exception as e:
            return {"error": f"AI Error: {e}"}

    def get_trello_client(user):
        creds = TrelloCredentials.objects(user_id=str(user.id)).first()
        if creds: 
            return TrelloClient(api_key=TRELLO_API_KEY, api_secret=TRELLO_API_SECRET, token=creds.token)
        return None

    def send_summary_email(recipients, analysis):
        if not SENDER_EMAIL or not SENDER_PASSWORD: return "Email creds not configured."
        subject = "Meeting Summary & Action Items"
        body = f"<h2>Summary</h2><p>{analysis.get('summary', 'N/A')}</p>"
        body += "<h2>Decisions</h2><ul>" + "".join([f"<li>{d}</li>" for d in analysis.get('decisions', [])]) + "</ul>"
        body += "<h2>Action Items</h2><ul>" + "".join([
                                                          f"<li><b>Task:</b> {i.get('task', 'N/A')} | <b>Assignee:</b> {i.get('assignee', 'N/A')} | <b>Due:</b> {i.get('due_date', 'N/A')}</li>"
                                                          for i in analysis.get('action_items', [])]) + "</ul>"
        msg = MIMEText(body, 'html');
        msg['Subject'], msg['From'], msg['To'] = subject, SENDER_EMAIL, ", ".join(recipients)
        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(SENDER_EMAIL, SENDER_PASSWORD); server.send_message(msg)
            return "Email sent successfully."
        except Exception as e:
            return f"Failed to send email: {e}"

    def create_trello_cards(client, board_id, list_id, action_items, user_id):
        try:
            target_list = client.get_list(list_id);
            cards_created = 0
            for item in action_items:
                card_name = item.get('task', 'Untitled Task')
                card_desc = f"Assignee: {item.get('assignee', 'N/A')}\nDue Date: {item.get('due_date', 'N/A')}"
                new_card = target_list.add_card(name=card_name, desc=card_desc);
                cards_created += 1
                db_card = TrelloCard(
                    card_id=new_card.id, 
                    user_id=str(user_id), 
                    board_id=board_id, 
                    list_id=list_id,
                    task_description=item.get('task', 'No desc'), 
                    assignee=item.get('assignee'),
                    due_date_str=item.get('due_date')
                )
                db_card.save()
            return f"{cards_created} Trello cards created."
        except Exception as e:
            return f"Failed Trello cards: {e}"

    def send_to_slack(team, analysis):
        if not team or not team.slack_webhook_url:
            return "Slack is not configured for this team."
        webhook_url = team.slack_webhook_url

        # --- SLACK BLOCKS RESTORED ---
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📝 Meeting Summary",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": analysis.get('summary', 'No summary available.')
                }
            },
            {
                "type": "divider"
            }
        ]
        # Add Decisions if any
        decisions = analysis.get('decisions')
        if decisions:
            blocks.extend([
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*⚖️ Key Decisions:*\n" + "\n".join([f"• {d}" for d in decisions])
                    }
                },
                {"type": "divider"}
            ])
        # Add Action Items if any
        action_items = analysis.get('action_items')
        if action_items:
            action_items_text = "*✅ Action Items:*\n"
            for item in action_items:
                action_items_text += f"• *Task:* {item.get('task', 'N/A')} | *Assignee:* {item.get('assignee', 'N/A')} | *Due:* {item.get('due_date', 'N/A')}\n"
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": action_items_text
                }
            })
        # -----------------------------

        payload = {"blocks": blocks}
        try:
            response = requests.post(webhook_url, json=payload, timeout=10);
            response.raise_for_status()
            if response.text == 'ok':
            else:
        except requests.exceptions.RequestException as e:
        except Exception as e:

    # --- JIRA HELPER FUNCTIONS (Unchanged) ---
    def get_jira_client(user):
        creds = JiraCredentials.objects(user_id=str(user.id)).first()
        if not creds: 
            return None
        try:
            jira_client = JIRA(server=creds.jira_url, basic_auth=(creds.email, creds.api_token))
            jira_client.server_info()
            return jira_client
        except JIRAError as e:
            flash(f"Jira Connection Error: {e.text}", "danger");
            return None
        except Exception as e:
            flash(f"Jira Initialization Error: {e}", "danger");
            return None

    def create_jira_issues(user, action_items, project_key, issue_type_name):
        jira_client = get_jira_client(user)
        if not jira_client: return "Failed to connect to Jira. Check credentials."
        if not action_items: return "No action items to create."
        if not project_key or not issue_type_name: return "Jira Project/Issue Type required."

        issues_created = 0;
        failed_items = []
        for item in action_items:
            summary = item.get('task', 'Untitled Meeting Task')
            description = f"Assignee: {item.get('assignee', 'Unassigned')}\nDue Date: {item.get('due_date', 'Not specified')}"
            issue_dict = {'project': {'key': project_key}, 'summary': summary, 'description': description,
                          'issuetype': {'name': issue_type_name}}
            try:
                new_issue = jira_client.create_issue(fields=issue_dict)
                issues_created += 1
            except JIRAError as e:
                failed_items.append(summary)
            except Exception as e:
                failed_items.append(summary)

        if not failed_items:
            return f"{issues_created} Jira issues created in {project_key}."
        else:
            return f"Created {issues_created} issues. Failed for: {', '.join(failed_items)}."

    # --- ROUTES ---
    @app.route('/')
    def landing():
        """Public landing page"""
        if current_user.is_authenticated:
            return redirect(url_for('dashboard'))
        return render_template('landing.html')
    
    @app.route('/home')
    @app.route('/dashboard')
    @login_required
    def dashboard():
        trello_client = get_trello_client(current_user)
        boards = trello_client.list_boards() if trello_client else []
        
        # Get user's integration credentials for the template
        trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        
        # Get user's team data if they belong to a team
        team_data = None
        if current_user.team_id:
            team_data = Team.objects(id=current_user.team_id).first()
        
        return render_template('index.html', 
                             trello_boards=boards, 
                             trello_credentials=trello_creds,
                             jira_credentials=jira_creds,
                             team_data=team_data)

    # --- GET_LISTS FUNCTION RESTORED ---
    @app.route('/get_lists/<board_id>')
    @login_required
    def get_lists(board_id):
        trello_client = get_trello_client(current_user)
        if not trello_client:
            return jsonify({"error": "Trello not connected"}), 400
        try:
            board = trello_client.get_board(board_id)
            lists = [{"id": lst.id, "name": lst.name} for lst in board.list_lists()]
            return jsonify(lists)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ----------------------------------

    # --- JIRA DATA ROUTES (Unchanged) ---
    @app.route('/get_jira_projects')
    @login_required
    def get_jira_projects():
        jira_client = get_jira_client(current_user)
        if not jira_client: return jsonify({"error": "Jira not connected or credentials invalid."}), 400
        try:
            projects = jira_client.projects()
            project_list = [{"key": p.key, "name": p.name} for p in projects]
            return jsonify(project_list)
        except JIRAError as e:
            return jsonify({"error": f"Jira API Error: {e.text}"}), 500
        except Exception as e:
            return jsonify({"error": "Could not fetch Jira projects."}), 500

    @app.route('/get_jira_issue_types/<project_key>')
    @login_required
    def get_jira_issue_types(project_key):
        jira_client = get_jira_client(current_user)
        if not jira_client: return jsonify({"error": "Jira not connected or credentials invalid."}), 400
        try:
            project = jira_client.project(project_key)
            issue_types = project.issueTypes
            issue_type_list = [{"id": it.id, "name": it.name, "subtask": it.subtask} for it in issue_types]
            return jsonify(issue_type_list)
        except JIRAError as e:
            return jsonify({"error": f"Jira API Error: {e.text}"}), 500
        except Exception as e:
            return jsonify({"error": f"Could not fetch issue types for {project_key}."}), 500

    @app.route('/analyze', methods=['POST'])
    @login_required
    def analyze():
        try:
            # Debug logging
            
            transcript_text = request.form.get('transcript')
            analysis_result, notification = None, None
            
            if not transcript_text or not transcript_text.strip():
                flash("Please provide a meeting transcript to analyze.", "error")
                trello_client = get_trello_client(current_user)
                boards = trello_client.list_boards() if trello_client else []
                return render_template('index.html', trello_boards=boards)
            
            if transcript_text:
                analysis_result = analyze_transcript_with_ai(transcript_text)
                if analysis_result and not analysis_result.get('error'):
                    automation_messages = []
                    action_items_list = analysis_result.get('action_items', [])
                    
                    # Get user's team
                    user_team = None
                    if current_user.team_id:
                        user_team = Team.objects(id=current_user.team_id).first()
                    
                    # Email Automation
                    if request.form.get('send_email') == 'true' and user_team:
                        # Get team members
                        team_members = User.objects(team_id=current_user.team_id)
                        recipients = [m.email for m in team_members if m.email]
                        if recipients:
                            automation_messages.append(f"Email: {send_summary_email(recipients, analysis_result)}")
                        else:
                            automation_messages.append("Email: No emails in team.")
                    elif request.form.get('send_email') == 'true':
                        automation_messages.append("Email: Requires team.")
                    
                    # Trello Automation
                    trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
                    if request.form.get('create_trello') == 'true' and trello_creds:
                        t_client = get_trello_client(current_user)
                        b_id, l_id = request.form.get('trello_board_id'), request.form.get('trello_list_id')
                        if t_client and b_id and l_id:
                            automation_messages.append(
                                f"Trello: {create_trello_cards(t_client, b_id, l_id, action_items_list, current_user.id)}")
                        elif not b_id or not l_id:
                            automation_messages.append("Trello: Board/List missing.")
                        else:
                            automation_messages.append("Trello: Client error.")
                    elif request.form.get('create_trello') == 'true':
                        automation_messages.append("Trello: Not connected.")
                    
                    # Slack Automation
                    if request.form.get('send_slack') == 'true' and user_team and user_team.slack_webhook_url:
                        automation_messages.append(f"Slack: {send_to_slack(user_team, analysis_result)}")
                    elif request.form.get('send_slack') == 'true':
                        if not user_team:
                            automation_messages.append("Slack: Requires team.")
                        else:
                            automation_messages.append("Slack: Not connected.")
                    
                    # JIRA Automation
                    jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
                    if request.form.get('create_jira') == 'true' and jira_creds:
                        jira_project_key = request.form.get('jira_project_key')
                        jira_issue_type_name = request.form.get('jira_issue_type_name')
                        if not jira_project_key or not jira_issue_type_name:
                            automation_messages.append("Jira: Project and Issue Type must be selected.")
                        else:
                            jira_status = create_jira_issues(current_user, action_items_list, jira_project_key,
                                                             jira_issue_type_name)
                            automation_messages.append(f"Jira: {jira_status}")
                    elif request.form.get('create_jira') == 'true':
                        automation_messages.append("Jira: Integration not connected.")
                    # Notification logic
                    if automation_messages:
                        overall_type = "success"
                        for msg in automation_messages:
                            if "Failed" in msg or "Error" in msg or "Invalid" in msg or "must be" in msg or "not connected" in msg or "missing" in msg:
                                overall_type = "error"
                                break
                        flash(" | ".join(automation_messages), overall_type)
                elif analysis_result and analysis_result.get('error'):
                    flash(f"AI Analysis Error: {analysis_result['error']}", "error")

            trello_client = get_trello_client(current_user)
            boards = trello_client.list_boards() if trello_client else []
            
        except Exception as e:
            flash(f"An error occurred while processing your request: {str(e)}", "error")
            trello_client = get_trello_client(current_user)
            boards = trello_client.list_boards() if trello_client else []
            analysis_result = None
            
        return render_template('index.html', analysis=analysis_result, transcript=transcript_text, trello_boards=boards)

    # --- USERNAME AVAILABILITY CHECK ---
    @app.route('/check_username', methods=['POST', 'OPTIONS'])
    def check_username():
        """Check if username is available via AJAX"""
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.add('Access-Control-Allow-Methods', 'POST')
            return response
            
        try:
            # Try to get data from JSON first, then form data
            if request.is_json:
                data = request.get_json()
                username = data.get('username', '').strip() if data else ''
            else:
                username = request.form.get('username', '').strip()
            
            
            if not username:
                return jsonify({'available': False, 'message': 'Username is required'}), 200
            
            if len(username) < 3:
                return jsonify({'available': False, 'message': 'Username must be at least 3 characters'}), 200
            
            if len(username) > 20:
                return jsonify({'available': False, 'message': 'Username must be less than 20 characters'}), 200
            
            # Check if username exists
            existing_user = User.objects(username=username).first()
            if existing_user:
                return jsonify({'available': False, 'message': 'Username is already taken'}), 200
            
            return jsonify({'available': True, 'message': 'Username is available'}), 200
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'available': False, 'message': 'Error checking username. Please try again.'}), 500

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        print("\n" + "="*60)
        print("📝 REGISTRATION REQUEST")
        print("="*60)
        
        if current_user.is_authenticated:
            print("="*60 + "\n")
            return redirect(url_for('dashboard'))
        
        if request.method == 'POST':
            # Check if this is an AJAX request for registration
            is_ajax = request.headers.get('Content-Type') == 'application/json'
            
            if is_ajax:
                data = request.get_json()
                username = data.get('username', '').strip()
                email = data.get('email', '').strip()
                password = data.get('password', '').strip()
            else:
                username = request.form.get('username', '').strip()
                email = request.form.get('email', '').strip()
                password = request.form.get('password', '').strip()
            
            try:
                print(f"    - Username: {username}")
                print(f"    - Email: {email}")
                print(f"    - Password length: {len(password) if password else 0}")
                
                # Validation
                if not username or not email or not password:
                    message = 'All fields are required.'
                    print(f"[✗] Validation failed: {message}")
                    if is_ajax:
                        return jsonify({'success': False, 'message': message})
                    flash(message, 'error')
                    print("="*60 + "\n")
                    return redirect(url_for('register'))
                
                if len(username) < 3:
                    message = 'Username must be at least 3 characters long.'
                    print(f"[✗] Validation failed: {message}")
                    if is_ajax:
                        return jsonify({'success': False, 'message': message})
                    flash(message, 'error')
                    print("="*60 + "\n")
                    return redirect(url_for('register'))
                
                if len(password) < 6:
                    message = 'Password must be at least 6 characters long.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message})
                    flash(message, 'error')
                    return redirect(url_for('register'))
                
                # Check if username or email already exists
                existing_username = User.objects(username=username).first()
                existing_email = User.objects(email=email).first()
                
                if existing_username:
                    message = 'Username already exists. Please choose another.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'username'})
                    flash(message, 'error')
                    return redirect(url_for('register'))
                
                if existing_email:
                    message = 'Email already registered. Please use another email or try logging in.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'email'})
                    flash(message, 'error')
                    return redirect(url_for('register'))
                
                # Create new user
                user = User(username=username, email=email)
                user.password = password  # This will hash the password
                user.save()
                
                # Generate and send verification email
                try:
                    otp_code = user.generate_verification_token()
                    success, email_result = send_email_verification(email, username, otp_code)
                    if success:
                        email_message = " Verification code sent to your email."
                    else:
                        email_message = " (Verification email failed to send.)"
                except Exception as email_error:
                    email_message = " (Verification email failed to send.)"
                
                message = f'Account created successfully!{email_message} Please verify your email.'
                if is_ajax:
                    return jsonify({'success': True, 'message': message, 'redirect': url_for('verify_email', email=email)})
                
                flash(message, 'success')
                return redirect(url_for('verify_email', email=email))
                
            except Exception as e:
                import traceback
                traceback.print_exc()
                message = 'An unexpected error occurred during registration. Please try again.'
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, 'error')
                return redirect(url_for('register'))
        
        return render_template('register.html')

    @app.route('/verify_email/<email>', methods=['GET', 'POST'])
    def verify_email(email):
        if request.method == 'POST':
            otp = request.form.get('otp')
            
            if not otp:
                flash('Verification code is required.', 'error')
                return render_template('verify_email.html', email=email)
            
            user = User.objects(email=email).first()
            if not user:
                flash('User not found.', 'error')
                return redirect(url_for('register'))
            
            if user.is_verified:
                flash('Account already verified! Please log in.', 'success')
                return redirect(url_for('login'))
            
            if user.verify_email_token(otp):
                # Complete verification
                user.complete_email_verification()
                
                # Send welcome email after verification
                try:
                    send_welcome_email(user.email, user.username)
                except Exception as e:
                
                flash('Email verified successfully! Welcome to AI Meeting Agent!', 'success')
                return redirect(url_for('login'))
            else:
                flash('Invalid or expired verification code.', 'error')
        
        return render_template('verify_email.html', email=email)

    @app.route('/resend_verification/<email>', methods=['POST'])
    def resend_verification(email):
        user = User.objects(email=email).first()
        if not user:
            return jsonify({'success': False, 'message': 'User not found'})
        
        if user.is_verified:
            return jsonify({'success': False, 'message': 'Account already verified'})
        
        try:
            otp_code = user.generate_verification_token()
            success, email_result = send_email_verification(email, user.username, otp_code)
            if success:
                return jsonify({'success': True, 'message': 'Verification code sent successfully'})
            else:
                return jsonify({'success': False, 'message': 'Failed to send verification email'})
        except Exception as e:
            return jsonify({'success': False, 'message': 'An error occurred'})

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        print("\n" + "="*60)
        print("🔐 LOGIN REQUEST")
        print("="*60)
        
        if current_user.is_authenticated:
            print("="*60 + "\n")
            return redirect(url_for('dashboard'))
        
        if request.method == 'POST':
            try:
                email = request.form.get('email')
                password = request.form.get('password')
                
                
                if not email or not password:
                    print("[✗] Missing email or password")
                    flash('Email and password are required.', 'error')
                    print("="*60 + "\n")
                    return render_template('login.html')
                
                user = User.objects(email=email).first()
                
                if user:
                    print(f"[✓] User found: {user.username} (ID: {user.id})")
                    
                    if user.verify_password(password):
                        print(f"[✓] Password verified successfully")
                        
                        # Check if email is verified
                        if not user.is_verified:
                            flash('Please verify your email before logging in. Check your email for the verification code.', 'warning')
                            print("="*60 + "\n")
                            return redirect(url_for('verify_email', email=email))
                        
                        print(f"[✓] Logging in user: {user.username}")
                        login_user(user, remember=True, duration=None)
                        next_page = request.args.get('next')
                        flash(f'Welcome back, {user.username}!', 'success')
                        print(f"[✓] Login successful! Redirecting to: {next_page or 'dashboard'}")
                        print("="*60 + "\n")
                        return redirect(next_page or url_for('dashboard'))
                    else:
                        print(f"[✗] Password verification failed")
                        flash('Invalid email or password. Please try again.', 'error')
                else:
                    print(f"[✗] No user found with email: {email}")
                    flash('Invalid email or password. Please try again.', 'error')
                    
            except Exception as e:
                print(f"[✗] Error in login: {type(e).__name__}: {str(e)}")
                import traceback
                traceback.print_exc()
                flash('An error occurred during login. Please try again.', 'error')
        else:
        
        print("="*60 + "\n")
        return render_template('login.html')

    @app.route('/logout')
    def logout():
        # ... (unchanged) ...
        logout_user();
        return redirect(url_for('login'))

    @app.route('/forgot_password', methods=['GET', 'POST'])
    def forgot_password():
        if request.method == 'POST':
            email = request.form.get('email')
            if not email:
                flash('Email is required.', 'error')
                return render_template('forgot_password.html')
            
            user = User.objects(email=email).first()
            if user:
                # Generate OTP
                otp = user.generate_reset_token()
                # Send email
                send_password_reset_email(user.email, user.username, otp)
                flash('Password reset code sent to your email.', 'success')
                return redirect(url_for('verify_reset_code', email=email))
            else:
                # Don't reveal if user exists or not for security
                flash('If that email exists, you will receive a reset code.', 'info')
        
        return render_template('forgot_password.html')

    @app.route('/verify_reset_code/<email>', methods=['GET', 'POST'])
    def verify_reset_code(email):
        if request.method == 'POST':
            # Check if this is step 1 (code verification) or step 2 (password change)
            if 'verify_code' in request.form:
                # Step 1: Verify the code only
                otp = request.form.get('otp')
                
                if not otp:
                    flash('Verification code is required.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
                
                user = User.objects(email=email).first()
                if user and user.verify_reset_token(otp):
                    # Code is valid, show password change form
                    flash('Code verified successfully! Now enter your new password.', 'success')
                    return render_template('verify_reset_code.html', email=email, step='change_password', verified_code=otp)
                else:
                    flash('Invalid or expired verification code.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
            
            elif 'change_password' in request.form:
                # Step 2: Change password after code verification
                otp = request.form.get('verified_code')
                new_password = request.form.get('new_password')
                confirm_password = request.form.get('confirm_password')
                
                if not otp or not new_password or not confirm_password:
                    flash('All fields are required.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='change_password', verified_code=otp)
                
                if new_password != confirm_password:
                    flash('Passwords do not match.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='change_password', verified_code=otp)
                
                # Verify the code again for security
                user = User.objects(email=email).first()
                if user and user.verify_reset_token(otp):
                    # Update password
                    user.password = new_password  # This will hash the password
                    user.clear_reset_token()
                    flash('Password updated successfully! Please log in with your new password.', 'success')
                    return redirect(url_for('login'))
                else:
                    flash('Session expired. Please request a new verification code.', 'error')
                    return redirect(url_for('forgot_password'))
        
        # Default: Show code verification form
        return render_template('verify_reset_code.html', email=email, step='verify')

    # --- ADD THIS MISSING ROUTE ---
    @app.route('/team')
    @login_required
    def team():
        team_data = None
        team_members = []
        
        if current_user.team_id:
            # Get team data
            team_data = Team.objects(id=current_user.team_id).first()
            # Get team members
            team_members = User.objects(team_id=current_user.team_id)
        
        return render_template('team.html', team=team_data, team_members=team_members)

    # -----------------------------

    @app.route('/create_team', methods=['POST'])
    @login_required
    def create_team():
        # ... (unchanged) ...
        team_name = request.form.get('team_name')
        if team_name:
            if current_user.team_id: 
                flash('Already in a team.', 'warning')
                return redirect(url_for('team'))
            
            new_team = Team(name=team_name, owner_id=str(current_user.id))
            new_team.save()
            current_user.team_id = str(new_team.id)
            current_user.save()
            flash(f'Team "{team_name}" created!', 'success')
        else:
            flash('Team name empty.', 'danger')
        return redirect(url_for('team'))

    @app.route('/invite', methods=['POST'])
    @login_required
    def invite():
        # ... (unchanged) ...
        if not current_user.team_id: 
            flash('Must be in team.', 'danger')
            return redirect(url_for('team'))
        
        email = request.form.get('email')
        user_to_invite = User.objects(email=email).first()
        if user_to_invite:
            if user_to_invite.team_id:
                flash(f'{user_to_invite.username} already in team.', 'warning')
            elif user_to_invite == current_user:
                flash('Cannot invite self.', 'warning')
            else:
                user_to_invite.team_id = current_user.team_id
                user_to_invite.save()
                flash(f'{user_to_invite.username} added.', 'success')
        else:
            flash('User not found.', 'danger')
        return redirect(url_for('team'))

    @app.route('/integrations')
    @login_required
    def integrations():
        # Get user's integration credentials
        trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        
        # Get team data for Slack integration
        team_data = None
        if current_user.team_id:
            team_data = Team.objects(id=current_user.team_id).first()
        
        return render_template('integrations.html', 
                             trello_credentials=trello_creds, 
                             jira_credentials=jira_creds,
                             team=team_data)

    # --- TRELLO ROUTES (Unchanged) ---
    @app.route('/trello/connect')
    @login_required
    def trello_connect():
        # ... (unchanged) ...
        app_name = "AI Agent";
        expiration = "never";
        scope = "read,write"
        if not TRELLO_API_KEY: flash('Trello Key missing.', 'danger'); return redirect(url_for('integrations'))
        auth_url = f"https://trello.com/1/authorize?key={TRELLO_API_KEY}&name={app_name}&expiration={expiration}&response_type=token&scope={scope}"
        return render_template('connect_trello.html', auth_url=auth_url)

    @app.route('/trello/save_token', methods=['POST'])
    @login_required
    def trello_save_token():
        # ... (unchanged) ...
        access_token = request.form.get('pin')
        if not access_token: 
            flash('Token required.', 'danger')
            return redirect(url_for('trello_connect'))
        if not TRELLO_API_KEY or not TRELLO_API_SECRET: 
            flash('Trello Key/Secret missing.', 'danger')
            return redirect(url_for('integrations'))
        try:
            client = TrelloClient(api_key=TRELLO_API_KEY, api_secret=TRELLO_API_SECRET, token=access_token)
            trello_user = client.get_member('me')
            
            # Check if credentials already exist
            creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
            if not creds:
                creds = TrelloCredentials(user_id=str(current_user.id))
            
            creds.token = access_token
            creds.trello_username = trello_user.full_name
            creds.save()
            
            # Send integration success email
            send_integration_success_email(current_user.email, current_user.username, 'Trello')
            
            flash('Trello connected successfully! Confirmation email sent.', 'success')
            return redirect(url_for('integrations'))
        except Exception as e:
            flash(f'Trello failed: {e}', 'danger')
            return redirect(url_for('trello_connect'))

    @app.route('/trello/disconnect')
    @login_required
    def trello_disconnect():
        # ... (unchanged) ...
        creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        if creds: 
            creds.delete()
            flash('Trello disconnected.', 'success')
        return redirect(url_for('integrations'))

    # --- SLACK ROUTES (Unchanged) ---
    @app.route('/slack/connect', methods=['POST'])
    @login_required
    def slack_connect():
        # ... (unchanged) ...
        if not current_user.team_id: 
            flash('Must be in team.', 'danger')
            return redirect(url_for('integrations'))
        
        webhook_url = request.form.get('slack_webhook_url')
        if not webhook_url or not webhook_url.startswith('https://hooks.slack.com/services/'):
            flash('Invalid Slack URL.', 'danger')
            return redirect(url_for('integrations'))
        
        user_team = Team.objects(id=current_user.team_id).first()
        if user_team:
            user_team.slack_webhook_url = webhook_url
            user_team.save()
            
            # Send integration success email
            send_integration_success_email(current_user.email, current_user.username, 'Slack')
            
            flash('Slack connected successfully! Confirmation email sent.', 'success')
        else:
            flash('Team not found.', 'danger')
        return redirect(url_for('integrations'))

    @app.route('/slack/disconnect')
    @login_required
    def slack_disconnect():
        # ... (unchanged) ...
        if current_user.team_id:
            user_team = Team.objects(id=current_user.team_id).first()
            if user_team and user_team.slack_webhook_url:
                user_team.slack_webhook_url = None
                user_team.save()
                flash('Slack disconnected.', 'success')
            else:
                flash('Slack not connected.', 'warning')
        else:
            flash('Slack not connected.', 'warning')
        return redirect(url_for('integrations'))

    # --- JIRA ROUTES (Unchanged) ---
    @app.route('/jira/connect', methods=['POST'])
    @login_required
    def jira_connect():
        # ... (unchanged) ...
        jira_url, email, api_token = request.form.get('jira_url'), request.form.get('jira_email'), request.form.get('jira_api_token')
        
        if not all([jira_url, email, api_token]): 
            flash('All Jira fields required.', 'danger')
            return redirect(url_for('integrations'))
        
        if not jira_url.startswith('https://') or not jira_url.endswith('.atlassian.net'):
            flash('Invalid Jira URL.', 'danger')
            return redirect(url_for('integrations'))
        
        # Check if credentials already exist
        creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        if not creds:
            creds = JiraCredentials(user_id=str(current_user.id))
        
        creds.jira_url = jira_url.rstrip('/')
        creds.email = email
        creds.api_token = api_token
        
        try:
            creds.save()
            # Send integration success email
            send_integration_success_email(current_user.email, current_user.username, 'Jira')
            flash('Jira connected successfully! Confirmation email sent.', 'success')
        except Exception as e:
            flash(f'Jira save failed: {e}', 'danger')
        return redirect(url_for('integrations'))

    @app.route('/jira/disconnect')
    @login_required
    def jira_disconnect():
        # ... (unchanged) ...
        creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        if creds:
            try:
                creds.delete()
                flash('Jira disconnected.', 'success')
            except Exception as e:
                flash(f'Jira disconnect failed: {e}', 'danger')
        else:
            flash('Jira not connected.', 'warning')
        return redirect(url_for('integrations'))

    @app.route('/docs')
    def docs():
        """Documentation page for the application"""
        return render_template('docs.html')

    return app


if __name__ == '__main__':
    app = create_app()
    # MongoDB doesn't need table creation like SQL databases
    print("🚀 AI Meeting Agent with MongoDB ready!")
    app.run(debug=True)
