from django.core.management import BaseCommand
from lexicon.models import RapidWords, Wordform
from tqdm import tqdm


def removeAnd(indices, domains):
    """
    indices is a list of strings
    domains is a list of strings
    returns: elements of both lists, any element containing "and" gets split on the word,
    but only if the corresponding index/domain also contains "and". If the domain doesn't contain "and"
    but the index does, remove that index. Increase the index of the index list, do not increase index of domains
    list.
    """
    i = 0       # index for indices
    j = 0       # index for domains
    treated_indices = []
    treated_domains = []
    while j < len(domains):
        ind = indices[i]
        domain = domains[j]
        ind = ind.strip()
        domain = domain.strip()
        ind = ind.replace(';', '')
        domain = domain.replace(';', '')
        if "and" in ind and "and" in domain:
            split_ind = ind.split(" and ")
            split_domain = domain.split(" and ")
            treated_indices.extend(split_ind)
            treated_domains.extend(split_domain)
            i += 1
            j += 1
        elif "and" in ind and "and" not in domain:
            i += 1
        else:
            treated_indices.append(ind)
            treated_domains.append(domain)
            i += 1
            j += 1

    return treated_indices, treated_domains


class Command(BaseCommand):
    help = """Some RW fields are just wrong and the number of domains doesn't match the number of indices. This
            command fixes that. Hopefully. Also: this takes virtually forever to run, most of that
            time is spent gathering every single wordform in the database. Bright side: it should only 
            need to be run once, ever. """

    def handle(self, **options):
        words = Wordform.objects.all()
        for word in tqdm(words):
            if word.rw_domains and word.rw_indices:
                rw_indices = word.rw_indices.split(';')
                rw_domains = word.rw_domains.split(';')
                treated_indices, treated_domains = removeAnd(rw_indices, rw_domains)
                indices_to_add = ""
                domains_to_add = ""
                if len(treated_indices) != len(treated_domains):
                    # there are either more indices, or more domains. Either way, something is wrong.
                    # we default to assuming the domains are the right length
                    i = 0       # index for indices
                    j = 0       # index for domains
                    while j < len(treated_domains):
                        ind = treated_indices[i]
                        domain = treated_domains[j]
                        rw_class = RapidWords.objects.filter(domain=domain, index=ind).first()
                        if rw_class:
                            indices_to_add += f" {ind};"
                            domains_to_add += f" {domain};"
                            i += 1
                            j += 1
                        else:
                            i += 1
                else:
                    indices_to_add = ";".join(treated_indices)
                    indices_to_add = f" {indices_to_add};"
                    domains_to_add = ";".join(treated_domains)
                    domains_to_add = f" {domains_to_add};"

                word.rw_indices = indices_to_add
                word.rw_domains = domains_to_add
                word.save()
