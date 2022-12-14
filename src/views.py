from __future__ import annotations

import json
import logging
import urllib
from pathlib import Path

import numpy as np
from typing import Any, Dict, Literal, Optional

import json

from http import HTTPStatus
from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view
import paradigm_panes
from rest_framework.response import Response

from relabelling import Relabelling
from helpers import *

import requests
from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseNotFound
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET

import analysis
from API.search import presentation, search_with_affixes
from forms import WordSearchForm
from paradigm.generation import default_paradigm_manager
from phrase_translate.translate import (
    eng_noun_entry_to_inflected_phrase_fst,
    eng_phrase_to_crk_features_fst,
    eng_verb_entry_to_inflected_phrase_fst,
)
from crkeng.app.preferences import DisplayMode, AnimateEmoji, ShowEmoji
from lexicon.models import Wordform

from paradigm.manager import ParadigmDoesNotExistError
from paradigm.panes import Paradigm
from helpers import url_for_query

# The index template expects to be rendered in the following "modes";
# The mode dictates which variables MUST be present in the context.
IndexPageMode = Literal["home-page", "search-page", "word-detail", "info-page"]

logger = logging.getLogger(__name__)

# "pragma: no cover" works with coverage.
# It excludes the clause or line (could be a function/class/if else block) from coverage
# it should be used on the view functions that are well covered by integration tests


@staff_member_required()
def fst_tool(request):
    context = {}

    context["fst_tool_samples"] = settings.FST_TOOL_SAMPLES

    text = request.GET.get("text", None)
    if text is not None:
        context.update({"text": text, "repr_text": repr(text)})

    def decode_foma_results(fst, query):
        return [r.decode("UTF-8") for r in fst[query]]

    if text is not None:
        context["analyses"] = {
            "relaxed_analyzer": analysis.relaxed_analyzer().lookup(text),
            "strict_analyzer": analysis.strict_analyzer().lookup(text),
            "strict_generator": analysis.strict_generator().lookup(text),
            "eng_noun_entry2inflected-phrase": decode_foma_results(
                eng_noun_entry_to_inflected_phrase_fst(), text
            ),
            "eng_verb_entry2inflected-phrase": decode_foma_results(
                eng_verb_entry_to_inflected_phrase_fst(), text
            ),
            "eng_phrase_to_crk_features": decode_foma_results(
                eng_phrase_to_crk_features_fst(), text
            ),
        }

    return render(request, "CreeDictionary/fst-tool.html", context)


def google_site_verification(request):
    code = settings.GOOGLE_SITE_VERIFICATION
    return HttpResponse(
        f"google-site-verification: google{code}.html",
        content_type="text/html; charset=UTF-8",
    )


@api_view(
    [
        "GET",
    ]
)
def word_details_api(request, slug: str):
    """
    Head word detail page. Will render a paradigm, if applicable. Fallback to search
    page if no slug is not found.

    :param slug: the stable unique ID of the lemma
    :return:

    :raise 300 Multiple Choices: the frontend should redirect to /search/?q=<slug>
    :raise 404 Not Found: when the lemma-id or paradigm size isn't found in the database
    """
    lemma = Wordform.objects.filter(slug=slug, is_lemma=True)

    if lemma.count() == 0:
        return HttpResponseNotFound("lemma not found")
    elif lemma.count() > 1:
        # This should only ever come up when the user inputs the url directly. If it does, the frontend should redirect to the search page.
        return HttpResponse(status=HTTPStatus.MULTIPLE_CHOICES)

    lemma = lemma.get()

    paradigm_size = ""
    paradigm_sizes = []
    paradigm = lemma.paradigm

    wordform = presentation.serialize_wordform(
        lemma,
        animate_emoji=AnimateEmoji.current_value_from_request(request),
        show_emoji=ShowEmoji.current_value_from_request(request),
        dict_source=get_dict_source(request),
    )
    wordform = wordform_morphemes(wordform)
    wordform = wordform_orth(wordform)
    recordings = []
    for source in settings.SPEECH_DB_EQ:
        url = f"https://speech-db.altlab.app/{source}/api/bulk_search"
        matched_recs = get_recordings_from_url_with_speaker_info([lemma], url)
        if matched_recs:
            recordings.extend(matched_recs)

    if paradigm is not None:
        FST_DIR = settings.BASE_DIR / "res" / "fst"
        paradigm_manager = default_paradigm_manager()
        pane_generator = paradigm_panes.PaneGenerator()
        pane_generator.set_layouts_dir(settings.LAYOUTS_DIR)
        pane_generator.set_fst_filepath(
            FST_DIR / settings.STRICT_GENERATOR_FST_FILENAME
        )
        try:
            paradigm_sizes = list(paradigm_manager.sizes_of(paradigm))
        except ParadigmDoesNotExistError:
            return HttpResponseNotFound("bad paradigm size")

        if "full" in paradigm_sizes:
            default_size = "full"
        else:
            default_size = paradigm_sizes[0]

        if len(paradigm_sizes) <= 1:
            paradigm_size = default_size
        else:
            paradigm_size = request.GET.get("paradigm-size")
            if paradigm_size:
                paradigm_size = paradigm_size.lower()
            if paradigm_size not in paradigm_sizes:
                paradigm_size = default_size

        paradigm = pane_generator.generate_pane(lemma, paradigm, paradigm_size)
        paradigm = get_recordings_from_paradigm(paradigm, request)
        paradigm = inflect_paradigm(paradigm)

    content = {
        "entry": {
            "lemma_id": lemma.id,
            "wordform": wordform,
            "paradigm": paradigm,
            "paradigm_size": paradigm_size,
            "paradigm_sizes": paradigm_sizes,
            "recordings": recordings,
        }
    }

    return Response(content)


