from __future__ import annotations

#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
from hfst_optimized_lookup import Analysis

from analysis import RichAnalysis, rich_analyze_strict

"""
Helper functions for the views file.
"""

from urllib.parse import ParseResult, urlencode, urlunparse
import time
import urllib
import logging
from typing import Optional
from pathlib import Path

import requests
from django.conf import settings

from paradigm.generation import default_paradigm_manager
from crkeng.app.preferences import DictionarySource
from lexicon.models import Wordform

from paradigm.panes import Paradigm
from morphodict.templatetags.morphodict_orth import ORTHOGRAPHY
from relabelling import Relabelling, read_labels

from shared_res_dir import shared_res_dir


from django.urls import reverse
from django.conf import settings


def get_morphodict_language_pair():
    return settings.MORPHODICT_SOURCE_LANGUAGE + settings.MORPHODICT_TARGET_LANGUAGE


logger = logging.getLogger(__name__)


def url_for_query(user_query: str) -> str:
    """
    Produces a relative URL to search for the given user query.
    """
    parts = ParseResult(
        scheme="",
        netloc="",
        params="",
        path=reverse("cree-dictionary-search"),
        query=urlencode((("q", user_query),)),
        fragment="",
    )
    return urlunparse(parts)


def get_dict_source(request):
    """
    Returns a dictionary source given a request.

    :param request:
    :return:
    """
    if dictionary_source := DictionarySource.current_value_from_request(request):
        if dictionary_source:
            ret = dictionary_source.split("+")
            ret = [r.upper() for r in ret]
            return ret
    return None


# Consider moving function the contents of this function to presentation.serialize_wordform
def wordform_orth(wordform):
    """
    Modifies a serialized wordform object. The text and inflectional_catagory_plain_english fields are modifed to
    contain a dictionary containing all orthographic representations of their text given in Standard Roman Orthography.

    e.g.,

        'wâpamêw'

    becomes:

        {
            "Latn": "wâpamêw",
            "Latn-x-macron": "wāpamēw",
            "Cans": "ᐚᐸᒣᐤ"
        }

    :param wordform:
    :return:
    """
    ret_wordform = {}
    try:
        ret_wordform["text"] = {
            code: ORTHOGRAPHY.converter[code](wordform["text"])
            for code in ORTHOGRAPHY.available
        }
        ret_wordform["inflectional_category_plain_english"] = {
            code: "like: "
            + ORTHOGRAPHY.converter[code](
                wordform["inflectional_category_plain_english"][6:]
            )
            for code in ORTHOGRAPHY.available
        }

    except TypeError:
        ret_wordform["text"] = {"Latn": wordform["text"]}
        # wordform["inflectional_category_plain_english"] = {"Latn": wordform["inflectional_category_plain_english"]}
    except KeyError:
        ret_wordform["text"] = {"Latn": wordform["text"]}

    for key in wordform:
        if key not in ret_wordform:
            ret_wordform[key] = wordform[key]

    return ret_wordform


def wordform_orth_text(wordform):
    """
    Modifies a serialized wordform object. The text and inflectional_catagory_plain_english fields are modifed to
    contain a dictionary containing all orthographic representations of their text given in Standard Roman Orthography.

    e.g.,

        'wâpamêw'

    becomes:

        {
            "Latn": "wâpamêw",
            "Latn-x-macron": "wāpamēw",
            "Cans": "ᐚᐸᒣᐤ"
        }

    :param wordform:
    :return:
    """
    try:
        ret_wordform = {}
        for code in ORTHOGRAPHY.available:
            ret_wordform[code] = ORTHOGRAPHY.converter[code](wordform)
    except TypeError:
        ret_wordform = {"Latn": wordform}
    except KeyError:
        ret_wordform = {"Latn": wordform}
    return ret_wordform


def wordform_morphemes(wordform):
    morphemes = {}
    raw_analysis = wordform["raw_analysis"]
    if not raw_analysis:
        raw_analysis = Analysis((), wordform["text"], ())
    if rich_analysis := RichAnalysis(raw_analysis):
        parts = rich_analysis.generate_with_morphemes(wordform["text"])
        if not parts:
            return wordform
        for part in parts:
            part = wordform_orth_text(part)
            print(part)
            for orth in part:
                if orth not in morphemes:
                    morphemes[orth] = []
                morphemes[orth].append(part[orth])
    wordform["morphemes"] = morphemes
    return wordform


