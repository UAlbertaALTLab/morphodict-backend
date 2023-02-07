from django.core.management import BaseCommand
from lexicon.models import RapidWords, Wordform
from tqdm import tqdm


class Command(BaseCommand):
    help = """Add a leading space and a trailing semicolon to all semantic entries"""

    def handle(self, **options):
        words = Wordform.objects.all()
        for word in tqdm(words):
            if word.rw_indices:
                word.rw_indices = " " + word.rw_indices + ";"
            if word.rw_domains:
                word.rw_domains = " " + word.rw_domains + ";"
            if word.wn_synsets:
                word.wn_synsets = " " + word.wn_synsets + ";"
            word.save()
