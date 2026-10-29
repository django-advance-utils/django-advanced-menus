// One positioner for both Popper generations. Bootstrap 4 puts Popper 1 on the page as a
// global constructor; Bootstrap 5 bundles Popper 2 privately and leaves `window.Popper` alone,
// so under Bootstrap 5 the include loads @popperjs/core itself (includes.py) and this finds
// `Popper.createPopper`. With neither present the menu is dropped straight below its button,
// which is where `.dropdown-menu.show` puts it without any positioning at all.
//
// Returns an object with one method, `update()`, which lays the menu out now. Call it after
// the menu is shown: a display:none element measures 0x0, so a layout done before the menu is
// visible has no width to work with and cannot see that it overflows the window.
function make_menu_popper(reference, menu, placement) {
    var reference_el = reference.jquery ? reference[0] : reference;
    var menu_el = menu.jquery ? menu[0] : menu;
    // A submenu opened beside its entry ('right-start', 'left-start', ...) is laid out here rather
    // than by Popper, which keeps a menu inside its scroll parent -- the whole page -- and so let a
    // submenu opened near the bottom of the window run off it, out of reach.
    if (/^(right|left)/.test(placement || '')) {
        return {
            update: function () {
                place_menu_beside(reference_el, menu_el, placement);
            }
        };
    }
    if (typeof Popper !== 'undefined' && typeof Popper.createPopper === 'function') {
        var instance = Popper.createPopper(reference_el, menu_el, {placement: placement});
        return {
            update: function () {
                // Popper 2's update() is asynchronous (a promise settled on the next frame), so
                // the menu would paint once where it last was before moving. forceUpdate() lays
                // it out synchronously, which is what Popper 1's update() did.
                instance.forceUpdate();
            }
        };
    }
    if (typeof Popper !== 'undefined') {
        return new Popper(reference_el, menu_el, {placement: placement});
    }
    var at_end = placement.indexOf('end') > -1;
    return {
        update: function () {
            menu_el.style.position = 'absolute';
            menu_el.style.top = '100%';
            menu_el.style.left = at_end ? 'auto' : '0';
            menu_el.style.right = at_end ? '0' : 'auto';
        }
    };
}

// Kept between a menu and the edge of the window.
var django_menus_viewport_margin = 8;

// The window's visible size, not counting its scroll bars.
function django_menus_viewport() {
    return {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight};
}

// A menu taller than the window scrolls inside it rather than running off it. Measured on the menu
// as shown, so call it after the menu is visible.
function fit_menu_height(menu_el) {
    menu_el.style.maxHeight = '';
    menu_el.style.overflowY = '';
    var room = django_menus_viewport().height - (django_menus_viewport_margin * 2);
    if (menu_el.offsetHeight > room) {
        menu_el.style.maxHeight = room + 'px';
        menu_el.style.overflowY = 'auto';
    }
}

// Puts a menu at (x, y) in window coordinates, whatever element it is positioned against.
function set_menu_position(menu_el, x, y) {
    var origin_x = -window.pageXOffset;
    var origin_y = -window.pageYOffset;
    var parent = menu_el.offsetParent;
    if (parent && parent !== document.body && parent !== document.documentElement) {
        var parent_rect = parent.getBoundingClientRect();
        origin_x = parent_rect.left + parent.clientLeft - parent.scrollLeft;
        origin_y = parent_rect.top + parent.clientTop - parent.scrollTop;
    }
    menu_el.style.left = (x - origin_x) + 'px';
    menu_el.style.top = (y - origin_y) + 'px';
}

