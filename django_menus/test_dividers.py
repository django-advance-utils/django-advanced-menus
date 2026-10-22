"""Dividers left with nothing to divide are not drawn (``HtmlMenu.tidy_dividers``)."""

from django.test import RequestFactory, SimpleTestCase
from django_menus.menu import DividerItem, HtmlMenu, MenuItem


def item(name, visible=True):
    return MenuItem(url='#', link_type=MenuItem.HREF, menu_display=name, visible=visible)


def shown(*items):
    menu = HtmlMenu(RequestFactory().get('/'), 'button_group').add_items(*items)
    rendered = menu.render()
    return rendered, ['-' if isinstance(i, DividerItem) else i.menu_display.text for i in menu.visible_items()]


class TidyDividersTests(SimpleTestCase):
    def test_a_divider_between_two_items_stays(self):
        self.assertEqual(shown(item('A'), DividerItem(), item('B'))[1], ['A', '-', 'B'])

    def test_dividers_left_together_by_hidden_items_become_one(self):
        items = (item('A'), DividerItem(), item('B', False), DividerItem(), item('C', False), DividerItem(), item('D'))

        self.assertEqual(shown(*items)[1], ['A', '-', 'D'])

    def test_dividers_at_the_start_and_end_go(self):
        items = (DividerItem(), item('A'), DividerItem(), item('B', False), DividerItem())

        self.assertEqual(shown(*items)[1], ['A'])

    def test_a_menu_of_only_dividers_draws_nothing(self):
        rendered, visible = shown(item('A', False), DividerItem(), item('B', False), DividerItem())

        self.assertEqual(rendered, '')
        self.assertEqual(visible, [])
