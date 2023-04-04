import logging  # type: ignore
import re   # type: ignore
from http import HTTPStatus # type: ignore
from typing import Dict, Optional   # type: ignore

import pytest   # type: ignore
from django.http import (
    HttpResponseBadRequest,
    HttpResponseNotAllowed,
    HttpResponseNotFound,
)   # type: ignore
from django.test import Client  # type: ignore
from django.urls import reverse # type: ignore
from pytest_django.asserts import assertInHTML  # type: ignore

from crkeng.app.preferences import DisplayMode  # type: ignore
from lexicon.models import Wordform # type: ignore

# The test wants an ID that never exists. Never say never; I have no idea if we'll
# have over two billion wordforms, however, we'll most likely run into problems once
# we exceed certain storage requirements. For example, the maximum for a signed,
# 32-bit int is a possible boundary condition that may cause issues elsewhere:
ID_THAT_SHOULD_BE_TOO_BIG = str(2**31 - 1)

RE_NUMERIC = re.compile(r"^-?[0-9]+(\.[0-9]+)?$")

@pytest.mark.django_db
def test_multiple_results_from_search(client: Client):
    """
    The paradigm returned from the full details page and the API endpoint should
    contain the exact same information.
    """
    lemma_text = "wâpamêw"

    # Get standalone page:
    response = client.get("/api/search/", {"name": lemma_text})
    assert response.status_code == HTTPStatus.OK
    standalone_html = response.content.decode("UTF-8")
    assert lemma_text in standalone_html

    results_size = getResultsSize(response.json())
    assert results_size > 1


@pytest.mark.django_db
def test_one_result_from_individual_page(client: Client):
    """
    The paradigm returned from the full details page and the API endpoint should
    contain the exact same information.
    """
    lemma_text = "wâpamêw"
    response = client.get(f"/api/search/?name={lemma_text}")
    assert response.status_code == HTTPStatus.OK
    standalone_html = response.content.decode("UTF-8")
    assert lemma_text in standalone_html

    results_size = getResultsSize(response.json())
    assert results_size == 1


####################################### Helpers ########################################


def is_template_error(record: logging.LogRecord) -> bool:
    """
    Looking for an error log that looks like this:

        Exception while resolving variable 'X' in template 'Y'.
        Traceback (most recent call last):
            ...
        SomeError: error

    """
    if record.name != "django.template":
        return False

    if not record.exc_info:
        return False

    return True


def getResultsSize(response) -> int:
    return len(response["search_results"])
