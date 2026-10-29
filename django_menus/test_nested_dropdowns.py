"""A submenu's entry that has a dropdown of its own opens it, as a top-level entry's does.

The script opens a submenu from the entry whose id is the submenu's id less ``-menu``, so an entry
rendered with no id opens nothing. The context menu template always gave its entries one; the
dropdown template did not, so a submenu of a submenu was drawn but could never be reached.
"""

import re

from django.test import SimpleTestCase, override_settings
from django_menus.menu import HtmlMenu, MenuItem


def leaf(name):
    return MenuItem(url='#', menu_display=name, link_type=MenuItem.HREF)


def rendered(pack):
    with override_settings(DJANGO_MENUS_TEMPLATE_PACK=pack):
        inner = MenuItem(menu_display='Glass', dropdown=[leaf('Clear'), leaf('Obscure')], placement='right-start')
        outer = MenuItem(menu_display='Material', dropdown=[inner, leaf('None')], placement='right-start')
        html = str(HtmlMenu(None, template='context').add_items(leaf('Item Property'), outer).render())
    return html, outer, inner


class ASubmenuOpensItsOwnSubmenu(SimpleTestCase):
    def test_the_nested_entry_carries_its_submenus_id(self):
        for pack in ('bootstrap4', 'bootstrap5'):
            with self.subTest(pack=pack):
                html, outer, inner = rendered(pack)
                self.assertIn(f"id='{inner.dropdown.id}-menu'", html)
                entry = re.search(r'<a[^>]*id="%s"[^>]*>.*?</a>' % inner.dropdown.id, html, re.S)
                self.assertIsNotNone(entry, 'the Glass entry has no id, so nothing can open its submenu')
                self.assertIn('Glass', entry.group(0))

    def test_the_nested_entry_shows_it_opens_a_submenu(self):
        for pack, side in (('bootstrap4', 'float-right'), ('bootstrap5', 'float-end')):
            with self.subTest(pack=pack):
                html, outer, inner = rendered(pack)
                entry = re.search(r'<a[^>]*id="%s"[^>]*>.*?</a>' % inner.dropdown.id, html, re.S).group(0)
                self.assertIn(f'fa-caret-right pt-1 {side}', entry)

    def test_a_plain_entry_in_a_submenu_is_unchanged(self):
        html, outer, inner = rendered('bootstrap4')
        submenu = html[html.index(f"id='{outer.dropdown.id}-menu'"):]
        none_entry = re.search(r'<a[^>]*>None</a>', submenu)
        self.assertIsNotNone(none_entry)
        self.assertNotIn(' id=', none_entry.group(0))
        self.assertNotIn('fa-caret-right', none_entry.group(0))
