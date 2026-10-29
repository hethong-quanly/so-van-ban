/* Logic đồng bộ thuần (không phụ thuộc trình duyệt) để test bằng node.
   Quy tắc: so theo id; bản có rev mới hơn thắng (bằng nhau thì so updated_at).
   Không bao giờ xóa im lặng: xóa từ máy khác được đếm và báo; xóa hàng loạt bị chặn. */
(function (root) {
  "use strict";
  var COT = ["id", "year", "ngayNhan", "soDen", "noiGui", "soKyHieu", "ngayBanHanh", "loai", "trichYeu",
    "nguoiNhan", "kyNhan", "ghiChu", "nguon", "doTinCay", "createdAt", "rev"];
  var DIEN = ["ngayNhan", "soDen", "noiGui", "soKyHieu", "ngayBanHanh", "loai", "trichYeu", "nguoiNhan", "kyNhan", "ghiChu"];
  function s(v) { return v == null ? "" : String(v); }
  function rong(v) { return s(v).trim() === ""; }
  function sangDong(r, xoa) {
    var o = {};
    COT.forEach(function (c) { o[c] = r[c] === undefined ? null : r[c]; });
    o.year = r.year == null || r.year === "" ? null : parseInt(r.year, 10);
    o.doTinCay = typeof r.doTinCay === "number" && isFinite(r.doTinCay) ? r.doTinCay : null;
    ["ngayNhan", "soDen", "noiGui", "soKyHieu", "ngayBanHanh", "loai", "trichYeu", "nguoiNhan", "kyNhan", "ghiChu", "nguon", "createdAt", "rev"]
      .forEach(function (c) { if (o[c] != null) o[c] = s(o[c]); });
    o.deleted = !!xoa;
    return o;
  }
  function tuDong(d, cu) {
    var r = {}; if (cu) for (var k in cu) r[k] = cu[k];
    COT.forEach(function (c) { if (d[c] !== undefined && d[c] !== null) r[c] = d[c]; else if (!cu) r[c] = c === "doTinCay" ? null : ""; });
    return r;
  }
  // >0 nếu a mới hơn b
  function soSanh(aRev, aUpd, bRev, bUpd) {
    var x = s(aRev), y = s(bRev);
    if (x !== y) return x > y ? 1 : -1;
    x = s(aUpd); y = s(bUpd);
    return x === y ? 0 : (x > y ? 1 : -1);
  }
  /* Gộp các dòng tải về vào sổ trên máy.
     daDay: {id: rev} các bản đã đẩy/đã nhận lần trước. Trả về records mới + thống kê. */
  function gopTaiVe(records, dongs, daDay) {
    var out = records.slice(), viTri = new Map(), kq = { moi: 0, capNhat: 0, xoa: 0, giuMay: 0 };
    out.forEach(function (r, i) { viTri.set(r.id, i); });
    var boXoa = new Set();
    (dongs || []).forEach(function (d) {
      var i = viTri.get(d.id);
      if (i === undefined) {
        if (!d.deleted) { out.push(tuDong(d)); viTri.set(d.id, out.length - 1); kq.moi++; if (daDay) daDay[d.id] = s(d.rev); }
        return;
      }
      var cu = out[i];
      var c = soSanh(d.rev, "", cu.rev, "");
      if (d.deleted && c >= 0) { boXoa.add(d.id); kq.xoa++; if (daDay) delete daDay[d.id]; return; }
      else if (!d.deleted && c > 0) { out[i] = tuDong(d, cu); kq.capNhat++; }
      else if (c < 0) { kq.giuMay++; return; } // bản trên máy mới hơn: giữ, lần đẩy sau sẽ gửi lên
      if (daDay) daDay[d.id] = s(d.rev);
    });
    if (boXoa.size) out = out.filter(function (r) { return !boXoa.has(r.id); });
    return { records: out, ketQua: kq };
  }
  /* Những gì cần đẩy lên: bản mới/sửa (rev khác lần trước) + bản đã xóa trên máy.
     Nếu số bản biến mất > gioiHanXoa thì KHÔNG đẩy xóa (có thể do nạp lại sổ), báo chanXoa. */
  function canDay(records, daDay, gioiHanXoa, now) {
    var dongs = [], co = new Set();
    records.forEach(function (r) {
      if (!r || !r.id) return;
      co.add(r.id);
      if (daDay[r.id] !== s(r.rev)) dongs.push(sangDong(r, false));
    });
    var mat = Object.keys(daDay).filter(function (id) { return !co.has(id); });
    var chanXoa = mat.length > (gioiHanXoa == null ? 20 : gioiHanXoa);
    if (!chanXoa) mat.forEach(function (id) { dongs.push({ id: id, rev: now || new Date().toISOString(), deleted: true }); });
    return { dongs: dongs, matDi: mat.length, chanXoa: chanXoa };
  }
  /* Lần đầu đưa sổ của máy này lên kho chung: chống trùng bằng khóa của PR #2.
     remote: các bản (record) đang có trên kho; local: sổ trên máy. */
  function gopLanDau(local, remote, opt) {
    opt = opt || {};
    var G = opt.gop || root.__svbGop, now = opt.now || function () { return new Date().toISOString(); };
    var out = remote.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; });
    var theoId = new Map(), k1 = new Map(), k2 = new Map(), day = new Set();
    function idx(r, i) { theoId.set(r.id, i); var a = G.khoaChinh(r), b = G.khoaPhu(r); if (a && !k1.has(a)) k1.set(a, i); if (b && !k2.has(b)) k2.set(b, i); }
    out.forEach(idx);
    var kq = { trung: 0, boSung: 0, moi: 0, xungDot: 0 };
    local.forEach(function (l) {
      var i = theoId.get(l.id);
      if (i !== undefined) {
        if (soSanh(l.rev, "", out[i].rev, "") > 0) { out[i] = l; day.add(l.id); }
        kq.trung++; return;
      }
      var a = G.khoaChinh(l), b = G.khoaPhu(l);
      i = a && k1.has(a) ? k1.get(a) : (b && k2.has(b) ? k2.get(b) : undefined);
      if (i === undefined) { out.push(l); idx(l, out.length - 1); day.add(l.id); kq.moi++; return; }
      var r = out[i], sua = null, xd = false;
      DIEN.forEach(function (f) {
        if (rong(l[f])) return;
        if (rong(r[f])) { sua = sua || Object.assign({}, r); sua[f] = l[f]; }
        else if (s(r[f]).replace(/\s+/g, "").toLowerCase() !== s(l[f]).replace(/\s+/g, "").toLowerCase()
          && !(f === "soDen" && G.normSoDen(r[f]) === G.normSoDen(l[f]))) xd = true;
      });
      if (xd) kq.xungDot++;
      if (sua) { sua.rev = now(); out[i] = sua; day.add(sua.id); kq.boSung++; } else kq.trung++;
    });
    return { records: out, dongs: out.filter(function (r) { return day.has(r.id); }).map(function (r) { return sangDong(r, false); }), ketQua: kq };
  }
  var api = { COT: COT, sangDong: sangDong, tuDong: tuDong, gopTaiVe: gopTaiVe, canDay: canDay, gopLanDau: gopLanDau };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.__svbDongBo = api;
})(typeof window !== "undefined" ? window : globalThis);
