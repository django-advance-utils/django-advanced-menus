"""
Bootstrap 5 variant of the example project.

    python manage.py runserver --settings=django_examples.settings_bs5

Needs ajax-advanced-helpers >= 1.0 for CSS_FRAMEWORK support.
"""
from importlib.util import find_spec

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F401,F403

if find_spec('ajax_helpers.config') is None:
    raise ImproperlyConfigured('settings_bs5 needs ajax-advanced-helpers >= 1.0 (CSS_FRAMEWORK support)')

CSS_FRAMEWORK = 'bootstrap5'

# Separate database, so the Bootstrap 4 and 5 containers sharing this folder don't share one.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(BASE_DIR.joinpath('db_bs5.sqlite3')),
    }
}
