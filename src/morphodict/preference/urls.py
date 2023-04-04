"""
URLs defined for interacting with morphodict preferences.

Usage:
In your site URLConf, include() these URLs:

    # site/urls.py
    urlpatterns = [
        # ...
        path("preferences", include("morphodict.preference.urls")),
    ]
"""
from django.urls import path    # type: ignore

from . import views     # type: ignore

app_name = "morphodict-preference"
urlpatterns = [
    path("change/<name>", views.change_preference, name="change"),
]
