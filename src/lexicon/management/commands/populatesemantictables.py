from django.core.management import BaseCommand
from lexicon.models import (RapidWords, WordNet)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = """Extract a random subset of a full dictionary for testing"""

    def handle(self, **options):
        cl, _created = RapidWords.objects.get_or_create()
