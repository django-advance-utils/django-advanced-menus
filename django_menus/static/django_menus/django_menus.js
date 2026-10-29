// Dropdowns are positioned by the vendored Floating UI (global FloatingUIDOM, so no clash with Bootstrap 4's Popper).

var MENU_VIEWPORT_PADDING = 8;  // context menus: keep clear of the viewport edge
var MENU_GAP = 2;

// Accepts an id, an element or (for custom templates written against the jQuery version) a jQuery object.
function menu_element(reference) {
    if (typeof reference === 'string') {
        return document.getElementById(reference);
    }
    if (reference && reference.jquery) {
        return reference[0];
    }
    return reference;
}

// Shows the menu and keeps it positioned until hide_menu; without Floating UI, Bootstrap's CSS places it.
// A menu taller than the room it is given scrolls inside the window (size), rather than running off it
// so that the wheel scrolls the page instead. Beside its entry, shift lets a submenu slide up, so it
// gets the window's height; above or below a button, a menu gets the room on the side flip chose.
function show_menu(reference, menu, placement) {
    menu.classList.add('show');
    if (typeof FloatingUIDOM === 'undefined') {
        return;
    }
    var fui = FloatingUIDOM;
    var edge = {padding: MENU_VIEWPORT_PADDING};
    stop_positioning(menu);
    Object.assign(menu.style, {position: 'absolute', margin: '0', right: 'auto', bottom: 'auto',
                               maxHeight: '', overflowY: ''});
    menu._menu_cleanup = fui.autoUpdate(reference, menu, function () {
        fui.computePosition(reference, menu, {
            placement: placement,
            middleware: [fui.offset(MENU_GAP), fui.flip(edge), fui.shift(edge), fui.size(Object.assign({
                apply: function (state) {
                    // Only a menu that does not fit becomes a scroll container: overflow-y: auto
                    // clips the menu's contents and can add a scroll bar across, so a short menu is
                    // left as it was.
                    var el = state.elements.floating;
                    var natural = el.scrollHeight + el.offsetHeight - el.clientHeight;
                    var fits = natural <= state.availableHeight;
                    Object.assign(el.style, {
                        maxHeight: fits ? '' : Math.max(0, state.availableHeight) + 'px',
                        overflowY: fits ? '' : 'auto'});
                }
            }, edge))]
        }).then(function (pos) {
            menu.style.left = pos.x + 'px';
            menu.style.top = pos.y + 'px';
        });
    });
}

function stop_positioning(menu) {
    if (menu._menu_cleanup) {
        menu._menu_cleanup();
        menu._menu_cleanup = null;
    }
}

// Closes the menu and any submenu still open below it. A submenu holds the menu above it open, so
// once it closes that menu may have been left by the pointer too, and is asked.
function hide_menu(menu) {
    var was_open = menu.classList.contains('show');
    menu.classList.remove('show', 'clicked');
    stop_positioning(menu);
    (menu._django_menus_children || []).forEach(function (child) {
        if (child.classList.contains('show')) {
            hide_menu(child);
        }
    });
    var parent = menu._django_menus_parent;
    if (was_open && parent && parent._django_menus_hide_if_left) {
        parent._django_menus_hide_if_left();
    }
}

function is_hovered(el) {
    return el.matches(':hover');
}

// Submenus. A submenu is drawn after the menu it belongs to rather than inside it, so each one is
// linked to its entry and to the menu above it when its script wires it, and the chain is walked
// through those links.

// Records that reference opens menu. The entry is already in the page when the submenu's script runs
// - a menu's markup comes before its submenus' - so the menu holding it is the parent. A top-level
// button is in no menu.
function link_submenu(reference, menu) {
    menu._django_menus_reference = reference;
    reference._django_menus_submenu = menu;
    var parent = reference.closest ? reference.closest('.dropdown-menu') : null;
    menu._django_menus_parent = parent;
    if (parent) {
        // isConnected drops a submenu whose menu has since been replaced.
        parent._django_menus_children = (parent._django_menus_children || []).filter(function (child) {
            return child !== menu && child.isConnected;
        }).concat([menu]);
    }
}

// This menu and every menu above it.
function menu_lineage(menu) {
    var lineage = [];
    while (menu && lineage.indexOf(menu) === -1) {
        lineage.push(menu);
        menu = menu._django_menus_parent;
    }
    return lineage;
}

// Every submenu below this menu, and theirs in turn.
function submenus(menu, found) {
    found = found || [];
    (menu._django_menus_children || []).forEach(function (child) {
        if (found.indexOf(child) === -1) {
            found.push(child);
            submenus(child, found);
        }
    });
    return found;
}

