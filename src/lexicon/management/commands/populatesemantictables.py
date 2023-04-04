from django.core.management import BaseCommand  # type: ignore
from lexicon.models import RapidWords   # type: ignore
from tqdm import tqdm   # type: ignore


class Command(BaseCommand):
    help = """Fill in the RW table"""

    def handle(self, **options):
        # Populate RW table
        self.add_rapid_words()

    @staticmethod
    def add_rapid_words():
        # first clear the table
        RapidWords.objects.all().delete()

        # the populate the table
        lines = []
        with open("src/crkeng/res/RW_12345.txt") as f:
            lines = f.readlines()

        for line in tqdm(lines):
            line = line.replace("\n", "")
            if not line:
                continue
            split = line.split(" ")
            i = split[0]
            domain = " ".join(split[1:])
            cl = RapidWords.objects.create(
                domain=domain,
                index=i,
            )
            parts = i.split(".")
            hypernym = ""
            for j in range(0, len(parts) - 1):
                hypernym += parts[j]
                if j != len(parts) - 2:
                    hypernym += "."
            if not hypernym:
                continue
            hypernym_object = RapidWords.objects.get(index=hypernym)
            if cl.hypernyms:
                cl.hypernyms += f"; {hypernym} {hypernym_object.domain}"
            else:
                cl.hypernyms = f"{hypernym} {hypernym_object.domain}"

            if hypernym_object.hyponyms:
                hypernym_object.hyponyms += f"; {cl.index} {cl.domain}"
            else:
                hypernym_object.hyponyms = f"{cl.index} {cl.domain}"

            cl.save()
            hypernym_object.save()