def orth(word):
    """
    Returns a dictionary containing all orthographic representations of a word given in
    Standard Roman Orthography.

    e.g.,

        'wâpamêw'

    Returns:

        {
            "Latn": "wâpamêw",
            "Latn-x-macron": "wāpamēw",
            "Cans": "ᐚᐸᒣᐤ"
        }

    :param word: a word given in SRO with macrons as circumflex
    :return:
    """
    try:
        return {
            code: ORTHOGRAPHY.converter[code](word) for code in ORTHOGRAPHY.available
        }
    except TypeError:
        return {"Latn": word}


# Yield successive n-sized
# chunks from l.
# https://www.geeksforgeeks.org/break-list-chunks-size-n-python/
def divide_chunks(terms, size):
    # looping till length l
    for i in range(0, len(terms), size):
        yield terms[i : i + size]


def inflect_paradigm(paradigm):
    for header in paradigm:
        if "rows" in paradigm[header]:
            for row in paradigm[header]["rows"]:
                if "subheader" in row:
                    continue
                if "inflections" in row:
                    for inflection in row["inflections"]:
                        wordform = inflection["wordform"]
                        analysis = rich_analyze_strict(wordform)
                        if analysis:
                            analysis = analysis[0]
                            parts = analysis.generate_with_morphemes(wordform)
                            morphemes = {}
                            for part in parts:
                                part = wordform_orth_text(part)
                                for orth in part:
                                    if orth not in morphemes:
                                        morphemes[orth] = []
                                    morphemes[orth].append(part[orth])
                            if not morphemes:
                                for orth in ORTHOGRAPHY.available:
                                    morphemes[orth] = [wordform]
                            inflection["morphemes"] = morphemes
                        inflection["wordform_text"] = wordform_orth_text(wordform)

    return paradigm


def label_setting_to_relabeller(label_setting: str):
    labels = read_labels()

    return {
        "english": labels.english,
        "linguistic": labels.linguistic_short,
        "source_language": labels.source_language,
    }.get(label_setting, labels.english)


def update_field(labels, row, title, part):
    row[title]["ling_long"] += (
        " " + labels.linguistic_long[part]
        if labels.linguistic_long[part]
        else str(part)
    )
    row[title]["ling_short"] += (
        " " + labels.linguistic_short[part]
        if labels.linguistic_short[part]
        else " " + labels.linguistic_long[part]
        if " " + labels.linguistic_long[part]
        else str(part)
    )
    row[title]["plain_english"] += (
        " " + labels.english[part] if labels.english[part] else str(part)
    )
    row[title]["source_language"] += (
        " " + labels.source_language[part]
        if labels.source_language[part]
        else str(part)
    )
    return row


def relabel_paradigm(paradigm):
    print(settings.SHARED_RES_DIR)
    with open(Path(settings.SHARED_RES_DIR / "altlabel.tsv")) as f:
        labels = Relabelling.from_tsv(f)
    if not labels:
        return paradigm

    for header in paradigm:
        paradigm[header]["relabelled_header"] = {}
        fixed_header = header.replace("*", "")
        fixed_header = fixed_header.replace("+", " ")
        fixed_header = fixed_header.strip()
        split_header = fixed_header.split(" ")
        tuple_header = tuple(s for s in split_header if s)
        paradigm[header]["relabelled_header"]["ling_long"] = ""
        paradigm[header]["relabelled_header"]["ling_short"] = ""
        paradigm[header]["relabelled_header"]["plain_english"] = ""
        paradigm[header]["relabelled_header"]["source_language"] = ""
        # for part in split_header:
        #     if part:
        try:
            paradigm[header] = update_field(
                labels, paradigm[header], "relabelled_header", tuple_header
            )
        except KeyError as e:
            for part in split_header:
                if part:
                    paradigm[header] = update_field(
                        labels, paradigm[header], "relabelled_header", tuple([part])
                    )

        if "rows" in paradigm[header]:
            for row in paradigm[header]["rows"]:
                if "subheader" in row:
                    subheader = row["subheader"]
                    # subheader = tuple(subheader)
                    row["subheader"] = {}
                    subheader_parts = subheader.split("+")
                    subheader_tuple = tuple(subheader_parts)
                    row["subheader"]["ling_long"] = ""
                    row["subheader"]["ling_short"] = ""
                    row["subheader"]["plain_english"] = ""
                    row["subheader"]["source_language"] = ""
                    # for part in subheader_parts:
                    try:
                        row = update_field(labels, row, "subheader", subheader_tuple)
                    except KeyError as e:
                        for part in subheader_parts:
                            try:
                                row = update_field(
                                    labels, row, "subheader", tuple([part])
                                )
                            except KeyError as e:
                                row["subheader"]["ling_long"] += " " + part
                                row["subheader"]["ling_short"] += " " + part
                                row["subheader"]["plain_english"] += " " + part
                                row["subheader"]["source_language"] += " " + part

                elif "label" in row:
                    label = row["label"]
                    # label = label.strip()
                    # label = label.replace(' ', '+')
                    label = label.split(" ")
                    label = tuple(label)
                    row["label"] = {}
                    # label_parts = label.split(' ')
                    row["label"]["ling_long"] = ""
                    row["label"]["ling_short"] = ""
                    row["label"]["plain_english"] = ""
                    row["label"]["source_language"] = ""
                    # for part in label_parts:
                    try:
                        row = update_field(labels, row, "label", label)
                    except KeyError as e:
                        print(e)
                        print("In the catch")
                        part_parts = list(label)
                        for part in part_parts:
                            try:
                                row = update_field(labels, row, "label", part)
                            except KeyError as e:
                                row["label"]["ling_long"] += " " + part
                                row["label"]["ling_short"] += " " + part
                                row["label"]["plain_english"] += " " + part
                                row["label"]["source_language"] += " " + part

    return paradigm