// Whether el is in this menu or in any of its submenus.
function in_menu_tree(menu, el) {
    return !!el && (menu.contains(el) || submenus(menu).some(function (submenu) {
        return submenu.contains(el);
    }));
}

// Whether the pointer is on this menu or on an open submenu below it.
function menu_tree_hovered(menu) {
    return is_hovered(menu) || submenus(menu).some(function (submenu) {
        return submenu.classList.contains('show') && is_hovered(submenu);
    });
}

// Whether a click landed on an entry that opens a submenu, which must not close the menu it is in.
function opens_submenu(target) {
    var entry = target.closest ? target.closest('a') : null;
    return !!(entry && entry._django_menus_submenu);
}

// Whether a click chose something - an entry, or a button an item renders - rather than landing on a
// header, a divider, the menu's padding or its scroll bar, which leave the menu open.
function chose_entry(target) {
    return !!(target.closest && target.closest('a, button')) && !opens_submenu(target);
}

// An entry was chosen: the menu it is in closes, with every menu above it and so every submenu.
function close_menu_chain(menu) {
    var lineage = menu_lineage(menu);
    hide_menu(lineage[lineage.length - 1]);
    lineage.forEach(hide_menu);
}

// Click-opened menus also close on an outside click or Escape: Safari never fires focusout on a clicked link.
// Opening a click menu closes the other click-opened menus, but not the ones it is a submenu of.
function close_clicked_menus(except) {
    var keep = except ? menu_lineage(except) : [];
    document.querySelectorAll('.dropdown-menu.clicked').forEach(function (menu) {
        if (keep.indexOf(menu) === -1) {
            hide_menu(menu);
        }
    });
}

document.addEventListener('click', function (e) {
    document.querySelectorAll('.dropdown-menu.clicked').forEach(function (menu) {
        var reference = menu._django_menus_reference;
        if (!in_menu_tree(menu, e.target) && !(reference && reference.contains(e.target))) {
            hide_menu(menu);
        }
    });
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        close_clicked_menus();
    }
});

// A click-opened menu closes when focus leaves its button - but not when focus has only moved between
// the button and the menu itself. The menu is rendered after the bar rather than inside the button, so
// handing focus into it from the keyboard is a focusout on the button, and closing then made a
// click-opened menu impossible to reach without a mouse. relatedTarget is null when focus goes nowhere
// in the page (or the browser does not say), which is read as leaving.
//
// Focus leaving a submenu may be leaving the menus above it as well, which see no focusout of their own
// (a submenu is not inside its parent), so each click-opened menu up the chain is checked. One that
// the pointer is on - its own entries or a submenu's - stays: clicking a submenu's header or scroll
// bar takes focus from the parent's entry to nowhere.
function close_on_focus_leaving(reference, menu) {
    function on_focusout(e) {
        var next = e.relatedTarget;
        menu_lineage(menu).forEach(function (el) {
            var el_reference = el._django_menus_reference;
            if (next && (in_menu_tree(el, next) || (el_reference && el_reference.contains(next)))) {
                return;
            }
            if (el.classList.contains('clicked') && !menu_tree_hovered(el)) {
                hide_menu(el);
            }
        });
    }
    reference.addEventListener('focusout', on_focusout);
    menu.addEventListener('focusout', on_focusout);
}

// Says on the button that its handlers are attached. The handlers are plain listeners, which nothing
// in the page can list, and a button can be in the DOM before the inline script that wires it has run -
// so a test, or any code that has to wait for a menu to be live, waits for this attribute instead.
function mark_bound(reference) {
    reference.setAttribute('data-django-menus-bound', '');
}

var dropdown_menu_function = function dropdown_menu_function(reference) {
    var placement = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'bottom-start';
    reference = menu_element(reference);
    var menu = document.getElementById(reference.id + '-menu');
    link_submenu(reference, menu);

    // Closes the menu once the pointer has left its button, the menu and any submenu open below it.
    function hide_if_left() {
        if (!menu.classList.contains('show') || is_hovered(reference) || menu_tree_hovered(menu) ||
                menu.classList.contains('clicked')) {
            return;
        }
        hide_menu(menu);
    }
    menu._django_menus_hide_if_left = hide_if_left;

    function hide_later(e) {
        setTimeout(hide_if_left, e.type === 'mouseleave' ? 300 : 0);
    }

    menu.addEventListener('click', function (e) {
        if (chose_entry(e.target)) {
            close_menu_chain(menu);
        }
    });

    function reference_hover(e) {
        if (is_hovered(reference)) {
            // Every other open menu closes, but not the ones this is a submenu of.
            var lineage = menu_lineage(menu);
            document.querySelectorAll('.menu-system.show').forEach(function (el) {
                if (lineage.indexOf(el) === -1) {
                    hide_menu(el);
                }
            });
            menu.classList.add('menu-system');
            show_menu(reference, menu, placement);
        }
        hide_later(e);
    }

    reference.addEventListener('mouseenter', reference_hover);
    reference.addEventListener('mouseleave', reference_hover);
    menu.addEventListener('mouseenter', hide_later);
    menu.addEventListener('mouseleave', hide_later);

    reference.addEventListener('click', function () {
        if (menu.classList.contains('clicked')) {
            hide_menu(menu);
        } else {
            close_clicked_menus(menu);
            menu.classList.add('clicked');
            show_menu(reference, menu, placement);
        }
    });

    close_on_focus_leaving(reference, menu);
    mark_bound(reference);
};

