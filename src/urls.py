"""
Definition of urls for CreeDictionary.
"""

from django.conf import settings
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path
from django_js_reverse.views import urls_js

import API.views as api_views
import views
from sitemaps import sitemaps

# TODO: use URL namespaces:
# e.g., cree-dictionary:index instead of cree-dictionary-index
# See: https://docs.djangoproject.com/en/2.2/topics/http/urls/#url-namespaces

urlpatterns = [
    ################################# Internal API #################################
    path("api/", views.search_api, name="search-api"),  # main page
    path(
        "api/search/", views.search_api, name="full-search-api"
    ),  # word_search returns wordforms as json
    path("api/rapidwords/", views.semantic_api, name="rw-semantic-search-api"),
    path(
        "api/word/<str:slug>/",
        views.word_details_api,
        name="word-details-api",
    ),
    path(
        "api/wordnet/<str:classification>", views.wordnet_api, name="wordnet-search-api"
    ),
    ################################ Click in text #################################
    # cree word translation for click-in-text
    path(
        "click-in-text/",
        api_views.click_in_text,
        name="cree-dictionary-word-click-in-text-api",
    ),
    path(
        "click-in-text-embedded-test/",
        api_views.click_in_text_embedded_test,
        name="cree-dictionary-click-in-text-embedded-test",
    ),
    ############################## Other applications ##############################
    path("admin/", admin.site.urls),
    path("search-quality/", include("search_quality.urls")),
    path("", include("morphodict.urls")),
    path(
        "sitemap.xml",
        sitemap,
        {"sitemaps": sitemaps},
        name="django.contrib.sitemaps.views.sitemap",
    ),
    ################################# Special URLS #################################
    # Reverse URLs in JavaScript:  https://github.com/ierror/django-js-reverse
    path("jsreverse", urls_js, name="js_reverse"),
]

if hasattr(settings, "GOOGLE_SITE_VERIFICATION"):
    urlpatterns.append(
        path(
            f"google{settings.GOOGLE_SITE_VERIFICATION}.html",
            views.google_site_verification,
        )
    )

if settings.DEBUG:
    # saves the need to `manage.py collectstatic` in development
    urlpatterns += staticfiles_urlpatterns()

if settings.DEBUG and settings.ENABLE_DJANGO_DEBUG_TOOLBAR:
    import debug_toolbar

    # necessary for debug_toolbar to work
    urlpatterns.append(path("__debug__/", include(debug_toolbar.urls)))
