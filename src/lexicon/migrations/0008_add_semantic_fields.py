# Generated by Django 3.2.18 on 2023-04-04 22:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lexicon', '0007_merge_20211001_1712'),
    ]

    operations = [
        migrations.CreateModel(
            name='RapidWords',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(help_text='The domain of this class', max_length=2048)),
                ('index', models.CharField(help_text='The index of this class', max_length=64, unique=True)),
                ('hypernyms', models.CharField(blank=True, help_text='A string list of hypernym indexes and domains', max_length=1024, null=True)),
                ('hyponyms', models.CharField(blank=True, help_text='A string list of hyponyms indexes and domains', max_length=1024, null=True)),
            ],
        ),
        migrations.AddField(
            model_name='wordform',
            name='rw_domains',
            field=models.CharField(blank=True, help_text='\n                RapidWords domains for an entry, separated by a semicolon\n                ', max_length=2048, null=True),
        ),
        migrations.AddField(
            model_name='wordform',
            name='rw_indices',
            field=models.CharField(blank=True, help_text='\n                    RapidWords indices for an entry, separated by a semicolon\n                    ', max_length=2048, null=True),
        ),
        migrations.AddField(
            model_name='wordform',
            name='wn_synsets',
            field=models.CharField(blank=True, help_text='\n                    WordNet synsets for an entry, separated by a semicolon\n                    ', max_length=2048, null=True),
        ),
    ]
