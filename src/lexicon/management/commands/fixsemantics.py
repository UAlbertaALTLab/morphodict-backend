from django.core.management import BaseCommand
from lexicon.models import RapidWords, Wordform
from tqdm import tqdm


class Command(BaseCommand):
    help = """Add a leading space and a trailing semicolon to all semantic entries"""

    def handle(self, **options):
        words = Wordform.objects.all()
        for word in tqdm(words):
            if word.rw_indices:
                if not word.rw_indices.startswith(" "):
                    word.rw_indices = " " + word.rw_indices
                if not word.rw_indices.endswith(";"):
                    word.rw_indices = word.rw_indices + ";"
            if word.rw_domains:
                if not word.rw_domains.startswith(" "):
                    word.rw_domains = " " + word.rw_domains
                if not word.rw_domains.endswith(";"):
                    word.rw_domains = word.rw_domains + ";"
            if word.wn_synsets:
                if not word.wn_synsets.startswith(" "):
                    word.wn_synsets = " " + word.wn_synsets
                if not word.wn_synsets.endswith(";"):
                    word.wn_synsets = word.wn_synsets + ";"
            word.save()
