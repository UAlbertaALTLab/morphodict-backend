import json     # type: ignore
import random   # type: ignore
from argparse import ArgumentParser, BooleanOptionalAction  # type: ignore
from contextlib import contextmanager   # type: ignore

import sys  # type: ignore
from django.core.management import BaseCommand  # type: ignore
from django.db.models import prefetch_related_objects   # type: ignore
from tqdm import tqdm   # type: ignore

from API.search import search   # type: ignore
from ... import DEFAULT_SAMPLE_FILE     # type: ignore
from ...sample import load_sample_definition    # type: ignore


class Command(BaseCommand):
    help = """Run search queries from survey, dumping JSON of features"""

    def add_arguments(self, parser: ArgumentParser):
        group = parser.add_argument_group("featuredump-specific options")
        group.add_argument("--csv-file", default=DEFAULT_SAMPLE_FILE)
        group.add_argument(
            "--prefix-queries-with",
            default="",
            help="String to include in every; see the fancy queries help page for suggestions",
        )
        group.add_argument("--max", type=int, help="Only run this many queries")
        group.add_argument(
            "--output-file", help="File to write features to, in JSON format"
        )
        group.add_argument(
            "--shuffle",
            action=BooleanOptionalAction,
            help="Shuffle sample before running, useful with --max",
        )

    def handle(self, *args, **options) -> None:
        samples = load_sample_definition(options["csv_file"])
        if options["shuffle"]:
            random.shuffle(samples)
        if options["max"] is not None:
            samples = samples[: options["max"]]

        with output_file(options["output_file"]) as out:
            # Only display progress bar if output is redirected
            if not out.isatty():
                samples = tqdm(samples)

            for entry in samples:
                query = entry["Query"]

                results = search(
                    query=f"verbose:1 {options['prefix_queries_with']} {query}"
                ).sorted_results()
                prefetch_related_objects(
                    [r.wordform for r in results], "definitions__citations"
                )
                for i, r in enumerate(results):
                    ret = r.features()
                    ret["query"] = query
                    ret["wordform_text"] = r.wordform.text
                    ret["lemma_wordform_text"] = r.wordform.lemma.text
                    ret["definitions"] = [
                        [d.text, ", ".join(c.abbrv for c in d.citations.all())]
                        for d in r.wordform.definitions.all()
                        if d.auto_translation_source_id is None
                    ]
                    ret["webapp_sort_rank"] = i + 1
                    ret["pos_match"] = r.pos_match
                    ret["morpheme_ranking"] = r.morpheme_ranking
                    ret["glossary_count"] = r.glossary_count
                    ret["lemma_freq"] = r.lemma_freq
                    ret["is_espt_result"] = 1 if r.is_espt_result else 0
                    print(json.dumps(ret, ensure_ascii=False), file=out)


@contextmanager
def output_file(filename: str):
    """Context manager that yields an open file, defaulting to sys.stdout"""
    ret = sys.stdout
    should_close = False
    if filename:
        ret = open(filename, "w")
        should_close = True
    try:
        yield ret
    finally:
        if should_close:
            ret.close()
