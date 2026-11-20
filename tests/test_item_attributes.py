"""``DJANGO_MENUS_ITEM_ATTRIBUTES``: attributes a project's function gives every item as it is made."""

import sys

from django.test import SimpleTestCase, override_settings
from django_menus.menu import AjaxButtonMenuItem, DividerItem, HtmlMenu, MenuItem, MenuItemDisplay
from django_menus.menu import menu_items

MADE = []
ANSWER = {}


def record(item):
    """Notes the item and the line that made it, and answers whatever the test put in ``ANSWER``."""
    frame = sys._getframe(1)
    # Up past the library's own frames and every __init__ on the way, to the code that made the item.
    while frame is not None and (
        frame.f_globals.get('__name__', '').startswith('django_menus') or frame.f_code.co_name == '__init__'
    ):
        frame = frame.f_back
    MADE.append((item, frame.f_lineno if frame is not None else None))
    return dict(ANSWER) if ANSWER else None


HOOK = 'tests.test_item_attributes.record'


def link(**kwargs):
    return MenuItem(url='#', menu_display='Link', link_type=MenuItem.HREF, **kwargs)


class ItemAttributesTestBase(SimpleTestCase):
    def setUp(self):
        MADE.clear()
        ANSWER.clear()
        menu_items._import_hook.cache_clear()


class WithoutTheSettingTests(ItemAttributesTestBase):
    def test_nothing_is_called_and_nothing_added(self):
        item = link()

        self.assertIsNone(item.made_attributes)
        self.assertEqual(MADE, [])
        self.assertEqual(str(item.attributes()), '')


@override_settings(DJANGO_MENUS_ITEM_ATTRIBUTES=HOOK)
class WithTheSettingTests(ItemAttributesTestBase):
    def test_the_function_is_called_once_for_each_item_made(self):
        first, second = link(), AjaxButtonMenuItem('save', 'Save')

        self.assertEqual([item for item, _line in MADE], [first, second])

    def test_it_is_called_while_the_code_that_made_the_item_is_on_the_stack(self):
        line = sys._getframe().f_lineno + 1
        AjaxButtonMenuItem('save', 'Save')

        self.assertEqual(MADE[0][1], line)

    def test_what_it_answers_is_written_into_the_tag(self):
        ANSWER['data-made-at'] = 'views.py:12'

        self.assertEqual(str(link().attributes()), 'data-made-at="views.py:12"')

    def test_none_adds_nothing(self):
        self.assertEqual(str(link().attributes()), '')

    def test_they_sit_beside_the_items_own_attributes(self):
        ANSWER['data-made-at'] = 'views.py:12'

        rendered = str(link(attributes={'data-id': '4'}, tooltip='Open').attributes())

        self.assertIn('data-id="4"', rendered)
        self.assertIn('title="Open"', rendered)
        self.assertIn('data-made-at="views.py:12"', rendered)

    def test_a_value_is_escaped(self):
        ANSWER['data-made-at'] = '"><script>'

        self.assertEqual(str(link().attributes()), 'data-made-at="&quot;&gt;&lt;script&gt;"')

    def test_a_name_that_is_not_a_plain_attribute_name_is_dropped(self):
        ANSWER.update({'x onmouseover': '1', 'onclick': '2', 'data-ok': '3'})

        self.assertEqual(str(link().attributes()), 'data-ok="3"')

    def test_they_reach_the_rendered_menu(self):
        ANSWER['data-made-at'] = 'views.py:12'
        menu = HtmlMenu(template='button_group').add_items(
            MenuItem(url='#', menu_display=MenuItemDisplay('Link'), link_type=MenuItem.HREF)
        )

        self.assertIn('data-made-at="views.py:12"', str(menu.render()))

    def test_an_item_with_no_attributes_of_its_own_is_called_too(self):
        divider = DividerItem()

        self.assertEqual([item for item, _line in MADE], [divider])
