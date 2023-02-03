# Generated by Django 3.2 on 2021-05-07 16:57

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("API", "0004_more_wordform_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="wordform",
            name="paradigm",
            field=models.CharField(
                default=None,
                help_text="If provided, this is the name of a static paradigm that this wordform belongs to. This name should match the filename in res/layouts/static/ WITHOUT the file extension.",
                max_length=50,
                null=True,
            ),
        ),
    ]
