[![PyPI version](https://img.shields.io/pypi/v/django-advanced-menus)](https://pypi.org/project/django-advanced-menus/)

# django-advanced-menus

Django app to render menus and load tabs with Ajax.

The [django-advance-utils](https://github.com/django-advance-utils) line of Ian Jones's
[django-tab-menus](https://github.com/jonesim/django-menus), forked so that releases can be cut as
the downstream libraries and django-advanced-report-builder need them. The Python package is still
`django_menus`, so existing imports and `INSTALLED_APPS` entries do not change; only the pip name
does. It depends on [ajax-advanced-helpers](https://github.com/django-advance-utils/ajax-advanced-helpers).

## Installation

```bash
pip install django-advanced-menus
```

Needs Python 3.11 or later; it is tested on Django 5.2 and 6.0. On Python 3.9 or 3.10, pip installs 1.0.4, the last 1.x release.

Add to `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    ...
    'django_menus',
]
```

### Upgrading to 2.x from django-advanced-menus 1.0.x

- The menu JavaScript no longer needs jQuery or Popper. Dropdowns are positioned by a bundled copy of Floating UI, which `{% lib_include module='django_menus.includes' %}` loads before `django_menus.js`.
- Bootstrap 5 is chosen by the ecosystem-wide `CSS_FRAMEWORK = 'bootstrap5'` that ajax-advanced-helpers reads; see [Bootstrap 4 / 5](#bootstrap-4--5). `DJANGO_MENUS_TEMPLATE_PACK` and the `bootstrap4/` and `bootstrap5/` template folders are gone: there is one set of templates again, at `django_menus/<name>.html`, and a project override at that path keeps working.
- Labels and attribute values are escaped unless marked safe (since 1.0.1); see [Escaping](#escaping).

- Python 3.11 or later is required.
- A dropdown button carries `data-django-menus-bound` once it is wired, for code that used to wait on jQuery's event registry; see [Dropdowns](#dropdowns).

To stay on the jQuery version, pin `django-advanced-menus<2.0`.

Coming from Ian Jones's django-tab-menus, the Python package is the same `django_menus`; swap the pip name, and note that escaping here is always on rather than chosen by `DJANGO_MENUS_ESCAPE_*` settings.

## Quick Start

The simplest menu is built with `HtmlMenu` and rendered in a template:

```python
from django_menus.menu import HtmlMenu, MenuItem, MenuMixin
from django.views.generic import TemplateView

class MyView(MenuMixin, TemplateView):
    template_name = 'my_template.html'

    def setup_menu(self):
        self.add_menu('main', 'base').add_items(
            'home',          # Django URL name — label auto-derived from view
            ('about', 'About Us'),
            ('contact', 'Contact'),
        )
```

In the template:

```html
{% load django_menu_tags %}
{% menu_content 'main' %}
```

`MenuMixin` injects all menus into the template context under `menus`, so `menus.main` is also accessible directly.

Two ready-made view classes save the boilerplate: `MenuTemplateView` is `MenuMixin + TemplateView`, and `AjaxMenuTemplateView` additionally mixes in ajax-advanced-helpers AJAX handling (needed for badge refresh, tabs and context menus).

## Menu Types

Pass a template name as the second argument to `add_menu()` (or as `template=` on `HtmlMenu`):

| Name | Layout |
|---|---|
| `'base'` | Bootstrap navbar |
| `'button_group'` | Inline button group |
| `'buttons'` | Stacked buttons |
| `'tabs'` | Tab bar |
| `'breadcrumb'` | Breadcrumb trail |
| `'dropdown'` | Standalone dropdown |

## Adding Items

### String shorthand

Passing a URL name string resolves the view and auto-derives the label from `view.menu_display` or the URL name:

```python
menu.add_items('dashboard', 'reports', 'settings')
```

### Tuple shorthand

```python
menu.add_items(
    ('reports', 'My Reports'),                          # (url_name, label)
    ('reports', 'My Reports', {'css_classes': 'btn-primary'}),  # with kwargs
)
```

### `MenuItem` class

The full item API:

```python
MenuItem(
    url,                        # URL name, raw URL, JS string, or AJAX command
    menu_display=None,          # str, tuple, or MenuItemDisplay instance
    link_type=MenuItem.URL_NAME,
    css_classes=None,           # str or list
    font_awesome=None,          # e.g. 'fas fa-edit'
    tooltip=None,
    badge=None,                 # MenuItemBadge instance
    dropdown=None,              # tuple of items for a nested dropdown
    show_caret=True,
    key=None,                   # keyboard shortcut, e.g. 'alt-s' or ['alt-s', 'shift-S']
    url_args=None,
    url_kwargs=None,
    attributes=None,            # dict of extra HTML attributes
    visible=True,
    disabled=False,
    target=None,                # link target, e.g. '_blank'
)
```

### Raw HTML

`HtmlMenuItem` injects arbitrary HTML into a menu slot:

```python
from django_menus.menu import HtmlMenuItem

menu.add_items(HtmlMenuItem(html='<span class="navbar-text">v2.1</span>'))
```

## Link Types

| Constant | Behaviour |
|---|---|
| `MenuItem.URL_NAME` | Django URL name resolved via `reverse()` (default) |
| `MenuItem.HREF` | Raw URL string |
| `MenuItem.AJAX_GET_URL_NAME` | URL name loaded via AJAX GET |
| `MenuItem.AJAX_BUTTON` | Submits an AJAX button (ajax-advanced-helpers) |
| `MenuItem.JAVASCRIPT` | Executes a JavaScript expression |
| `MenuItem.AJAX_COMMAND` | Sends an ajax_helpers command dict |

```python
# Raw URL
MenuItem('/some/path/', 'External', MenuItem.HREF)

# JavaScript
MenuItem("alert('hello')", 'Alert', MenuItem.JAVASCRIPT)

# AJAX GET (loads content without full page reload)
MenuItem('my_view', 'Load Content', MenuItem.AJAX_GET_URL_NAME)

# URL with args
MenuItem('profile', 'Profile', url_args=[user.pk])
MenuItem('profile', 'Profile', url_kwargs={'pk': user.pk})
# Shorthand: keyword args prefixed with url_ become URL kwargs
MenuItem('profile', 'Profile', url_pk=user.pk)
```

`AjaxButtonMenuItem` is a convenience class for posting an ajax-helpers button without writing the JavaScript yourself:

```python
from django_menus.menu import AjaxButtonMenuItem

menu.add_items(AjaxButtonMenuItem('refresh', 'Refresh'))   # posts {"button": "refresh"}
```

## MenuItemDisplay

Controls display properties — text, icon, CSS classes, tooltip, and HTML attributes:

```python
from django_menus.menu import MenuItemDisplay

# Keyword form
MenuItemDisplay(text='Save', font_awesome='fas fa-save', css_classes='btn-primary', tooltip='Save record')

# Tuple shorthand (text, icon, css_classes, tooltip, attributes)
MenuItem('save_view', ('Save', 'fas fa-save', 'btn-primary'))

# On a view class — auto-picked up when the URL is resolved
class MyView(TemplateView):
    menu_display = MenuItemDisplay('My View', 'fas fa-star', 'btn-success')
```

## Dropdowns

Pass a `dropdown` tuple to any `MenuItem`:

```python
from django_menus.menu import DividerItem, HeaderItem

menu.add_items(
    MenuItem(menu_display='Actions', dropdown=(
        HeaderItem('Record'),
        'edit_view',
        'delete_view',
        DividerItem(),
        'archive_view',
    )),
)
```

`HeaderItem` renders a non-clickable section header (`dropdown-header`); `DividerItem` a separator line. Options: `show_caret=False` hides the caret; `no_hover=True` requires a click to open.

Once a dropdown's button is wired up it carries a `data-django-menus-bound` attribute. The handlers are plain event listeners, which nothing in the page can list, so code that must wait for a menu to be live (a Playwright helper, say) waits for that attribute. A click-opened menu closes when focus leaves both its button and the menu, but not when focus moves from one to the other, so it can be opened and used from the keyboard.

### AJAX-loaded dropdowns

`AjaxMenuDropDownItem` renders a button whose dropdown contents are fetched from the server when clicked — useful when the items are expensive to build or depend on live data. The click posts `{"ajax": "<dropdown_view_name>"}` (default `'dropdown_menu'`) to the current view, which responds with `add_ajax_dropdown_menu`:

```python
from django_menus.menu import AjaxMenuDropDownItem

class MyView(AjaxMenuTemplateView):
    def setup_menu(self):
        self.add_menu('menu_items', 'button_group').add_items(
            AjaxMenuDropDownItem(menu_display='Options', css_classes='btn-success'))

    def ajax_dropdown_menu(self, *args, pos, **kwargs):
        return self.add_ajax_dropdown_menu('view1', 'view2', ('view4', 'View 4'), pos=pos)
```

An optional `value=` on the item is passed through to the handler, so one handler can serve several buttons.

## Context Menus

`ContextMenuMixin` attaches a right-click menu to any element matching `context_menu_selector` (default `'.context_menu'`). The right-click posts `{"ajax": "context_menu"}` to the view, which builds the menu on demand:

```python
from django_menus.menu import ContextMenuMixin, AjaxMenuTemplateView, HeaderItem, MenuItem

class MyView(ContextMenuMixin, AjaxMenuTemplateView):
    template_name = 'my_template.html'

    def ajax_context_menu(self, *args, **kwargs):
        return self.add_context_menu(
            HeaderItem('Actions'),
            'view1', 'view2',
            ('test_button', 'Send to View', MenuItem.AJAX_BUTTON),
        )
```

```html
<div class="context_menu" id="area_one">Right click me</div>

<!-- Per-element handler override: posts {"ajax": "special_context_menu"} instead -->
<div class="context_menu" id="area_two" data-ajax="special_context_menu">Right click me</div>
```

The clicked element's `id` is available in the handler kwargs, so the menu can vary per row/area. The view must include ajax-advanced-helpers handling (e.g. `AjaxMenuTemplateView`).

## Badges

Attach a `MenuItemBadge` to any `MenuItem`:

```python
from django_menus.menu import MenuItemBadge

def my_badge_fn(badge):
    badge.text = MyModel.objects.filter(unread=True).count()
    badge.css_class = 'danger'   # Bootstrap colour name

MenuItem('inbox', 'Inbox', badge=MenuItemBadge('inbox-badge', my_badge_fn))
```

The badge is rendered inside a `<span id="inbox-badge">` so it can be refreshed via AJAX without a page reload. Use `AjaxMenuTemplateView.timer_menu()` to poll for updates.

## Keyboard Shortcuts

```python
# Single key
MenuItem('save_view', 'Save', key='alt-s')

# Multiple bindings
MenuItem('save_view', 'Save', key=['alt-s', 'shift-S'])
```

Supported modifiers: `alt-`, `shift-`. The key name is case-sensitive (e.g. `'F2'` for the function key).

Shortcuts from every menu on the page — including menus loaded later via AJAX — are merged into a single document-level listener, so multiple menus can define keys without clobbering each other. Shortcuts are suppressed while a django-modals dialog is open.

## Repeat Clicks on Menu Links

Every menu item renders as an `<a href>`, and a menu item can point at a view that *does*
something rather than one that just shows a page. A double-click sends the URL twice, and a view
that resolves what to act on from its own current state - rather than from the state the link was
drawn against - acts on both.

This is **off by default** - swallowing a click is a behaviour change, and whether a project has
menu items pointing at views that mind being called twice is the project's business. Opt in with
the milliseconds to hold a link for, at whichever level fits. They cascade
**item -> menu -> page -> off**, so the narrowest one set wins:

    # one item - usually the one that knows it minds being clicked twice
    MenuItem('next_stage', 'Go to Next Stage', django_menus_repeat_click_ms=2000)

    # every item in a menu that has not set its own
    HtmlMenu(request, 'button_group', django_menus_repeat_click_ms=2000)

    # a page, or a whole site if set on a base view class
    class MyView(MenuTemplateView):
        repeat_click_ms = 2000

A target view can also declare it, which is arguably the best place - the view that minds being
called twice is the thing that knows:

    class MyView(View):
        menu_config = {'attributes': {'data-django-menus-repeat-ms': 2000}}

That sits below the item and menu arguments, which are set at the call site and so win.

Because an item's own value wins, one item can be held on a page with the guard off, and
`django_menus_repeat_click_ms=0` on an item opts it out where the page has it on. A menu-level
value also reaches the items of a dropdown built on one of that menu's items.

The first two forms render a `data-django-menus-repeat-ms` attribute on the anchor and need
nothing else. The view attribute reaches the page through the `django_menus_script` context
variable, so output that once in a base template, alongside the include:

    {% lib_include module='django_menus.includes' %}
    {{ django_menus_script }}

All that does is set a JS window of the same name, which the guard reads on every click rather
than capturing at load - so it can also be set or changed directly, from a page's own script or a
console while diagnosing, on either side of the include:

    django_menus_repeat_click_ms = 2000;

Anywhere it is set, `0` turns it off, and anything that is not a number above zero reads as off.

See the **Repeat Clicks** page in the example app for all three working side by side.

Once on, a second click on the same anchor inside that window is swallowed. Only real navigations
are affected - a `javascript:` href leaves the page in place and clicking again straight away is
often what the user means (close a modal, reopen it), so those are left alone, as are modified
clicks (ctrl/cmd/shift/alt, or any button but the primary) which open the link elsewhere.

Two limits worth knowing. The window collapses a double-click; it does not cover an impatient
re-click several seconds into a slow response, because holding a link until the page actually
goes away would strand anything that deliberately leaves the page up, like a download or a
`target="_blank"`. And the rule is about the href, not the effect: a `JAVASCRIPT` item is free to
set `window.location` itself, an `AJAX_BUTTON`'s view can answer with a redirect, and
`AJAX_GET_URL_NAME` fetches a view - those hit the view twice on a double-click just the same and
are out of scope here.

If you override these templates with your own copies, carry the `django-menus-item` class across
or those menus will not be covered.

### Showing that the click registered

While a link is held it carries a `django-menus-clicked` class. Swallowing the second click stops
the duplicate request, but people double-click *because* the first click appeared to do nothing,
so the class is there to let you address the cause as well:

    a.django-menus-clicked { opacity: .65; cursor: default; }

No styling is shipped for it, so it does nothing until a project adds a rule. Style the
appearance only - `pointer-events: none` looks like the obvious choice and lets the click fall
*through* to whatever sits underneath, which inside a dropdown is another menu item. The click is
already stopped in JS; the class only has to look the part.

The class is cleared when the hold expires, so a navigation that never arrives - cancelled, a
download, a `target="_blank"` - cannot leave a link looking permanently dead.

This is defence in depth, not a substitute for making such a view idempotent - the back button, a
refresh and a second tab all still send the request twice.

## Permissions

### `view_permission`

Define a classmethod on a view to control whether the menu item pointing to that view is visible:

```python
class SecretView(TemplateView):
    @classmethod
    def view_permission(cls, request, menu_item):
        return request.user.is_staff
```

### `menu_permissions`

Define on a view to control non-URL-resolved items (e.g. AJAX buttons) while that view is active:

```python
class MyView(TemplateView):
    @classmethod
    def menu_permissions(cls, request, menu_item):
        return request.user.has_perm('myapp.can_edit')
```

### Callable `visible`

`visible` accepts a callable taking the request, for items whose target view you do not own:

```python
MenuItem('admin:index', 'Admin', visible=lambda request: request.user.is_staff)
```

### Permission hooks

`MenuItem.test_visible` asks the views involved whether an item may be shown:

* a link, tab or modal item (`HREF`, `URL_NAME`, `AJAX_GET_URL_NAME`) calls
  `view_permission(request, item)` on the **target** view class, if it has one;
* anything else (`AJAX_BUTTON`, `JAVASCRIPT`, `AJAX_COMMAND`) calls `menu_permissions(request, item)`
  on the **current page's** view class.

Both are called on the class, so they are classmethods or staticmethods, and return a bool. A refused
item is not drawn, and a dropdown left with nothing in it goes too, button, shortcut key and all. A
divider left with nothing to divide (first, last, or straight after another divider) is not drawn
either.

`item.permission_name` names the item for those hooks: the `permission_name=` it was given,
otherwise its url name without any `,args`, or for an `AjaxButtonMenuItem` its button name. An
`AjaxButtonMenuItem` also keeps `button_name` and `button_url_name` (the view that answers it, when
that is not the current page).

## Menu Registry

A long dropdown listed in one central `setup_menu()` conflicts on every merge. The registry lets
each view declare its own place instead, so adding a page touches only the app that owns it.

Declare the sections once:

```python
DJANGO_MENUS_SECTIONS = {
    'settings': {'title': 'Settings'},
    'reports': {
        'title': 'Reports',
        'groups': ['sales', 'purchases', ('stock', 'Stock')],
        'sort': 'order',
    },
}
```

Then each view says where it belongs:

```python
from django_menus.menu import MenuEntry

class ExchangeRateList(ListView):
    menu_display = 'Exchange Rates'
    menu_entry = MenuEntry('settings')

class StockReorderReport(ListView):
    menu_display = 'Stock Reorder'
    menu_entry = MenuEntry('reports', 'stock')
```

and the central menu shrinks to a skeleton:

```python
def setup_menu(self):
    self.add_menu('main_menu').add_items(
        'dashboard_view',
        registry.menu_item('reports', self.request),
        registry.menu_item('settings', self.request,
                           MenuItem('page_info', 'Page Info', link_type=MenuItem.AJAX_BUTTON),
                           MenuItem('admin:index', 'Admin', visible=lambda r: r.user.is_staff)),
    )
```

The URLConf is walked once, lazily and cached; `MenuItem`s are built per request, so
`view_permission` and callable `visible` behave exactly as they do in a hand-written menu.

### `MenuEntry`

| Argument | Purpose |
|---|---|
| `section` | Key in `DJANGO_MENUS_SECTIONS`. Required. |
| `group` | Group within a grouped section. Required for grouped sections. |
| `url_name` | Only needed when the view is reachable under more than one url name. |
| `url_args` / `url_kwargs` | Arguments for `reverse()`, when the url pattern takes any. |
| `display` | Overrides `menu_display` **in this section only** — tabs and breadcrumbs keep the view's own label. |
| `order` | Sort position, used when the section sets `sort: 'order'`. |
| anything else | Passed to `MenuItem()` — `font_awesome`, `css_classes`, `key`, `tooltip`… |

Set `menu_entry` to a list to put one view in several sections. `menu_entry` is **not** inherited —
a view is in the menu only if it declares one itself, so the archived, grouped and pk-taking
subclasses of a listed page do not each add a duplicate item. A subclass that should appear as well
declares a `MenuEntry` of its own.

### Section options

| Key | Default | Meaning |
|---|---|---|
| `title` | capitalised section name | Label of the parent item built by `menu_item()`. |
| `font_awesome` | — | Icon for the parent item. |
| `groups` | none | Group names in render order. A `(name, header)` pair emits a `HeaderItem`. |
| `sort` | `'alpha'` | `'alpha'` by display text, `'order'` by `MenuEntry(order=...)`, or `'declared'` by URLConf order. |
| `divider` | on when grouped | Insert a `DividerItem` between groups. |
| `default_group` | first group | Group for entries that name none. |

Dividers and headers are only emitted between groups that still have visible items for this
request, so a group hidden by permissions never leaves a stray separator behind.

### API

```python
from django_menus.menu import registry

registry.dropdown(section, request, *extra)   # ordered list of items
registry.menu_item(section, request, *extra)  # parent MenuItem with the dropdown attached
registry.extra(item, group=..., order=..., sort_text=...)   # place a caller-built item
registry.specs(section)                       # what the scan found, for diagnostics
```

`extra` items are ordinary `MenuItem`s built at the call site — use them for anything the URLConf
cannot describe, such as an `AJAX_BUTTON` or a third-party view with no view class. They sort by
their own display text alongside the registered items.

### Checking it

Mistyped sections and groups, ambiguous url names and missing url arguments are reported by
`manage.py check` (ids `django_menus.E001`–`E007`, `W001`–`W002`) and raise `ImproperlyConfigured`
when the registry scans.

`manage.py show_menu` prints the resolved tree so ordering is inspectable without running the site:

```bash
manage.py show_menu                          # every configured section
manage.py show_menu reports --user ian       # one section, as a given user
manage.py show_menu --view dashboard_view    # the menus a view actually builds
manage.py show_menu --view dashboard_view --show-hidden --format json
```

## AJAX Tab Interfaces

`AjaxMenuTabs` handles a tab bar where each tab loads its content via AJAX:

```python
from django_menus.menu import AjaxMenuTabs, MenuItem

class MyTabView(AjaxMenuTabs):
    template_name = 'my_tabs.html'
    tab_template = 'my_tab_content.html'

    def setup_menu(self):
        super().setup_menu()
        self.add_menu('tab_menu', 'tabs').add_items(
            ('tab1_view', 'First Tab', MenuItem.AJAX_GET_URL_NAME),
            ('tab2_view', 'Second Tab', MenuItem.AJAX_GET_URL_NAME),
        )

    def tab_context(self, **kwargs):
        context = super().tab_context(**kwargs)
        context['data'] = MyModel.objects.all()
        return context

    def main_context(self, **kwargs):
        # Only called on the initial (non-AJAX) page load
        return {'title': 'My Tabs'}
```

- `tab_context()` is called on every request (initial and AJAX).
- `main_context()` is called only on the initial page load.
- `additional_content` lists extra areas to refresh on tab switch: `[(name, AjaxMenuTabs.MENU_CONTENT)]` for a menu, or `[(name, AjaxMenuTabs.TEMPLATE_CONTENT)]` for a template fragment.

## Global Button Defaults

Pre-configure named button styles in `settings.py` so any menu item whose display text matches the key inherits the style automatically:

```python
from django_menus.menu import MenuItemDisplay

DJANGO_MENUS_BUTTON_DEFAULTS = {
    'save':   MenuItemDisplay('Save',   'fas fa-save',   'btn-primary'),
    'delete': MenuItemDisplay('Delete', 'fas fa-trash',  'btn-danger'),
    'edit':   MenuItemDisplay('Edit',   'fas fa-pen',    'btn-secondary'),
}
```

Then in any view:

```python
self.add_menu('actions', 'button_group').add_items(
    MenuItem('save_view',   'save'),    # picks up the global style
    MenuItem('delete_view', 'delete'),
)
```

Individual menus can override or extend the global set with `button_defaults=`, without affecting other menus:

```python
self.add_menu('actions', 'button_group',
              button_defaults={'save': MenuItemDisplay('Save', 'fas fa-check', 'btn-outline-primary')})
```

## Escaping

**Changed in 1.0.1.** `MenuItemDisplay.display()` used to return `mark_safe(self.text)`, so every
label reached the page as markup whether it meant to or not. A label that comes from a value — a
project's name, a file's name, a report's name — put that value into the page unescaped, and an
item was safe only because its caller happened to escape it.

A label is now escaped unless it is marked safe, and the same goes for each attribute value
`MenuItem.attributes()` writes (a quote in a `tooltip` could otherwise close `title=""` and start
another attribute).

Nothing changes for a label that is the app's own words. **A label that is markup says so with
`safe=True`** (added in 1.0.2; on 1.0.1, use `mark_safe`):

```python
MenuItem(url='home', menu_display='<i class="fas fa-lock"></i> Disable', safe=True)
MenuItemDisplay('<i class="fas fa-lock"></i> Disable', safe=True)

menu.add_items(
    ('home', '<span class="btn-info">HTML</span>', {'safe': True}),
)
```

`safe` is off by default, and it covers the label only: the `font_awesome` class and attribute
values such as `tooltip` are still escaped. A label already marked safe where it was made —
`mark_safe`, `format_html`, a rendered template — is left alone as well, with or without the flag.

When `menu_display` is already a `MenuItemDisplay`, it is that display's own `safe` that counts,
the same as its own `font_awesome` and `css_classes`: `MenuItem(safe=True)` is ignored there, so
put the flag on the display instead —
`MenuItem(url='home', menu_display=MenuItemDisplay('<b>Edit</b>', css_classes='btn-info', safe=True))`.
The same goes for a `button_defaults` entry: the display it puts in place has its own `safe`.

Don't use `safe=True` on a label built from a value. `safe=True` says the *whole* string is
trusted, so the value inside it would not be escaped; `format_html` escapes the value and keeps the
markup around it:

```python
from django.utils.html import format_html

MenuItem(url='home', menu_display=format_html('<img src="{}" class="avatar">', user.avatar_url))
```

An icon does not need either — pass it as `font_awesome` and the library builds the `<i>` itself:

```python
MenuItem(url='home', menu_display='Disable', font_awesome='fas fa-lock')
```

A caller that was already escaping its own label keeps working: `escape()` returns a `SafeString`,
which `conditional_escape` leaves alone, so nothing is escaped twice.

An attribute **name** is checked rather than escaped, and dropped when it is not a plain attribute
name — escaping would not help, since a name is not quoted and a key such as `x onmouseover`
renders a second attribute whatever is done to its value. Names of letters, digits, `-`, `_`, `:`
and `.` are kept, so `data-*`, `aria-*` and the attribute-style hooks other front-end libraries
use still work; `on*` is refused, so a key cannot be a native event handler.

The guarantee is structural rather than total: a name cannot become *markup* — it cannot close its
own attribute, open a second one, or end the tag. It is not a promise that a name is inert in your
page. `x-on:click`, `@click`, `v-on:` and `hx-on:` are well-formed names that execute under some
front-end framework, and this library cannot know which you load. Attribute names should come from
your own code, not from user input; if they do not, this is not the place to fix it.

`button_defaults` is unaffected: which item picks up which default is exactly what it was. The
lookup is `MenuItem.default_key`, which is the label as `display()` rendered it **before** it
escaped, so a default keyed `R&D` still matches an item labelled `R&D`; `MenuItem.name` stays the
thing the template prints, and is escaped.

`MenuItemDisplay.default_key()` is what answers, and a subclass with its own `display()` needs to
do nothing: that renderer still decides its key, exactly as it did when the lookup went through
`display()` directly. Override `default_key()` only to choose a *different* key.

That is a compatibility contract rather than a tidy one, and it has a sharp edge worth knowing:
when the item carries its own `font_awesome`, the key includes the generated `<i ...></i>` just as
it always has, so a plain-label key does not match such an item. Key a default on the label alone
and give the icon in the default itself.

## Bootstrap 4 / 5

Markup follows the `CSS_FRAMEWORK` setting shared with `ajax-advanced-helpers` (the same setting that decides what `{% lib_include %}` loads):

```python
CSS_FRAMEWORK = 'bootstrap5'   # default 'bootstrap4'
```

It switches navbar alignment (`ms-auto`/`me-auto`), button spacing, the context-menu caret, badge classes
(`badge rounded-pill text-bg-<colour>`) and tooltip `data-bs-placement`. Custom menu templates receive the active class set
as `css`, e.g. `{{ css.align_end }}`.

## Template Tags

```html
{% load django_menu_tags %}

{# Render a menu by name from the context variable 'menus' #}
{% menu_content 'main_menu' %}

{# Render any menu object directly #}
{% show_menu menus.main_menu %}

{# Render a single button inline — keyword args are passed to MenuItem #}
{% display_button url='my_view' menu_display='Click me' %}

{# Render a template content fragment by context variable name #}
{% template_content 'tab_template' %}
```

## Running the Example Project

```bash
docker-compose up
# Bootstrap 4: http://localhost:8009
# Bootstrap 5: http://localhost:8010
```

To run it without Docker, install both
requirements files, the second without dependencies:

    pip install -r requirements.txt
    pip install --no-deps -r requirements-no-deps.txt

and run it from `django_examples` with the checkout on the path:

    cd django_examples
    PYTHONPATH=.. python manage.py migrate
    PYTHONPATH=.. python manage.py runserver

`PYTHONPATH=..` matters: django-advanced-modals depends on django-advanced-menus, so the requirements
install a copy from PyPI as well, and without it the example runs that copy rather than your
checkout. docker-compose sets `PYTHONPATH=/menus` for the same reason. `requirements-no-deps.txt`
says why it is installed separately.

Add `--settings=django_examples.settings_bs5` to both commands for the Bootstrap 5 variant. It only sets `CSS_FRAMEWORK = 'bootstrap5'` (and its own database); the menus' JavaScript needs neither jQuery nor Popper (dropdowns are positioned by a bundled copy of [Floating UI](https://floating-ui.com/)), so it works in both modes.
