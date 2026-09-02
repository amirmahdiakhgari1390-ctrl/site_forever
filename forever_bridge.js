/**
 * Forever Shop — پل اتصال یکپارچه سایت ↔ مرکز کنترل
 * مشتریان: 5000-5003 | سفارش/نرخ: 5050-5053
 */
(function (w) {
  if (w.__ForeverBridgeLoaded) return;
  w.__ForeverBridgeLoaded = true;

  var DATA_URLS = [
    'http://127.0.0.1:5000', 'http://localhost:5000',
    'http://127.0.0.1:5001', 'http://localhost:5001',
    'http://127.0.0.1:5002', 'http://localhost:5002',
    'http://127.0.0.1:5003', 'http://localhost:5003'
  ];
  var ORDER_URLS = [
    'http://127.0.0.1:5050', 'http://localhost:5050',
    'http://127.0.0.1:5051', 'http://localhost:5051',
    'http://127.0.0.1:5052', 'http://localhost:5052',
    'http://127.0.0.1:5053', 'http://localhost:5053'
  ];

  function timeoutFetch(url, opts, ms) {
    ms = ms || 10000;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    opts = opts || {};
    opts.signal = ctrl.signal;
    opts.mode = opts.mode || 'cors';
    opts.credentials = opts.credentials || 'omit';
    opts.cache = 'no-store';
    return fetch(url, opts).finally(function () { clearTimeout(t); });
  }

  async function tryUrls(urls, path, opts) {
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await timeoutFetch(urls[i] + path, opts);
        var data = {};
        try { data = await res.json(); } catch (e) {}
        if (res.ok) return data;
        lastErr = new Error((data && data.message) || ('HTTP ' + res.status));
      } catch (e) { lastErr = e; }
    }
    return { success: false, offline: true, message: (lastErr && lastErr.message) || 'offline' };
  }

  async function dataPost(path, body) {
    return tryUrls(DATA_URLS, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }
  async function dataGet(path) {
    return tryUrls(DATA_URLS, path, { method: 'GET', headers: { 'Accept': 'application/json' } });
  }
  async function orderPost(path, body) {
    return tryUrls(ORDER_URLS, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }
  async function orderGet(path) {
    return tryUrls(ORDER_URLS, path, { method: 'GET', headers: { 'Accept': 'application/json' } });
  }

  // —— ForeverDataAPI (مشتریان) ——
  w.ForeverDataAPI = w.ForeverDataAPI || {
    post: dataPost,
    get: dataGet,
    register: function (p) { return dataPost('/api/register', p); },
    contact: function (p) { return dataPost('/api/contact', p); },
    club: function (p) { return dataPost('/api/club', p); },
    newsletter: function (p) { return dataPost('/api/newsletter', p); },
    hamkari: function (p) { return dataPost('/api/hamkari', p); },
    survey: function (p) { return dataPost('/api/survey', p); },
    products: function () { return dataGet('/api/products'); }
  };

  // —— ForeverOrderAPI (سفارش + نرخ) ——
  w.ForeverOrderAPI = w.ForeverOrderAPI || {
    post: orderPost,
    get: orderGet,
    order: function (p) { return orderPost('/api/order', p); },
    rate: function () { return orderGet('/api/rate'); },
    list: function () { return orderGet('/api/orders/list'); }
  };

  function formatPriceFa(n) {
    try { return Number(n).toLocaleString('fa-IR') + ' تومان'; }
    catch (e) { return n + ' تومان'; }
  }

  function pageCategoryHint() {
    var path = (location.pathname || '').toLowerCase();
    var map = {
      'immune': 'سیستم ایمنی',
      'varsesh': 'ورزشی',
      'sport': 'ورزشی',
      'drink': 'نوشیدنی‌ها',
      'supplement': 'مکمل‌ها',
      'cream': 'کرم‌ها',
      'kerem_face': 'کرم‌ها',
      'skin': 'کرم‌ها',
      'bee': 'زنبور',
      'oil': 'روغن‌ها',
      'package': 'پکیج‌ها',
      'oral': 'مکمل‌ها'
    };
    for (var k in map) {
      if (path.indexOf(k) !== -1) return map[k];
    }
    return '';
  }



  /** قفل کارت محصول تمام‌شده + نمایش موجودی */
  /** قفل کارت محصول تمام‌شده/غیرفعال + نمایش «ناموجود» به‌جای قیمت */
  function lockCardIfNoStock(card, stock) {
    stock = Number(stock);
    if (isNaN(stock)) stock = 5;
    card.setAttribute('data-stock', String(stock));
    var buyBtns = card.querySelectorAll('.btn-buy, .add-to-cart, [data-add-cart], button.buy, .add-to-cart-btn, .view-product-btn');
    card.querySelectorAll('.stock-badge, .stock-lock-overlay').forEach(function (el) { el.remove(); });
    var price = card.querySelector('.price,.product-price,[data-price-display],.product-price-value');
    if (stock <= 0) {
      card.classList.add('product-out-of-stock', 'out-of-stock');
      if (price) {
        price.innerHTML = '<span style="color:#e53935;font-weight:bold;">ناموجود</span>';
      }
      buyBtns.forEach(function (btn) {
        btn.setAttribute('disabled', 'disabled');
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      });
    } else {
      var wasLocked = card.classList.contains('out-of-stock') || card.classList.contains('product-out-of-stock');
      card.classList.remove('product-out-of-stock', 'out-of-stock');
      card.style.opacity = '';
      if (price && wasLocked) {
        var fin = parseInt(card.getAttribute('data-price') || '0', 10) || 0;
        var oldP = parseInt(card.getAttribute('data-old-price') || '0', 10) || 0;
        var disc = parseInt(card.getAttribute('data-discount') || '0', 10) || 0;
        if (fin > 0) {
          var metas = '';
          price.querySelectorAll('meta').forEach(function (m) {
            if (m.getAttribute('itemprop') === 'price') m.setAttribute('content', String(fin * 10));
            metas += m.outerHTML;
          });
          price.innerHTML = metas
            + (oldP && oldP !== fin ? '<span class="price-old" style="display:block;font-size:13px;color:#9ca3af;text-decoration:line-through;font-weight:600">' + formatPriceFa(oldP) + '</span>' : '')
            + '<span class="price-new" style="display:block;font-size:1.05rem;color:#b91c1c;font-weight:900">' + formatPriceFa(fin) + '</span>'
            + (disc > 0 ? '<span class="price-off-label" style="display:block;font-size:11px;color:#16a34a;font-weight:800">' + disc + '٪ تخفیف</span>' : '');
        } else {
          var p2 = card.getAttribute('data-price');
          if (p2) price.textContent = formatPriceFa(p2);
        }
      }
      buyBtns.forEach(function (btn) {
        btn.removeAttribute('disabled');
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
      });
    }
  }
  function applyStockFromProducts(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (p) {
      if (!p || !p.name) return;
      var isActive = !(p.active === 0 || p.active === false || p.active === '0');
      var stock = (p.stock != null) ? Number(p.stock) : 5;
      var effectiveStock = isActive ? stock : 0;
      document.querySelectorAll('.product[data-name], .product[data-id]').forEach(function (card) {
        var n = (card.getAttribute('data-name') || '').trim();
        var id = (card.getAttribute('data-id') || '').trim();
        var match = (n && n === String(p.name).trim()) || (p.sku && id && id === String(p.sku));
        if (!match) return;
        lockCardIfNoStock(card, effectiveStock);
      });
    });
    document.querySelectorAll('.product').forEach(function (card) {
      if (!card.hasAttribute('data-stock')) lockCardIfNoStock(card, 5);
    });
  }
  /** نمایش موجودی در مودال مشاهده محصول */
  function patchProductModal() {
    var orig = w.openProductModal;
    // common pattern: function openProductModal(product)
    if (typeof w.openProductModal === 'function' && !w.openProductModal.__stockPatched) {
      var prev = w.openProductModal;
      w.openProductModal = function (product) {
        prev.apply(this, arguments);
        showStockInModal(product);
      };
      w.openProductModal.__stockPatched = true;
    }
    // also listen clicks on view buttons
    document.querySelectorAll('.product').forEach(function (card) {
      if (card.dataset.stockClick) return;
      card.dataset.stockClick = '1';
      card.addEventListener('click', function (e) {
        var t = e.target;
        if (!t) return;
        var isView = t.closest && (t.closest('.btn:not(.btn-buy)') || t.closest('[data-view]') || (t.textContent || '').indexOf('مشاهده') !== -1);
        if (!isView) return;
        setTimeout(function () {
          showStockInModal({
            stock: card.getAttribute('data-stock') || 5,
            name: card.getAttribute('data-name')
          });
        }, 80);
      }, true);
    });
  }

  function showStockInModal(product) {
    var stock = product && product.stock != null ? Number(product.stock) : null;
    if (stock == null || isNaN(stock)) {
      var name = product && product.name;
      if (name) {
        var card = document.querySelector('.product[data-name="' + name + '"]');
        if (card) stock = Number(card.getAttribute('data-stock') || 5);
      }
    }
    if (stock == null || isNaN(stock)) stock = 5;
    var host = document.getElementById('modalProductDesc') ||
      document.querySelector('.product-modal-info') ||
      document.getElementById('modalProductName');
    if (!host) return;
    var el = document.getElementById('modalProductStock');
    if (!el) {
      el = document.createElement('p');
      el.id = 'modalProductStock';
      el.setAttribute('style', 'margin:10px 0;font-weight:800;font-size:15px;');
      if (host.parentNode) {
        if (host.id === 'modalProductDesc') host.parentNode.insertBefore(el, host.nextSibling);
        else host.appendChild(el);
      }
    }
    if (stock <= 0) {
      el.textContent = 'موجودی: ناموجود';
      el.style.color = '#ef4444';
    } else {
      el.textContent = 'موجودی: ' + stock + ' عدد';
      el.style.color = '#16a34a';
    }
    // cap qty input
    var qty = document.getElementById('qtyInput');
    if (qty) {
      qty.max = String(Math.max(1, stock));
      if (Number(qty.value) > stock) qty.value = String(Math.max(0, stock));
    }
    var addBtn = document.querySelector('#productModal .btn-buy, #productModal .add-to-cart, .product-modal-box .btn-buy, #modalAddCart');
    if (addBtn) {
      if (stock <= 0) {
        addBtn.setAttribute('disabled', 'disabled');
        addBtn.style.opacity = '0.5';
      } else {
        addBtn.removeAttribute('disabled');
        addBtn.style.opacity = '';
      }
    }
  }

  /** همگام‌سازی قیمت و تخفیف از مرکز کنترل روی کارت‌های محصول */
  function applyProductsToPage(list) {
    if (!Array.isArray(list)) return 0;
    var hint = pageCategoryHint();
    var applied = 0;
    list.forEach(function (p) {
      if (!p || !p.name) return;
      if (hint && p.category && p.category !== hint && p.category !== '') {
        // اگر صفحه دسته مشخص دارد، فقط همان دسته + تطبیق نام
      }
      var cards = document.querySelectorAll('.product[data-name], .product[data-id], [data-product-name]');
      cards.forEach(function (card) {
        var n = (card.getAttribute('data-name') || card.getAttribute('data-product-name') || '').trim();
        var id = (card.getAttribute('data-id') || '').trim();
        var match = (n && n === String(p.name).trim()) ||
          (p.sku && id && id === String(p.sku)) ||
          (n && String(p.name).indexOf(n) !== -1) ||
          (n && n.indexOf(String(p.name)) !== -1);
        if (!match) return;
        var finalPrice = (p.final_price != null) ? p.final_price : p.price;
        if (finalPrice != null) {
          card.setAttribute('data-price', String(finalPrice));
          if (p.source === 'excel' || p.sku) card.setAttribute('data-excel', '1');
          if (p.price != null) card.setAttribute('data-old-price', String(p.price));
          if (p.price != null) card.setAttribute('data-old-price', String(p.price));
          var priceEl = card.querySelector('.price, .product-price, [data-price-display], .product-price-value');
          if (priceEl) priceEl.textContent = formatPriceFa(finalPrice);
          applied++;
        }
        var disc = Number(p.discount_percent || 0);
        if (disc > 0) {
          var badge = card.querySelector('.badge.off, .badge-discount');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge off';
            var wrap = card.querySelector('.product-img, .product-image') || card;
            wrap.appendChild(badge);
          }
          badge.textContent = disc + '٪';
        }
      });
    });
    return applied;
  }

  function syncProductsFromControl() {
    w.ForeverDataAPI.products().then(function (data) {
      if (data && data.products) {
        applyProductsToPage(data.products);
        applyStockFromProducts(data.products);
      }
    }).catch(function () {});
  }

  /** اتصال خودکار فرم‌های رایج صفحه */
  function bindCommonForms() {
    // خبرنامه
    document.querySelectorAll('form[id*="newsletter" i], form.newsletter-form').forEach(function (form) {
      if (form.dataset.foreverBound) return;
      form.dataset.foreverBound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var phone = fd.get('phone') || (form.querySelector('[name=phone]') || {}).value || '';
        var email = fd.get('email') || (form.querySelector('[name=email]') || {}).value || '';
        w.ForeverDataAPI.newsletter({ phone: phone, email: email });
      });
    });
  }



  /** قیمت از اکسل (products_prices.json) */
  function matchExcelProduct(card, list) {
    var n = (card.getAttribute('data-name') || '').trim();
    var id = (card.getAttribute('data-id') || card.getAttribute('data-sku') || '').trim();
    if (!n && !id) return null;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      if (p.sku && id && String(p.sku) === String(id)) return p;
      if (p.code && id && String(p.code) === String(id)) return p;
      var fa = (p.name_fa || '').trim();
      var en = (p.name_en || '').trim();
      if (fa && n && (n === fa || n.indexOf(fa) !== -1 || fa.indexOf(n) !== -1)) return p;
      if (en && n && n.toLowerCase().indexOf(en.toLowerCase().slice(0, 12)) !== -1) return p;
      // کلیدواژه‌های رایج
      if (n.indexOf('سونیا') !== -1 && en.indexOf('Sonya') !== -1) return p;
      if (n.indexOf('پروپولیس') !== -1 && en.indexOf('Bee Propolis') !== -1) return p;
      if ((n.indexOf('ژل آلو') !== -1 || n.indexOf('آلوئه‌ورا') !== -1) && en === 'Aloe Vera Gel') return p;
    }
    return null;
  }

  function applyExcelPrices(data) {
    if (!data || !Array.isArray(data.products)) return 0;
    var list = data.products;
    var off = Number(data.default_discount_percent || 30);
    var applied = 0;
    document.querySelectorAll('.product, .rail-card').forEach(function (card) {
      var p = matchExcelProduct(card, list);
      if (!p) return;
      var oldPrice = Number(p.price_old || p.price_toman || 0);
      if (!oldPrice) return;
      var finalPrice = Number(p.price_30off || Math.round(oldPrice * (100 - off) / 100));
      card.setAttribute('data-old-price', String(oldPrice));
      card.setAttribute('data-price', String(finalPrice));
          if (p.source === 'excel' || p.sku) card.setAttribute('data-excel', '1');
          if (p.price != null) card.setAttribute('data-old-price', String(p.price));
      if (p.sku) card.setAttribute('data-sku', String(p.sku));
      if (p.retail_aed) card.setAttribute('data-aed', String(p.retail_aed));
      card.dataset.flashDone = ''; // اجازه اعمال دوباره UI تخفیف
      applied++;
    });
    // رویداد برای اسکریپت تخفیف صفحه اصلی
    document.dispatchEvent(new CustomEvent('forever-excel-prices', { detail: data }));
    return applied;
  }

  function loadExcelPrices() {
    var urls = ['products_prices.json', './products_prices.json', '/products_prices.json'];
    (function tryLoad(i) {
      if (i >= urls.length) return;
      fetch(urls[i], { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); })
        .then(function (data) {
          applyExcelPrices(data);
          // بعد از اکسل، API کنترل را هم تلاش کن (اولویت با اکسل روی کارت‌های match شده)
        })
        .catch(function () { tryLoad(i + 1); });
    })(0);
  }


  /** نرخ درهم خودکار */
  var ForeverRate = window.ForeverRate || { aedToman: null, source: null, ready: false };
  window.ForeverRate = ForeverRate;

  function applyAutoRate(toman, source) {
    if (!toman || toman <= 0) return;
    ForeverRate.aedToman = toman;
    ForeverRate.source = source || '';
    ForeverRate.ready = true;
    try { localStorage.setItem('foreverAedToman', String(toman)); localStorage.setItem('foreverAedSource', source || ''); } catch (e) {}
    // فقط کارت‌هایی که data-excel نیستند و data-aed دارند
    document.querySelectorAll('.product[data-aed], .rail-card[data-aed]').forEach(function (card) {
      if (card.getAttribute('data-excel') === '1') return;
      if (card.getAttribute('data-old-price') && card.getAttribute('data-discount')) {
        // اگر قیمت اکسل/ثابت دارد دست نزن
        if (card.getAttribute('data-excel') === '1') return;
      }
      var aed = parseFloat(card.getAttribute('data-aed'));
      if (!aed || aed <= 0) return;
      // اگر data-lock-price باشد رد شو
      if (card.getAttribute('data-lock-price') === '1') return;
      if (card.getAttribute('data-excel') === '1') return;
      var tomanPrice = Math.round(aed * toman);
      var off = parseInt(card.getAttribute('data-discount') || '0', 10) || 0;
      var finalP = off > 0 ? Math.round(tomanPrice * (100 - off) / 100) : tomanPrice;
      card.setAttribute('data-old-price', String(tomanPrice));
      card.setAttribute('data-price', String(finalP));
    });
    var el = document.getElementById('liveAedRate');
    if (el) {
      try { el.textContent = Math.round(toman).toLocaleString('fa-IR') + ' تومان'; }
      catch (e) { el.textContent = Math.round(toman) + ' تومان'; }
    }
    document.dispatchEvent(new CustomEvent('forever-rate-updated', { detail: { aedToman: toman, source: source } }));
  }

  function loadAutoRate() {
    var ports = [5000, 5050];
    var hosts = ['http://127.0.0.1', 'http://localhost'];
    var urls = [];
    hosts.forEach(function (h) { ports.forEach(function (p) { urls.push(h + ':' + p + '/api/rate'); }); });
    (function next(i) {
      if (i >= urls.length) {
        try {
          var cached = parseFloat(localStorage.getItem('foreverAedToman') || '0');
          if (cached > 0) applyAutoRate(cached, localStorage.getItem('foreverAedSource') || 'cache');
        } catch (e) {}
        return;
      }
      fetch(urls[i], { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); })
        .then(function (data) {
          var t = Number(data.aed_toman || (data.aed_irr ? data.aed_irr / 10 : 0));
          if (t > 0) applyAutoRate(t, data.source || 'api');
          else throw new Error('empty');
        })
        .catch(function () { next(i + 1); });
    })(0);
  }

  function boot() {
    loadAutoRate();
    setInterval(loadAutoRate, 5 * 60 * 1000);
    function work() {
      document.querySelectorAll('.product').forEach(function (card) {
        if (!card.getAttribute('data-stock')) card.setAttribute('data-stock', '5');
        lockCardIfNoStock(card, card.getAttribute('data-stock') || 5);
      });
      syncProductsFromControl();
      patchProductModal();
      bindCommonForms();
    }
    if (window.requestIdleCallback) requestIdleCallback(work, { timeout: 2000 });
    else setTimeout(work, 100);
    setInterval(syncProductsFromControl, 10 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

w.ForeverLockCard = lockCardIfNoStock;
  w.ForeverBridge = {
    syncProducts: syncProductsFromControl,
    applyProducts: applyProductsToPage,
    dataPost: dataPost,
    orderPost: orderPost
  };
})(window);

