from django.core.management import BaseCommand  # type: ignore
from lexicon.models import RapidWords, Wordform     # type: ignore
from tqdm import tqdm   # type: ignore


class Command(BaseCommand):
    help = """Turn the RW string into relationships to the RW table"""

    def handle(self, **options):
        words = Wordform.objects.all()
        for word in tqdm(words):
            rw = word.rw_indices
            if not rw:
                continue
            rw_split = rw.split(";")
            for i in rw_split:
                rw_object = RapidWords.objects.filter(index=i).first()
                word.rw_classes.add(rw_object)
            word.save()
