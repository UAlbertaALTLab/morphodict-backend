from django.core.management import BaseCommand
from lexicon.models import RapidWords, Wordform
from pathlib import Path
from tqdm import tqdm
import csv


class Command(BaseCommand):
    help = """Add a leading space and a trailing semicolon to all semantic entries"""

    def handle(self, **options):
        entries = []
        sro_index = 0
        wordnet_index = -4
        rw_index_index = -3
        rw_domain_index = -2
        root = Path(__file__).resolve().parent.parent.parent.parent
        with open(root / "crkeng/res/Wolvengrey_WN_RW.tsv") as input:
            tsv_file = csv.reader(input, delimiter="\t")
            for line in tsv_file:
                if line[sro_index] == "sro":
                    continue
                else:
                    sro = line[sro_index]
                    wn = line[wordnet_index]
                    rw_index = line[rw_index_index]
                    rw_domain = line[rw_domain_index]
                    entry = {}
                    entry[sro] = {}
                    entry[sro]["wordnet"] = wn
                    entry[sro]["rw_index"] = rw_index
                    entry[sro]["rw_domain"] = rw_domain
                    entries.append(entry)

        for entry in tqdm(entries):
            for item in entry:
                wf = Wordform.objects.filter(text=item).first()
                if wf:
                    # get all the info
                    wn_entries = entry[item]["wordnet"].replace("h; ", "").split(" and ")
                    rw_indices = entry[item]["rw_index"].replace("h; ", "").split(" and ")
                    rw_domains = entry[item]["rw_domain"].replace("h; ", "").split(" and ")

                    # treat and store WN
                    treated_wn_entries = "; ".join(wn_entries)
                    treated_wn_entries = " " + treated_wn_entries + ";"
                    wf.wn_synsets = treated_wn_entries

                    # treat and store RW
                    # first we need to restore the "ands" that we took out
                    treated_domains = []
                    lowercase_letters = "abcdefghijklmnopqrstuvwxyz"
                    for i, domain in enumerate(rw_domains):
                        if domain and domain[0] in lowercase_letters:
                            # if the domain starts with a lowercase letter,
                            # it likely belongs with the one before it.
                            if i -1 >= 0:
                                new_domain = rw_domains[i-1] + " and " + domain
                                treated_domains.remove(rw_domains[i-1])
                                treated_domains.append(new_domain)
                        else:
                            treated_domains.append(domain)

                    # some indices have commas in them
                    # we just want the part that comes before the comma
                    treated_indices = []
                    for ind in rw_indices:
                        if ',' in ind:
                            split_ind = ind.split(',')
                            treated_indices.append(split_ind[0])
                        else:
                            treated_indices.append(ind)

                    # now that everything is treated,
                    # we can make sure that RW class actually exists
                    # then assign those values to the wf object
                    indices_to_add = ""
                    domains_to_add = ""
                    for i, d in enumerate(treated_domains):
                        if i < len(treated_indices):
                            rw_ind = treated_indices[i]
                            rw_object = RapidWords.objects.filter(domain=d).first()
                            if rw_object:
                                indices_to_add += f" {rw_ind};"
                                domains_to_add += f" {d};"

                    wf.rw_domains = domains_to_add
                    wf.rw_indices = indices_to_add
                    wf.save()