var dropdown_menu_click = function dropdown_menu_click(reference) {
    var placement = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'bottom-start';
    reference = menu_element(reference);
    var menu = document.getElementById(reference.id + '-menu');
    link_submenu(reference, menu);

    menu.addEventListener('click', function (e) {
        if (menu.classList.contains('clicked') && chose_entry(e.target)) {
            close_menu_chain(menu);
        }
    });

    reference.addEventListener('click', function () {
        if (menu.classList.contains('clicked')) {
            hide_menu(menu);
        } else {
            close_clicked_menus(menu);
            menu.classList.add('clicked');
            show_menu(reference, menu, placement);
        }
    });

    close_on_focus_leaving(reference, menu);
    mark_bound(reference);
};


function click_href(href) {
    var a = document.createElement('a');
    a.style.display = 'none';
    a.href = href;
    document.body.appendChild(a);
    a.click();
    a.remove();
}


ajax_helpers.command_functions.enable_context_menu = function (command) {
    // Delegated, so elements added after page load get the menu too.
    document.addEventListener('contextmenu', function (evt) {
        var el = evt.target.closest ? evt.target.closest(command.selector) : null;
        if (!el) {
            return;
        }
        evt.preventDefault();

        // Create a dictionary (object) to store data attributes and id
        var elementData = {'ajax': 'context_menu', 'pos': [evt.pageX, evt.pageY]};
        elementData['id'] = el.id;

        // Get all data attributes and add them to the dictionary
        Object.assign(elementData, el.dataset);
        ajax_helpers.event = evt;
        ajax_helpers.post_json({'data': elementData});
    });
};


// Replaces #context-menu (or appends to body) with html. Scripts are re-created because innerHTML does not
// run them, and nested dropdowns in the menu html set themselves up with a <script>.
function insert_context_menu(html) {
    var old = document.getElementById('context-menu');
    // Its submenus are drawn beside it, not in it, so replacing it alone would leave them behind.
    if (old) {
        submenus(old).forEach(function (submenu) {
            hide_menu(submenu);
            submenu.remove();
        });
    }
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var nodes = Array.prototype.slice.call(tmp.childNodes);
    nodes.forEach(function (node) {
        if (old) {
            old.parentNode.insertBefore(node, old);
        } else {
            document.body.appendChild(node);
        }
    });
    if (old) {
        old.remove();
    }
    nodes.forEach(function (node) {
        if (node.nodeType !== 1) {
            return;
        }
        var scripts = node.tagName === 'SCRIPT' ? [node] : Array.prototype.slice.call(node.querySelectorAll('script'));
        scripts.forEach(function (script) {
            var fresh = document.createElement('script');
            fresh.text = script.textContent;
            script.parentNode.replaceChild(fresh, script);
        });
    });
}


var context_menu_outside_click;

