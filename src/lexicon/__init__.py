from pathlib import Path    # type: ignore

from django.conf import settings    # type: ignore

from .helpers import get_morphodict_language_pair   # type: ignore

DICTIONARY_RESOURCE_DIR = settings.BASE_DIR / "res" / "dictionary"

DEFAULT_FULL_IMPORTJSON_FILE = DICTIONARY_RESOURCE_DIR / (
    f"{get_morphodict_language_pair()}_dictionary.importjson"
)
DEFAULT_TEST_IMPORTJSON_FILE = DICTIONARY_RESOURCE_DIR / (
    f"{get_morphodict_language_pair()}_test_db.importjson"
)

DEFAULT_IMPORTJSON_FILE = (
    DEFAULT_TEST_IMPORTJSON_FILE
    if settings.USE_TEST_DB
    else DEFAULT_FULL_IMPORTJSON_FILE
)

MORPHODICT_LEXICON_RESOURCE_DIR = Path(__file__).parent / "res"
