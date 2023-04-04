from pathlib import Path    # type: ignore

from .app import App    # type: ignore

# The directory containing the docker-compose file
DOCKER_COMPOSE_DIR = Path(__file__).parent.parent


# Port assignments and UIDs are tracked at:
# https://github.com/UAlbertaALTLab/deploy.altlab.dev/blob/master/docs/application-registry.tsv

APP_INFO = {
    "crkeng": {"port": 8003, "uwsgi_stats_port": 9003},
    "cwdeng": {"port": 8005, "uwsgi_stats_port": 9005},
    "srseng": {"port": 8009, "uwsgi_stats_port": 9009},
    "arpeng": {"port": 8007, "uwsgi_stats_port": 9007},
    "hdneng": {"port": 8010, "uwsgi_stats_port": 9010},
}

APPS = [App(k, **v) for k, v in APP_INFO.items()]
