/* Đồng bộ nhiều máy qua Supabase + đọc chữ viết tay bằng Gemini (Edge Function ocr-gemini).
   Vá cho bản build: cần bundle gán window.__svbStore (zustand) và gọi window.__svbOcrGemini. */
(function () {
  "use strict";
  var URL_SB = "https://urvgfsirrglwmaaggtgt.supabase.co";
  // Khóa công khai (anon). An toàn khi nhúng: dữ liệu được bảo vệ bằng RLS + danh sách email được phép.
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydmdmc2lycmdsd21hYWdndGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDMxMjksImV4cCI6MjA5NzMxOTEyOX0.H-gPtZlFp2SeCknfeyzmhg7MH8MwygFUoE_WM25qnRU";
  var BANG = "so_van_ban", CHU_KY = 30000, TRANG = 1000;
  var REDIRECT = location.origin + location.pathname.replace(/[^/]*$/, "");
  var D = window.__svbDongBo;
  if (!window.supabase || !D) return;
  var sb = window.supabase.createClient(URL_SB, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "svb-auth" } });
  var LS = { daDay: "svb-dongbo-daday", moc: "svb-dongbo-moc", daDua: "svb-dongbo-dadua", email: "svb-dongbo-email" };
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
      var o = el("input", { type: "email", placeholder: "email@...", autocomplete: "email", style: "width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #ccc;border-radius:8px" });
      o.value = doc(LS.email, "");
      var ma = el("input", { inputmode: "numeric", placeholder: "Mã 6 số trong email (nếu có)", style: "width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border:1px solid #ccc;border-radius:8px" });
      bang.appendChild(o);
      bang.appendChild(nutB("Gửi link đăng nhập", function () { guiLink(o.value); }));
      bang.appendChild(ma);
      bang.appendChild(nutB("Đăng nhập bằng mã", function () { nhapMa(o.value, ma.value); }, true));
      bang.appendChild(el("div", { style: "font-size:12px;color:#555;margin-top:8px" }, ["Chỉ email đã được cấp quyền mới xem và ghi được sổ chung. Nếu cài app trên iPhone, mở link trong Safari sẽ không vào app được: hãy dùng mã 6 số."]));
      return;
    }
    bang.appendChild(el("div", { style: "margin-top:4px;color:#374151" }, ["Đăng nhập: " + (phien.user && phien.user.email || "")]));
    if (duocPhep === false) { bang.appendChild(el("div", { style: "color:#b91c1c;margin-top:6px" }, ["Email này chưa được cấp quyền. Nhờ người quản lý thêm email vào danh sách."])); }
    if (duocPhep && !doc(LS.daDua, false)) {
      bang.appendChild(el("div", { style: "margin-top:8px" }, ["Máy này chưa đưa sổ lên kho chung. Bấm nút dưới để gộp sổ trên máy với kho (tự bỏ văn bản trùng)."]));
      bang.appendChild(nutB("Đưa sổ trên máy này lên kho chung", duaLen));
    }
    if (duocPhep && doc(LS.daDua, false)) bang.appendChild(nutB("Đồng bộ ngay", function () { dongBo(); }));
    bang.appendChild(nutB("Đăng xuất", dangXuat, true));
  }

  // ---------- Đăng nhập ----------
  function guiLink(email) {
    email = String(email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { thongBao = "Email chưa đúng."; return ve(); }
    ghi(LS.email, email); thongBao = "Đang gửi…"; ve();
    sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: REDIRECT } }).then(function (r) {
      thongBao = r.error ? "Không gửi được: " + r.error.message : "Đã gửi email đăng nhập tới " + email + ". Mở email và bấm link (hoặc nhập mã)."; ve();
    });
  }
  function nhapMa(email, ma) {
    email = String(email || "").trim().toLowerCase(); ma = String(ma || "").replace(/\D/g, "");
    if (!email || ma.length < 6) { thongBao = "Nhập email và mã trong email."; return ve(); }
    sb.auth.verifyOtp({ email: email, token: ma, type: "email" }).then(function (r) { thongBao = r.error ? "Mã không đúng hoặc đã hết hạn." : ""; ve(); });
  }
  function dangXuat() { sb.auth.signOut().then(function () { phien = null; duocPhep = null; datTT("Chưa đăng nhập", ""); }); }

  // ---------- Đồng bộ ----------
  function store() { return window.__svbStore; }
  function choStore() { return new Promise(function (ok) { (function c() { var s = store(); if (s && s.getState().hydrated !== false) return ok(s); setTimeout(c, 300); })(); }); }
  function kiemQuyen() { return sb.rpc("la_nguoi_duoc_phep").then(function (r) { duocPhep = !r.error && r.data === true; return duocPhep; }); }
  function taiVe(tu) {
    var tat = [];
    function trang(moc) {
      var q = sb.from(BANG).select("*").order("updated_at", { ascending: true }).limit(TRANG);
      if (moc) q = q.gt("updated_at", moc);
      return q.then(function (r) {
        if (r.error) throw r.error;
        tat = tat.concat(r.data);
        if (r.data.length === TRANG) return trang(r.data[r.data.length - 1].updated_at);
        return tat;
      });
    }
    return trang(tu);
  }
  function day(dongs) {
    var ps = [];
    for (var i = 0; i < dongs.length; i += 500) ps.push(sb.from(BANG).upsert(dongs.slice(i, i + 500), { onConflict: "id" }).then(function (r) { if (r.error) throw r.error; }));
    return Promise.all(ps);
  }
  function lui(moc) { if (!moc) return moc; var t = new Date(moc).getTime() - 60000; return new Date(t).toISOString(); } // chừa 1 phút cho giao dịch đến muộn
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
        if (dongs.length) ghi(LS.moc, dongs[dongs.length - 1].updated_at);
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
        ghi(LS.daDay, daDay); ghi(LS.moc, dongs.length ? dongs[dongs.length - 1].updated_at : null); ghi(LS.daDua, true);
        var k = g.ketQua; thongBao = "Xong: " + k.moi + " văn bản mới đưa lên, " + k.trung + " trùng, " + k.boSung + " được bổ sung, " + k.xungDot + " khác nhau (giữ bản trên kho).";
      });
    }).then(function () { return dongBo(); }, function (e) { datTT("Lỗi đồng bộ", "Lỗi: " + (e && e.message || e)); });
  }
  var hen = null;
  function henDay() { clearTimeout(hen); hen = setTimeout(dongBo, 2000); }
  function batDau() {
    choStore().then(function (S) { if (!batDau.sub) batDau.sub = S.subscribe(function (s, p) { if (s.records !== p.records && !dangChay) henDay(); }); });
  }
  sb.auth.onAuthStateChange(function (_ev, s) {
    phien = s;
    if (!s) { duocPhep = null; return datTT("Chưa đăng nhập"); }
    kiemQuyen().then(function (ok) {
      if (!ok) return datTT("Chưa được cấp quyền");
      if (!doc(LS.daDua, false)) { datTT("Chưa đưa sổ lên"); return moBang(); }
      batDau(); dongBo();
    });
  });
  setInterval(function () { if (document.visibilityState === "visible") dongBo(); }, CHU_KY);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") dongBo(); });
  window.addEventListener("online", function () { dongBo(); });
  window.addEventListener("load", function () { document.body.appendChild(nut); ve(); });
  if (document.body) { document.body.appendChild(nut); ve(); }

  // ---------- OCR bằng Gemini (khi có mạng + đã đăng nhập + được phép); lỗi thì app tự dùng Tesseract ----------
  var kqGemini = null;
  window.__svbOcrGemini = function (dataUrl, baoTien) {
    if (!phien || !duocPhep || !navigator.onLine) return Promise.resolve(null);
    baoTien && baoTien("Đang đọc chữ (cả chữ viết tay) bằng Gemini…");
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = setTimeout(function () { ctl && ctl.abort(); }, 45000);
    return sb.functions.invoke("ocr-gemini", { body: { image: dataUrl } }).then(function (r) {
      clearTimeout(t);
      var f = r && !r.error && r.data && r.data.fields;
      if (!f) return null;
      var txt = String(f.vanBan || "").trim();
      if (txt.length < 24) txt = [f.noiGui, f.soKyHieu, f.ngayBanHanh, f.loai, f.trichYeu].filter(Boolean).join("\n");
      kqGemini = { text: txt, fields: {
        soKyHieu: f.soKyHieu || "", ngayBanHanh: /^\d{4}-\d{2}-\d{2}$/.test(f.ngayBanHanh || "") ? f.ngayBanHanh : "",
        noiGui: f.noiGui || "", loai: f.loai || "", trichYeu: f.trichYeu || "", donVi: f.donVi || "",
        nguon: "ai", doTinCay: typeof f.doTinCay === "number" ? f.doTinCay : null,
        canhBao: "Đọc bằng Gemini (AI). Hãy đối chiếu với bản giấy trước khi ghi sổ." + (f.ghiChu ? " Bút phê: " + f.ghiChu : "") } };
      return kqGemini;
    }, function () { clearTimeout(t); return null; });
  };
  window.__svbTruongGemini = function (text) { return kqGemini && kqGemini.text === text ? kqGemini.fields : null; };
})();
