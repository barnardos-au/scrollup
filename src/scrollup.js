(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory();
    });
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.ScrollUp = factory();
  }
})(this, function () {
  'use strict';

  /**
   * Public API.
   * @type {Object}
   */
  var ScrollUp = {};

  /**
   * Current version.
   * @type {String}
   */
  ScrollUp.VERSION = '3.0.0';

  /**
   * Expose settings.
   * @type {Object}
   */
  ScrollUp.settings = {};

  /**
   * Global vars.
   */
  var isInitialStateUp = true;
  var isInitialStateDown = true;
  var triggerUpVisible = false;
  var triggerDownVisible = false;
  var start;
  var startPos;
  var scrollToPos;
  var animationId;
  var settings;
  var triggerElemUp;
  var triggerElemDown;
  var scrollEventThrottled;
  
  /**
   * Default options.
   * @type {Object}
   */
  var defaults = {
    triggerTemplate: false,
    triggerDownTemplate: false,
    scrollDistance: 400,
    scrollDistanceFromBottom: 400,
    scrollThrottle: 250,
    scrollDuration: 500,
    scrollEasing: 'linear',
    scrollTarget: false,
    scrollElement: window,
	showTriggersOnInit: false,
    classes: {
      init: 'scrollup--init',
      show: 'scrollup--show',
      hide: 'scrollup--hide'
    },
    onInit: null,
    onDestroy: null,
    onShow: null,
    onHide: null,
    onTop: null
  };

  /**
   * Required features.
   * @type {Array}
   */
  var features = [
    'querySelector' in document,
    'addEventListener' in window,
    'requestAnimationFrame' in window,
    'classList' in document.documentElement,
    !!Array.prototype.every
  ];

  /**
   * Extend objects.
   * @param  {Object} objects  Objects to merge
   * @return {Object}          New object
   */
  var extend = function (objects) {
    var extended = {};
    var i = 1;
    var prop;

    var merge = function (obj) {
      for (prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
          if (Object.prototype.toString.call(obj[prop]) === '[object Object]') {
            extended[prop] = extend(extended[prop], obj[prop]);
          }
          else {
            extended[prop] = obj[prop];
          }
        }
      }
    };

    merge(arguments[0]);

    for (i = 1; i < arguments.length; i++) {
      var obj = arguments[i];

      merge(obj);
    }

    return extended;
  };

  /**
   * Throttle function.
   * @param  {Function} func Function to call
   * @param  {Number}   wait Throttle delay
   * @return {Function}
   */
  var throttle = function (func, wait) {
    var _now =  Date.now || function () { return new Date().getTime(); };
    var context, args, result;
    var timeout = null;
    var previous = 0;

    var later = function () {
      previous = _now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };

    return function () {
      var now = _now();
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;

      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }

      return result;
    };
  };

  /**
   * Easings.
   * @param  {Number} t Current time
   * @param  {Number} b Start value
   * @param  {Number} c Change in value
   * @param  {Number} d Duration
   * @return {Number}
   */
  var easings = {
    linear: function (t, b, c, d) {
      return c*t/d + b;
    },

    easeInOutQuad: function (t, b, c, d) {
      t /= d/2;
      if (t < 1) { return c/2*t*t + b; }
      t--;
      return -c/2 * (t*(t-2) - 1) + b;
    },

    easeInOutCube: function (t, b, c, d) {
      t /= d/2;
      if (t < 1) { return c/2*t*t*t + b; }
      t -= 2;
      return c/2*(t*t*t + 2) + b;
    }
  };

  /**
   * Get document height.
   * @ref http://james.padolsey.com/javascript/get-document-height-cross-browser/
   * @return {Number} The document height
   */
  var getDocHeight = function () {
    var body = document.body;
    var docElem = document.documentElement;

    return Math.max(
      body.scrollHeight, docElem.scrollHeight,
      body.offsetHeight, docElem.offsetHeight,
      body.clientHeight, docElem.clientHeight
    );
  };

  /**
   * Get scroll Y position.
   * @return {Number} The scroll Y position
   */
  var getScrollFromTop = function () {
    return (window.pageYOffset !== undefined) ?
      window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
  };

  var getScrollFromBottom = function () {
	  return getDocHeight() - window.innerHeight - getScrollFromTop();
  };

  /**
   * Get Y position of an element.
   * @param  {Object} elem - DOM element
   * @return {Number}
   */
  var getElemY = function (elem) {
    var top = 0;

    while (elem) {
      top += elem.offsetTop;
      elem = elem.offsetParent;
    }

    return top;
  };

  /**
   * Check if all array values are true. Used to check feature list array.
   * @param  {Array}   arr
   * @return {Boolean}
   */
  var truthyArray = function (arr) {
    return arr.every(Boolean);
  };

  /**
   * Stop animation.
   */
  var stopAninmation = function () {

    // Reset vars.
    start = null;
    startPos = null;
    scrollToPos = null;

    // Cancel the animation.
    cancelAnimationFrame(animationId);

    // Callback.
    if (settings.onTop) {
      settings.onTop.call(triggerElemUp);
      settings.onTop.call(triggerElemDown);
    }
  };

  /**
   * Scrolling to top loop animation.
   * @param {Number} time - Timestamp from rAF.
   */
  var animationLoop = function (time) {
    if (!start) {
      start = time;
    }

    // Set current time.
    var currentTime = time - start;

    // Set pos with easing.
    var pos = easings[settings.scrollEasing](currentTime, startPos, -startPos + scrollToPos, settings.scrollDuration);

    // Scroll.
    window.scrollTo(0, pos);

    // If current time is less than scrollSpeed, keep going.
    if (currentTime < settings.scrollDuration) {
      animationId = requestAnimationFrame(animationLoop);
    } else {
      stopAninmation();
    }
  };

  /**
   * Scroll event.
   */
  var evaluateAndShowTriggers = function () {
    if (getScrollFromTop() > settings.scrollDistance) {
      if (!triggerUpVisible) {
		ScrollUp.showUpTrigger();
	  }	
    } else {
      if (triggerUpVisible) {
		ScrollUp.hideUpTrigger();
	  }
    }

    var scrollfrombottom = getScrollFromBottom();
    if (scrollfrombottom > settings.scrollDistanceFromBottom) {
      if (!triggerDownVisible) {
		ScrollUp.showDownTrigger();
	  }	
    } else {
      if (triggerDownVisible) {
		ScrollUp.hideDownTrigger();
	  }
    }
  };

  var scrollEvent = function () {
	  evaluateAndShowTriggers();
  };
  
  /**
   * Trigger click event.
   */
  var triggerUpClickEvent = function (event) {
    event.preventDefault();

    // Set where we're scrolling to.
    scrollToPos = getElemY(document.querySelector(settings.scrollTarget)) || 0;

    // Set the start position.
    startPos = getScrollFromTop();

    // Run animation.
    animationId = requestAnimationFrame(animationLoop);
  };

  var triggerDownClickEvent = function (event) {
    event.preventDefault();

    // Set where we're scrolling to.
    scrollToPos = getDocHeight() - window.innerHeight;

    // Set the start position.
    startPos = getScrollFromTop();

    // Run animation.
    animationId = requestAnimationFrame(animationLoop);
  };

  /**
   * Create trigger elem.
   * @param  {String} template
   * @return {Object}
   */
  var createTrigger = function (template) {
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = template;

    var elem = tempDiv.firstChild;

    // Append trigger to body
    return document.body.appendChild(elem);
  };

  /**
   * Assign feature test result to public API. "Cuts The Mustard".
   * @type {Boolean}
   */
  ScrollUp.cutsTheMustard = truthyArray(features);

  /**
   * Initialise ScrollUp.
   * @param  {String} elem    - String to use with querySelector()
   * @param  {Object} options - User options
   */
  ScrollUp.init = function (elem, options) {

    // Feature test
    if (!ScrollUp.cutsTheMustard) {
      return;
    }

    // Destroy any existing initializations.
    ScrollUp.destroy();

    // Check if object is passed in as first param and assign options to it.
    if (typeof elem === 'object') {
      options = elem;
    }

    // Merge user options with defaults.
    ScrollUp.settings = settings = extend(defaults, options || {});

    // Create trigger if needed.
    triggerElemUp = settings.triggerTemplate ? createTrigger(settings.triggerTemplate) : document.querySelector(elem);
    triggerElemDown = settings.triggerDownTemplate ? createTrigger(settings.triggerDownTemplate) : document.querySelector(elem);

    // Events.
    scrollEventThrottled = throttle(scrollEvent, settings.scrollThrottle);
    settings.scrollElement.addEventListener('scroll', scrollEventThrottled, false);
    triggerElemUp.addEventListener('click', triggerUpClickEvent, false);
    triggerElemDown.addEventListener('click', triggerDownClickEvent, false);

    // Callback.
    if (settings.onInit) {
      settings.onInit.call(triggerElemUp);
      settings.onInit.call(triggerElemDown);
    }
	
	if (settings.showTriggersOnInit) {
		evaluateAndShowTriggers();
	}
  };

  /**
   * Show trigger.
   */
  ScrollUp.showUpTrigger = function () {

    // Check initial state to add init class.
    if (isInitialStateUp) {
      ScrollUp.handleInitialStateUp();
    }

    // Remove hide class.
    if (triggerElemUp.classList.contains(settings.classes.hide)) {
      triggerElemUp.classList.remove(settings.classes.hide);
    }

    // Add show class.
    triggerElemUp.classList.add(settings.classes.show);

    // Set global state var.
    triggerUpVisible = true;

    // Callback.
    if (settings.onShow) {
      settings.onShow.call(triggerElemUp);
    }
  };

  /**
   * Hide trigger.
   */
  ScrollUp.hideUpTrigger = function () {

    // Remove show class.
    if (triggerElemUp.classList.contains(settings.classes.show)) {
      triggerElemUp.classList.remove(settings.classes.show);
    }

    // Add hide class.
    triggerElemUp.classList.add(settings.classes.hide);

    // Set global state var.
    triggerUpVisible = false;

    // Callback.
    if (settings.onHide) {
      settings.onHide.call(triggerElemUp);
    }
  };

  /**
   * Handle the initial state. Adds the init class.
   */
  ScrollUp.handleInitialStateUp = function () {
    triggerElemUp.classList.add(settings.classes.init);

    // Set global state var.
    isInitialStateUp = false;
  };

  ScrollUp.handleInitialStateDown = function () {
    triggerElemDown.classList.add(settings.classes.init);

    // Set global state var.
    isInitialStateDown = false;
  };

  ScrollUp.showDownTrigger = function () {
    // Check initial state to add init class.
    if (isInitialStateDown) {
      ScrollUp.handleInitialStateDown();
    }

    // Remove hide class.
    if (triggerElemDown.classList.contains(settings.classes.hide)) {
      triggerElemDown.classList.remove(settings.classes.hide);
    }

    // Add show class.
    triggerElemDown.classList.add(settings.classes.show);

    // Set global state var.
    triggerDownVisible = true;

    // Callback.
    if (settings.onShow) {
      settings.onShow.call(triggerElemDown);
    }
  };

  ScrollUp.hideDownTrigger = function () {
    // Remove show class.
    if (triggerElemDown.classList.contains(settings.classes.show)) {
      triggerElemDown.classList.remove(settings.classes.show);
    }

    // Add hide class.
    triggerElemDown.classList.add(settings.classes.hide);

    // Set global state var.
    triggerDownVisible = false;

    // Callback.
    if (settings.onHide) {
      settings.onHide.call(triggerElemDown);
    }
  };

  /**
   * Destroy ScrollUp.
   */
  ScrollUp.destroy = function () {

    // Make sure ScrollUp is initialised first.
    if (!settings) {
      return;
    }

    // Remove events.
    settings.scrollElement.removeEventListener('scroll', scrollEventThrottled);
    triggerElemUp.removeEventListener('click', triggerUpClickEvent);
    triggerElemDown.removeEventListener('click', triggerDownClickEvent);

    // Remove DOM element, if created.
    if (settings.triggerTemplate) {
      triggerElemUp.parentNode.removeChild(triggerElemUp);
    }
    if (settings.triggerDownTemplate) {
      triggerElemDown.parentNode.removeChild(triggerElemDown);
    }

    // Callback.
    if (settings.onDestroy) {
      settings.onDestroy.call(triggerElemUp);
      settings.onDestroy.call(triggerElemDown);
    }

    // Reset variables.
    isInitialStateUp = true;
    isInitialStateDown = true;
    triggerUpVisible = false;
    triggerDownVisible = false;
    start = null;
    startPos = null;
    scrollToPos = null;
    animationId = null;
    settings = null;
    triggerElemUp = null;
    triggerElemDown = null;
    scrollEventThrottled = null;
  };

  /**
   * Return public API.
   */
  return ScrollUp;
});