def should_include_auto_definitions(request):
    return False if request.COOKIES.get("auto_translate_defs") == "no" else True


def should_inflect_phrases(request):
    return False if request.COOKIES.get("inflect_english_phrase") == "no" else True


def get_recordings_from_paradigm(paradigm, request):
    start = time.time()
    if request.COOKIES.get("paradigm_audio") == "no":
        return paradigm

    query_terms = paradigm.get_all_wordforms()
    matched_recordings = {}
    if source := request.COOKIES.get("audio_source"):
        if source != "both":
            speech_db_eq = [remove_diacritics(source)]
        else:
            speech_db_eq = settings.SPEECH_DB_EQ
    else:
        speech_db_eq = settings.SPEECH_DB_EQ
    if speech_db_eq == ["_"]:
        return paradigm

    if request.COOKIES.get("synthesized_audio_in_paradigm") == "yes":
        speech_db_eq.insert(0, "synth")
    query_terms = [
        query_terms[0],
        query_terms[1],
        query_terms[2],
        query_terms[3],
        query_terms[4],
    ]
    for search_terms in divide_chunks(query_terms, 30):
        for source in speech_db_eq:
            url = f"https://speech-db.altlab.app/{source}/api/bulk_search"
            matched_recordings.update(get_recordings_from_url(search_terms, url))
    end = time.time()
    print(end - start)
    paradigm = paradigm.bulk_add_recordings(matched_recordings)
    return paradigm


def get_recordings_from_url(search_terms, url):
    matched_recordings = {}
    query_params = [("q", term) for term in search_terms]
    response = requests.get(url + "?" + urllib.parse.urlencode(query_params))
    if response.status_code == 200:
        recordings = response.json()

        for recording in recordings["matched_recordings"]:
            entry = macron_to_circumflex(recording["wordform"])
            matched_recordings[entry] = {}
            matched_recordings[entry]["recording_url"] = recording["recording_url"]
            matched_recordings[entry]["speaker"] = recording["speaker"]

    return matched_recordings


def get_recordings_from_url_with_speaker_info(search_terms, url):
    query_params = [("q", term) for term in search_terms]
    response = requests.get(url + "?" + urllib.parse.urlencode(query_params))
    if response.status_code == 200:
        recordings = response.json()
        return recordings["matched_recordings"]
    else:
        return []


def macron_to_circumflex(item):
    """
    >>> macron_to_circumflex("wāpamēw")
    'wâpamêw'
    """
    item = item.translate(str.maketrans("ēīōā", "êîôâ"))
    return item


def remove_diacritics(item):
    """
    >>> remove_diacritics("mōswacīhk")
    'moswacihk'
    >>> remove_diacritics("maskwacîs")
    'maskwacis'
    """
    item = item.translate(str.maketrans("ēīōāêîôâ", "eioaeioa"))
    return item
