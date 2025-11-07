import os
import schedule
import time
from trello import TrelloClient
import mongoengine
from mongo_models import User, TrelloCard, TrelloCredentials
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
# Use the same Trello API Key as your main app
TRELLO_API_KEY = os.environ.get("TRELLO_API_KEY")
TRELLO_API_SECRET = os.environ.get("TRELLO_API_SECRET")
MONGO_URL = os.environ.get("MONGO_URL")

# Connect to MongoDB
if MONGO_URL:
    mongoengine.connect(host=MONGO_URL)
else:
    mongoengine.connect('ai_meeting_agent')


def check_trello_tasks():
    """
    The main job for the worker. It checks the status of all tracked Trello cards.
    """
    print(f"--- Running accountability check at {time.ctime()} ---")

    try:
        # Find all users who have connected their Trello account
        trello_credentials = TrelloCredentials.objects()

        if not trello_credentials:
            print("No users with Trello integrations to check.")
            return

        for creds in trello_credentials:
            user = User.objects(id=creds.user_id).first()
            if not user:
                continue
                
            client = TrelloClient(
                api_key=TRELLO_API_KEY,
                api_secret=TRELLO_API_SECRET,
                token=creds.token
            )

            # Get all cards created by this user from our database
            tracked_cards = TrelloCard.objects(user_id=creds.user_id)
            if not tracked_cards:
                print("  -> No tracked cards found for this user.")
                continue

            # In a real app, you would let the user define their "Done" list
            # For now, we'll assume any card moved from its original list is progressing.
            for card_record in tracked_cards:
                try:
                    card = client.get_card(card_record.card_id)
                    if card.list_id != card_record.list_id:
                        print(
                            f"  -> STATUS UPDATE: Task '{card.name}' has been moved to a new list '{card.get_list().name}'.")
                    else:
                        print(f"  -> STATUS OK: Task '{card.name}' is still in its original list.")
                except Exception as e:
                    # This can happen if the card was deleted in Trello
                    print(
                        f"  -> ERROR: Could not fetch card ID {card_record.card_id}. It may have been deleted. Error: {e}")


if __name__ == "__main__":
    # For testing, we'll run the job every 1 minute.
    # For production, you would change this to schedule.every().day.at("09:00")
    schedule.every(1).minutes.do(check_trello_tasks)

    print("--- AI Accountability Worker Started ---")
    print("Waiting for scheduled job...")

    while True:
        schedule.run_pending()
        time.sleep(1)
