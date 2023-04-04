#!/usr/bin/env python3

from lexicon.models import Wordform     # type: ignore
from django.contrib.sitemaps import Sitemap     # type: ignore
from django.urls import reverse     # type: ignore


class WordformSitemap(Sitemap):
    """
    Make heads available in the sitemap.
    This way, web crawlers can index ALL THE WORDS!
    """

    protocol = "https"

    def items(self):
        # Use lemma_text_idx (is_lemma, text) index.
        return Wordform.objects.filter(is_lemma=True).order_by("is_lemma", "text")

    def location(self, item: Wordform):
        return item.get_absolute_url(ambiguity="allow")


class StaticViewSitemap(Sitemap):
    """
    Index static pages too!

    Note that the 'items' list needs to be manually maintained :/

    See: https://docs.djangoproject.com/en/2.2/ref/contrib/sitemaps/#sitemap-for-static-views
    """

    protocol = "https"

    def items(self):
        return ["index", "about", "contact-us"]

    def location(self, item):
        return reverse(f"cree-dictionary-{item}")


sitemaps = {
    "static": StaticViewSitemap,
    "words": WordformSitemap,
}
