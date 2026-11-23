/* dc-lite — tiny runtime for REQ9 static pages.
   Binds {{path}} holes in text, class and style attributes, data-dcref refs,
   data-dcev-* events and data-dcif blocks to a Component (renderVals/setState). */
(function () {
  'use strict';
  var HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function get(v, path) {
    if (path === 'false') return false;
    if (path === 'true') return true;
    return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, v);
  }
  function fill(str, v) { return str.replace(HOLE, function (_, p) { var r = get(v, p); return r == null || r === false ? '' : String(r); }); }

  function DCLogic() { this.state = {}; this.props = {}; }
  DCLogic.prototype.setState = function (o) {
    var self = this;
    Object.assign(this.state, typeof o === 'function' ? o(this.state) : o);
    if (!self.__q) { self.__q = true; Promise.resolve().then(function () { self.__q = false; self.__update && self.__update(); }); }
  };
  window.DCLogic = DCLogic;

  window.dcMount = function (Component, root) {
    var c = new Component();
    var binds = [];
    // collect bindings
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n = root;
    while (n) {
      if (n.nodeType === 3) {
        if (n.nodeValue.indexOf('{{') > -1) binds.push({ t: 'text', node: n, tpl: n.nodeValue });
      } else {
        for (var i = 0; i < n.attributes.length; i++) {
          var a = n.attributes[i];
          if (a.value.indexOf('{{') > -1 && a.name.indexOf('data-dc') !== 0) binds.push({ t: a.name, node: n, tpl: a.value });
        }
      }
      n = walker.nextNode();
    }
    // strip raw holes from attributes before first paint
    binds.forEach(function (b) { if (b.t === 'class') b.node.setAttribute('class', b.tpl.replace(HOLE, ' ').replace(/\s+/g, ' ').trim()); else if (b.t === 'style') b.node.setAttribute('style', b.tpl.replace(/[^;]*\{\{[^}]*\}\}[^;]*;?/g, '')); });

    function update() {
      var v = c.renderVals();
      binds.forEach(function (b) {
        var val = fill(b.tpl, v);
        if (b.t === 'text') { if (b.node.nodeValue !== val) b.node.nodeValue = val; }
        else if (b.t === 'class') {
          var nw = val.split(/\s+/).filter(Boolean), prev = b.prev || b.node.className.split(/\s+/).filter(Boolean);
          prev.forEach(function (k) { if (nw.indexOf(k) < 0) b.node.classList.remove(k); });
          nw.forEach(function (k) { b.node.classList.add(k); });
          b.prev = nw;
        } else if (b.t === 'style') {
          val.split(';').forEach(function (d) { var i = d.indexOf(':'); if (i < 0) return; b.node.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim()); });
        } else b.node.setAttribute(b.t, val);
      });
      root.querySelectorAll('[data-dcif]').forEach(function (el) { el.style.display = get(v, el.getAttribute('data-dcif')) ? 'contents' : 'none'; });
    }
    c.__update = update;
    update();
    var v0 = c.renderVals();
    root.querySelectorAll('[data-dcref]').forEach(function (el) { var f = get(v0, el.getAttribute('data-dcref')); if (typeof f === 'function') f(el); });
    root.querySelectorAll('*').forEach(function (el) {
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-dcev-') === 0) (function (evt, path) {
          el.addEventListener(evt, function (e) { var f = get(c.renderVals(), path); if (typeof f === 'function') f(e); });
        })(a.name.slice(10), a.value);
      }
    });
    if (c.componentDidMount) c.componentDidMount();
    window.addEventListener('pagehide', function () { if (c.componentWillUnmount) c.componentWillUnmount(); });
    return c;
  };
})();