@api_view(["GET"])
def search_api(request):
    """
    homepage with optional initial search results to display

    :param request:
    :return:
    """
    query_string = request.GET.get("name")
    print(query_string)
    dict_source = get_dict_source(request)
    search_run = None
    include_auto_definitions = request.user.is_authenticated
    context = dict()

    if query_string:
        search_run = search_with_affixes(
            query_string,
            include_auto_definitions=include_auto_definitions,
        )
        search_results = search_run.serialized_presentation_results(
            display_mode=DisplayMode.current_value_from_request(request),
            dict_source=dict_source,
        )
        did_search = True

    else:
        query_string = ""
        search_results = []
        did_search = False

    context.update(
        word_search_form=request.data.get("name"),
        query_string=query_string,
        search_results=search_results,
        did_search=did_search,
    )

    context["show_dict_source_setting"] = settings.SHOW_DICT_SOURCE_SETTING
    if search_run and search_run.verbose_messages and search_run.query.verbose:
        context["verbose_messages"] = json.dumps(
            search_run.verbose_messages, indent=2, ensure_ascii=False
        )

    context["search_results"] = fetch_single_recording(
        context["search_results"], request
    )

    for result in context["search_results"]:
        result["wordform_text"] = wordform_orth_text(result["wordform_text"])
        result["lemma_wordform"]["wordform_text"] = wordform_orth_text(
            result["lemma_wordform"]["text"]
        )
        if "inflectional_category" in result["lemma_wordform"]:
            result["lemma_wordform"][
                "inflectional_category_relabelled"
            ] = relabelInflectionalCategory(
                result["lemma_wordform"]["inflectional_category"]
            )
        if "relabelled_fst_analysis" in result:
            result["relabelled_fst_analysis"] = relabelFSTAnalysis(
                result["relabelled_fst_analysis"]
            )

    return Response(context)


def fetch_single_recording(results, request):
    query_terms = []
    for result in results:
        query_terms.append(result["wordform_text"])

    speech_db_eq = settings.SPEECH_DB_EQ
    matched_recordings = {}

    for search_terms in divide_chunks(query_terms, 30):
        for source in speech_db_eq:
            url = f"https://speech-db.altlab.app/{source}/api/bulk_search"
            matched_recordings.update(get_recordings_from_url(search_terms, url))

    for result in results:
        if result["wordform_text"] in matched_recordings:
            result["recording"] = matched_recordings[result["wordform_text"]][
                "recording_url"
            ]
        else:
            result["recording"] = ""

    return results


def relabelInflectionalCategory(ic):
    with open(Path(settings.RESOURCES_DIR / "altlabel.tsv")) as f:
        labels = Relabelling.from_tsv(f)
    if not labels:
        return ic
    ling_long = labels.linguistic_long.get_longest(ic)
    ling_short = labels.linguistic_short.get_longest(ic)
    plain_english = labels.english.get_longest(ic)
    source_language = labels.source_language.get_longest(ic)
    ret = {
        "linguistic_long": ling_long,
        "linguistic_short": ling_short,
        "plain_english": plain_english,
        "source_language": source_language,
    }
    return ret


def relabelFSTAnalysis(analysis):
    ling_long = []
    ling_short = []
    source_language = []
    english = []
    with open(Path(settings.RESOURCES_DIR / "altlabel.tsv")) as f:
        labels = Relabelling.from_tsv(f)
    if not labels:
        return {
            "linguistic_long": analysis["label"],
            "linguistic_short": analysis["label"],
            "plain_english": analysis["label"],
            "source_language": analysis["label"],
        }

    for item in analysis:
        tags = item["tags"]
        print("TAGS:", tags)
        ling_long.append(labels.linguistic_long.get_longest(tags))
        ling_short.append(labels.linguistic_short.get_longest(tags))
        source_language.append(labels.source_language.get_longest(tags))
        english.append(labels.english.get_longest(tags))

    return {
        "linguistic_long": ling_long,
        "linguistic_short": ling_short,
        "plain_english": english,
        "source_language": source_language,
    }
