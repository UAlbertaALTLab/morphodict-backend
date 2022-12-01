(function () {
  'use strict';

  function getBoundingClientRect(element) {
    var rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      x: rect.left,
      y: rect.top
    };
  }

  /*:: import type { Window } from '../types'; */

  /*:: declare function getWindow(node: Node | Window): Window; */
  function getWindow(node) {
    if (node.toString() !== '[object Window]') {
      var ownerDocument = node.ownerDocument;
      return ownerDocument ? ownerDocument.defaultView || window : window;
    }

    return node;
  }

  function getWindowScroll(node) {
    var win = getWindow(node);
    var scrollLeft = win.pageXOffset;
    var scrollTop = win.pageYOffset;
    return {
      scrollLeft: scrollLeft,
      scrollTop: scrollTop
    };
  }

  /*:: declare function isElement(node: mixed): boolean %checks(node instanceof
    Element); */

  function isElement(node) {
    var OwnElement = getWindow(node).Element;
    return node instanceof OwnElement || node instanceof Element;
  }
  /*:: declare function isHTMLElement(node: mixed): boolean %checks(node instanceof
    HTMLElement); */


  function isHTMLElement(node) {
    var OwnElement = getWindow(node).HTMLElement;
    return node instanceof OwnElement || node instanceof HTMLElement;
  }
  /*:: declare function isShadowRoot(node: mixed): boolean %checks(node instanceof
    ShadowRoot); */


  function isShadowRoot(node) {
    var OwnElement = getWindow(node).ShadowRoot;
    return node instanceof OwnElement || node instanceof ShadowRoot;
  }

  function getHTMLElementScroll(element) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }

  function getNodeScroll(node) {
    if (node === getWindow(node) || !isHTMLElement(node)) {
      return getWindowScroll(node);
    } else {
      return getHTMLElementScroll(node);
    }
  }

  function getNodeName(element) {
    return element ? (element.nodeName || '').toLowerCase() : null;
  }

  function getDocumentElement(element) {
    // $FlowFixMe[incompatible-return]: assume body is always available
    return ((isElement(element) ? element.ownerDocument : // $FlowFixMe[prop-missing]
    element.document) || window.document).documentElement;
  }

  function getWindowScrollBarX(element) {
    // If <html> has a CSS width greater than the viewport, then this will be
    // incorrect for RTL.
    // Popper 1 is broken in this case and never had a bug report so let's assume
    // it's not an issue. I don't think anyone ever specifies width on <html>
    // anyway.
    // Browsers where the left scrollbar doesn't cause an issue report `0` for
    // this (e.g. Edge 2019, IE11, Safari)
    return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
  }

  function getComputedStyle(element) {
    return getWindow(element).getComputedStyle(element);
  }

  function isScrollParent(element) {
    // Firefox wants us to check `-x` and `-y` variations as well
    var _getComputedStyle = getComputedStyle(element),
        overflow = _getComputedStyle.overflow,
        overflowX = _getComputedStyle.overflowX,
        overflowY = _getComputedStyle.overflowY;

    return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
  }

  // Composite means it takes into account transforms as well as layout.

  function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
    if (isFixed === void 0) {
      isFixed = false;
    }

    var documentElement = getDocumentElement(offsetParent);
    var rect = getBoundingClientRect(elementOrVirtualElement);
    var isOffsetParentAnElement = isHTMLElement(offsetParent);
    var scroll = {
      scrollLeft: 0,
      scrollTop: 0
    };
    var offsets = {
      x: 0,
      y: 0
    };

    if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
      if (getNodeName(offsetParent) !== 'body' || // https://github.com/popperjs/popper-core/issues/1078
      isScrollParent(documentElement)) {
        scroll = getNodeScroll(offsetParent);
      }

      if (isHTMLElement(offsetParent)) {
        offsets = getBoundingClientRect(offsetParent);
        offsets.x += offsetParent.clientLeft;
        offsets.y += offsetParent.clientTop;
      } else if (documentElement) {
        offsets.x = getWindowScrollBarX(documentElement);
      }
    }

    return {
      x: rect.left + scroll.scrollLeft - offsets.x,
      y: rect.top + scroll.scrollTop - offsets.y,
      width: rect.width,
      height: rect.height
    };
  }

  // Returns the layout rect of an element relative to its offsetParent. Layout
  // means it doesn't take into account transforms.
  function getLayoutRect(element) {
    return {
      x: element.offsetLeft,
      y: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight
    };
  }

  function getParentNode(element) {
    if (getNodeName(element) === 'html') {
      return element;
    }

    return (// this is a quicker (but less type safe) way to save quite some bytes from the bundle
      // $FlowFixMe[incompatible-return]
      // $FlowFixMe[prop-missing]
      element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
      element.parentNode || // DOM Element detected
      // $FlowFixMe[incompatible-return]: need a better way to handle this...
      element.host || // ShadowRoot detected
      // $FlowFixMe[incompatible-call]: HTMLElement is a Node
      getDocumentElement(element) // fallback

    );
  }

  function getScrollParent(node) {
    if (['html', 'body', '#document'].indexOf(getNodeName(node)) >= 0) {
      // $FlowFixMe[incompatible-return]: assume body is always available
      return node.ownerDocument.body;
    }

    if (isHTMLElement(node) && isScrollParent(node)) {
      return node;
    }

    return getScrollParent(getParentNode(node));
  }

  /*
  given a DOM element, return the list of all scroll parents, up the list of ancesors
  until we get to the top window object. This list is what we attach scroll listeners
  to, because if any of these parent elements scroll, we'll need to re-calculate the
  reference element's position.
  */

  function listScrollParents(element, list) {
    if (list === void 0) {
      list = [];
    }

    var scrollParent = getScrollParent(element);
    var isBody = getNodeName(scrollParent) === 'body';
    var win = getWindow(scrollParent);
    var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
    var updatedList = list.concat(target);
    return isBody ? updatedList : // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    updatedList.concat(listScrollParents(getParentNode(target)));
  }

  function isTableElement(element) {
    return ['table', 'td', 'th'].indexOf(getNodeName(element)) >= 0;
  }

  function getTrueOffsetParent(element) {
    if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
    getComputedStyle(element).position === 'fixed') {
      return null;
    }

    var offsetParent = element.offsetParent;

    if (offsetParent) {
      var html = getDocumentElement(offsetParent);

      if (getNodeName(offsetParent) === 'body' && getComputedStyle(offsetParent).position === 'static' && getComputedStyle(html).position !== 'static') {
        return html;
      }
    }

    return offsetParent;
  } // `.offsetParent` reports `null` for fixed elements, while absolute elements
  // return the containing block


  function getContainingBlock(element) {
    var currentNode = getParentNode(element);

    while (isHTMLElement(currentNode) && ['html', 'body'].indexOf(getNodeName(currentNode)) < 0) {
      var css = getComputedStyle(currentNode); // This is non-exhaustive but covers the most common CSS properties that
      // create a containing block.

      if (css.transform !== 'none' || css.perspective !== 'none' || css.willChange && css.willChange !== 'auto') {
        return currentNode;
      } else {
        currentNode = currentNode.parentNode;
      }
    }

    return null;
  } // Gets the closest ancestor positioned element. Handles some edge cases,
  // such as table ancestors and cross browser bugs.


  function getOffsetParent(element) {
    var window = getWindow(element);
    var offsetParent = getTrueOffsetParent(element);

    while (offsetParent && isTableElement(offsetParent) && getComputedStyle(offsetParent).position === 'static') {
      offsetParent = getTrueOffsetParent(offsetParent);
    }

    if (offsetParent && getNodeName(offsetParent) === 'body' && getComputedStyle(offsetParent).position === 'static') {
      return window;
    }

    return offsetParent || getContainingBlock(element) || window;
  }

  var top = 'top';
  var bottom = 'bottom';
  var right = 'right';
  var left = 'left';
  var auto = 'auto';
  var basePlacements = [top, bottom, right, left];
  var start = 'start';
  var end = 'end';
  var clippingParents = 'clippingParents';
  var viewport = 'viewport';
  var popper = 'popper';
  var reference = 'reference';
  var variationPlacements = /*#__PURE__*/basePlacements.reduce(function (acc, placement) {
    return acc.concat([placement + "-" + start, placement + "-" + end]);
  }, []);
  var placements = /*#__PURE__*/[].concat(basePlacements, [auto]).reduce(function (acc, placement) {
    return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
  }, []); // modifiers that need to read the DOM

  var beforeRead = 'beforeRead';
  var read = 'read';
  var afterRead = 'afterRead'; // pure-logic modifiers

  var beforeMain = 'beforeMain';
  var main = 'main';
  var afterMain = 'afterMain'; // modifier with the purpose to write to the DOM (or write into a framework state)

  var beforeWrite = 'beforeWrite';
  var write = 'write';
  var afterWrite = 'afterWrite';
  var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];

  function order(modifiers) {
    var map = new Map();
    var visited = new Set();
    var result = [];
    modifiers.forEach(function (modifier) {
      map.set(modifier.name, modifier);
    }); // On visiting object, check for its dependencies and visit them recursively

    function sort(modifier) {
      visited.add(modifier.name);
      var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
      requires.forEach(function (dep) {
        if (!visited.has(dep)) {
          var depModifier = map.get(dep);

          if (depModifier) {
            sort(depModifier);
          }
        }
      });
      result.push(modifier);
    }

    modifiers.forEach(function (modifier) {
      if (!visited.has(modifier.name)) {
        // check for visited object
        sort(modifier);
      }
    });
    return result;
  }

  function orderModifiers(modifiers) {
    // order based on dependencies
    var orderedModifiers = order(modifiers); // order based on phase

    return modifierPhases.reduce(function (acc, phase) {
      return acc.concat(orderedModifiers.filter(function (modifier) {
        return modifier.phase === phase;
      }));
    }, []);
  }

  function debounce(fn) {
    var pending;
    return function () {
      if (!pending) {
        pending = new Promise(function (resolve) {
          Promise.resolve().then(function () {
            pending = undefined;
            resolve(fn());
          });
        });
      }

      return pending;
    };
  }

  function getBasePlacement(placement) {
    return placement.split('-')[0];
  }

  function mergeByName(modifiers) {
    var merged = modifiers.reduce(function (merged, current) {
      var existing = merged[current.name];
      merged[current.name] = existing ? Object.assign(Object.assign(Object.assign({}, existing), current), {}, {
        options: Object.assign(Object.assign({}, existing.options), current.options),
        data: Object.assign(Object.assign({}, existing.data), current.data)
      }) : current;
      return merged;
    }, {}); // IE11 does not support Object.values

    return Object.keys(merged).map(function (key) {
      return merged[key];
    });
  }

  function getViewportRect(element) {
    var win = getWindow(element);
    var html = getDocumentElement(element);
    var visualViewport = win.visualViewport;
    var width = html.clientWidth;
    var height = html.clientHeight;
    var x = 0;
    var y = 0; // NB: This isn't supported on iOS <= 12. If the keyboard is open, the popper
    // can be obscured underneath it.
    // Also, `html.clientHeight` adds the bottom bar height in Safari iOS, even
    // if it isn't open, so if this isn't available, the popper will be detected
    // to overflow the bottom of the screen too early.

    if (visualViewport) {
      width = visualViewport.width;
      height = visualViewport.height; // Uses Layout Viewport (like Chrome; Safari does not currently)
      // In Chrome, it returns a value very close to 0 (+/-) but contains rounding
      // errors due to floating point numbers, so we need to check precision.
      // Safari returns a number <= 0, usually < -1 when pinch-zoomed
      // Feature detection fails in mobile emulation mode in Chrome.
      // Math.abs(win.innerWidth / visualViewport.scale - visualViewport.width) <
      // 0.001
      // Fallback here: "Not Safari" userAgent

      if (!/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
        x = visualViewport.offsetLeft;
        y = visualViewport.offsetTop;
      }
    }

    return {
      width: width,
      height: height,
      x: x + getWindowScrollBarX(element),
      y: y
    };
  }

  // of the `<html>` and `<body>` rect bounds if horizontally scrollable

  function getDocumentRect(element) {
    var html = getDocumentElement(element);
    var winScroll = getWindowScroll(element);
    var body = element.ownerDocument.body;
    var width = Math.max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
    var height = Math.max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
    var x = -winScroll.scrollLeft + getWindowScrollBarX(element);
    var y = -winScroll.scrollTop;

    if (getComputedStyle(body || html).direction === 'rtl') {
      x += Math.max(html.clientWidth, body ? body.clientWidth : 0) - width;
    }

    return {
      width: width,
      height: height,
      x: x,
      y: y
    };
  }

  function contains(parent, child) {
    var rootNode = child.getRootNode && child.getRootNode(); // First, attempt with faster native method

    if (parent.contains(child)) {
      return true;
    } // then fallback to custom implementation with Shadow DOM support
    else if (rootNode && isShadowRoot(rootNode)) {
        var next = child;

        do {
          if (next && parent.isSameNode(next)) {
            return true;
          } // $FlowFixMe[prop-missing]: need a better way to handle this...


          next = next.parentNode || next.host;
        } while (next);
      } // Give up, the result is false


    return false;
  }

  function rectToClientRect(rect) {
    return Object.assign(Object.assign({}, rect), {}, {
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height
    });
  }

  function getInnerBoundingClientRect(element) {
    var rect = getBoundingClientRect(element);
    rect.top = rect.top + element.clientTop;
    rect.left = rect.left + element.clientLeft;
    rect.bottom = rect.top + element.clientHeight;
    rect.right = rect.left + element.clientWidth;
    rect.width = element.clientWidth;
    rect.height = element.clientHeight;
    rect.x = rect.left;
    rect.y = rect.top;
    return rect;
  }

  function getClientRectFromMixedType(element, clippingParent) {
    return clippingParent === viewport ? rectToClientRect(getViewportRect(element)) : isHTMLElement(clippingParent) ? getInnerBoundingClientRect(clippingParent) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
  } // A "clipping parent" is an overflowable container with the characteristic of
  // clipping (or hiding) overflowing elements with a position different from
  // `initial`


  function getClippingParents(element) {
    var clippingParents = listScrollParents(getParentNode(element));
    var canEscapeClipping = ['absolute', 'fixed'].indexOf(getComputedStyle(element).position) >= 0;
    var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;

    if (!isElement(clipperElement)) {
      return [];
    } // $FlowFixMe[incompatible-return]: https://github.com/facebook/flow/issues/1414


    return clippingParents.filter(function (clippingParent) {
      return isElement(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== 'body';
    });
  } // Gets the maximum area that the element is visible in due to any number of
  // clipping parents


  function getClippingRect(element, boundary, rootBoundary) {
    var mainClippingParents = boundary === 'clippingParents' ? getClippingParents(element) : [].concat(boundary);
    var clippingParents = [].concat(mainClippingParents, [rootBoundary]);
    var firstClippingParent = clippingParents[0];
    var clippingRect = clippingParents.reduce(function (accRect, clippingParent) {
      var rect = getClientRectFromMixedType(element, clippingParent);
      accRect.top = Math.max(rect.top, accRect.top);
      accRect.right = Math.min(rect.right, accRect.right);
      accRect.bottom = Math.min(rect.bottom, accRect.bottom);
      accRect.left = Math.max(rect.left, accRect.left);
      return accRect;
    }, getClientRectFromMixedType(element, firstClippingParent));
    clippingRect.width = clippingRect.right - clippingRect.left;
    clippingRect.height = clippingRect.bottom - clippingRect.top;
    clippingRect.x = clippingRect.left;
    clippingRect.y = clippingRect.top;
    return clippingRect;
  }

  function getVariation(placement) {
    return placement.split('-')[1];
  }

  function getMainAxisFromPlacement(placement) {
    return ['top', 'bottom'].indexOf(placement) >= 0 ? 'x' : 'y';
  }

  function computeOffsets(_ref) {
    var reference = _ref.reference,
        element = _ref.element,
        placement = _ref.placement;
    var basePlacement = placement ? getBasePlacement(placement) : null;
    var variation = placement ? getVariation(placement) : null;
    var commonX = reference.x + reference.width / 2 - element.width / 2;
    var commonY = reference.y + reference.height / 2 - element.height / 2;
    var offsets;

    switch (basePlacement) {
      case top:
        offsets = {
          x: commonX,
          y: reference.y - element.height
        };
        break;

      case bottom:
        offsets = {
          x: commonX,
          y: reference.y + reference.height
        };
        break;

      case right:
        offsets = {
          x: reference.x + reference.width,
          y: commonY
        };
        break;

      case left:
        offsets = {
          x: reference.x - element.width,
          y: commonY
        };
        break;

      default:
        offsets = {
          x: reference.x,
          y: reference.y
        };
    }

    var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;

    if (mainAxis != null) {
      var len = mainAxis === 'y' ? 'height' : 'width';

      switch (variation) {
        case start:
          offsets[mainAxis] = offsets[mainAxis] - (reference[len] / 2 - element[len] / 2);
          break;

        case end:
          offsets[mainAxis] = offsets[mainAxis] + (reference[len] / 2 - element[len] / 2);
          break;
      }
    }

    return offsets;
  }

  function getFreshSideObject() {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };
  }

  function mergePaddingObject(paddingObject) {
    return Object.assign(Object.assign({}, getFreshSideObject()), paddingObject);
  }

  function expandToHashMap(value, keys) {
    return keys.reduce(function (hashMap, key) {
      hashMap[key] = value;
      return hashMap;
    }, {});
  }

  function detectOverflow(state, options) {
    if (options === void 0) {
      options = {};
    }

    var _options = options,
        _options$placement = _options.placement,
        placement = _options$placement === void 0 ? state.placement : _options$placement,
        _options$boundary = _options.boundary,
        boundary = _options$boundary === void 0 ? clippingParents : _options$boundary,
        _options$rootBoundary = _options.rootBoundary,
        rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary,
        _options$elementConte = _options.elementContext,
        elementContext = _options$elementConte === void 0 ? popper : _options$elementConte,
        _options$altBoundary = _options.altBoundary,
        altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary,
        _options$padding = _options.padding,
        padding = _options$padding === void 0 ? 0 : _options$padding;
    var paddingObject = mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements));
    var altContext = elementContext === popper ? reference : popper;
    var referenceElement = state.elements.reference;
    var popperRect = state.rects.popper;
    var element = state.elements[altBoundary ? altContext : elementContext];
    var clippingClientRect = getClippingRect(isElement(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary);
    var referenceClientRect = getBoundingClientRect(referenceElement);
    var popperOffsets = computeOffsets({
      reference: referenceClientRect,
      element: popperRect,
      strategy: 'absolute',
      placement: placement
    });
    var popperClientRect = rectToClientRect(Object.assign(Object.assign({}, popperRect), popperOffsets));
    var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect; // positive = overflowing the clipping rect
    // 0 or negative = within the clipping rect

    var overflowOffsets = {
      top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
      bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
      left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
      right: elementClientRect.right - clippingClientRect.right + paddingObject.right
    };
    var offsetData = state.modifiersData.offset; // Offsets can be applied only to the popper element

    if (elementContext === popper && offsetData) {
      var offset = offsetData[placement];
      Object.keys(overflowOffsets).forEach(function (key) {
        var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
        var axis = [top, bottom].indexOf(key) >= 0 ? 'y' : 'x';
        overflowOffsets[key] += offset[axis] * multiply;
      });
    }

    return overflowOffsets;
  }

  var DEFAULT_OPTIONS = {
    placement: 'bottom',
    modifiers: [],
    strategy: 'absolute'
  };

  function areValidElements() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return !args.some(function (element) {
      return !(element && typeof element.getBoundingClientRect === 'function');
    });
  }

  function popperGenerator(generatorOptions) {
    if (generatorOptions === void 0) {
      generatorOptions = {};
    }

    var _generatorOptions = generatorOptions,
        _generatorOptions$def = _generatorOptions.defaultModifiers,
        defaultModifiers = _generatorOptions$def === void 0 ? [] : _generatorOptions$def,
        _generatorOptions$def2 = _generatorOptions.defaultOptions,
        defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
    return function createPopper(reference, popper, options) {
      if (options === void 0) {
        options = defaultOptions;
      }

      var state = {
        placement: 'bottom',
        orderedModifiers: [],
        options: Object.assign(Object.assign({}, DEFAULT_OPTIONS), defaultOptions),
        modifiersData: {},
        elements: {
          reference: reference,
          popper: popper
        },
        attributes: {},
        styles: {}
      };
      var effectCleanupFns = [];
      var isDestroyed = false;
      var instance = {
        state: state,
        setOptions: function setOptions(options) {
          cleanupModifierEffects();
          state.options = Object.assign(Object.assign(Object.assign({}, defaultOptions), state.options), options);
          state.scrollParents = {
            reference: isElement(reference) ? listScrollParents(reference) : reference.contextElement ? listScrollParents(reference.contextElement) : [],
            popper: listScrollParents(popper)
          }; // Orders the modifiers based on their dependencies and `phase`
          // properties

          var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers, state.options.modifiers))); // Strip out disabled modifiers

          state.orderedModifiers = orderedModifiers.filter(function (m) {
            return m.enabled;
          }); // Validate the provided modifiers so that the consumer will get warned

          runModifierEffects();
          return instance.update();
        },
        // Sync update – it will always be executed, even if not necessary. This
        // is useful for low frequency updates where sync behavior simplifies the
        // logic.
        // For high frequency updates (e.g. `resize` and `scroll` events), always
        // prefer the async Popper#update method
        forceUpdate: function forceUpdate() {
          if (isDestroyed) {
            return;
          }

          var _state$elements = state.elements,
              reference = _state$elements.reference,
              popper = _state$elements.popper; // Don't proceed if `reference` or `popper` are not valid elements
          // anymore

          if (!areValidElements(reference, popper)) {

            return;
          } // Store the reference and popper rects to be read by modifiers


          state.rects = {
            reference: getCompositeRect(reference, getOffsetParent(popper), state.options.strategy === 'fixed'),
            popper: getLayoutRect(popper)
          }; // Modifiers have the ability to reset the current update cycle. The
          // most common use case for this is the `flip` modifier changing the
          // placement, which then needs to re-run all the modifiers, because the
          // logic was previously ran for the previous placement and is therefore
          // stale/incorrect

          state.reset = false;
          state.placement = state.options.placement; // On each update cycle, the `modifiersData` property for each modifier
          // is filled with the initial data specified by the modifier. This means
          // it doesn't persist and is fresh on each update.
          // To ensure persistent data, use `${name}#persistent`

          state.orderedModifiers.forEach(function (modifier) {
            return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
          });

          for (var index = 0; index < state.orderedModifiers.length; index++) {

            if (state.reset === true) {
              state.reset = false;
              index = -1;
              continue;
            }

            var _state$orderedModifie = state.orderedModifiers[index],
                fn = _state$orderedModifie.fn,
                _state$orderedModifie2 = _state$orderedModifie.options,
                _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2,
                name = _state$orderedModifie.name;

            if (typeof fn === 'function') {
              state = fn({
                state: state,
                options: _options,
                name: name,
                instance: instance
              }) || state;
            }
          }
        },
        // Async and optimistically optimized update – it will not be executed if
        // not necessary (debounced to run at most once-per-tick)
        update: debounce(function () {
          return new Promise(function (resolve) {
            instance.forceUpdate();
            resolve(state);
          });
        }),
        destroy: function destroy() {
          cleanupModifierEffects();
          isDestroyed = true;
        }
      };

      if (!areValidElements(reference, popper)) {

        return instance;
      }

      instance.setOptions(options).then(function (state) {
        if (!isDestroyed && options.onFirstUpdate) {
          options.onFirstUpdate(state);
        }
      }); // Modifiers have the ability to execute arbitrary code before the first
      // update cycle runs. They will be executed in the same order as the update
      // cycle. This is useful when a modifier adds some persistent data that
      // other modifiers need to use, but the modifier is run after the dependent
      // one.

      function runModifierEffects() {
        state.orderedModifiers.forEach(function (_ref3) {
          var name = _ref3.name,
              _ref3$options = _ref3.options,
              options = _ref3$options === void 0 ? {} : _ref3$options,
              effect = _ref3.effect;

          if (typeof effect === 'function') {
            var cleanupFn = effect({
              state: state,
              name: name,
              instance: instance,
              options: options
            });

            var noopFn = function noopFn() {};

            effectCleanupFns.push(cleanupFn || noopFn);
          }
        });
      }

      function cleanupModifierEffects() {
        effectCleanupFns.forEach(function (fn) {
          return fn();
        });
        effectCleanupFns = [];
      }

      return instance;
    };
  }

  var passive = {
    passive: true
  };

  function effect(_ref) {
    var state = _ref.state,
        instance = _ref.instance,
        options = _ref.options;
    var _options$scroll = options.scroll,
        scroll = _options$scroll === void 0 ? true : _options$scroll,
        _options$resize = options.resize,
        resize = _options$resize === void 0 ? true : _options$resize;
    var window = getWindow(state.elements.popper);
    var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);

    if (scroll) {
      scrollParents.forEach(function (scrollParent) {
        scrollParent.addEventListener('scroll', instance.update, passive);
      });
    }

    if (resize) {
      window.addEventListener('resize', instance.update, passive);
    }

    return function () {
      if (scroll) {
        scrollParents.forEach(function (scrollParent) {
          scrollParent.removeEventListener('scroll', instance.update, passive);
        });
      }

      if (resize) {
        window.removeEventListener('resize', instance.update, passive);
      }
    };
  } // eslint-disable-next-line import/no-unused-modules


  var eventListeners = {
    name: 'eventListeners',
    enabled: true,
    phase: 'write',
    fn: function fn() {},
    effect: effect,
    data: {}
  };

  function popperOffsets(_ref) {
    var state = _ref.state,
        name = _ref.name;
    // Offsets are the actual position the popper needs to have to be
    // properly positioned near its reference element
    // This is the most basic placement, and will be adjusted by
    // the modifiers in the next step
    state.modifiersData[name] = computeOffsets({
      reference: state.rects.reference,
      element: state.rects.popper,
      strategy: 'absolute',
      placement: state.placement
    });
  } // eslint-disable-next-line import/no-unused-modules


  var popperOffsets$1 = {
    name: 'popperOffsets',
    enabled: true,
    phase: 'read',
    fn: popperOffsets,
    data: {}
  };

  var unsetSides = {
    top: 'auto',
    right: 'auto',
    bottom: 'auto',
    left: 'auto'
  }; // Round the offsets to the nearest suitable subpixel based on the DPR.
  // Zooming can change the DPR, but it seems to report a value that will
  // cleanly divide the values into the appropriate subpixels.

  function roundOffsetsByDPR(_ref) {
    var x = _ref.x,
        y = _ref.y;
    var win = window;
    var dpr = win.devicePixelRatio || 1;
    return {
      x: Math.round(x * dpr) / dpr || 0,
      y: Math.round(y * dpr) / dpr || 0
    };
  }

  function mapToStyles(_ref2) {
    var _Object$assign2;

    var popper = _ref2.popper,
        popperRect = _ref2.popperRect,
        placement = _ref2.placement,
        offsets = _ref2.offsets,
        position = _ref2.position,
        gpuAcceleration = _ref2.gpuAcceleration,
        adaptive = _ref2.adaptive,
        roundOffsets = _ref2.roundOffsets;

    var _ref3 = roundOffsets ? roundOffsetsByDPR(offsets) : offsets,
        _ref3$x = _ref3.x,
        x = _ref3$x === void 0 ? 0 : _ref3$x,
        _ref3$y = _ref3.y,
        y = _ref3$y === void 0 ? 0 : _ref3$y;

    var hasX = offsets.hasOwnProperty('x');
    var hasY = offsets.hasOwnProperty('y');
    var sideX = left;
    var sideY = top;
    var win = window;

    if (adaptive) {
      var offsetParent = getOffsetParent(popper);

      if (offsetParent === getWindow(popper)) {
        offsetParent = getDocumentElement(popper);
      } // $FlowFixMe[incompatible-cast]: force type refinement, we compare offsetParent with window above, but Flow doesn't detect it

      /*:: offsetParent = (offsetParent: Element); */


      if (placement === top) {
        sideY = bottom;
        y -= offsetParent.clientHeight - popperRect.height;
        y *= gpuAcceleration ? 1 : -1;
      }

      if (placement === left) {
        sideX = right;
        x -= offsetParent.clientWidth - popperRect.width;
        x *= gpuAcceleration ? 1 : -1;
      }
    }

    var commonStyles = Object.assign({
      position: position
    }, adaptive && unsetSides);

    if (gpuAcceleration) {
      var _Object$assign;

      return Object.assign(Object.assign({}, commonStyles), {}, (_Object$assign = {}, _Object$assign[sideY] = hasY ? '0' : '', _Object$assign[sideX] = hasX ? '0' : '', _Object$assign.transform = (win.devicePixelRatio || 1) < 2 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
    }

    return Object.assign(Object.assign({}, commonStyles), {}, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : '', _Object$assign2[sideX] = hasX ? x + "px" : '', _Object$assign2.transform = '', _Object$assign2));
  }

  function computeStyles(_ref4) {
    var state = _ref4.state,
        options = _ref4.options;
    var _options$gpuAccelerat = options.gpuAcceleration,
        gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat,
        _options$adaptive = options.adaptive,
        adaptive = _options$adaptive === void 0 ? true : _options$adaptive,
        _options$roundOffsets = options.roundOffsets,
        roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;

    var commonStyles = {
      placement: getBasePlacement(state.placement),
      popper: state.elements.popper,
      popperRect: state.rects.popper,
      gpuAcceleration: gpuAcceleration
    };

    if (state.modifiersData.popperOffsets != null) {
      state.styles.popper = Object.assign(Object.assign({}, state.styles.popper), mapToStyles(Object.assign(Object.assign({}, commonStyles), {}, {
        offsets: state.modifiersData.popperOffsets,
        position: state.options.strategy,
        adaptive: adaptive,
        roundOffsets: roundOffsets
      })));
    }

    if (state.modifiersData.arrow != null) {
      state.styles.arrow = Object.assign(Object.assign({}, state.styles.arrow), mapToStyles(Object.assign(Object.assign({}, commonStyles), {}, {
        offsets: state.modifiersData.arrow,
        position: 'absolute',
        adaptive: false,
        roundOffsets: roundOffsets
      })));
    }

    state.attributes.popper = Object.assign(Object.assign({}, state.attributes.popper), {}, {
      'data-popper-placement': state.placement
    });
  } // eslint-disable-next-line import/no-unused-modules


  var computeStyles$1 = {
    name: 'computeStyles',
    enabled: true,
    phase: 'beforeWrite',
    fn: computeStyles,
    data: {}
  };

  // and applies them to the HTMLElements such as popper and arrow

  function applyStyles(_ref) {
    var state = _ref.state;
    Object.keys(state.elements).forEach(function (name) {
      var style = state.styles[name] || {};
      var attributes = state.attributes[name] || {};
      var element = state.elements[name]; // arrow is optional + virtual elements

      if (!isHTMLElement(element) || !getNodeName(element)) {
        return;
      } // Flow doesn't support to extend this property, but it's the most
      // effective way to apply styles to an HTMLElement
      // $FlowFixMe[cannot-write]


      Object.assign(element.style, style);
      Object.keys(attributes).forEach(function (name) {
        var value = attributes[name];

        if (value === false) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value === true ? '' : value);
        }
      });
    });
  }

  function effect$1(_ref2) {
    var state = _ref2.state;
    var initialStyles = {
      popper: {
        position: state.options.strategy,
        left: '0',
        top: '0',
        margin: '0'
      },
      arrow: {
        position: 'absolute'
      },
      reference: {}
    };
    Object.assign(state.elements.popper.style, initialStyles.popper);

    if (state.elements.arrow) {
      Object.assign(state.elements.arrow.style, initialStyles.arrow);
    }

    return function () {
      Object.keys(state.elements).forEach(function (name) {
        var element = state.elements[name];
        var attributes = state.attributes[name] || {};
        var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]); // Set all values to an empty string to unset them

        var style = styleProperties.reduce(function (style, property) {
          style[property] = '';
          return style;
        }, {}); // arrow is optional + virtual elements

        if (!isHTMLElement(element) || !getNodeName(element)) {
          return;
        }

        Object.assign(element.style, style);
        Object.keys(attributes).forEach(function (attribute) {
          element.removeAttribute(attribute);
        });
      });
    };
  } // eslint-disable-next-line import/no-unused-modules


  var applyStyles$1 = {
    name: 'applyStyles',
    enabled: true,
    phase: 'write',
    fn: applyStyles,
    effect: effect$1,
    requires: ['computeStyles']
  };

  function distanceAndSkiddingToXY(placement, rects, offset) {
    var basePlacement = getBasePlacement(placement);
    var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;

    var _ref = typeof offset === 'function' ? offset(Object.assign(Object.assign({}, rects), {}, {
      placement: placement
    })) : offset,
        skidding = _ref[0],
        distance = _ref[1];

    skidding = skidding || 0;
    distance = (distance || 0) * invertDistance;
    return [left, right].indexOf(basePlacement) >= 0 ? {
      x: distance,
      y: skidding
    } : {
      x: skidding,
      y: distance
    };
  }

  function offset(_ref2) {
    var state = _ref2.state,
        options = _ref2.options,
        name = _ref2.name;
    var _options$offset = options.offset,
        offset = _options$offset === void 0 ? [0, 0] : _options$offset;
    var data = placements.reduce(function (acc, placement) {
      acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset);
      return acc;
    }, {});
    var _data$state$placement = data[state.placement],
        x = _data$state$placement.x,
        y = _data$state$placement.y;

    if (state.modifiersData.popperOffsets != null) {
      state.modifiersData.popperOffsets.x += x;
      state.modifiersData.popperOffsets.y += y;
    }

    state.modifiersData[name] = data;
  } // eslint-disable-next-line import/no-unused-modules


  var offset$1 = {
    name: 'offset',
    enabled: true,
    phase: 'main',
    requires: ['popperOffsets'],
    fn: offset
  };

  var hash = {
    left: 'right',
    right: 'left',
    bottom: 'top',
    top: 'bottom'
  };
  function getOppositePlacement(placement) {
    return placement.replace(/left|right|bottom|top/g, function (matched) {
      return hash[matched];
    });
  }

  var hash$1 = {
    start: 'end',
    end: 'start'
  };
  function getOppositeVariationPlacement(placement) {
    return placement.replace(/start|end/g, function (matched) {
      return hash$1[matched];
    });
  }

  /*:: type OverflowsMap = { [ComputedPlacement]: number }; */

  /*;; type OverflowsMap = { [key in ComputedPlacement]: number }; */
  function computeAutoPlacement(state, options) {
    if (options === void 0) {
      options = {};
    }

    var _options = options,
        placement = _options.placement,
        boundary = _options.boundary,
        rootBoundary = _options.rootBoundary,
        padding = _options.padding,
        flipVariations = _options.flipVariations,
        _options$allowedAutoP = _options.allowedAutoPlacements,
        allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
    var variation = getVariation(placement);
    var placements$1 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function (placement) {
      return getVariation(placement) === variation;
    }) : basePlacements;
    var allowedPlacements = placements$1.filter(function (placement) {
      return allowedAutoPlacements.indexOf(placement) >= 0;
    });

    if (allowedPlacements.length === 0) {
      allowedPlacements = placements$1;
    } // $FlowFixMe[incompatible-type]: Flow seems to have problems with two array unions...


    var overflows = allowedPlacements.reduce(function (acc, placement) {
      acc[placement] = detectOverflow(state, {
        placement: placement,
        boundary: boundary,
        rootBoundary: rootBoundary,
        padding: padding
      })[getBasePlacement(placement)];
      return acc;
    }, {});
    return Object.keys(overflows).sort(function (a, b) {
      return overflows[a] - overflows[b];
    });
  }

  function getExpandedFallbackPlacements(placement) {
    if (getBasePlacement(placement) === auto) {
      return [];
    }

    var oppositePlacement = getOppositePlacement(placement);
    return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
  }

  function flip(_ref) {
    var state = _ref.state,
        options = _ref.options,
        name = _ref.name;

    if (state.modifiersData[name]._skip) {
      return;
    }

    var _options$mainAxis = options.mainAxis,
        checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
        _options$altAxis = options.altAxis,
        checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis,
        specifiedFallbackPlacements = options.fallbackPlacements,
        padding = options.padding,
        boundary = options.boundary,
        rootBoundary = options.rootBoundary,
        altBoundary = options.altBoundary,
        _options$flipVariatio = options.flipVariations,
        flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio,
        allowedAutoPlacements = options.allowedAutoPlacements;
    var preferredPlacement = state.options.placement;
    var basePlacement = getBasePlacement(preferredPlacement);
    var isBasePlacement = basePlacement === preferredPlacement;
    var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
    var placements = [preferredPlacement].concat(fallbackPlacements).reduce(function (acc, placement) {
      return acc.concat(getBasePlacement(placement) === auto ? computeAutoPlacement(state, {
        placement: placement,
        boundary: boundary,
        rootBoundary: rootBoundary,
        padding: padding,
        flipVariations: flipVariations,
        allowedAutoPlacements: allowedAutoPlacements
      }) : placement);
    }, []);
    var referenceRect = state.rects.reference;
    var popperRect = state.rects.popper;
    var checksMap = new Map();
    var makeFallbackChecks = true;
    var firstFittingPlacement = placements[0];

    for (var i = 0; i < placements.length; i++) {
      var placement = placements[i];

      var _basePlacement = getBasePlacement(placement);

      var isStartVariation = getVariation(placement) === start;
      var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
      var len = isVertical ? 'width' : 'height';
      var overflow = detectOverflow(state, {
        placement: placement,
        boundary: boundary,
        rootBoundary: rootBoundary,
        altBoundary: altBoundary,
        padding: padding
      });
      var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;

      if (referenceRect[len] > popperRect[len]) {
        mainVariationSide = getOppositePlacement(mainVariationSide);
      }

      var altVariationSide = getOppositePlacement(mainVariationSide);
      var checks = [];

      if (checkMainAxis) {
        checks.push(overflow[_basePlacement] <= 0);
      }

      if (checkAltAxis) {
        checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
      }

      if (checks.every(function (check) {
        return check;
      })) {
        firstFittingPlacement = placement;
        makeFallbackChecks = false;
        break;
      }

      checksMap.set(placement, checks);
    }

    if (makeFallbackChecks) {
      // `2` may be desired in some cases – research later
      var numberOfChecks = flipVariations ? 3 : 1;

      var _loop = function _loop(_i) {
        var fittingPlacement = placements.find(function (placement) {
          var checks = checksMap.get(placement);

          if (checks) {
            return checks.slice(0, _i).every(function (check) {
              return check;
            });
          }
        });

        if (fittingPlacement) {
          firstFittingPlacement = fittingPlacement;
          return "break";
        }
      };

      for (var _i = numberOfChecks; _i > 0; _i--) {
        var _ret = _loop(_i);

        if (_ret === "break") break;
      }
    }

    if (state.placement !== firstFittingPlacement) {
      state.modifiersData[name]._skip = true;
      state.placement = firstFittingPlacement;
      state.reset = true;
    }
  } // eslint-disable-next-line import/no-unused-modules


  var flip$1 = {
    name: 'flip',
    enabled: true,
    phase: 'main',
    fn: flip,
    requiresIfExists: ['offset'],
    data: {
      _skip: false
    }
  };

  function getAltAxis(axis) {
    return axis === 'x' ? 'y' : 'x';
  }

  function within(min, value, max) {
    return Math.max(min, Math.min(value, max));
  }

  function preventOverflow(_ref) {
    var state = _ref.state,
        options = _ref.options,
        name = _ref.name;
    var _options$mainAxis = options.mainAxis,
        checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
        _options$altAxis = options.altAxis,
        checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis,
        boundary = options.boundary,
        rootBoundary = options.rootBoundary,
        altBoundary = options.altBoundary,
        padding = options.padding,
        _options$tether = options.tether,
        tether = _options$tether === void 0 ? true : _options$tether,
        _options$tetherOffset = options.tetherOffset,
        tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
    var overflow = detectOverflow(state, {
      boundary: boundary,
      rootBoundary: rootBoundary,
      padding: padding,
      altBoundary: altBoundary
    });
    var basePlacement = getBasePlacement(state.placement);
    var variation = getVariation(state.placement);
    var isBasePlacement = !variation;
    var mainAxis = getMainAxisFromPlacement(basePlacement);
    var altAxis = getAltAxis(mainAxis);
    var popperOffsets = state.modifiersData.popperOffsets;
    var referenceRect = state.rects.reference;
    var popperRect = state.rects.popper;
    var tetherOffsetValue = typeof tetherOffset === 'function' ? tetherOffset(Object.assign(Object.assign({}, state.rects), {}, {
      placement: state.placement
    })) : tetherOffset;
    var data = {
      x: 0,
      y: 0
    };

    if (!popperOffsets) {
      return;
    }

    if (checkMainAxis) {
      var mainSide = mainAxis === 'y' ? top : left;
      var altSide = mainAxis === 'y' ? bottom : right;
      var len = mainAxis === 'y' ? 'height' : 'width';
      var offset = popperOffsets[mainAxis];
      var min = popperOffsets[mainAxis] + overflow[mainSide];
      var max = popperOffsets[mainAxis] - overflow[altSide];
      var additive = tether ? -popperRect[len] / 2 : 0;
      var minLen = variation === start ? referenceRect[len] : popperRect[len];
      var maxLen = variation === start ? -popperRect[len] : -referenceRect[len]; // We need to include the arrow in the calculation so the arrow doesn't go
      // outside the reference bounds

      var arrowElement = state.elements.arrow;
      var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
        width: 0,
        height: 0
      };
      var arrowPaddingObject = state.modifiersData['arrow#persistent'] ? state.modifiersData['arrow#persistent'].padding : getFreshSideObject();
      var arrowPaddingMin = arrowPaddingObject[mainSide];
      var arrowPaddingMax = arrowPaddingObject[altSide]; // If the reference length is smaller than the arrow length, we don't want
      // to include its full size in the calculation. If the reference is small
      // and near the edge of a boundary, the popper can overflow even if the
      // reference is not overflowing as well (e.g. virtual elements with no
      // width or height)

      var arrowLen = within(0, referenceRect[len], arrowRect[len]);
      var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - tetherOffsetValue : minLen - arrowLen - arrowPaddingMin - tetherOffsetValue;
      var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + tetherOffsetValue : maxLen + arrowLen + arrowPaddingMax + tetherOffsetValue;
      var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
      var clientOffset = arrowOffsetParent ? mainAxis === 'y' ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
      var offsetModifierValue = state.modifiersData.offset ? state.modifiersData.offset[state.placement][mainAxis] : 0;
      var tetherMin = popperOffsets[mainAxis] + minOffset - offsetModifierValue - clientOffset;
      var tetherMax = popperOffsets[mainAxis] + maxOffset - offsetModifierValue;
      var preventedOffset = within(tether ? Math.min(min, tetherMin) : min, offset, tether ? Math.max(max, tetherMax) : max);
      popperOffsets[mainAxis] = preventedOffset;
      data[mainAxis] = preventedOffset - offset;
    }

    if (checkAltAxis) {
      var _mainSide = mainAxis === 'x' ? top : left;

      var _altSide = mainAxis === 'x' ? bottom : right;

      var _offset = popperOffsets[altAxis];

      var _min = _offset + overflow[_mainSide];

      var _max = _offset - overflow[_altSide];

      var _preventedOffset = within(_min, _offset, _max);

      popperOffsets[altAxis] = _preventedOffset;
      data[altAxis] = _preventedOffset - _offset;
    }

    state.modifiersData[name] = data;
  } // eslint-disable-next-line import/no-unused-modules


  var preventOverflow$1 = {
    name: 'preventOverflow',
    enabled: true,
    phase: 'main',
    fn: preventOverflow,
    requiresIfExists: ['offset']
  };

  function arrow(_ref) {
    var _state$modifiersData$;

    var state = _ref.state,
        name = _ref.name;
    var arrowElement = state.elements.arrow;
    var popperOffsets = state.modifiersData.popperOffsets;
    var basePlacement = getBasePlacement(state.placement);
    var axis = getMainAxisFromPlacement(basePlacement);
    var isVertical = [left, right].indexOf(basePlacement) >= 0;
    var len = isVertical ? 'height' : 'width';

    if (!arrowElement || !popperOffsets) {
      return;
    }

    var paddingObject = state.modifiersData[name + "#persistent"].padding;
    var arrowRect = getLayoutRect(arrowElement);
    var minProp = axis === 'y' ? top : left;
    var maxProp = axis === 'y' ? bottom : right;
    var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets[axis] - state.rects.popper[len];
    var startDiff = popperOffsets[axis] - state.rects.reference[axis];
    var arrowOffsetParent = getOffsetParent(arrowElement);
    var clientSize = arrowOffsetParent ? axis === 'y' ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
    var centerToReference = endDiff / 2 - startDiff / 2; // Make sure the arrow doesn't overflow the popper if the center point is
    // outside of the popper bounds

    var min = paddingObject[minProp];
    var max = clientSize - arrowRect[len] - paddingObject[maxProp];
    var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
    var offset = within(min, center, max); // Prevents breaking syntax highlighting...

    var axisProp = axis;
    state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset, _state$modifiersData$.centerOffset = offset - center, _state$modifiersData$);
  }

  function effect$2(_ref2) {
    var state = _ref2.state,
        options = _ref2.options,
        name = _ref2.name;
    var _options$element = options.element,
        arrowElement = _options$element === void 0 ? '[data-popper-arrow]' : _options$element,
        _options$padding = options.padding,
        padding = _options$padding === void 0 ? 0 : _options$padding;

    if (arrowElement == null) {
      return;
    } // CSS selector


    if (typeof arrowElement === 'string') {
      arrowElement = state.elements.popper.querySelector(arrowElement);

      if (!arrowElement) {
        return;
      }
    }

    if (!contains(state.elements.popper, arrowElement)) {

      return;
    }

    state.elements.arrow = arrowElement;
    state.modifiersData[name + "#persistent"] = {
      padding: mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements))
    };
  } // eslint-disable-next-line import/no-unused-modules


  var arrow$1 = {
    name: 'arrow',
    enabled: true,
    phase: 'main',
    fn: arrow,
    effect: effect$2,
    requires: ['popperOffsets'],
    requiresIfExists: ['preventOverflow']
  };

  function getSideOffsets(overflow, rect, preventedOffsets) {
    if (preventedOffsets === void 0) {
      preventedOffsets = {
        x: 0,
        y: 0
      };
    }

    return {
      top: overflow.top - rect.height - preventedOffsets.y,
      right: overflow.right - rect.width + preventedOffsets.x,
      bottom: overflow.bottom - rect.height + preventedOffsets.y,
      left: overflow.left - rect.width - preventedOffsets.x
    };
  }

  function isAnySideFullyClipped(overflow) {
    return [top, right, bottom, left].some(function (side) {
      return overflow[side] >= 0;
    });
  }

  function hide(_ref) {
    var state = _ref.state,
        name = _ref.name;
    var referenceRect = state.rects.reference;
    var popperRect = state.rects.popper;
    var preventedOffsets = state.modifiersData.preventOverflow;
    var referenceOverflow = detectOverflow(state, {
      elementContext: 'reference'
    });
    var popperAltOverflow = detectOverflow(state, {
      altBoundary: true
    });
    var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
    var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
    var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
    var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
    state.modifiersData[name] = {
      referenceClippingOffsets: referenceClippingOffsets,
      popperEscapeOffsets: popperEscapeOffsets,
      isReferenceHidden: isReferenceHidden,
      hasPopperEscaped: hasPopperEscaped
    };
    state.attributes.popper = Object.assign(Object.assign({}, state.attributes.popper), {}, {
      'data-popper-reference-hidden': isReferenceHidden,
      'data-popper-escaped': hasPopperEscaped
    });
  } // eslint-disable-next-line import/no-unused-modules


  var hide$1 = {
    name: 'hide',
    enabled: true,
    phase: 'main',
    requiresIfExists: ['preventOverflow'],
    fn: hide
  };

  var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1, offset$1, flip$1, preventOverflow$1, arrow$1, hide$1];
  var createPopper = /*#__PURE__*/popperGenerator({
    defaultModifiers: defaultModifiers
  }); // eslint-disable-next-line import/no-unused-modules

  // adapted from poppers.js tutorial https://popper.js.org/docs/v2/tutorial/

  const showEvents = ["mouseenter", "focus"];
  const hideEvents = ["mouseleave", "blur"];

  let popperInstance = null;

  /**
   * @param {Element} icon
   * @param {Element} popup
   */
  function create(icon, popup) {
    popperInstance = createPopper(icon, popup, {
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [0, 8],
          },
        },
      ],
    });
  }

  function destroy() {
    if (popperInstance) {
      popperInstance.destroy();
      popperInstance = null;
    }
  }

  /**
   * prepare the popup and the icon. Attach relevant handlers
   *
   * @param icon {Element}: icon that triggers the popup on hover/click/focus
   * @param popup {Element}: the popup that shows up
   */
  function createTooltip(icon, popup) {
    for (let event of showEvents) {
      icon.addEventListener(event, () => {
        popup.setAttribute("data-show", "");
        create(icon, popup);
      });
    }

    for (let event of hideEvents) {
      icon.addEventListener(event, () => {
        popup.removeAttribute("data-show");
        destroy();
      });
    }
  }

  /*!
   * Copyright (c) 2020 Eddie Antonio Santos
   *
   * This Source Code Form is subject to the terms of the Mozilla Public License,
   * v. 2.0. If a copy of the MPL was not distributed with this file, You can
   * obtain one at http://mozilla.org/MPL/2.0/.
   */

  /**
   * Simplifies interaction with <template> tags.
   *
   * Usage:
   *
   * In the HTML, create a <template> with <slot> elements. Give it an ID:
   *
   *     <template id="template:hello">
   *       <h1> <slot name="salutation">Hello</slot>, <slot name="recipient">World</slot>!</h1>
   *     </template>
   *
   * Once the <template> is in the DOM, instantiate a SimpleTemplate from its ID:
   *
   *       let greeting = SimpleTemplate.fromId('template:hello')
   *
   * Change the text of <slot name="salutation">:
   *
   *       greeting.slot.salutation = 'Goodbye'
   *
   * Change the text of <slot name="recipient">:
   *
   *       greeting.slot.recipient = 'cruel world'
   *
   * Now, insert the template into the DOM:
   *
   *       document.body.appendChild(greeting.element)
   *
   * This will result with the following inserted into the page:
   *
   * <body>
   *    <h1> <slot name="salutation">Goodbye</slot>, <slot name="recipient">cruel world</slot>!</h1>
   * </body>
   */
  class SimpleTemplate {
    constructor(element) {
      /**
       * @property {Element} a clone of the template
       */
      this.element = element.content.firstElementChild.cloneNode(true);
      /**
       * @property {object} Dynamic object generated from <slot name> elements.
       */
      this.slot = {};

      // Create getters and setters for each slot
      for (let slot of this.element.querySelectorAll("slot[name]")) {
        createGettersAndSetters(this.slot, slot);
      }
    }

    /**
     * Create a new simple template given the id="" of an existing <template>
     * tag.
     *
     * @returns {SimpleTemplate} a brand new SimpleTemplate
     */
    static fromId(id) {
      let element = document.getElementById(id);
      if (element == null)
        throw new Error(`Could not find element with id="${id}"`);
      return new SimpleTemplate(element);
    }
  }

  function createGettersAndSetters(obj, slot) {
    return Object.defineProperty(obj, slot.name, {
      get: () => slot.innerText,
      set: (newValue) => (slot.innerText = newValue),
      enumerable: true,
    });
  }

  // the specific URL for a given wordform (refactored from previous commits).
  // TODO: should come from config.
  const BASE_URL = "https://speech-db.altlab.app";
  const BULK_API_URL = `${BASE_URL}/api/bulk_search`;

  /**
   * Fetches the recording URL for one wordform.
   *
   * @param {string} a wordform. The spelling must match *exactly* with the
   *                 speech-db's transcription.
   * @return {string?} the recording URL, if it exists, else undefined.
   */
  async function fetchFirstRecordingURL(wordform) {
    let response = await fetchRecordingUsingBulkSearch([wordform]);
    return mapWordformsToBestRecordingURL(response).get(wordform);
  }

  /**
   * Fetches recordings URLs for each wordform given.
   *
   * @param {Iterable<str>} iterable of wordforms to search
   * @return {Map<str, str>} maps wordforms to a valid recording URL.
   */
  async function fetchRecordingURLForEachWordform(requestedWordforms) {
    let response = await fetchRecordingUsingBulkSearch(requestedWordforms);
    return mapWordformsToBestRecordingURL(response);
  }

  /**
   * Render a list of speakers (in the form of a select) for the user to
   * interact with and hear the wordform pronounced in different ways.
   */
  async function retrieveListOfSpeakers() {
    // There SHOULD be a <data id="data:head" value="..."> element on the page
    // that will tell us the current wordform: get it!
    let wordform = document.getElementById("data:head").value;

    // select for our elements for playback and link-generation
    let recordingsDropdown = document.querySelector(
      ".multiple-recordings select"
    );
    let recordingsPlayback = document.querySelector(
      '[data-action="play-current-recording"]'
    );
    let recordingsLink = document.querySelector(
      '[data-action="learn-about-speaker"]'
    );

    // Get all recordings for this wordform
    let response = await fetchRecordingUsingBulkSearch([wordform]);

    displaySpeakerList(
      response["matched_recordings"].filter(
        (result) => result.wordform === wordform
      )
    );
    showRecordingsExplainerText();

    ////////////////////////////////// helpers /////////////////////////////////

    // the function that displays an individual speaker's name
    function displaySpeakerList(recordings) {
      for (let recordingData of recordings) {
        // using a template, place the speaker's name and dialect into the dropdown
        let individualSpeaker = SimpleTemplate.fromId("template:speakerList");
        individualSpeaker.slot.speakerName = recordingData.speaker_name;
        individualSpeaker.slot.speakerDialect = recordingData.dialect;
        recordingsDropdown.appendChild(individualSpeaker.element);
      }

      // audio playback for the specific speaker
      recordingsPlayback.addEventListener("click", () => {
        let speakerPosition = recordingsDropdown.selectedIndex;
        let audioURL = recordings[speakerPosition].recording_url;

        // play the audio associated with that specific index
        let audio = new Audio(audioURL);
        audio.play();
      });

      // link for the specific speaker
      recordingsLink.addEventListener("click", () => {
        let speakerPosition = recordingsDropdown.selectedIndex;
        let speakerBioLink = recordings[speakerPosition].speaker_bio_url;

        // change the URL of the selected speaker
        recordingsLink.href = speakerBioLink;
      });
    }
  }

  function showRecordingsExplainerText() {
    let recordingsHeading = document.querySelector(
      ".definition__recordings--not-loaded"
    );
    if (!recordingsHeading) {
      return;
    }

    recordingsHeading.classList.remove("definition__recordings--not-loaded");
  }

  /**
   * Uses speech-db's bulk API to search for recordsings.
   *
   * @param {Iterable<str>}  one or more wordforms to search for.
   * @return {BulkSearchResponse} see API documentation: TODO
   */
  async function fetchRecordingUsingBulkSearch(requestedWordforms) {
    // Construct the query parameters: ?q=word&q=word2&q=word3&q=...
    let searchParams = new URLSearchParams();
    for (let wordform of requestedWordforms) {
      searchParams.append("q", wordform);
    }
    let url = new URL(BULK_API_URL);
    url.search = searchParams;

    let response = await fetch(url);
    if (!response.ok) {
      throw new Error("Could not fetch recordings");
    }

    return response.json();
  }

  /**
   * Given a BulkSearchResponse, returns a Map of wordforms to exactly one
   * recording URL.
   *
   * @param {BulkSearchResponse} the entire response returned from the bulk
   *                             search API.
   */
  function mapWordformsToBestRecordingURL(response) {
    let wordform2recordingURL = new Map();

    for (let result of response["matched_recordings"]) {
      let wordform = result["wordform"];

      if (!wordform2recordingURL.has(wordform)) {
        // Assume the first result returned is the best recording:
        wordform2recordingURL.set(wordform, result["recording_url"]);
      }
    }

    return wordform2recordingURL;
  }

  /**
   * @file
   * Orthography switching.
   */

  const AVAILABLE_ORTHOGRAPHIES = new Set(["Cans", "Latn", "Latn-x-macron"]);

  /**
   * This **must** be set in order to update the orthography cookie on the
   * server-side.
   */
  let djangoCSRFToken = null;

  /**
   * Listen to ALL clicks on the page, and change orthography for elements that
   * have the data-orth-switch.
   */
  function registerEventListener(csrfToken) {
    // Try to handle a click on ANYTHING.
    // This way, if new elements appear on the page dynamically, we never
    // need to register new event listeners: this one will work for all of them.
    document.body.addEventListener("click", handleClickSwitchOrthography);
    djangoCSRFToken = csrfToken;
  }

  /**
   * Changes the orthography of EVERYTHING on the page.
   */
  function changeOrth(which) {
    if (!AVAILABLE_ORTHOGRAPHIES.has(which)) {
      throw new Error(`tried to switch to unknown orthography: ${which}`);
    }

    let elements = document.querySelectorAll("[data-orth]");
    let attr = `data-orth-${which}`;
    for (let el of elements) {
      let newText = el.getAttribute(attr);
      if (newText) {
        el.innerText = newText;
      }
    }
  }

  /**
   * Switches orthography and updates the UI.
   */
  function handleClickSwitchOrthography(evt) {
    let target = findClosestOrthographySwitch(evt.target);
    // Determine that this is a orthography changing button.
    if (!target) {
      return;
    }

    // target is a <button data-orth-swith="ORTHOGRAPHY">
    let orth = target.value;
    changeOrth(orth);
    updateUI(target);
    updateCookies(orth);
  }

  function findClosestOrthographySwitch(el) {
    return el.closest("[data-orth-switch]");
  }

  /**
   * Updates the UI following an orthography switch.
   * Assumes the following HTML:
   *
   *  <details>
   *    <summary>CURRENT ORTHOGRAPHY</summary>
   *    <ul>
   *      <li class="menu-choice menu-choice--selected">
   *        <button data-orth-switch value="ORTH">CURRENT ORTHOGRAPHY</button>
   *      </li>
   *      <li class="menu-choice">
   *        <button data-orth-switch value="ORTH">DIFFERENT ORTHOGRAPHY</button>
   *      </li>
   *    </ul>
   *  </details>
   */
  function updateUI(button) {
    // Climb up the DOM tree to find the <details> and its <summary> that contains the title.
    let detailsElement = button.closest("details");
    if (!detailsElement) {
      // there absolutely should be a <de
      throw new Error("Could not find relevant <details> element!");
    }

    closeMenu();

    // Clear the selected class from all options
    for (let el of detailsElement.querySelectorAll("[data-orth-switch]")) {
      let li = el.closest(".menu-choice");
      li.classList.remove("menu-choice--selected");
    }
    button.closest(".menu-choice").classList.add("menu-choice--selected");

    function closeMenu() {
      detailsElement.open = false;
    }
  }

  /**
   * Sends a request to the server to update the orthography cookie.
   * This ensures future requests will be sent with the current orthography.
   */
  function updateCookies(orth) {
    if (djangoCSRFToken == null) {
      throw new Error("djangoCSRFToken is unset!");
    }

    let changeOrthURL = window.Urls["morphodict:change-orthography"]();
    fetch(changeOrthURL, {
      method: "POST",
      body: new URLSearchParams({
        orth: orth,
      }),
      headers: new Headers({
        "X-CSRFToken": djangoCSRFToken,
      }),
    });
  }

  /**
   * A few utilites for manipulating DOM Element and Node instances.
   *
   * Intended to replace jQuery.
   *
   * See: http://youmightnotneedjquery.com/
   */

  /**
   * Removes all children of an element.
   *
   * @param {Element} element
   */
  function emptyElement(element) {
    // Uses the fastest method tested here:
    // https://jsperf.com/innerhtml-vs-removechild/15
    while (element.lastChild) {
      element.removeChild(element.lastChild);
    }
  }

  /**
   * Removes this element from the DOM
   *
   * @param {(Element|null)} element
   */
  function removeElement(element) {
    if (!element) return;

    let parent = element.parentNode;
    parent.removeChild(element);
  }

  /**
   * Restores the elements display value to its default, effectively showing it
   * if it was hidden with hideElement().
   *
   * @param {(Element|null)} element
   */
  function showElement(element) {
    if (!element) return;

    element.style.display = "";
  }

  /**
   * Sets the element to display: none.
   *
   * @param {(Element|null)} element
   */
  function hideElement(element) {
    if (!element) return;

    element.style.display = "none";
  }

  /**
   * Manipulate the progress bar.
   */

  const ERROR_CLASS = "search-progress--error";
  const LOADING_CLASS = "search-progress--loading";

  /**
   * Make a 10% progress bar. We actually don't know how much there is left,
   * but make it seem like it's thinking about it!
   */
  function indicateLoading() {
    let progress = document.getElementById("loading-indicator");
    progress.max = 100;
    progress.value = 10;
    progress.classList.remove(ERROR_CLASS);
    progress.classList.add(LOADING_CLASS);
  }

  function indicateLoadedSuccessfully() {
    let progress = document.getElementById("loading-indicator");
    progress.value = 100;
    hideLoadingIndicator();
  }

  function indicateLoadingFailure() {
    // makes the loading state "indeterminate", like it's loading forever.
    let progress = document.getElementById("loading-indicator");
    progress.removeAttribute("value");
    progress.classList.add(ERROR_CLASS);
  }

  function hideLoadingIndicator() {
    let progress = document.getElementById("loading-indicator");
    progress.classList.remove(LOADING_CLASS, ERROR_CLASS);
  }

  /**
   * A debounce function. Documentation: https://davidwalsh.name/javascript-debounce-function
   * @param  {Function} func      The function to debounce
   * @param  {Number}   wait      The time to wait, in milliseconds
   * @param  {Boolean}  immediate Whether to invoke the function immediately
   * @return {Function}
   */
  function debounce$1(func, wait, immediate) {
    let timeout;

    return function debounced(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };

      const callNow = immediate && !timeout;

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);

      if (callNow) func.apply(this, args);
    };
  }

  /**
   * Set up any page that has the #paradigm element with its size controls.
   */
  function setupParadigm() {
    setupParadigmSizeToggleButton(null);
  }

  let paradigmSizes;

  /**
   * attach handlers to the "show more/less" button. So that it:
   *
   *  - loads a more detailed paradigm when clicked or do nothing and report to console if the request for the paradigm errors
   *  - changes its text to "show less" when the paradigm has the largest size
   *    and shows the smallest paradigm when clicked
   *  - prepare the new "show more/less" button to do these 3
   */
  function setupParadigmSizeToggleButton(currentParadigmSize) {
    const toggleButton = document.querySelector(".js-paradigm-size-button");

    if (!toggleButton) {
      // There's nothing to toggle, hence nothing to setup. Done!
      return;
    }

    // `lemmaId` should be embedded by Django into the template.
    // It's present when the current page is lemma detail/paradigm page
    const lemmaId = readDjangoJsonScript("lemma-id");
    // `paradigmSize` is also rendered by a Django template
    // And it can changed dynamically by JavaScript when the script loads different sized paradigms
    let paradigmSize =
      currentParadigmSize || readDjangoJsonScript("paradigm-size");
    paradigmSizes = readDjangoJsonScript("paradigm-sizes") || [];

    if (paradigmSizes.length <= 1) {
      toggleButton.remove();
      return;
    }

    const nextParadigmSize = getNextParadigmSize(paradigmSize);

    toggleButton.addEventListener("click", () => {
      displayButtonAsLoading(toggleButton);

      fetch(
        window.Urls["cree-dictionary-paradigm-detail"]() +
          `?lemma-id=${lemmaId}&paradigm-size=${nextParadigmSize}`
      )
        .then((r) => {
          if (r.ok) {
            return r.text();
          } else {
            // TODO: show error on the loading component
            throw new Error(
              `${r.status} ${r.statusText} when loading paradigm: ${r.text()}`
            );
          }
        })
        .then((text) => {
          const newParadigm = document
            .createRange()
            .createContextualFragment(text);

          // TODO: the backend should SOLELY maintain this:
          if (mostDetailedParadigmSizeIsSelected()) {
            setParadigmSizeToggleButtonText("-", "show less");
          } else {
            setParadigmSizeToggleButtonText("+", "show more");
          }

          const paradigmContainer = document.getElementById("paradigm");
          paradigmContainer
            .querySelector(".js-replaceable-paradigm")
            .replaceWith(newParadigm);

          paradigmSize = nextParadigmSize;
          setupParadigmSizeToggleButton(paradigmSize);
          updateCurrentURLWithParadigmSize();

          function setParadigmSizeToggleButtonText(symbol, text) {
            newParadigm.querySelector(".js-button-text").textContent = text;
            newParadigm.querySelector(".js-plus-minus").textContent = symbol;
          }
        })
        .catch((err) => {
          displayButtonAsError(toggleButton);
          console.error(err);
        });
    });

    function mostDetailedParadigmSizeIsSelected() {
      return paradigmSizes.indexOf(nextParadigmSize) === paradigmSizes.length - 1;
    }

    function updateCurrentURLWithParadigmSize() {
      window.history.replaceState(
        {},
        document.title,
        updateQueryParam("paradigm-size", nextParadigmSize)
      );
    }
  }

  /**
   * Make the button look like it's loading.
   */
  function displayButtonAsLoading(toggleButton) {
    toggleButton.classList.add("paradigm__size-toggle-button--loading");
  }

  /**
   * Make the button look like something went wrong.
   */
  function displayButtonAsError(toggleButton) {
    toggleButton.classList.remove("paradigm__size-toggle-button--loading");
    // TODO: should have an error state for the toggle button!
  }

  /**
   * cycles between BASIC, FULL, LINGUISTIC
   *
   * @param {String} size
   * @return {String}
   */
  function getNextParadigmSize(sizeName) {
    const index = paradigmSizes.indexOf(sizeName);
    if (index >= 0) {
      return paradigmSizes[(index + 1) % paradigmSizes.length];
    }
    // Use default.
    return paradigmSizes[0];
  }

  ///////////////////////////// Internal functions /////////////////////////////

  /**
   * Read JSOn data produced by Django's `json_script` filter during HTML template generation
   */
  function readDjangoJsonScript(id) {
    const jsonScriptElement = document.getElementById(id);
    if (jsonScriptElement) {
      return JSON.parse(jsonScriptElement.textContent);
    } else {
      return undefined;
    }
  }

  /**
   * Update the current query parameters.
   * Derived from: https://stackoverflow.com/a/41542008/6626414
   */
  function updateQueryParam(key, value) {
    let search = new URLSearchParams(window.location.search);
    search.set(key, value);

    let url = new URL(window.location.href);
    url.search = search.toString();

    return url.href;
  }

  /**
   * How long the toast should stay on the screen by default.
   */
  const TOAST_DURATION = 3000;

  let _toast = null;

  /**
   * Initialize the global toast element.
   *
   * @param {HTMLDialogElement} element
   */
  function setGlobalElement(el) {
    _toast = new Toast(el);
  }

  /**
   * Show a message that something succeeded.
   */
  function showSuccess(message) {
    return globalToastOrThrow().showSuccess(message);
  }

  /**
   * Show a message that something failed.
   */
  function showFailure(message) {
    return globalToastOrThrow().showFailure(message);
  }

  const ALL_EXPECTED_MODIFIERS = ["toast--success", "toast--failure"];

  /**
   * Toast component.
   *
   * A toast is a small, minimally intrusive notifcation.
   *
   * See: https://cultureamp.design/components/toast-notification/
   *
   * (At what point do you consider using a frontend UI framework? :S)
   */
  class Toast {
    constructor(element) {
      /* == null matches **both** null and undefined. */
      if (element == null) {
        throw new TypeError("must provide a valid <dialog> element");
      }

      this._el = element;
      this._timer = null;

      this._closeDialog();
      this._classList.add("toast--off-screen");
      /* Makes screen readers speak the message, only after they're done
       * speaking what they are currently reading: */
      this._el.setAttribute("aria-live", "polite");
    }

    /**
     * Show a message that something succeeded.
     */
    showSuccess(message) {
      this._setMessage(message);
      this._setCSSModifier("toast--success");
      this._show();
    }

    /**
     * Show a message that something failed.
     */
    showFailure(message) {
      this._setMessage(message);
      this._setCSSModifier("toast--failure");
      this._show();
    }

    get _classList() {
      return this._el.classList;
    }

    get _textNode() {
      return this._el.querySelector(".toast__message");
    }

    _setMessage(message) {
      this._textNode.textContent = message;
    }

    _clearMessage() {
      this._textNode.textContent = "";
    }

    _setCSSModifier(modifier) {
      this._classList.remove(...ALL_EXPECTED_MODIFIERS);
      this._classList.add(modifier);
    }

    _show() {
      if (this._timer !== null) {
        clearTimeout(this._timer);
      }

      this._timer = setTimeout(() => void this._hide(), TOAST_DURATION);
      this._showDialog();
      this._classList.remove("toast--off-screen");
    }

    _hide() {
      this._classList.add("toast--off-screen");
      this._timer = null;

      const closeDialog = () => {
        this._closeDialog();
        this._clearMessage();
      };

      /* Wait until the CSS animation is finished to actually close the dialog. */
      this._el.addEventListener("transitionend", closeDialog, { once: true });
    }

    _showDialog() {
      if (isHTMLDialogElement(this._el)) {
        this._el.show();
      } else {
        this._el.setAttribute("open", "");
      }
    }

    _closeDialog() {
      if (isHTMLDialogElement(this._el)) {
        this._el.close();
      } else {
        this._el.removeAttribute("open");
      }
    }
  }

  function globalToastOrThrow() {
    if (_toast === null) {
      throw new Error(
        "The toast has not been configured! Did you call toast.setGlobalElement()?"
      );
    }
    return _toast;
  }

  function isHTMLDialogElement(el) {
    if ("HTMLDialogElement" in window) {
      return el instanceof HTMLDialogElement;
    }

    // This browser does not support the <dialog> element API
    return false;
  }

  /**
   * Sets up all <form data-save-preference> elements on the page to be submitted upon
   * change. This means there is no need for a submit <button> in the form as
   * changes are persisted when they're made.
   *
   * Assumes at least the HTML that looks like this:
   *
   * <form data-save-preference action="url/to/valid/action" method="POST">
   *  <input name="setting" value="value1">
   *  <input name="setting" value="value2">
   *  <input name="setting" value="value3">
   * </form>
   *
   * A <button type="submit"> is removed from the form, if it exists.
   */
  function setupAutoSubmitForEntirePage() {
    let forms = document.querySelectorAll("form[data-save-preference]");
    for (const form of forms) {
      setupFormAutoSubmit(form);
    }
  }

  /**
   * Enables save preference on change.
   *
   * @param {HTMLFormElement} the form that has all of the information.
   */
  function setupFormAutoSubmit(form) {
    const endpoint = form.action;
    const submitButton = form.querySelector("button[type=submit]");

    form.addEventListener("change", async () => {
      try {
        await changePreference();
      } catch {
        showFailure("😕  Could not save preference");
        return;
      }

      showSuccess("✅ Saved!");
    });

    if (submitButton) {
      submitButton.remove();
    }

    /////////////////////////////// Utilities ////////////////////////////////

    async function changePreference() {
      let response = await fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
      });

      return response.ok ? Promise.resolve() : Promise.reject();
    }
  }

  // "Urls" is a magic variable that allows use to reverse urls in javascript

  ///////////////////////////////// Constants //////////////////////////////////

  const NO_BREAK_SPACE = "\u00A0";

  /**
   * Milliseconds, we only send search requests after this long of time of inactivity has passed.
   * Prevents too many invalid requests from being sent during typing
   *
   * Check the brief blog post to read a study about people's typing speed:
   * https://madoshakalaka.github.io/2020/08/31/how-hard-should-you-debounce-on-a-responsive-search-bar.html
   * @type {number}
   */
  const SERACH_BAR_DEBOUNCE_TIME = 450;

  //////////////////////////////// On page load ////////////////////////////////

  document.addEventListener("DOMContentLoaded", () => {
    let csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    registerEventListener(csrfToken);

    setupSearchBar();
    setupAutoSubmitForEntirePage();
    setGlobalElement(document.getElementById("toast"));

    let route = makeRouteRelativeToSlash(window.location.pathname);
    // Tiny router.
    if (route === "/") {
      // Homepage
      setSubtitle(null);
    } else if (route === "/about") {
      // About page
      setSubtitle("About");
    } else if (route === "/contact-us") {
      // Contact page
      setSubtitle("Contact us");
    } else if (route === "/search") {
      // Search page
      prepareSearchResults(getSearchResultList());
    } else if (route.match(/^[/]word[/].+/)) {
      // Word detail/paradigm page. This one has the 🔊 button.
      setSubtitle(getEntryHead());
      setupAudioOnPageLoad();
      setupParadigm();
      prepareTooltips();
    }
  });

  function setupSearchBar() {
    const searchBar = document.getElementById("search");
    const debouncedLoadSearchResults = debounce$1(() => {
      loadSearchResults(searchBar);
    }, SERACH_BAR_DEBOUNCE_TIME);

    searchBar.addEventListener("input", () => {
      indicateLoading();
      debouncedLoadSearchResults();
    });
  }

  /**
   * clean paradigm details
   */
  function cleanDetails() {
    removeElement(document.getElementById("definition"));
  }

  function showProse() {
    showElement(document.getElementById("prose"));
  }

  function hideProse() {
    hideElement(document.getElementById("prose"));
  }

  /**
   * Prepares interactive elements of each search result, including:
   *  - tooltips
   *  - recordings
   *
   * @param {Element} searchResultsList
   */
  function prepareSearchResults(searchResultsList) {
    prepareTooltips();
    loadRecordingsForAllSearchResults(searchResultsList);
  }

  /**
   * Given a list of search results, this will attempt to match a recording to
   * its match wordform.
   *
   * @param {Element} searchResultsList
   */
  async function loadRecordingsForAllSearchResults(searchResultsList) {
    let elementWithWordform = [];
    let requestedWordforms = new Set();

    for (let element of searchResultsList.querySelectorAll("[data-wordform]")) {
      let wordform = element.dataset.wordform;
      elementWithWordform.push([element, wordform]);
      requestedWordforms.add(wordform);
    }

    let wordform2recordingURL;
    try {
      wordform2recordingURL = await fetchRecordingURLForEachWordform(
        requestedWordforms
      );
    } catch {
      // fail silently ¯\_(ツ)_/¯
      return;
    }

    for (let [element, wordform] of elementWithWordform) {
      let recordingURL = wordform2recordingURL.get(wordform);
      if (recordingURL) {
        createAudioButton(recordingURL, element);
      }
    }
  }

  /**
   * Attach relevant handlers to **ALL** tooltip icons on the page.
   */
  function prepareTooltips() {
    let tooltips = document.querySelectorAll("[data-has-tooltip]");

    for (let icon of tooltips) {
      let tooltip = icon.nextElementSibling;
      if (!tooltip.classList.contains("tooltip")) {
        throw new Error("Expected tooltip to be direct sibling of icon");
      }
      createTooltip(icon, tooltip);
    }
  }

  /**
   * use AJAX to load search results in place
   *
   * @param {HTMLInputElement} searchInput
   */
  function loadSearchResults(searchInput) {
    let userQuery = searchInput.value;
    let searchResultList = getSearchResultList();

    if (userQuery !== "") {
      changeTitleBySearchQuery(userQuery);
      issueSearch();
    } else {
      goToHomePage();
    }

    function issueSearch() {
      let searchURL = Urls["cree-dictionary-search-results"](userQuery);

      window.history.replaceState(null, "", urlForQuery(userQuery));
      hideProse();

      fetch(searchURL)
        .then((response) => {
          if (response.ok) {
            return response.text();
          }
          return Promise.reject();
        })
        .then((html) => {
          // user input may have changed during the request
          const inputNow = searchInput.value;

          if (inputNow !== userQuery) {
            // input has changed, so ignore this request to prevent flashing
            // out-of-date search results
            return;
          }

          // Remove loading cards
          indicateLoadedSuccessfully();
          cleanDetails();
          searchResultList.innerHTML = html;
          prepareSearchResults(searchResultList);
        })
        .catch(() => {
          indicateLoadingFailure();
        });
    }

    function goToHomePage() {
      window.history.replaceState(null, "", Urls["cree-dictionary-index"]());

      showProse();

      hideLoadingIndicator();
      emptyElement(searchResultList);
    }

    /**
     * Returns a URL that search for the given query.
     *
     * The URL is constructed by using the <form>'s action="" attribute.
     */
    function urlForQuery(userQuery) {
      let form = searchInput.closest("form");
      return form.action + `?q=${encodeURIComponent(userQuery)}`;
    }
  }

  /**
   * Change tab title according to user input in the search bar
   *
   * @param inputVal {string}
   */
  function changeTitleBySearchQuery(inputVal) {
    setSubtitle(inputVal ? "🔎 " + inputVal : null);
  }

  function setSubtitle(subtitle) {
    let defaultTitle = "itwêwina: the online Cree dictionary";
    document.title = subtitle ? `${subtitle} — ${defaultTitle}` : defaultTitle;
  }

  /**
   * Sets up the (rudimentary) audio link on page load.
   */
  function setupAudioOnPageLoad() {
    let title = document.getElementById("head");
    if (!title) {
      // Could not find a head on the page.
      return;
    }

    // TODO: setup baseURL from <link rel=""> or something.
    let wordform = getEntryHead();

    fetchFirstRecordingURL(wordform)
      .then((recordingURL) => {
        if (recordingURL === undefined) {
          // The API could not find a recording for this wordform ¯\_(ツ)_/¯
          return;
        }

        // TODO: it shouldn't be placed be **inside** the title <h1>...
        let button = createAudioButton(recordingURL, title);
        button.addEventListener("click", retrieveListOfSpeakers);
      })
      .catch(() => {
        // TODO: display an error message?
      });
  }

  /**
   * Makes all URL paths relative to '/'.
   * In development, the root path is '/', so nothing changes.
   * On Sapir (as of 2020-03-09), the root path is '/cree-dictionary/'.
   */
  function makeRouteRelativeToSlash(route) {
    let baseURL = Urls["cree-dictionary-index"]();
    return route.replace(baseURL, "/");
  }

  /**
   * Returns the head of the current dictionary entry on a /word/* page.
   */
  function getEntryHead() {
    let dataElement = document.getElementById("data:head");
    return dataElement.value;
  }

  /**
   * Creates the 🔊 button and places it beside the desired element.
   */
  function createAudioButton(recordingURL, element) {
    let recording = new Audio(recordingURL);
    recording.preload = "none";

    let template = document.getElementById("template:play-button");

    let fragment = template.content.cloneNode(true);
    let button = fragment.querySelector("button");
    button.addEventListener("click", () => recording.play());

    // Place "&nbsp;<button>...</button>"
    // at the end of the element
    let nbsp = document.createTextNode(NO_BREAK_SPACE);
    element.appendChild(nbsp);
    element.appendChild(button);

    return button;
  }

  ////////////////////// Fetch information from the page ///////////////////////

  /**
   * @returns {(Element|null)}
   */
  function getSearchResultList() {
    return document.getElementById("search-result-list");
  }

}());
//# sourceMappingURL=index.js.map
