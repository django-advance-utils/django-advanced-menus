"""The views' permission hooks deciding which menu items are shown (``MenuItem.test_visible``)."""

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.urls import include, path, resolve
from django.views import View
from django_menus.menu import AjaxButtonMenuItem, HtmlMenu, MenuItem

ASKED = []
REFUSED = set()


class PageView(View):
    @staticmethod
    def menu_permissions(request, item):
        ASKED.append(('page', item.permission_name))
        return item.permission_name not in REFUSED

    def get(self, request, *args, **kwargs):
        return HttpResponse()


class TargetView(View):
    @classmethod
    def view_permission(cls, request, item):
        ASKED.append(('target', item.permission_name))
        return item.permission_name not in REFUSED

    def get(self, request, *args, **kwargs):
        return HttpResponse()


urlpatterns = [
    path('page/', PageView.as_view(), name='page'),
    path('invoices/', include(([path('<int:pk>/', TargetView.as_view(), name='detail')], 'invoices'))),
]


@override_settings(ROOT_URLCONF='tests.test_permissions')
class PermissionHookTestBase(SimpleTestCase):
    def setUp(self):
        ASKED.clear()
        REFUSED.clear()
        self.request = RequestFactory().get('/page/')
        self.request.resolver_match = resolve('/page/')

    def menu(self, *items):
        return HtmlMenu(self.request, 'button_group').add_items(*items)


class LinksAskTheirTargetTests(PermissionHookTestBase):
    def test_a_link_is_named_by_its_url_name_without_its_arguments(self):
        self.menu(MenuItem('invoices:detail,5', 'Invoice')).render()

        self.assertEqual(ASKED, [('target', 'invoices:detail')])

    def test_a_refused_link_is_not_shown(self):
        REFUSED.add('invoices:detail')

        self.assertEqual(self.menu(MenuItem('invoices:detail,5', 'Invoice')).render(), '')


class ButtonsAskTheirPageTests(PermissionHookTestBase):
    def test_an_ajax_button_is_named_by_its_button_name(self):
        self.menu(AjaxButtonMenuItem('approve', 'Approve')).render()

        self.assertEqual(ASKED, [('page', 'approve')])

    def test_a_refused_button_is_not_shown(self):
        REFUSED.add('approve')

        rendered = self.menu(AjaxButtonMenuItem('approve', 'Approve'), AjaxButtonMenuItem('reject', 'Reject')).render()

        self.assertNotIn('Approve', rendered)
        self.assertIn('Reject', rendered)

    def test_an_ajax_button_keeps_its_name_and_view(self):
        item = AjaxButtonMenuItem('approve', 'Approve', url_name='invoices:detail', url_args=[5])

        self.assertEqual((item.button_name, item.button_url_name), ('approve', 'invoices:detail'))

    def test_a_given_permission_name_wins(self):
        item = AjaxButtonMenuItem('approve', 'Approve', permission_name='invoice_approve')

        self.assertEqual(item.permission_name, 'invoice_approve')


class EmptyDropdownTests(PermissionHookTestBase):
    def test_a_dropdown_left_empty_takes_its_button_and_shortcut_with_it(self):
        REFUSED.add('approve')
        parent = MenuItem(menu_display='More', dropdown=[AjaxButtonMenuItem('approve', 'Approve')], key='m')

        self.assertEqual(self.menu(parent).render(), '')
        self.assertFalse(parent.visible)
