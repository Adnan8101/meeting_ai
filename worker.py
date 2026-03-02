import os
import schedule
import time
from trello import TrelloClient
import mongoengine
from mongo_models import User, TrelloCard, TrelloCredentials
from dotenv import load_dotenv

# Import logging configuration
from logger_config import app_logger, integration_logger, database_logger, log_error

load_dotenv()

app_logger.info("="*60)
app_logger.info("Starting AI Meeting Agent Worker")
app_logger.info("="*60)

# --- CONFIGURATION ---
# Use the same Trello API Key as your main app
TRELLO_API_KEY = os.environ.get("TRELLO_API_KEY")
TRELLO_API_SECRET = os.environ.get("TRELLO_API_SECRET")
# Support both MONGO_URI and MONGO_URL for backward compatibility
MONGO_URL = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")

# Log configuration
app_logger.info("Configuration loaded:")
app_logger.info(f"- TRELLO_API_KEY: {'✓ Set' if TRELLO_API_KEY else '✗ Missing'}")
app_logger.info(f"- TRELLO_API_SECRET: {'✓ Set' if TRELLO_API_SECRET else '✗ Missing'}")
app_logger.info(f"- MONGO_URL: {'✓ Set' if MONGO_URL else '✗ Missing'}")

# Connect to MongoDB
database_logger.info("Connecting to MongoDB...")
try:
    if MONGO_URL:
        start_time = time.time()
        mongoengine.connect(host=MONGO_URL)
        connection_time = (time.time() - start_time) * 1000
        database_logger.info(f"Connected to MongoDB (cloud) in {connection_time:.2f}ms")
    else:
        start_time = time.time()
        mongoengine.connect('ai_meeting_agent')
        connection_time = (time.time() - start_time) * 1000
        database_logger.info(f"Connected to local MongoDB in {connection_time:.2f}ms")
except Exception as e:
    database_logger.error(f"MongoDB connection failed: {str(e)}")
    log_error(database_logger, e)
    raise


def check_trello_tasks():
    """
    The main job for the worker. It checks the status of all tracked Trello cards.
    """
    app_logger.info("="*60)
    app_logger.info(f"Running accountability check at {time.ctime()}")
    app_logger.info("="*60)
    print(f"--- Running accountability check at {time.ctime()} ---")

    try:
        # Find all users who have connected their Trello account
        integration_logger.info("Fetching Trello credentials from database...")
        trello_credentials = TrelloCredentials.objects()

        if not trello_credentials:
            app_logger.info("No users with Trello integrations to check")
            print("No users with Trello integrations to check.")
            return
        
        integration_logger.info(f"Found {len(trello_credentials)} user(s) with Trello integration")

        for creds in trello_credentials:
            try:
                user = User.objects(id=creds.user_id).first()
                if not user:
                    integration_logger.warning(f"User not found for Trello credentials: {creds.user_id}")
                    continue
                
                integration_logger.info(f"Checking Trello tasks for user: {user.username}")
                
                client = TrelloClient(
                    api_key=TRELLO_API_KEY,
                    api_secret=TRELLO_API_SECRET,
                    token=creds.token
                )

                # Get all cards created by this user from our database
                tracked_cards = TrelloCard.objects(user_id=creds.user_id)
                if not tracked_cards:
                    integration_logger.info(f"No tracked cards for user: {user.username}")
                    print("  -> No tracked cards found for this user.")
                    continue
                
                integration_logger.info(f"Checking {len(tracked_cards)} card(s) for user: {user.username}")

                # In a real app, you would let the user define their "Done" list
                # For now, we'll assume any card moved from its original list is progressing.
                for card_record in tracked_cards:
                    try:
                        integration_logger.debug(f"Checking card: {card_record.card_id}")
                        card = client.get_card(card_record.card_id)
                        
                        if card.list_id != card_record.list_id:
                            message = f"STATUS UPDATE: Task '{card.name}' moved to '{card.get_list().name}'"
                            integration_logger.info(message)
                            print(f"  -> {message}")
                        else:
                            message = f"STATUS OK: Task '{card.name}' still in original list"
                            integration_logger.debug(message)
                            print(f"  -> {message}")
                    except Exception as e:
                        # This can happen if the card was deleted in Trello
                        error_msg = f"Could not fetch card ID {card_record.card_id}. It may have been deleted."
                        integration_logger.warning(f"{error_msg} Error: {str(e)}")
                        print(f"  -> ERROR: {error_msg} Error: {e}")
            
            except Exception as e:
                integration_logger.error(f"Error processing Trello credentials for user: {str(e)}")
                log_error(integration_logger, e)
                
    except Exception as e:
        app_logger.error(f"Error in check_trello_tasks: {str(e)}")
        log_error(app_logger, e)


if __name__ == "__main__":
    # For testing, we'll run the job every 1 minute.
    # For production, you would change this to schedule.every().day.at("09:00")
    schedule.every(1).minutes.do(check_trello_tasks)

    app_logger.info("="*60)
    app_logger.info("AI Accountability Worker Started")
    app_logger.info("Scheduled: Every 1 minute")
    app_logger.info("Waiting for scheduled job...")
    app_logger.info("="*60)
    
    print("--- AI Accountability Worker Started ---")
    print("Waiting for scheduled job...")

    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        app_logger.info("Worker stopped by user (KeyboardInterrupt)")
        print("\nWorker stopped by user")
    except Exception as e:
        app_logger.error(f"Worker crashed: {str(e)}")
        log_error(app_logger, e)
        raise
