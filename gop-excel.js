/* Gộp dữ liệu Excel vào sổ, chống trùng (vá cho bản build, không có mã nguồn React).
   Khóa chính: year | chuẩn hóa(soDen). Khóa phụ: chuẩn hóa(soKyHieu) | ngayBanHanh | chuẩn hóa(noiGui).
   Khi trùng: chỉ điền trường còn trống; khác giá trị thì giữ bản trong app (đếm xung đột).
   Ô trống trong Excel không bao giờ ghi đè. */
(function (root) {
  "use strict";
  var FIELDS = ["ngayNhan", "noiGui", "soKyHieu", "ngayBanHanh", "loai", "trichYeu", "nguoiNhan", "kyNhan", "ghiChu"];
  function str(v) { return v == null ? "" : String(v); }
  function rong(v) { return str(v).trim() === ""; }
  function normSoDen(v) {
    var s = str(v).trim().replace(/\s+/g, "").toLowerCase();
    if (/^\d+(\.0+)?$/.test(s)) s = String(parseInt(s, 10));
    return s;
  }
  function normTxt(v) { return str(v).replace(/\s+/g, "").toLowerCase(); }
  function khoaChinh(r) { var s = normSoDen(r.soDen); return s ? r.year + "|" + s : ""; }
  function khoaPhu(r) {
    var k = normTxt(r.soKyHieu), n = str(r.ngayBanHanh).trim();
    return k && n ? k + "|" + n + "|" + normTxt(r.noiGui) : "";
  }
  function gop(records, rows, opt) {
    opt = opt || {};
    var vt = opt.normLoai || function (x) { return x; };
    var newId = opt.newId || function () { return "vb-" + Date.now() + "-" + Math.random().toString(16).slice(2); };
    var now = opt.now || function () { return new Date().toISOString(); };
    var out = records.slice(), m1 = new Map(), m2 = new Map();
    function index(r, i) { var a = khoaChinh(r), b = khoaPhu(r); if (a && !m1.has(a)) m1.set(a, i); if (b && !m2.has(b)) m2.set(b, i); }
    out.forEach(index);
    var kq = { added: 0, duplicates: 0, filled: 0, conflicts: 0, skipped: 0 };
    (rows || []).forEach(function (row) {
      var r = {}; for (var k in row) r[k] = row[k];
      r.soDen = normSoDen(row.soDen) === "" ? "" : str(row.soDen).trim().replace(/\s+/g, "");
      if (/^\d+(\.0+)?$/.test(r.soDen)) r.soDen = normSoDen(r.soDen);
      if (!rong(r.loai)) r.loai = vt(r.loai);
      var a = khoaChinh(r), b = khoaPhu(r);
      if (!a && !b) { kq.skipped++; return; }
      var idx = a && m1.has(a) ? m1.get(a) : (b && m2.has(b) ? m2.get(b) : undefined);
      if (idx === undefined) {
        var moi = {}; for (var k2 in r) moi[k2] = r[k2];
        moi.id = newId(); moi.createdAt = now(); moi.rev = now();
        out.push(moi); index(moi, out.length - 1); kq.added++; return;
      }
      var cu = out[idx], sua = null, xd = false;
      FIELDS.concat(rong(cu.soDen) ? ["soDen"] : []).forEach(function (f) {
        if (rong(r[f])) return;
        if (rong(cu[f])) { sua = sua || Object.assign({}, cu); sua[f] = r[f]; }
        else if (normTxt(cu[f]) !== normTxt(r[f]) && !(f === "soDen" && normSoDen(cu[f]) === normSoDen(r[f]))) xd = true;
      });
      if (xd) kq.conflicts++;
      if (sua) { sua.rev = now(); out[idx] = sua; index(sua, idx); kq.filled++; }
      else if (!xd) kq.duplicates++;
    });
    return { records: out, result: kq };
  }
  var api = { gop: gop, normSoDen: normSoDen, khoaChinh: khoaChinh, khoaPhu: khoaPhu };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.__svbGop = api;
})(typeof window !== "undefined" ? window : globalThis);
