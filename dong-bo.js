/* Đồng bộ nhiều máy qua Firebase (Firestore) với MỘT mật khẩu chung cho cả phòng.
   Mỗi máy chỉ nhập mật khẩu một lần; trình duyệt nhớ đăng nhập. Logic gộp/chống trùng giữ nguyên (dong-bo-logic.js). */
(function () {
  "use strict";
  var CAU_HINH = { apiKey: "AIzaSyCqpgf7mqjwW58qvljDSjJD1afnjLlF9fo", authDomain: "kiemtra-nghiepvu.firebaseapp.com", projectId: "kiemtra-nghiepvu",
    storageBucket: "kiemtra-nghiepvu.firebasestorage.app", messagingSenderId: "589960693059", appId: "1:589960693059:web:2be258ccd93552eb21dbf6" };
  // Tài khoản nội bộ cố định; người dùng chỉ thấy ô mật khẩu. Dữ liệu được khóa bằng luật Firestore theo đúng tài khoản này.
  var EMAIL_SO = "so-van-ban@kiemtra-nghiepvu.local";
  var BANG = "so_van_ban", CHU_KY = 30000, TRANG = 1000;
  var D = window.__svbDongBo;
  if (!window.firebase || !D) return;
  var app = firebase.initializeApp(CAU_HINH), auth = app.auth(), db = app.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
  var LS = { daDay: "svb-fb-daday", moc: "svb-fb-moc", daDua: "svb-fb-dadua" };
  function doc(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function ghi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var phien = null, duocPhep = null, dangChay = false, lanNua = false, trangThai = "Chưa đăng nhập", loiCuoi = "", thongBao = "";

  // ---------- Giao diện (chỉ dùng textContent, không chèn HTML từ dữ liệu) ----------
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "style") e.style.cssText = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  var nut = el("button", { type: "button", "aria-live": "polite", title: "Đồng bộ kho chung",
    style: "position:fixed;left:10px;bottom:10px;z-index:9998;border:0;border-radius:999px;padding:6px 12px;font:600 13px system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer;color:#fff;background:#6b7280",
    onclick: function () { moBang(); } });
  var bang = null;
  function mau() { return { "Đã đồng bộ": "#15803d", "Đang đồng bộ": "#1e5a8a", "Chưa đăng nhập": "#6b7280" }[trangThai] || "#b45309"; }
  function ve() {
    nut.textContent = (trangThai === "Đã đồng bộ" ? "✓ " : trangThai === "Đang đồng bộ" ? "⟳ " : "● ") + trangThai;
    nut.style.background = mau();
    if (bang) veBang();
  }
  function datTT(t, loi) { trangThai = t; if (loi !== undefined) loiCuoi = loi; ve(); }
  function dong() { if (bang) { bang.remove(); bang = null; } }
  function moBang() { if (!bang) { bang = el("div", { role: "dialog", "aria-label": "Kho chung", style: "position:fixed;left:10px;bottom:52px;z-index:9999;width:min(360px,calc(100vw - 20px));background:#fff;color:#111;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.3);padding:14px;font:14px system-ui,sans-serif" }); document.body.appendChild(bang); } veBang(); }
  function nutB(txt, fn, phu) { return el("button", { type: "button", onclick: fn, style: "margin:6px 6px 0 0;padding:7px 10px;border-radius:8px;border:1px solid #1e5a8a;cursor:pointer;" + (phu ? "background:#fff;color:#1e5a8a" : "background:#1e5a8a;color:#fff") }, [txt]); }
  function veBang() {
    bang.textContent = "";
    bang.appendChild(el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px" }, [el("strong", {}, ["Kho chung (đồng bộ nhiều máy)"]), el("button", { type: "button", "aria-label": "Đóng", onclick: dong, style: "border:0;background:none;font-size:20px;cursor:pointer" }, ["×"])]));
    bang.appendChild(el("div", {}, ["Trạng thái: " + trangThai]));
    if (loiCuoi) bang.appendChild(el("div", { style: "color:#b91c1c;margin-top:4px" }, [loiCuoi]));
    if (thongBao) bang.appendChild(el("div", { style: "color:#374151;margin-top:4px" }, [thongBao]));
    if (!phien) {
      var o = el("input", { type: "password", placeholder: "Mật khẩu sổ", autocomplete: "current-password", style: "width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #ccc;border-radius:8px", onkeydown: function (e) { if (e.key === "Enter") dangNhap(o.value); } });
      bang.appendChild(o);
      bang.appendChild(nutB("Mở sổ chung", function () { dangNhap(o.value); }));
      bang.appendChild(el("div", { style: "font-size:12px;color:#555;margin-top:8px" }, ["Nhập mật khẩu chung của phòng một lần trên mỗi máy; máy sẽ nhớ, lần sau mở là có sổ."]));
      setTimeout(function () { o.focus(); }, 0);
      return;
    }
    bang.appendChild(el("div", { style: "margin-top:4px;color:#374151" }, ["Đã mở sổ chung trên máy này."]));
    if (duocPhep && !doc(LS.daDua, false)) {
      bang.appendChild(el("div", { style: "margin-top:8px" }, ["Máy này chưa đưa sổ lên kho chung. Bấm nút dưới để gộp sổ trên máy với kho (tự bỏ văn bản trùng)."]));
      bang.appendChild(nutB("Đưa sổ trên máy này lên kho chung", duaLen));
    }
    if (duocPhep && doc(LS.daDua, false)) bang.appendChild(nutB("Đồng bộ ngay", function () { dongBo(); }));
    bang.appendChild(nutB("Thoát sổ chung trên máy này", dangXuat, true));
  }

  // ---------- Đăng nhập bằng mật khẩu chung ----------
  function dangNhap(mk) {
    mk = String(mk || "");
    if (!mk) { thongBao = "Nhập mật khẩu."; return ve(); }
    thongBao = "Đang mở sổ…"; ve();
    auth.signInWithEmailAndPassword(EMAIL_SO, mk).then(function () { thongBao = ""; ve(); }, function (e) {
      var c = e && e.code || "";
      thongBao = /wrong-password|invalid-credential|invalid-login|user-not-found/.test(c) ? "Mật khẩu không đúng." : /too-many-requests/.test(c) ? "Nhập sai nhiều lần, chờ ít phút rồi thử lại." : /network/.test(c) ? "Không có mạng." : "Không mở được: " + (e && e.message || c);
      ve();
    });
  }
  function dangXuat() { if (!confirm("Thoát sổ chung trên máy này? Sổ trên máy vẫn giữ, lần sau cần nhập lại mật khẩu.")) return; auth.signOut(); }

  // ---------- Đồng bộ ----------
  function store() { return window.__svbStore; }
  function choStore() { return new Promise(function (ok) { (function c() { var s = store(); if (s && s.getState().hydrated !== false) return ok(s); setTimeout(c, 300); })(); }); }
  function msMoc(d) { var u = d.updatedAt; return u && u.toMillis ? u.toMillis() : 0; }
  function taiVe(tu) {
    var tat = [];
    function trang(sau) {
      var q = db.collection(BANG).orderBy("updatedAt").limit(TRANG);
      if (tu) q = q.where("updatedAt", ">", firebase.firestore.Timestamp.fromMillis(tu));
      if (sau) q = q.startAfter(sau);
      return q.get().then(function (snap) {
        snap.docs.forEach(function (x) { var d = x.data(); d._ms = msMoc(d); delete d.updatedAt; tat.push(d); });
        if (snap.size === TRANG) return trang(snap.docs[snap.size - 1]);
        return tat;
      });
    }
    return trang(null);
  }
  function day(dongs) {
    var ps = [];
    for (var i = 0; i < dongs.length; i += 400) {
      var b = db.batch();
      dongs.slice(i, i + 400).forEach(function (d) {
        var o = {}; for (var k in d) if (d[k] !== undefined) o[k] = d[k];
        o.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        b.set(db.collection(BANG).doc(String(d.id)), o);
      });
      ps.push(b.commit());
    }
    return Promise.all(ps);
  }
  function mocCuoi(dongs) { return dongs.length ? Math.max.apply(null, dongs.map(function (d) { return d._ms || 0; })) : null; }
  function lui(moc) { return moc ? moc - 60000 : null; } // chừa 1 phút cho giao dịch đến muộn
  function dongBo() {
    if (!phien || !duocPhep || !doc(LS.daDua, false)) return Promise.resolve();
    if (dangChay) { lanNua = true; return Promise.resolve(); }
    if (!navigator.onLine) { datTT("Mất mạng – sẽ đồng bộ lại"); return Promise.resolve(); }
    dangChay = true; datTT("Đang đồng bộ", "");
    return choStore().then(function (S) {
      var daDay = doc(LS.daDay, {}), moc = doc(LS.moc, null);
      return taiVe(lui(moc)).then(function (dongs) {
        var g = D.gopTaiVe(S.getState().records, dongs, daDay);
        if (g.ketQua.moi || g.ketQua.capNhat || g.ketQua.xoa) S.setState({ records: g.records, updatedAt: new Date().toISOString() });
        if (g.ketQua.xoa) thongBao = "Có " + g.ketQua.xoa + " văn bản đã bị xóa từ máy khác.";
        if (dongs.length) ghi(LS.moc, mocCuoi(dongs));
        ghi(LS.daDay, daDay);
        var c = D.canDay(S.getState().records, daDay, 20);
        if (c.chanXoa) thongBao = "Có " + c.matDi + " văn bản biến mất khỏi máy này cùng lúc nên KHÔNG xóa trên kho chung. Bấm Đồng bộ ngay để lấy lại.";
        if (c.chanXoa) { Object.keys(daDay).forEach(function (id) { if (!S.getState().records.some(function (r) { return r.id === id; })) delete daDay[id]; }); ghi(LS.moc, null); }
        return day(c.dongs).then(function () {
          c.dongs.forEach(function (d) { if (d.deleted) delete daDay[d.id]; else daDay[d.id] = d.rev; });
          ghi(LS.daDay, daDay);
        });
      });
    }).then(function () { datTT("Đã đồng bộ", ""); }, function (e) { datTT("Lỗi đồng bộ", "Lỗi: " + (e && e.message || e)); })
      .then(function () { dangChay = false; if (lanNua) { lanNua = false; dongBo(); } });
  }
  function duaLen() {
    var S = store(); if (!S || !duocPhep) return;
    var n = S.getState().records.length;
    if (!confirm("Đưa " + n + " văn bản trên máy này lên kho chung? Văn bản trùng (cùng năm + số đến, hoặc cùng số ký hiệu + ngày + nơi gửi) sẽ được gộp, không nhân đôi.")) return;
    datTT("Đang đồng bộ", "");
    taiVe(null).then(function (dongs) {
      var remote = dongs.filter(function (d) { return !d.deleted; }).map(function (d) { return D.tuDong(d); });
      var g = D.gopLanDau(S.getState().records, remote);
      return day(g.dongs).then(function () {
        var daDay = {}; g.records.forEach(function (r) { daDay[r.id] = String(r.rev == null ? "" : r.rev); });
        S.setState({ records: g.records, updatedAt: new Date().toISOString() });
        ghi(LS.daDay, daDay); ghi(LS.moc, mocCuoi(dongs)); ghi(LS.daDua, true);
        var k = g.ketQua; thongBao = "Xong: " + k.moi + " văn bản mới đưa lên, " + k.trung + " trùng, " + k.boSung + " được bổ sung, " + k.xungDot + " khác nhau (giữ bản trên kho).";
      });
    }).then(function () { return dongBo(); }, function (e) { datTT("Lỗi đồng bộ", "Lỗi: " + (e && e.message || e)); });
  }
  var hen = null;
  function henDay() { clearTimeout(hen); hen = setTimeout(dongBo, 2000); }
  function batDau() {
    choStore().then(function (S) { if (!batDau.sub) batDau.sub = S.subscribe(function (s, p) { if (s.records !== p.records && !dangChay) henDay(); }); });
  }
  auth.onAuthStateChanged(function (u) {
    phien = u ? { user: u } : null;
    if (!u) { duocPhep = null; return datTT("Chưa đăng nhập"); }
    duocPhep = u.email === EMAIL_SO;
    if (!duocPhep) return datTT("Chưa được cấp quyền");
    if (!doc(LS.daDua, false)) { datTT("Chưa đưa sổ lên"); return moBang(); }
    batDau(); dongBo();
  });
  setInterval(function () { if (document.visibilityState === "visible") dongBo(); }, CHU_KY);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") dongBo(); });
  window.addEventListener("online", function () { dongBo(); });
  window.addEventListener("load", function () { document.body.appendChild(nut); ve(); });
  if (document.body) { document.body.appendChild(nut); ve(); }

  // ---------- OCR: Gemini (qua Supabase) đã tắt khi chuyển sang Firebase; app tự dùng Tesseract ----------
  window.__svbOcrGemini = function () { return Promise.resolve(null); };
  window.__svbTruongGemini = function () { return null; };
})();