/** قیمت زنده از پنل کنترل — بدون رفرش صفحه */
(function () {
  var lastVersion = '';
  var URLS = [
    'http://127.0.0.1:5000', 'http://localhost:5000',
    'http://127.0.0.1:5001', 'http://localhost:5001',
    'http://127.0.0.1:5050', 'http://localhost:5050'
  ];
  function fa(n) {
    try { return Math.round(Number(n)).toLocaleString('fa-IR'); } catch (e) { return String(n); }
  }
  function applyList(products) {
    if (!products || !products.length) return 0;
    var map = {};
    products.forEach(function (p) {
      var k = String(p.sku || p.id || '').trim();
      if (k) map[k] = p;
      if (p.name) map['name:' + String(p.name).trim()] = p;
    });
var changed = 0;
    document.querySelectorAll('.product, .rail-card').forEach(function (card) {
      var id = (card.getAttribute('data-sku') || card.getAttribute('data-id') || '').trim();
      var name = (card.getAttribute('data-name') || '').trim();
      var p = map[id] || map['name:' + name];
      if (!p) return;

      var oldP = Number(p.price) || 0;
      var disc = Number(p.discount_percent) || 0;
      var fin = Number(p.final_price);
      if (!fin && oldP) fin = Math.round(oldP * (100 - disc) / 100);
      if (oldP || fin) {
        card.setAttribute('data-old-price', String(oldP));
        card.setAttribute('data-price', String(fin));
        card.setAttribute('data-discount', String(disc));
      }
      card.setAttribute('data-from-control', '1');
      card.setAttribute('data-video', String((p.video != null ? p.video : '') || ''));

      // موجودی صفر یا غیرفعال از اپ کنترل → ناموجود + قفل کارت
      var isActive = !(p.active === 0 || p.active === false || p.active === '0');
      var stockVal = (p.stock != null) ? Number(p.stock) : 5;
      var effStock = isActive ? stockVal : 0;
      if (window.ForeverLockCard) window.ForeverLockCard(card, effStock);
      if (effStock <= 0) return; // کارت قفل شد، نیازی به رندر مجدد قیمت نیست

      var prevSig = card.getAttribute('data-price-rendered') || '';
      var sig = fin + '|' + oldP + '|' + disc;
      if (sig === prevSig) return;
      card.setAttribute('data-price-rendered', sig);
      changed++;
      var box = card.querySelector('.price');
      if (box) {
        var metas = '';
        box.querySelectorAll('meta').forEach(function (m) {
          if (m.getAttribute('itemprop') === 'price') m.setAttribute('content', String(fin * 10));
          metas += m.outerHTML;
        });
        box.innerHTML = metas
          + (oldP && oldP !== fin
            ? '<span class="price-old" style="display:block;font-size:13px;color:#9ca3af;text-decoration:line-through;font-weight:600">' + fa(oldP) + ' تومان</span>'
            : '')
          + '<span class="price-new" style="display:block;font-size:1.05rem;color:#b91c1c;font-weight:900">' + fa(fin) + ' تومان</span>'
          + (disc > 0
            ? '<span class="price-off-label" style="display:block;font-size:11px;color:#16a34a;font-weight:800">' + disc + '٪ تخفیف</span>'
            : '');
      }
      card.dataset.flashDone = '1';
      card.style.transition = 'box-shadow .35s ease';
      card.style.boxShadow = '0 0 0 3px rgba(22,163,74,.45)';
      setTimeout(function () { card.style.boxShadow = ''; }, 900);
    });
    // مودال باز اگر همان محصول است
    try {
      if (window.currentProduct && document.getElementById('productModal') &&
          document.getElementById('productModal').classList.contains('active')) {
        var cp = window.currentProduct;
        var key = String(cp.id || cp.sku || '');
        var p2 = map[key];
        if (p2) {
          var fin2 = Number(p2.final_price) || Math.round((Number(p2.price)||0) * (100 - (Number(p2.discount_percent)||0)) / 100);
          var el = document.getElementById('modalProductPrice');
          if (el) el.textContent = fa(fin2) + ' تومان';
          cp.price = fin2;
        }
      }
    } catch (e) {}
    return changed;
  }
  function fetchJson(path) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      function next() {
        if (i >= URLS.length) return reject();
        var base = URLS[i++];
        fetch(base + path, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store'
        })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(resolve)
          .catch(next);
      }
      next();
    });
  }
  function syncControlPrices(force) {
    var go = function () {
      fetchJson('/api/products')
        .then(function (data) {
          if (data && data.products) applyList(data.products);
        })
        .catch(function () {});
    };
    if (force) return go();
    fetchJson('/api/products/version')
      .then(function (v) {
        var ver = (v && v.version) ? String(v.version) : '';
        if (ver && ver === lastVersion) return;
        if (ver) lastVersion = ver;
        go();
      })
      .catch(function () { go(); });
  }
  window.syncControlPrices = syncControlPrices;
  function boot() {
    syncControlPrices(true);
    setInterval(function () { syncControlPrices(false); }, 2000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') syncControlPrices(true);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


  var HOME_ALLOWED_SKUS = {"374":1,"015":1,"027":1,"034":1,"196":1,"439":1,"566":1,"061":1};
  /** محصولات از پنل کنترل → کارت‌های سایت (دقیقاً مثل بقیه) */
(function () {
  var URLS = [
    'http://127.0.0.1:5000', 'http://localhost:5000',
    'http://127.0.0.1:5001', 'http://localhost:5001'
  ];
  var CACHE_KEY = 'foreverControlProductsCache';

  function fa(n) {
    try { return Math.round(Number(n)).toLocaleString('fa-IR'); } catch (e) { return String(n); }
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function pageCategory() {
    var p = (document.body && document.body.getAttribute('data-page')) || '';
    var path = (location.pathname || '') + (location.href || '');
    if (p === 'immune' || /immune\.html/i.test(path)) return 'سیستم ایمنی';
    if (p === 'ostekhan' || /ostekhan\.html/i.test(path)) return 'استخوان‌ها';
    if (p === 'orogh' || /orogh\.html/i.test(path)) return 'عروق';
    if (p === 'behdashti' || /behdashti\.html/i.test(path)) return 'بهداشتی';
    if (p === 'varsesh' || /varsesh|sport\.html/i.test(path)) return 'ورزشی';
    if (p === 'drink' || /drink\.html/i.test(path)) return 'نوشیدنی‌ها';
    if (p === 'home' || /test_html2\.html|^\/$|index/i.test(path)) return 'صفحه اصلی';
    return '';
  }
  function finalPrice(p) {
    var price = Number(p.price) || 0;
    var disc = Number(p.discount_percent) || 0;
    var fin = Number(p.final_price);
    if (!fin) fin = Math.round(price * (100 - disc) / 100);
    return { old: price, fin: fin, disc: disc };
  }
  function cardHtml(p) {
    var pr = finalPrice(p);
    var sku = esc(p.sku || p.id || '');
    var name = esc(p.name || '');
    var img = esc((p.image && !/^javascript:/i.test(String(p.image)) ? p.image : '') || 'images/sonya.jpg');
    var desc = esc(p.description || '');
    var cat = esc(p.category || '');
    var stock = (p.stock != null) ? p.stock : 5;
    var shortDesc = desc ? (desc.length > 90 ? desc.substring(0, 90) + '…' : desc) : '';
    var badges = '';
    if (pr.disc > 0) badges += '<span class="badge off">' + pr.disc + '٪</span>';
    var oldPriceHtml = '';
    if (pr.old && pr.old !== pr.fin) {
      oldPriceHtml = '<span class="price-old" style="display:block;font-size:13px;color:#9ca3af;text-decoration:line-through;font-weight:600;">' + fa(pr.old) + ' تومان</span>';
    }
    var offHtml = pr.disc > 0
      ? '<span class="price-off-label" style="display:block;font-size:11px;color:#16a34a;font-weight:800;">' + pr.disc + '٪ تخفیف ویژه</span>'
      : '';
    return (
      '<article class="product" data-excel="1" data-from-control="1" data-id="' + sku + '" data-sku="' + sku + '" data-name="' + name + '"' +
      ' data-price="' + pr.fin + '" data-old-price="' + pr.old + '" data-discount="' + pr.disc + '"' +
      ' data-image="' + img + '" data-video="' + esc(p.video || '') + '" data-stock="' + stock + '" data-desc="' + desc + '" data-category="' + cat + '"' +
      ' itemscope itemtype="https://schema.org/Product">' +
      '<div class="product-img">' +
      '<img src="' + img + '" alt="' + name + '" width="400" height="400" loading="lazy" itemprop="image"' +
      ' onerror="this.style.background=\'#f3f4f6\';this.style.objectFit=\'contain\';this.removeAttribute(\'src\');">' +
      badges +
      '</div>' +
      '<h3 itemprop="name">' + name + '</h3>' +
      '<p itemprop="description">' + shortDesc + '</p>' +
      '<div class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">' +
      '<meta itemprop="priceCurrency" content="IRR">' +
      '<meta itemprop="price" content="' + (pr.fin * 10) + '">' +
      oldPriceHtml +
      '<span class="price-new" style="display:block;font-size:1.05rem;color:#b91c1c;font-weight:900;">' + fa(pr.fin) + ' تومان</span>' +
      offHtml +
      '</div>' +
      '<div class="product-buttons">' +
      '<button type="button" class="btn view-product-btn">مشاهده محصول</button>' +
      '<button type="button" class="btn-buy add-to-cart-btn">افزودن به سبد خرید</button>' +
      '</div>' +
      '</article>'
    );
  }
  function filterForPage(list) {
    var cat = pageCategory();
    if (!cat) return list;
    if (cat === 'صفحه اصلی') {
      return list.filter(function (p) {
        var pc = (p.category || '');
        var feat = p.featured === 1 || p.featured === true || p.featured === '1';
        return feat || pc === 'صفحه اصلی' || pc === 'صفحه اصلي' || pc === 'home' || pc === '';
      });
    }
    return list.filter(function (p) {
      var pc = (p.category || '');
      return pc === cat || pc.indexOf(cat) !== -1;
    });
  }
  function findGrid() {
    return document.querySelector('#products .product-box') ||
      document.querySelector('section.products .product-box') ||
      document.querySelector('.product-box');
  }
  function renderProducts(list) {
    var grid = findGrid();
    if (!grid || !list) return;
    var filtered = filterForPage(list);
    var activeMap = {};
    function normSku(s) {
      s = String(s == null ? '' : s).trim();
      if (!s) return '';
      if (/^\d+\.0$/.test(s)) s = s.split('.')[0];
      return s;
    }
    (list || []).forEach(function (p) {
      var k = normSku(p.sku || p.id || '');
      if (k) activeMap[k] = p;
      // تطبیق با نام هم
      if (p.name) activeMap['name:' + String(p.name).trim()] = p;
    });
    var existing = {};
    grid.querySelectorAll('.product[data-sku], .product[data-id], .product[data-name]').forEach(function (el) {
      var k = normSku(el.getAttribute('data-sku') || el.getAttribute('data-id') || '');
      if (k) existing[k] = el;
      var nm = (el.getAttribute('data-name') || '').trim();
      if (nm) existing['name:' + nm] = el;
    });

    function applyCard(card, p) {
      var pr = finalPrice(p);
      var name = p.name || card.getAttribute('data-name') || '';
      var img = p.image || card.getAttribute('data-image') || '';
      var desc = p.description || card.getAttribute('data-desc') || '';
      var stock = (p.stock != null) ? p.stock : (card.getAttribute('data-stock') || '5');
      card.setAttribute('data-name', name);
      card.setAttribute('data-old-price', String(pr.old));
      card.setAttribute('data-price', String(pr.fin));
      card.setAttribute('data-discount', String(pr.disc));
      card.setAttribute('data-from-control', '1');
      card.setAttribute('data-stock', String(stock));
      if (desc) card.setAttribute('data-desc', desc);
      card.setAttribute('data-video', String(p.video || ''));
      if (p.category) card.setAttribute('data-category', p.category);
      var h3 = card.querySelector('h3');
      if (h3 && name) h3.textContent = name;
      var pEl = card.querySelector('p');
      if (pEl && desc) pEl.textContent = desc.length > 90 ? desc.substring(0, 90) + '…' : desc;
      var im = card.querySelector('.product-img img, img');
      // عکس فعلی سایت را نگه دار — فقط اگر عکس نداشت از پنل بگیر
      var curImg = (im && im.getAttribute('src')) || card.getAttribute('data-image') || '';
      var apiImg = (img || '').trim();
      if (!curImg && apiImg) {
        card.setAttribute('data-image', apiImg);
        if (im) im.setAttribute('src', apiImg);
      } else if (curImg) {
        card.setAttribute('data-image', curImg);
        if (im && !im.getAttribute('src')) im.setAttribute('src', curImg);
      }
      var badge = card.querySelector('.badge.off, .badge');
      if (pr.disc > 0) {
        if (!badge) {
          var wrap = card.querySelector('.product-img');
          if (wrap) {
            badge = document.createElement('span');
            badge.className = 'badge off';
            wrap.appendChild(badge);
          }
        }
        if (badge) badge.textContent = pr.disc + '٪';
      } else if (badge) {
        badge.remove();
      }
      var box = card.querySelector('.price');
      if (box) {
        var metas = '';
        box.querySelectorAll('meta').forEach(function (m) {
          if (m.getAttribute('itemprop') === 'price') m.setAttribute('content', String(pr.fin * 10));
          metas += m.outerHTML;
        });
        box.innerHTML = metas
          + (pr.old && pr.old !== pr.fin
            ? '<span class="price-old" style="display:block;font-size:13px;color:#9ca3af;text-decoration:line-through;font-weight:600">' + fa(pr.old) + ' تومان</span>'
            : '')
          + '<span class="price-new" style="display:block;font-size:1.05rem;color:#b91c1c;font-weight:900">' + fa(pr.fin) + ' تومان</span>'
          + (pr.disc > 0
            ? '<span class="price-off-label" style="display:block;font-size:11px;color:#16a34a;font-weight:800">' + pr.disc + '٪ تخفیف</span>'
            : '');
      }
      // فعال
      card.classList.remove('out-of-stock');
      card.style.display = '';
      card.querySelectorAll('button').forEach(function (btn) {
        btn.disabled = false;
        btn.style.pointerEvents = '';
        btn.style.opacity = '';
      });
      if (parseInt(stock, 10) <= 0) {
        card.classList.add('out-of-stock');
      }
    }

// آپدیت کارت‌های موجود از پنل کنترل — غیرفعال دیگر مخفی نمی‌شود، «ناموجود» و قفل می‌شود
    Object.keys(existing).forEach(function (sku) {
      if (String(sku).indexOf('name:') === 0) return; // فقط یک‌بار از روی sku
      var card = existing[sku];
      var p = activeMap[sku];
      if (!p) {
        // محصول استاتیک سایت را مخفی نکن — فقط کارت ساخته‌شده از پنل حذف شود
        if (card.getAttribute('data-from-control') === '1') {
          card.remove();
        }
        return;
      }
      card.removeAttribute('data-inactive');
      card.style.display = '';
      // همه محصولات (کد + برنامه) کامل از کنترل اعمال شوند
      applyCard(card, p);
    });

    // محصول جدید از پنل — فقط اگر فعال است اضافه شود
    (filtered || []).forEach(function (p) {
      var sku = String(p.sku || p.id || '').trim();
      if (!sku || existing[sku]) return;
      var isActiveNew = !(p.active === 0 || p.active === false || p.active === '0');
      if (!isActiveNew) return;
      // جلوگیری از تکراری با نام
      var name = String(p.name || '').trim();
      var dup = false;
      Object.keys(existing).forEach(function (k) {
        var c = existing[k];
        if (c && (c.getAttribute('data-name') || '').trim() === name) dup = true;
      });
      if (dup) return;
      grid.insertAdjacentHTML('beforeend', cardHtml(p));
      var neu = grid.querySelector('.product[data-sku="' + sku.replace(/"/g, '') + '"]');
      if (neu) existing[sku] = neu;
    });

    // قفل/بازکردن کارت‌ها بر اساس موجودی و فعال‌بودن
    Object.keys(activeMap).forEach(function (key) {
      if (key.indexOf('name:') === 0) return;
      var p = activeMap[key];
      var card = existing[key] || grid.querySelector('.product[data-sku="' + key.replace(/"/g, '') + '"]');
      if (!card) return;
      var isAct = !(p.active === 0 || p.active === false || p.active === '0');
      var st = (p.stock != null) ? parseInt(p.stock, 10) : 5;
      var eff = isAct ? (isNaN(st) ? 5 : st) : 0;
      if (window.ForeverLockCard) window.ForeverLockCard(card, eff);
    });

    try { document.dispatchEvent(new CustomEvent('forever-products-rendered')); } catch (e) {}
    if (typeof bindCardButtons === 'function') bindCardButtons(grid);
  }
  function cacheSave(list) {
    try { window.__foreverLastProducts = list || []; localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), products: list })); } catch (e) {}
  }
  function cacheLoad() {
    try {
      var o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return (o && o.products) ? o.products : [];
    } catch (e) { return []; }
  }
  function fetchProducts() {
    return new Promise(function (resolve, reject) {
      function fromApi() {
        var i = 0;
        function next() {
          if (i >= URLS.length) return reject();
          var base = URLS[i++];
          fetch(base + '/api/products', {
            method: 'GET', headers: { 'Accept': 'application/json' },
            mode: 'cors', credentials: 'omit', cache: 'no-store'
          })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (data) {
              if (data && data.products) resolve(data.products);
              else next();
            })
            .catch(next);
        }
        next();
      }
      // اول API؛ اگر برنامه بسته بود از فایل کش کنار سایت
      var i = 0;
      var tried = false;
      function next() {
        if (i >= URLS.length) {
          if (tried) return reject();
          tried = true;
          fetch('products_cache.json', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (data) {
              if (data && data.products) resolve(data.products);
              else reject();
            })
            .catch(function () { reject(); });
          return;
        }
        var base = URLS[i++];
        fetch(base + '/api/products', {
          method: 'GET', headers: { 'Accept': 'application/json' },
          mode: 'cors', credentials: 'omit', cache: 'no-store'
        })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (data) {
            if (data && data.products) resolve(data.products);
            else next();
          })
          .catch(next);
      }
      next();
    });
  }
  function loadAndRender() {
    fetchProducts()
      .then(function (list) {
        cacheSave(list);
        renderProducts(list);
        if (typeof window.syncControlPrices === 'function') window.syncControlPrices(true);
      })
      .catch(function () {
        var cached = cacheLoad();
        if (cached.length) renderProducts(cached);
      });
  }
  // Event delegation برای دکمه‌های کارت‌های داینامیک
  function bindDelegation() {
    // سبد و مشاهده از هسته صفحه مدیریت می‌شود — از دوبار کلیک جلوگیری
    if (document.body.dataset.productDelegate === '1') return;
    document.body.dataset.productDelegate = '1';
  }
  function productFromCard(card) {
    var img = card.querySelector('.product-img img, img');
    return {
      id: card.getAttribute('data-id') || card.getAttribute('data-sku') || '',
      sku: card.getAttribute('data-sku') || card.getAttribute('data-id') || '',
      name: card.getAttribute('data-name') || '',
      price: parseInt(card.getAttribute('data-price') || '0', 10) || 0,
      image: (img && img.getAttribute('src')) || card.getAttribute('data-image') || '',
      video: card.getAttribute('data-video') || '',
      desc: card.getAttribute('data-desc') || '',
      stock: parseInt(card.getAttribute('data-stock') || '5', 10) || 5
    };
  }
  // function bindCardButtons(root) {
  //   (root || document).querySelectorAll('.product[data-from-control="1"]').forEach(function (card) {
  //     // always rebind so after cart core loads it still works
  //     card.dataset.btnBound = '1';
  //     card.querySelectorAll('.view-product-btn').forEach(function (btn) {
  //       btn.onclick = function (e) {
  //         e.preventDefault();
  //         var product = productFromCard(card);
  //         if (typeof window.openProductModal === 'function') window.openProductModal(product);
  //       };
  //     });
  //     card.querySelectorAll('.btn-buy, .add-to-cart-btn').forEach(function (btn) {
  //       btn.onclick = function (e) {
  //         e.preventDefault();
  //         var product = productFromCard(card);
  //         if (typeof window.addToCart === 'function') window.addToCart(product, 1);
  //       };
  //     });
  //   });
  // }
function bindCardButtons(root) {
  (root || document).querySelectorAll('.product[data-from-control="1"]').forEach(function (card) {
    // جلوگیری از اتصال مجدد برای جلوگیری از سنگین شدن سایت
    if (card.dataset.btnBound === '1') return;
    card.dataset.btnBound = '1';

    // --- بخش حیاتی: چک کردن موجودی بلافاصله بعد از رندر شدن ---
    // فرض می‌کنیم موجودی در ویژگی data-stock ذخیره شده است
    var stock = parseInt(card.getAttribute('data-stock')) || 0;

    if (stock <= 0) {
      // ۱. اضافه کردن کلاس برای قفل شدن (CSS باید این کلاس رو داشته باشه)
      card.classList.add('out-of-stock');

      // ۲. تغییر متن قیمت به ناموجود
      var priceElement = card.querySelector('.price');
      if (priceElement) {
        priceElement.innerHTML = '<span class="out-of-stock-text">ناموجود</span>';
      }

      // ۳. غیرفعال کردن دکمه‌های خرید و مشاهده
      card.querySelectorAll('.btn-buy, .add-to-cart-btn, .view-product-btn').forEach(function(btn) {
        btn.disabled = true;
        btn.style.pointerEvents = 'none'; // اطمینان از عدم کلیک
      });
    }
    // -------------------------------------------------------

    // اتصال دکمه مشاهده محصول
    card.querySelectorAll('.view-product-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        var product = productFromCard(card);
        if (typeof window.openProductModal === 'function') window.openProductModal(product);
      };
    });

    // اتصال دکمه خرید
    card.querySelectorAll('.btn-buy, .add-to-cart-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        var product = productFromCard(card);
        if (typeof window.addToCart === 'function') {
          window.addToCart(product, 1);
        }
      };
    });
  });
}


  function boot() {
    bindDelegation();
    // اول از کش (حتی اگر برنامه بسته بود)
    try {
      var cached = cacheLoad();
      if (cached && cached.length) renderProducts(cached);
    } catch (e) {}
    loadAndRender();
    bindCardButtons(document);
    (function smartPoll(){
      var t = null;
      function tick(){
        if (document.visibilityState === 'hidden') return;
        loadAndRender();
        setTimeout(function(){ if (typeof bindCardButtons==='function') bindCardButtons(document); }, 150);
      }
      function schedule(){
        if (t) clearInterval(t);
        t = setInterval(tick, document.visibilityState==='hidden' ? 30000 : 6000);
      }
      document.addEventListener('visibilitychange', function(){ schedule(); if(document.visibilityState==='visible') tick(); });
      schedule();
      setTimeout(tick, 800);
    })();
    document.addEventListener('forever-products-rendered', function () {
      bindCardButtons(document);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        loadAndRender();
        setTimeout(function () { bindCardButtons(document); }, 300);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.renderControlProducts = loadAndRender;
})();




/** اتصال تنظیمات بنر / تخفیف / شمارش‌معکوس از مرکز کنترل */
(function () {
  if (window.__ForeverSiteSettingsBound) return;
  window.__ForeverSiteSettingsBound = true;

  var URLS = [
    'http://127.0.0.1:5000', 'http://localhost:5000',
    'http://127.0.0.1:5001', 'http://localhost:5001'
  ];
  var lastSig = '';

  function fa(n) {
    try { return Math.round(Number(n) || 0).toLocaleString('fa-IR'); } catch (e) { return String(n || 0); }
  }

  function parseEnd(s) {
    if (!s) return null;
    // "YYYY-MM-DD HH:MM:SS" or ISO
    var t = Date.parse(String(s).replace(/-/g, '/'));
    if (!isNaN(t)) return t;
    t = Date.parse(String(s));
    return isNaN(t) ? null : t;
  }

  function applyBanner(s) {
    var enabled = s.banner_enabled !== false && s.banner_enabled !== 0 && s.banner_enabled !== '0';
    var section = document.getElementById('foreverBanner');
    var track = document.getElementById('foreverBannerTrack');
    if (section) section.style.display = enabled ? '' : 'none';
    if (!enabled || !track) return;

    function normImg(p) {
      p = String(p || '').trim().replace(/\\/g, '/');
      if (!p || /^javascript:/i.test(p)) return '';
      if (/^[A-Za-z]:\//.test(p) || /:\/\//.test(p) && !/^https?:\/\//i.test(p)) {
        p = p.split('/').pop() || p;
      }
      if (/^[A-Za-z]:\//.test(String(p))) p = String(p).split('/').pop();
      return p;
    }

    var list = Array.isArray(s.slides) ? s.slides : [];
    list = list.filter(function (x) { return x && normImg(x.image); });
    if (!list.length && s.banner_image) {
      list = [{ image: s.banner_image, duration_ms: s.slider_default_ms || 4000, alt: 'بنر' }];
    }
    if (!list.length) return;

    var defMs = parseInt(s.slider_default_ms, 10) || 4000;
    var html = '';
    list.forEach(function (sl, idx) {
      var src = normImg(sl.image);
      var ms = parseInt(sl.duration_ms, 10) || defMs;
      if (ms < 1000) ms = defMs;
      var alt = String(sl.alt || ('اسلاید ' + (idx + 1))).replace(/"/g, '');
      html += '<div class="fs-slide" data-ms="' + ms + '" style="display:' + (idx === 0 ? 'block' : 'none') + ';width:100%;">' +
        '<img alt="' + alt + '" width="1200" height="480" ' + (idx === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"') +
        ' decoding="async" src="' + src.replace(/"/g, '') + '" ' +
        ' style="width:100%;max-height:480px;min-height:160px;object-fit:cover;display:block;background:#0b2f17;" ' +
        ' onerror="this.onerror=null;this.src=\'images/' + src.split('/').pop().replace(/'/g, '') + '\';">' +
        '</div>';
    });
    track.innerHTML = html;

    // ری‌استارت اسلایدر اگر تابع سراسری دارد
    try {
      if (typeof window.foreverRestartBannerSlider === 'function') {
        window.foreverRestartBannerSlider();
      } else {
        // اسلایدر ساده داخلی
        if (window.__fsTimer) clearTimeout(window.__fsTimer);
        var slides = track.querySelectorAll('.fs-slide');
        var ix = 0;
        function show(i) {
          slides.forEach(function (el, j) { el.style.display = j === i ? 'block' : 'none'; });
          var ms = parseInt(slides[i].getAttribute('data-ms') || defMs, 10) || defMs;
          window.__fsTimer = setTimeout(function () {
            ix = (i + 1) % slides.length;
            show(ix);
          }, ms);
        }
        if (slides.length) show(0);
      }
    } catch (e) {}
  }

  function applyShopCard(s) {
    var card = String(s.shop_card_number || '').trim();
    if (!card) return;
    var el = document.getElementById('shopCardNumber');
    if (el) el.textContent = card;
  }

  function applyCountdown(s) {
    var bar = document.getElementById('flashSaleCountdown');
    var enabled = !!(s.countdown_enabled === true || s.countdown_enabled === 1 || s.countdown_enabled === '1');
    if (bar) bar.style.display = enabled ? '' : 'none';
    if (!enabled) return;

    var hours = parseInt(s.countdown_hours, 10) || 72;
    var endMs = parseEnd(s.countdown_end);
    if (!endMs) {
      endMs = Date.now() + hours * 3600 * 1000;
    }
    try {
      localStorage.setItem('foreverFlashSaleEnd72', String(endMs));
      localStorage.setItem('foreverFlashSaleFromControl', '1');
    } catch (e) {}

    // درصد روی متن بنر تخفیف
    var disc = Number(s.global_discount_percent) || 0;
    if (bar) {
      if (s.festival_title) {
        var titleP = bar.querySelector('p');
        if (titleP) {
          var bolt = titleP.querySelector('.cd-bolt-icon');
          var boltHtml = bolt ? bolt.outerHTML + ' ' : '';
          titleP.innerHTML = boltHtml + String(s.festival_title).replace(/</g, '&lt;') +
            (s.discount_enabled && disc > 0
              ? ' <strong style="background:#fff;color:#b91c1c;padding:2px 10px;border-radius:20px;margin:0 6px;">' + fa(disc) + '٪</strong> تخفیف'
              : '');
        }
      } else if (s.discount_enabled && disc > 0) {
        var strong = bar.querySelector('strong');
        if (strong) strong.textContent = fa(disc) + '٪';
      }
    }

    // تیک فوری
    tickCountdown(endMs);
    if (window.__foreverCdTimer) clearInterval(window.__foreverCdTimer);
    window.__foreverCdTimer = setInterval(function () { tickCountdown(endMs); }, 1000);
  }

  function tickCountdown(endMs) {
    var left = Math.max(0, endMs - Date.now());
    var ended = document.getElementById('countdownEnded');
    var boxes = document.getElementById('countdownBoxes');
    if (left <= 0) {
      if (boxes) boxes.style.display = 'none';
      if (ended) ended.style.display = '';
      return;
    }
    if (boxes) boxes.style.display = 'flex';
    if (ended) ended.style.display = 'none';
    var sec = Math.floor(left / 1000);
    var d = Math.floor(sec / 86400); sec %= 86400;
    var h = Math.floor(sec / 3600); sec %= 3600;
    var m = Math.floor(sec / 60); sec %= 60;
    function set(id, v) {
      var el = document.getElementById(id);
      if (!el) return;
      var t = String(v).padStart(2, '0');
      if (el.textContent !== t) {
        el.textContent = t;
        el.classList.remove('tick');
        void el.offsetWidth;
        el.classList.add('tick');
      }
    }
    set('cdDays', d);
    set('cdHours', h);
    set('cdMins', m);
    set('cdSecs', sec);
  }

  function applyGlobalDiscount(s) {
    if (!(s.discount_enabled === true || s.discount_enabled === 1 || s.discount_enabled === '1')) return;
    var disc = Number(s.global_discount_percent) || 0;
    if (disc <= 0) return;
    document.querySelectorAll('.product').forEach(function (card) {
      // اگر از کنترل درصد جدا دارد، دست نزن مگر صفر باشد
      var own = parseInt(card.getAttribute('data-discount') || '0', 10) || 0;
      if (card.getAttribute('data-from-control') === '1' && own > 0) return;
      var oldP = parseInt(card.getAttribute('data-old-price') || card.getAttribute('data-price') || '0', 10) || 0;
      if (!oldP) return;
      var fin = Math.round(oldP * (100 - disc) / 100);
      card.setAttribute('data-old-price', String(oldP));
      card.setAttribute('data-price', String(fin));
      card.setAttribute('data-discount', String(disc));
      var box = card.querySelector('.price');
      if (!box) return;
      var metas = '';
      box.querySelectorAll('meta').forEach(function (m) {
        if (m.getAttribute('itemprop') === 'price') m.setAttribute('content', String(fin * 10));
        metas += m.outerHTML;
      });
      box.innerHTML = metas
        + '<span class="price-old" style="display:block;font-size:13px;color:#9ca3af;text-decoration:line-through;font-weight:600">' + fa(oldP) + ' تومان</span>'
        + '<span class="price-new" style="display:block;font-size:1.05rem;color:#b91c1c;font-weight:900">' + fa(fin) + ' تومان</span>'
        + '<span class="price-off-label" style="display:block;font-size:11px;color:#16a34a;font-weight:800">' + disc + '٪ تخفیف</span>';
      var badge = card.querySelector('.badge.off, .badge');
      if (badge) badge.textContent = disc + '٪';
    });
  }

  function applySettings(s) {
    if (!s || typeof s !== 'object') return;
    var sig = JSON.stringify(s);
    if (sig === lastSig) return;
    lastSig = sig;
    try { localStorage.setItem('foreverSiteSettings', sig); } catch (e) {}
    applyBanner(s);
    applyShopCard(s);
    applyCountdown(s);
    applyGlobalDiscount(s);
    window.__foreverSiteSettings = s;
  }

  function fetchSettings() {
    var i = 0;
    function next() {
      if (i >= URLS.length) {
        // فایل کنار سایت
        fetch('site_settings.json', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (d) {
            var s = d.settings || d;
            if (s) applySettings(s);
          })
          .catch(function () {
            try {
              var raw = localStorage.getItem('foreverSiteSettings');
              if (raw) applySettings(JSON.parse(raw));
            } catch (e) {}
          });
        return;
      }
      var base = URLS[i++];
      fetch(base + '/api/site-settings', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store'
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (d) {
          if (d && d.settings) applySettings(d.settings);
          else if (d && d.success === false) next();
          else if (d) applySettings(d);
        })
        .catch(next);
    }
    next();
  }

  function boot() {
    fetchSettings();
    setInterval(fetchSettings, 4000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') fetchSettings();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
