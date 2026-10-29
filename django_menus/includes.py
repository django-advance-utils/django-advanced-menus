from ajax_helpers.html_include import SourceBase, pip_version


# The query string on the served django_menus.js/.css for a consumer that includes them plainly,
# so bump the package version whenever either file changes. Static is usually served with a
# far-future expiry and no content hashing, and an unchanged version leaves the URL byte
# identical - returning browsers would keep the file they already have and never run the new JS,
# which is exactly the users who have been there before. (A consumer passing its own `version=`,
# e.g. its git revision, busts the cache on every deploy and does not depend on this.)
version = pip_version('django-advanced-menus')


class DjangoMenus(SourceBase):
    static_path = 'django_menus/'
    # Floating UI 1.8.0 (vendored UMD builds) positions dropdowns; core must load before dom.
    js_filename = ['floating-ui.core.umd.min.js', 'floating-ui.dom.umd.min.js', 'django_menus.js']
    css_filename = 'django_menus.css'
    js_path = ''
    css_path = ''


class DefaultInclude(DjangoMenus):
    pass
