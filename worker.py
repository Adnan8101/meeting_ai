import os
import schedule
import time
from trello import TrelloClient
from dotenv import load_dotenv

from app_logging import app_logger, integration_logger, log_error
from main_app import create_app
from models import TrelloCard, TrelloCredentials, User

load_dotenv()

TRELLO_API_KEY = os.environ.get("TRELLO_API_KEY")
TRELLO_API_SECRET = os.environ.get("TRELLO_API_SECRET")

app = create_app()


def check_trello_tasks():
    """Worker job to inspect tracked Trello card movement."""
    app_logger.info(f"Running accountability check at {time.ctime()}")

    with app.app_context():
        try:
            trello_credentials = TrelloCredentials.objects()
            if not trello_credentials:
                return

            for creds in trello_credentials:
                user = User.objects(id=creds.user_id).first()
                if not user:
                    continue

                client = TrelloClient(
                    api_key=TRELLO_API_KEY,
                    api_secret=TRELLO_API_SECRET,
                    token=creds.token,
                )

                tracked_cards = TrelloCard.objects(user_id=creds.user_id)
                for card_record in tracked_cards:
                    try:
                        card = client.get_card(card_record.card_id)
                        if card.list_id != card_record.list_id:
                            integration_logger.info(
                                "STATUS UPDATE: Task '%s' moved to '%s'",
                                card.name,
                                card.get_list().name,
                            )
                    except Exception as exc:
                        integration_logger.warning(
                            "Could not fetch card ID %s. Error: %s",
                            card_record.card_id,
                            str(exc),
                        )
        except Exception as exc:
            app_logger.error(f"Error in check_trello_tasks: {str(exc)}")
            log_error(app_logger, exc)


if __name__ == "__main__":
    schedule.every(1).minutes.do(check_trello_tasks)
    app_logger.info("AI accountability worker started")

    while True:
        schedule.run_pending()
        time.sleep(1)