// A submenu beside the entry that opens it, kept on the screen:
// - beside its parent menu on the side the placement asks for -- or the side the parent itself
//   opened to, so a chain of submenus carries on the way it started rather than doubling back over
//   the menus it came from -- or on the other side when that side has no room (a menu near the
//   right of the window opens to the left);
// - its first entry level with the entry, or, with no room below, its last entry level with it, so
//   the menu opens upwards (a menu near the bottom of the window grows up from the entry);
// - and a menu taller than the window scrolls.
function place_menu_beside(reference_el, menu_el, placement) {
    var margin = django_menus_viewport_margin;
    var view = django_menus_viewport();
    menu_el.style.position = 'absolute';
    menu_el.style.transform = 'none';
    menu_el.style.margin = '0';
    menu_el.style.right = 'auto';
    menu_el.style.bottom = 'auto';
    fit_menu_height(menu_el);

    var item = reference_el.getBoundingClientRect();
    var parent_menu = $(reference_el).closest('.dropdown-menu')[0];
    var beside = parent_menu ? parent_menu.getBoundingClientRect() : item;
    var width = menu_el.offsetWidth;
    var height = menu_el.offsetHeight;

    var right_x = beside.right;
    var left_x = beside.left - width;
    var fits_right = right_x + width + margin <= view.width;
    var fits_left = left_x >= margin;
    var wanted = (parent_menu && parent_menu.getAttribute('data-django-menus-side')) ||
        (placement.indexOf('left') === 0 ? 'left' : 'right');
    var side;
    if (wanted === 'left') {
        side = (fits_left || !fits_right) ? 'left' : 'right';
    } else {
        side = (fits_right || !fits_left) ? 'right' : 'left';
    }
    menu_el.setAttribute('data-django-menus-side', side);
    var x = side === 'left' ? left_x : right_x;
    x = Math.max(margin, Math.min(x, view.width - width - margin));

    var style = window.getComputedStyle(menu_el);
    var above_first = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
    var below_last = (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    var y = item.top - above_first;
    if (y + height + margin > view.height) {
        y = item.bottom + below_last - height;
    }
    y = Math.max(margin, Math.min(y, view.height - height - margin));
    set_menu_position(menu_el, x, y);
}

// The entry that opens a menu: '#abc' for '#abc-menu'.
function django_menus_reference(menu) {
    var id = $(menu).attr('id') || '';
    return /-menu$/.test(id) ? $('#' + id.replace(/-menu$/, '')) : $();
}

// The submenus opened from a menu's own entries, open or not, and theirs in turn. They are not
// inside it in the page -- each is drawn after the menu it belongs to -- so they are found from the
// entries' ids.
function django_menus_submenus(menu) {
    var found = $();
    $(menu).find('a[id]').each(function () {
        if (!this.id) {
            return;
        }
        var submenu = $('#' + this.id + '-menu');
        if (submenu.length && !found.is(submenu)) {
            found = found.add(submenu).add(django_menus_submenus(submenu));
        }
    });
    return found;
}

// A menu and every menu above it: the menu holding the entry that opened it, and so on up.
function django_menus_lineage(menu) {
    var lineage = $();
    menu = $(menu);
    while (menu.length && !lineage.is(menu)) {
        lineage = lineage.add(menu);
        menu = django_menus_reference(menu).closest('.dropdown-menu');
    }
    return lineage;
}

// Whether the pointer is on a menu or on any open submenu below it.
function django_menus_tree_hovered(menu) {
    return $(menu).add(django_menus_submenus(menu).filter('.show')).is(':hover');
}

// Whether a click landed on an entry that opens a submenu -- which opens it, and must not close
// the menu it is in.
function django_menus_opens_submenu(target) {
    var entry = $(target).closest('a[id]');
    return entry.length > 0 && entry.attr('id') !== '' && $('#' + entry.attr('id') + '-menu').length > 0;
}

// Closes a hover menu the pointer has left -- unless it is on the entry that opened it, on the menu,
// or on a submenu opened from it -- and its submenus with it. Then its parent, which a submenu
// holds open, has been left too if the pointer is on neither.
function close_left_menu(menu) {
    menu = $(menu);
    if (!menu.hasClass('show') || menu.hasClass('clicked')) {
        return;
    }
    if (django_menus_reference(menu).is(':hover') || django_menus_tree_hovered(menu)) {
        return;
    }
    menu.removeClass('show');
    django_menus_submenus(menu).removeClass('show clicked');
    var parent = django_menus_reference(menu).closest('.dropdown-menu.menu-system');
    if (parent.length) {
        close_left_menu(parent);
    }
}

var dropdown_menu_function = function dropdown_menu_function(reference) {
  var placement = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'bottom-start';
    var menu = $('#' + reference.attr('id') + '-menu');
    var pop;

    menu.click(function (e) {
        if (django_menus_opens_submenu(e.target)) {
            return;
        }
        // The entry chosen closes the menu it is in and every hover menu above it.
        menu.removeClass('show clicked');
        django_menus_lineage(menu).filter('.menu-system').removeClass('show clicked');
    })

    reference.hover(function (e) {
        var reference = $(this);
        var menu = $('#' + reference.attr('id') + '-menu');
        if (reference.is(':hover')) {
            // Every other open menu closes, but not the ones this is a submenu of.
            $('.menu-system.show').not(django_menus_lineage(menu)).removeClass('show');
            menu.addClass('show menu-system');
            // Positioned only once the menu is shown (see make_menu_popper), and laid out again on
            // every show because the page can have changed since the positioner was built.
            if (pop == undefined) {
                pop = make_menu_popper(reference, menu, placement);
            }
            pop.update();
        }
        setTimeout(function () {
            close_left_menu(menu);
        }, e.type === 'mouseleave' ? 300 : 0);
    });

    menu.hover(function (e) {
        setTimeout(function () {
            close_left_menu(menu);
        }, e.type === 'mouseleave' ? 300 : 0);
    });

    reference.click(function () {
        if (menu.hasClass('clicked')) {
            menu.removeClass('show clicked');
        } else {
            menu.addClass('show clicked');
        }
    });

    reference.focusout(function () {
        if (menu.hasClass('clicked') &&  !menu.is(':hover')) {
            menu.removeClass('show clicked');
        }
    });
};

// A click-opened menu closes when another opens, when the page is clicked anywhere outside it, and
// on Escape. Not only on the button losing focus: Safari never focuses a link or button that is
// clicked, so there focusout never fires, and every menu opened stayed open -- the next row's
// menu opened on top of the last, which then covered the button below it.
var close_clicked_menus = function close_clicked_menus(except) {
    $('.dropdown-menu.clicked').not(except || $()).removeClass('show clicked');
};

$(document).on('click.dropdown_menu_click', function (e) {
    $('.dropdown-menu.clicked').each(function () {
        var menu = $(this);
        var reference = $('#' + menu.attr('id').replace(/-menu$/, ''));
        var inside = menu.is(e.target) || menu.has(e.target).length ||
            reference.is(e.target) || reference.has(e.target).length;
        if (!inside) {
            menu.removeClass('show clicked');
        }
    });
}).on('keydown.dropdown_menu_click', function (e) {
    if (e.key === 'Escape') {
        close_clicked_menus();
    }
});

var dropdown_menu_click = function dropdown_menu_click(reference) {
  var placement = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'bottom-start';
    var menu = $('#' + reference.attr('id') + '-menu');
    var pop;

    menu.click(function () {
        if (menu.hasClass('clicked')) {
            menu.removeClass('show clicked')
        }
    })

    reference.click(function () {
        if (menu.hasClass('clicked')) {
            menu.removeClass('show clicked')
        } else {
            close_clicked_menus(menu)
            menu.addClass('show clicked')
            // Positioned only once the menu is shown (see make_menu_popper), and laid out again on
            // every reopen because the page can have changed since the positioner was built.
            if (pop == undefined) {
                pop = make_menu_popper(reference, menu, placement)
            }
            pop.update()
        }
    })

    reference.focusout(function () {
        if (menu.hasClass('clicked') &&  !menu.is(':hover')) {
                menu.removeClass('show clicked')
            }
    })
}


function click_href(href) {
    var a = document.createElement('a');
    a.style.display = 'none';
    a.href = href;
    document.body.appendChild(a);
    a.click();
    a.remove();
}


ajax_helpers.command_functions.enable_context_menu = function (command) {
    $(document).on("contextmenu", command.selector, function (evt) {
        evt.preventDefault();

        // Create a dictionary (object) to store data attributes and id
        var elementData = {'ajax': 'context_menu', 'pos': [evt.pageX, evt.pageY]};
        elementData['id'] = $(this).attr('id');

        // Get all data attributes and add them to the dictionary
        $.each(this.dataset, function (key, value) {
            elementData[key] = value;
        });
        ajax_helpers.event = evt
        ajax_helpers.post_json({'data': elementData});
    });
}


// The submenus of the context menu now showing, removed with it when the next one is drawn.
var context_submenus = $();

function hide_context_menu(menu) {
    $(menu).hide();
    context_submenus.removeClass('show clicked');
    $(document).off('click.contextMenu');
}

ajax_helpers.command_functions.context_menu = function (command) {
    // The last menu's submenus are drawn beside it, not in it, so replacing it leaves them behind.
    context_submenus.remove();
    if ($("#context-menu").length) {
        $("#context-menu").replaceWith(command.menu);
    } else {
        $("body").append(command.menu);
    }
    var menu = $('#context-menu');

    // Ensure the menu is valid before proceeding
    if (!menu.length) {
        console.error('Dropdown menu not found');
        return;
    }
    context_submenus = django_menus_submenus(menu);

    // Get the viewport bounds in document coordinates. Context-menu events already
    // provide page coordinates, and AJAX dropdowns send document coordinates below.
    var windowWidth = django_menus_viewport().width;
    var windowHeight = django_menus_viewport().height;
    var viewportLeft = $(window).scrollLeft();
    var viewportTop = $(window).scrollTop();
    var viewportRight = viewportLeft + windowWidth;
    var viewportBottom = viewportTop + windowHeight;
    var viewportPadding = django_menus_viewport_margin;

    // Shown before it is measured, but not seen until it is in place.
    menu.css({display: 'block', visibility: 'hidden', top: 0, left: 0});

    // A menu taller than the window scrolls inside it.
    fit_menu_height(menu[0]);
    var menuWidth = menu.outerWidth();
    var menuHeight = menu.outerHeight();

    // Calculate the position
    var positionX = 0;
    var positionY = 0;
    var anchorTop;

    if (command.pos === undefined) {
        positionX = ajax_helpers.event.pageX;
        positionY = ajax_helpers.event.pageY;
    } else {
        positionX = command.pos[0];
        positionY = command.pos[1];
        anchorTop = command.pos[2];
    }

    // With no room to the right, a menu opened at the pointer opens to its left, and an AJAX
    // dropdown's moves left until it fits.
    // Its submenus open on the side it did (see place_menu_beside).
    menu.removeAttr('data-django-menus-side');
    if (positionX + menuWidth + viewportPadding > viewportRight) {
        if (anchorTop === undefined && positionX - menuWidth >= viewportLeft + viewportPadding) {
            positionX = positionX - menuWidth;
            menu.attr('data-django-menus-side', 'left');
        } else {
            positionX = viewportRight - menuWidth - viewportPadding;
        }
    }
    positionX = Math.max(viewportLeft + viewportPadding, positionX);

    // With no room below, a menu opens upwards: an AJAX dropdown directly above its button (the
    // top of which it is sent), a menu opened at the pointer with its bottom at the pointer. Where
    // there is no room above either, it sits as low as the window allows.
    if (positionY + menuHeight + viewportPadding > viewportBottom) {
        var above = anchorTop !== undefined ? anchorTop : positionY;
        if (above - menuHeight - viewportPadding >= viewportTop) {
            positionY = above - menuHeight;
        } else {
            positionY = viewportBottom - menuHeight - viewportPadding;
        }
    }
    positionY = Math.max(viewportTop + viewportPadding, positionY);

    // Position the menu at the adjusted coordinates
    menu.css({
        visibility: '',
        top: `${positionY}px`,
        left: `${positionX}px`
    });

    // Hide the menu when clicking outside of it -- in the page, or on an entry of one of its
    // submenus, which are drawn outside it -- but not on an entry that opens a submenu.
    $(document).off('click.contextMenu').on('click.contextMenu', function (e) {
        if (!$(e.target).closest(menu).length && !django_menus_opens_submenu(e.target)) {
            hide_context_menu(menu);
        }
    });

    // Hides the menu as soon as you clicked it
    menu.on('click', function (e) {
        if (!django_menus_opens_submenu(e.target)) {
            hide_context_menu(menu);
        }
    });

};

function get_ajax_dropdown_menu(button, dropdownViewName, value) {
    // Get the bounding rectangle of the button
    const rect = button.getBoundingClientRect();

    // Convert the viewport-relative rectangle to document coordinates so it uses
    // the same coordinate system as the absolutely positioned context menu.
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const x = rect.left + scrollX;
    const y = rect.bottom + scrollY;
    const top = rect.top + scrollY;

    // Prepare data to send
    const data = {
        ajax: dropdownViewName,
        value: value,
        pos: [x, y, top]
    };

    // Call the post_json function with the new data
    ajax_helpers.post_json({'data': data});
}


/* Swallow a repeat click on a menu link that is already navigating.
 *
 * Every item this library renders is an <a href>, and a menu item can point at a view that DOES
 * something rather than one that just shows a page. A double-click sends the URL twice, and a
 * view that resolves "what should I act on" from its own current state rather than from the state
 * the link was drawn against acts on both: in JMS Cloud, two clicks on the project timeline's
 * "Go to Next Stage" moved a batch two stages on. Rather than every such view growing its own
 * guard, a project can opt in here.
 *
 * OFF by default: swallowing a click is a behaviour change, and whether a project has menu items
 * pointing at views that mind being called twice is the project's business, not this library's.
 * Opt in with the milliseconds to hold a link for, at whichever level fits - they cascade
 * item -> menu -> page -> off:
 *
 *     MenuItem('next_stage', 'Go to Next Stage', django_menus_repeat_click_ms=2000)
 *     HtmlMenu(request, 'button_group', django_menus_repeat_click_ms=2000)
 *     class MyView(MenuTemplateView):
 *         repeat_click_ms = 2000
 *
 * The first two render data-django-menus-repeat-ms on the anchor; the last sets the window
 * below. An item's own value wins, so one item can be held on a page with the guard off, and
 * 0 on an item opts it out where the page has it on.
 *
 * Read on each click rather than captured at load, so it can be changed at any point in a page's
 * life. An assignment made BEFORE this file loads survives too (see the initialiser below), so
 * a project can set it either side of the include.
 *
 * Around 2000 is a sensible starting point. Note what that window is and is not: it collapses a
 * double-click, which is the reported problem. It does not cover an impatient re-click several
 * seconds into a slow response - holding a link until the page actually goes away would strand
 * anything that deliberately leaves the page in place, like a download or a target="_blank".
 *
 * WHAT IS GUARDED, once on: any marked anchor whose href is not javascript: or a fragment, on an
 * unmodified primary-button click. That is a real browser navigation, so the first click has
 * already started one and a repeat can only duplicate it - which is what keeps this
 * behaviour-neutral for an ordinary page link. A target="_blank" item is included even though
 * the page stays put, because the duplicate REQUEST is the thing being prevented, not the
 * navigation; the effect is one new tab per double-click instead of two.
 *
 * WHAT IS NOT: a javascript: href, because the page stays and clicking again straight away is
 * often exactly what the user means - close a modal, reopen it. That covers AJAX_BUTTON,
 * AJAX_COMMAND, JAVASCRIPT and AJAX_GET_URL_NAME items, a django-modals show_modal link, and
 * anything disabled. Be aware this is a rule about the href, not a guarantee about the effect:
 * a JAVASCRIPT item is free to set window.location itself, an AJAX_BUTTON's view can answer with
 * a redirect command, and AJAX_GET_URL_NAME fetches a view and pushes state. Those reach a view
 * twice on a double-click just the same and are deliberately out of scope here - a view behind
 * one of them needs to be idempotent, or to do its own guarding. Modified clicks (ctrl/cmd/
 * shift/alt, or any button but the primary) are also left alone: they open the link elsewhere
 * and leave this page where it is.
 *
 * While a link is held it carries a django-menus-clicked class, so a project can show that the
 * click registered. That matters: people double-click because the first click appeared to do
 * nothing, so swallowing the second one treats the symptom and leaves the cause. No styling is
 * shipped for it - see the readme.
 *
 * Delegated from the document, so it also covers items rendered into the page later - an ajax
 * tooltip's contents, a context menu, a menu replaced by an ajax response. A project that
 * overrides these templates with its own copies needs to carry the marker class across for
 * those menus to be covered.
 *
 * This is defence in depth, NOT a substitute for making such a view idempotent. The back button,
 * a refresh, a second tab, a page left open while someone else moved the record, and a click
 * landing before this script has run all still send the request twice.
 */

// window.* rather than a bare 0, so an assignment made above the include is not clobbered when
// this line runs. A plain `var x = 0` would silently switch the guard back off for a project
// that set it first, which is the one mistake the "set it anywhere" contract invites.
var django_menus_repeat_click_ms = window.django_menus_repeat_click_ms || 0;

$(document).on('click', 'a.django-menus-item', function (event) {
    // An item's own data-django-menus-repeat-ms wins over the page's window, so a single item
    // can be held where the page has the guard off, and 0 on an item opts it out where the page
    // has it on. jQuery has already turned the attribute into a number.
    var item_ms = $(this).data('djangoMenusRepeatMs');
    // Number() so junk reads as off rather than as NaN comparisons that quietly never fire:
    // 0, a negative, null and a non-numeric string all fail this. (true would read as a 1ms
    // hold, i.e. effectively off; the Python side rejects it outright with a message.)
    var hold_ms = Number(item_ms === undefined ? django_menus_repeat_click_ms : item_ms);
    if (!(hold_ms > 0)) {
        return;
    }
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
    }
    // Something closer to the target has already cancelled the navigation - an inline onclick
    // returning false, an element-bound handler. Nothing was started, so there is nothing to
    // swallow, and arming here would eat the NEXT click: confirm() -> Cancel, then confirm() ->
    // OK within the window, and the user's confirmed click goes nowhere.
    if (event.isDefaultPrevented()) {
        return;
    }
    // Trimmed because a browser trims before deciding what a href means, so a scheme sitting
    // behind leading whitespace still counts as one.
    var href = ($(this).attr('href') || '').replace(/^\s+/, '');
    if (!href || href.charAt(0) === '#' || href.slice(0, 11).toLowerCase() === 'javascript:') {
        return;
    }
    // new Date().getTime() rather than Date.now(): the latter is ES5.1, and this file is served
    // as-is to whatever the project supports (django_menus declares no legacy_js build to fall
    // back to), so there is no reason for this to be what raises the browser floor.
    var now = new Date().getTime();
    var clicked_at = $(this).data('django-menus-clicked-at');
    if (clicked_at !== undefined && now - clicked_at < hold_ms) {
        // preventDefault alone, deliberately. `return false` would also stop propagation, and
        // jQuery runs directly-bound document handlers after delegated ones - so it would rob
        // the dropdown/context-menu closers and Bootstrap's clearMenus of a click they should
        // still see. Nothing here needs the click stopped, only the navigation.
        event.preventDefault();
        return;
    }
    $(this).data('django-menus-clicked-at', now);

    // Mark it while it is held, so a project can show the user something happened - which is the
    // half of this problem the swallow does not address: people double-click precisely because
    // the first click appeared to do nothing.
    //
    // A class rather than a look. What a held link should look like is the project's decision,
    // nothing is shipped for it, and so by default this is invisible - see the readme for the
    // rule to add. Style the appearance only: pointer-events: none looks tempting and lets the
    // click fall THROUGH to whatever sits underneath, which inside a dropdown is another menu
    // item. The handler above already stops the click; the class only has to look the part.
    //
    // Cleared on a timer, because a navigation that never arrives - cancelled, a download, a
    // target="_blank" - must not leave a link looking permanently dead. In the ordinary case the
    // page is replaced long before this fires.
    var anchor = $(this);
    anchor.addClass('django-menus-clicked');
    setTimeout(function () {
        anchor.removeClass('django-menus-clicked');
    }, hold_ms);
});

$(window).on('pageshow', function (event) {
    // A page restored from the back/forward cache comes back with its jQuery data intact, so a
    // link clicked just before navigating away would still be held - clicking Back and
    // immediately clicking the same item again would do nothing. A restored page is a fresh
    // start, so the timers go.
    //
    // Nothing can be holding a timer unless something opted in, and this is the only place the
    // guard would touch the DOM while switched off, so it checks first: with no page-level
    // window and no item carrying its own, a restore does no work here.
    if (!event.originalEvent || !event.originalEvent.persisted) {
        return;
    }
    var held = $('a.django-menus-item[data-django-menus-repeat-ms]');
    if (Number(django_menus_repeat_click_ms) > 0) {
        held = $('a.django-menus-item');
    } else if (!held.length) {
        return;
    }
    held.removeData('django-menus-clicked-at').removeClass('django-menus-clicked');
});