ajax_helpers.command_functions.context_menu = function (command) {
    insert_context_menu(command.menu);
    var menu = document.getElementById('context-menu');

    // Ensure the menu is valid before proceeding
    if (!menu) {
        console.error('Dropdown menu not found');
        return;
    }

    // Get the viewport bounds in document coordinates. Context-menu events already
    // provide page coordinates, and AJAX dropdowns send document coordinates below.
    var windowWidth = document.documentElement.clientWidth;
    var windowHeight = document.documentElement.clientHeight;
    var viewportLeft = window.scrollX;
    var viewportTop = window.scrollY;
    var viewportRight = viewportLeft + windowWidth;
    var viewportBottom = viewportTop + windowHeight;

    // Measure while displayed; a hidden menu has no size.
    menu.style.display = 'block';
    var menuWidth = menu.offsetWidth;
    var menuHeight = menu.offsetHeight;

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

    // Keep oversized menus usable rather than allowing them to extend beyond both
    // edges of the viewport.
    var viewportPadding = MENU_VIEWPORT_PADDING;
    if (menuHeight > windowHeight - (viewportPadding * 2)) {
        menu.style.maxHeight = (windowHeight - (viewportPadding * 2)) + 'px';
        menu.style.overflowY = 'auto';
        menuHeight = menu.offsetHeight;
    }

    // Adjust position to prevent overflow on the right
    if (positionX + menuWidth + viewportPadding > viewportRight) {
        positionX = viewportRight - menuWidth - viewportPadding;
    }
    positionX = Math.max(viewportLeft + viewportPadding, positionX);

    // AJAX dropdowns include the top of their anchor button. Flip those menus
    // directly above the button when they do not fit below it; pointer context
    // menus retain the existing viewport-edge fallback.
    if (positionY + menuHeight + viewportPadding > viewportBottom) {
        if (anchorTop !== undefined && anchorTop - menuHeight - viewportPadding >= viewportTop) {
            positionY = anchorTop - menuHeight;
        } else {
            positionY = viewportBottom - menuHeight - viewportPadding;
        }
    }
    positionY = Math.max(viewportTop + viewportPadding, positionY);

    // Position the menu at the adjusted coordinates
    menu.style.top = positionY + 'px';
    menu.style.left = positionX + 'px';

    // Hide the menu when clicking outside of it
    if (context_menu_outside_click) {
        document.removeEventListener('click', context_menu_outside_click);
    }
    context_menu_outside_click = function (e) {
        // Choosing an entry in one of its submenus closes it too; any other click in them does not.
        if (!in_menu_tree(menu, e.target) || chose_entry(e.target)) {
            menu.style.display = 'none';
            // Remove the click event handler after hiding the menu
            document.removeEventListener('click', context_menu_outside_click);
            context_menu_outside_click = null;
        }
    };
    document.addEventListener('click', context_menu_outside_click);

    // Hides the menu as soon as an entry in it is chosen
    menu.addEventListener('click', function (e) {
        if (chose_entry(e.target)) {
            menu.style.display = 'none';
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

document.addEventListener('click', function (event) {
    var anchor = event.target.closest ? event.target.closest('a.django-menus-item') : null;
    if (!anchor) {
        return;
    }
    // An item's own data-django-menus-repeat-ms wins over the page's window, so a single item
    // can be held where the page has the guard off, and 0 on an item opts it out where the page
    // has it on.
    var item_ms = anchor.getAttribute('data-django-menus-repeat-ms');
    // Number() so junk reads as off rather than as NaN comparisons that quietly never fire:
    // 0, a negative and a non-numeric string all fail this. (true would read as a 1ms hold,
    // i.e. effectively off; the Python side rejects it outright with a message.)
    var hold_ms = Number(item_ms === null ? django_menus_repeat_click_ms : item_ms);
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
    if (event.defaultPrevented) {
        return;
    }
    // Trimmed because a browser trims before deciding what a href means, so a scheme sitting
    // behind leading whitespace still counts as one.
    var href = (anchor.getAttribute('href') || '').replace(/^\s+/, '');
    if (!href || href.charAt(0) === '#' || href.slice(0, 11).toLowerCase() === 'javascript:') {
        return;
    }
    var now = new Date().getTime();
    var clicked_at = anchor._django_menus_clicked_at;
    if (clicked_at !== undefined && now - clicked_at < hold_ms) {
        // preventDefault alone, deliberately: stopping propagation as well would rob the
        // dropdown/context-menu closers above, and Bootstrap's own, of a click they should still
        // see. Nothing here needs the click stopped, only the navigation.
        event.preventDefault();
        return;
    }
    anchor._django_menus_clicked_at = now;

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
    anchor.classList.add('django-menus-clicked');
    setTimeout(function () {
        anchor.classList.remove('django-menus-clicked');
    }, hold_ms);
});

window.addEventListener('pageshow', function (event) {
    // A page restored from the back/forward cache comes back with its elements intact, so a
    // link clicked just before navigating away would still be held - clicking Back and
    // immediately clicking the same item again would do nothing. A restored page is a fresh
    // start, so the timers go.
    //
    // Nothing can be holding a timer unless something opted in, and this is the only place the
    // guard would touch the DOM while switched off, so it checks first: with no page-level
    // window and no item carrying its own, a restore does no work here.
    if (!event.persisted) {
        return;
    }
    var held = document.querySelectorAll('a.django-menus-item[data-django-menus-repeat-ms]');
    if (Number(django_menus_repeat_click_ms) > 0) {
        held = document.querySelectorAll('a.django-menus-item');
    } else if (!held.length) {
        return;
    }
    Array.prototype.forEach.call(held, function (anchor) {
        anchor._django_menus_clicked_at = undefined;
        anchor.classList.remove('django-menus-clicked');
    });
});
