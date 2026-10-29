"""An entry in a dropdown that opens a submenu carries the submenu's id, which the menu JS wires it by."""
import re

from django.test import RequestFactory, SimpleTestCase
from django_menus.menu import HtmlMenu, MenuItem


def item(name, **kwargs):
    return MenuItem(url='#', link_type=MenuItem.HREF, menu_display=name, **kwargs)


class NestedDropdownTests(SimpleTestCase):
    def render(self, entry):
        menu = HtmlMenu(RequestFactory().get('/'), 'button_group').add_items(
            item('Top', dropdown=(item('Leaf'), entry)))
        return menu.render(), entry

    def test_an_entry_opening_a_submenu_carries_its_id_and_a_caret(self):
        rendered, entry = self.render(item('Sub', placement='right-start', dropdown=(item('Deep'),)))

        submenu_id = entry.dropdown.id
        self.assertIn(f"id='{submenu_id}-menu'", rendered)
        anchor = re.search(rf'<a [^>]*id="{submenu_id}"[^>]*>(.*?)</a>', rendered)
        self.assertIsNotNone(anchor)
        self.assertIn('fa-caret-right', anchor.group(1))
        self.assertIn(f"dropdown_menu_function('{submenu_id}', 'right-start')", rendered)

    def test_without_show_caret_the_entry_has_no_caret(self):
        rendered, entry = self.render(item('Sub', show_caret=False, dropdown=(item('Deep'),)))

        anchor = re.search(rf'<a [^>]*id="{entry.dropdown.id}"[^>]*>(.*?)</a>', rendered)
        self.assertNotIn('fa-caret-right', anchor.group(1))

    def test_a_plain_entry_has_no_id(self):
        rendered, _ = self.render(item('Plain'))

        self.assertNotRegex(rendered, r'<a [^>]*dropdown-item[^>]*id=')
