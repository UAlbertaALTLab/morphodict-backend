from __future__ import annotations

import json
import logging
from pathlib import Path
import time
from typing import Dict, Literal
from nltk.corpus import wordnet as wn


from http import HTTPStatus
from django.http import HttpResponse
from rest_framework.decorators import api_view
from paradigm_manager.manager import ParadigmManager
from rest_framework.response import Response

from relabelling import Relabelling
from helpers import *

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse, HttpResponseNotFound
from django.shortcuts import redirect, render

import analysis
from API.search import presentation, search_with_affixes
from phrase_translate.translate import (
    eng_noun_entry_to_inflected_phrase_fst,
    eng_phrase_to_crk_features_fst,
    eng_verb_entry_to_inflected_phrase_fst,
)
from crkeng.app.preferences import DisplayMode, AnimateEmoji, ShowEmoji
from lexicon.models import Wordform, RapidWords


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
        paradigm_manager = ParadigmManager(
            layout_directory=settings.LAYOUTS_DIR,
            generation_fst=FST_DIR / settings.STRICT_GENERATOR_FST_FILENAME,
        )
        paradigm_manager.set_lemma(lemma.text)
        paradigm_manager.set_paradigm(paradigm)
        paradigm_manager.generate()
        paradigm = get_recordings_from_paradigm(paradigm_manager, request)
        paradigm = inflect_paradigm(paradigm)
        paradigm = relabel_paradigm(paradigm)

    content = {
        "entry": {
            "lemma_id": lemma.id,
            "wordform": wordform,
            "paradigm": paradigm,
            "recordings": recordings,
        }
    }

    return Response(content)


@api_view(["GET"])
def semantic_api(request):
    """
    search endpoint for the semantic fields
    """
    query = request.GET.get("q")
    context = dict()
    if query:
        context["query"] = query
        if "." in query:
            rw = RapidWords.objects.filter(index=query).first()
        else:
            rw = RapidWords.objects.filter(domain=query).first()
        if not rw:
            context["response"] = "No results found"
            return Response(context)

        context["class"] = f"{rw.index} {rw.domain}"
        context["index"] = rw.index
        context["domain"] = rw.domain
        context["hypernyms"] = rw.hypernyms
        context["hyponyms"] = rw.hyponyms

    else:
        context["message"] = "Positional argument 'q' required"
    return Response(context)


@api_view(["GET"])
def search_api(request):
    """
    homepage with optional initial search results to display

    :param request:
    :return:
    """
    start = time.time()
    query_string = request.GET.get("name")
    rw_index = request.GET.get("rw_index")
    rw_domain = request.GET.get("rw_domain")
    wn_synset = request.GET.get("wn_synset")
    dict_source = get_dict_source(request)
    search_run = None
    include_auto_definitions = request.user.is_authenticated
    context = dict()

    if query_string or rw_index or rw_domain or wn_synset:
        search_run = search_with_affixes(
            query_string,
            rw_index,
            rw_domain,
            wn_synset,
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
    end = time.time()
    print(end - start)
    return Response(context)


def make_wordnet_format(wn_class):
    """
    Accepts: wn_class of format (n) bear 1
    No other formats are accepted.
    Returns: the WordNet package compatible version of the classification
        e.g. bear.n.01
    """
    parts = wn_class.split(" ")
    # now we have ["(pos)", "word", "num"]
    pos = parts[0].replace("(", "").replace(")", "")
    word = parts[1]
    num = int(parts[2])

    return f"{word}.{pos}.{num:02d}"


@api_view(["GET"])
def wordnet_api(request, classification):
    """
    The React accessible endpoint for the nltk WordNet corpus
    Accepts: wordnet classification in the form (for example):
        (n) bear 1
    Returns:
        - the WordNet synset for that entry
        - its sister terms (holonyms)
        - its direct hyponyms
        - its direct hypernyms
    """
    classification = make_wordnet_format(classification)
    context = dict()

    try:
        wn_class = wn.synset(classification)
    except:
        context["search_term"] = classification
        context["message"] = f"No synset found for {classification}"
        return Response(context)

    hypernyms = wn_class.hypernyms()
    hyponyms = wn_class.hyponyms()
    holonyms = wn_class.member_holonyms()

    context["search_term"] = classification
    context["hypernyms"] = [h.name() for h in hypernyms]
    context["hyponyms"] = [h.name() for h in hyponyms]
    context["holonyms"] = [h.name() for h in holonyms]

    return Response(context)


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
