import logging  # type: ignore
from functools import cache     # type: ignore
from hfst_optimized_lookup import TransducerFile    # type: ignore
from django.conf import settings    # type: ignore

logger = logging.getLogger(__name__)


@cache
def cmro_transcriptor():
    return TransducerFile(settings.BASE_DIR / "res" / "fst" / "default-to-cmro.hfstol")


def to_cmro(sro_circumflex: str) -> str:
    """
    Transliterate SRO to CMRO.
    """
    ret = cmro_transcriptor().lookup(sro_circumflex)

    if len(ret) == 1:
        return ret[0]

    if len(ret) == 0:
        logger.warning(f"No CMRO transcription for {sro_circumflex!r}")
        return sro_circumflex

    raise Exception(f"Multiple CMRO transcriptions for {sro_circumflex!r}")
