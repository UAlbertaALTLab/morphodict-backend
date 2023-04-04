from django.urls import path    # type: ignore

from . import views     # type: ignore

app_name = "morphodict"
urlpatterns = [
    path(
        "change-orthography",
        views.ChangeOrthography.as_view(),
        name="change-orthography",
    ),
]
