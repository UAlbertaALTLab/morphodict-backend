from lexicon.test_db import get_test_words  # type: ignore


def test_test_db_words():
    assert "wâpamêw" in get_test_words()
