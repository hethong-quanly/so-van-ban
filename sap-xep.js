/* Sắp xếp sổ đến, gom nơi nhận khi xuất Excel, danh sách cơ quan ban hành. Hàm thuần, chạy được cả trong Node. */
(function (g) {
  "use strict";
  var CO_QUAN = ["TAND TP.CT"];
  for (var k = 1; k <= 14; k++) CO_QUAN.push("TAND KV" + k);
  CO_QUAN.push("TPT TANDTC tại TP.HCM");
  var PHONG = ["P1", "P2", "P7", "P9", "P10", "P11"];

  function boDau(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase();
  }
  /** Đưa tên cơ quan về đúng một giá trị trong danh sách nếu nhận ra; không nhận ra thì giữ nguyên. */
  function chuanCoQuan(v) {
    var s = boDau(v).replace(/\s+/g, " ").trim();
    if (!s) return v || "";
    if (/\bVKS|VIEN KIEM SAT|CONG AN|\bCA\b|THI HANH AN|\bTHA\b/.test(s)) return v;
    var compact = s.replace(/[\s.\-_,]/g, "");
    if (/TPT|PHUCTHAM/.test(compact) && /TANDTC|TOIC?AO|TOAANNHANDANTOICAO/.test(compact)) return CO_QUAN[15];
    var m = /(?:KHU ?VUC|\bKV)\s*\.?\s*(\d{1,2})\b/.exec(s);
    if (m) { var n = +m[1]; if (n >= 1 && n <= 14) return "TAND KV" + n; return v; }
    if (/^(TAND|TOA AN NHAN DAN)\s*(TP|THANH PHO)\.?\s*(CT|CAN THO)\b/.test(s) || compact === "TANDTPCT") return CO_QUAN[0];
    return v;
  }
  /** "P 9", "p9", "Phòng 9", "P.9" -> "P9". Không nhận ra thì giữ nguyên (đã bỏ khoảng trắng thừa). */
  function chuanNoiNhan(v) {
    var t = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    var m = /^(?:P|PHONG)(\d{1,2})$/.exec(boDau(t).replace(/[\s.\-_]+/g, ""));
    return m ? "P" + (+m[1]) : t;
  }
  function chuanTruong(f) {
    if (f && f.donVi) { var d = chuanNoiNhan(f.donVi); if (d !== f.donVi) f = Object.assign({}, f, { donVi: d }); }
    if (f && f.noiGui) { var c = chuanCoQuan(f.noiGui); if (c !== f.noiGui) { f = Object.assign({}, f, { noiGui: c }); } }
    return f;
  }

  /** Khoá số đến: "12" < "100" < "100A"; số không đọc được xếp cuối. */
  function khoaSo(v) {
    var m = /^\s*(\d+)\s*([A-Za-z]*)\s*$/.exec(String(v == null ? "" : v));
    return m ? { ok: 0, n: +m[1], h: m[2].toUpperCase() } : { ok: 1, n: 0, h: String(v || "").trim() };
  }
  function soSanhSoDen(a, b) {
    var x = khoaSo(a.soDen), y = khoaSo(b.soDen);
    if (x.ok !== y.ok) return x.ok - y.ok;
    if (x.n !== y.n) return x.n - y.n;
    if (x.h !== y.h) return x.h < y.h ? -1 : 1;
    var d = (a.ngayNhan || "").localeCompare(b.ngayNhan || "");
    return d || (a.createdAt || "").localeCompare(b.createdAt || "");
  }
  function khoaNoiNhan(v) { return boDau(chuanNoiNhan(v)).replace(/[\s.]+/g, ""); }

  /** Gom các dòng cùng nơi nhận. Trả về rows đã sắp và merges [{start, len, value}] (chỉ nhóm >1 dòng). Dòng trống nơi nhận nằm cuối, không gộp. */
  function nhomNoiNhan(list) {
    var sorted = list.slice().sort(soSanhSoDen), groups = new Map(), blanks = [];
    sorted.forEach(function (r) {
      var key = khoaNoiNhan(r.nguoiNhan);
      if (!key) { blanks.push(r); return; }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    var rows = [], merges = [], thuTu = [];
    groups.forEach(function (g, key) { thuTu.push([key, g]); });
    var hang = function (key) { var i = PHONG.indexOf(key); return i < 0 ? PHONG.length : i; };
    thuTu.sort(function (a, b) { return hang(a[0]) - hang(b[0]); }); // sort ổn định: nhóm khác giữ thứ tự số đến nhỏ nhất
    thuTu.forEach(function (x) {
      var g = x[1];
      if (g.length > 1) merges.push({ start: rows.length, len: g.length, value: chuanNoiNhan(g[0].nguoiNhan) });
      rows.push.apply(rows, g);
    });
    rows.push.apply(rows, blanks);
    return { rows: rows, merges: merges };
  }

  var api = { CO_QUAN: CO_QUAN, PHONG: PHONG, chuanNoiNhan: chuanNoiNhan, chuanCoQuan: chuanCoQuan, chuanTruong: chuanTruong, soSanhSoDen: soSanhSoDen, nhomNoiNhan: nhomNoiNhan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (g) { g.__svbSapXep = api; g.__svbChuanCoQuan = chuanTruong; }
})(typeof window !== "undefined" ? window : null);
