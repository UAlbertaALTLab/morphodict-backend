from django.conf import settings    # type: ignore


def get_morphodict_language_pair():
    return settings.MORPHODICT_SOURCE_LANGUAGE + settings.MORPHODICT_TARGET_LANGUAGE
