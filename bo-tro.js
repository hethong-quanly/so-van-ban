/* Tiện ích bổ trợ độc lập (không phụ thuộc mã React):
   1) Xin trình duyệt lưu trữ lâu dài (hạn chế iOS/Chrome tự xóa dữ liệu).
   2) Nhắc sao lưu nếu đã quá 7 ngày chưa xuất file.
   3) Thông báo khi có phiên bản mới (service worker). */
(function () {
  "use strict";
  var KEY = "svb-lan-sao-luu-cuoi";
  var SNOOZE = "svb-nhac-sao-luu-hoan";
  var NGAY = 864e5;
  function get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch (e) { return 0; } }
  function set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }

  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(function (ok) { if (!ok) navigator.storage.persist(); }).catch(function () {});
    }
  } catch (e) {}

  // Ghi nhận mỗi lần ứng dụng tải file xuống (xuất/sao lưu).
  function ghiNhan(a) { if (a && a.hasAttribute && a.hasAttribute("download")) set(KEY, Date.now()); }
  try {
    var goc = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { ghiNhan(this); return goc.apply(this, arguments); };
  } catch (e) {}
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    ghiNhan(t && t.closest ? t.closest("a[download]") : null);
  }, true);

  function thanhBao(noiDung, nut, khiBam) {
    var d = document.createElement("div");
    d.setAttribute("role", "status");
    d.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;" +
      "max-width:min(92vw,520px);background:#1e5a8a;color:#fff;padding:10px 14px;border-radius:10px;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.25);font:14px/1.4 'Be Vietnam Pro',system-ui,sans-serif;display:flex;gap:10px;align-items:center";
    var p = document.createElement("span"); p.textContent = noiDung; p.style.flex = "1"; d.appendChild(p);
    function btn(txt, fn) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = txt;
      b.style.cssText = "border:0;border-radius:6px;padding:6px 10px;cursor:pointer;background:#fff;color:#1e5a8a;font:inherit;font-weight:600";
      b.onclick = function () { d.remove(); if (fn) fn(); }; d.appendChild(b);
    }
    if (nut) btn(nut, khiBam);
    btn("Đóng", null);
    document.body.appendChild(d);
  }

  function kiemTraSaoLuu() {
    var now = Date.now();
    if (!get(KEY)) { set(KEY, now); return; } // lần đầu: bắt đầu đếm
    if (now - get(KEY) < 7 * NGAY || now - get(SNOOZE) < NGAY) return;
    set(SNOOZE, now);
    thanhBao("Đã hơn 7 ngày bạn chưa xuất/sao lưu sổ. Nên xuất file (Excel/JSON) để phòng mất dữ liệu trên máy.", null, null);
  }
  window.addEventListener("load", function () { setTimeout(kiemTraSaoLuu, 4000); });

  if ("serviceWorker" in navigator) {
    var coSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (coSW) thanhBao("Đã có phiên bản mới của ứng dụng.", "Tải lại", function () { location.reload(); });
      coSW = true;
    });
  }
})();
