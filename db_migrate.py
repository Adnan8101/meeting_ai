"""Create or update PostgreSQL tables for AI Meeting Agent."""

from main_app import create_app
from extensions import db


def migrate() -> None:
    app = create_app()
    with app.app_context():
        db.create_all()


if __name__ == "__main__":
    migrate()
    print("Database migration complete.")
