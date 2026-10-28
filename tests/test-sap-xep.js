const assert = require("assert");
const S = require("../sap-xep.js");
const r = (soDen, nguoiNhan = "", ngayNhan = "2026-01-01") => ({ soDen, nguoiNhan, ngayNhan });
// 1. Sắp số đến tăng dần, hiểu số
let a = [r("100"), r("12"), r("9"), r("12A"), r("abc"), r("12", "", "2025-12-31")].sort(S.soSanhSoDen);
assert.deepStrictEqual(a.map(x => x.soDen + "@" + x.ngayNhan.slice(0, 4)), ["9@2026", "12@2025", "12@2026", "12A@2026", "100@2026", "abc@2026"]);
// 2. Gom nơi nhận
const rows = [r("5", "P 9"), r("1", "P2"), r("3", " p9 "), r("2", ""), r("4", "P2"), r("7", "P9"), r("6", "P5"), r("8", "  ")];
const g = S.nhomNoiNhan(rows);
assert.deepStrictEqual(g.rows.map(x => x.soDen), ["1", "4", "3", "5", "7", "6", "2", "8"]);
assert.deepStrictEqual(g.merges, [{ start: 0, len: 2, value: "P2" }, { start: 2, len: 3, value: "P9" }]);
assert.strictEqual(S.nhomNoiNhan([]).rows.length, 0);
// 3. Cơ quan ban hành
const m = { "TAND khu vực 5": "TAND KV5", "Tòa án nhân dân Khu vực 12": "TAND KV12", "TAND KV 3": "TAND KV3", "TAND TP. Cần Thơ": "TAND TP.CT",
  "Tòa phúc thẩm TANDTC tại TP.HCM": "TPT TANDTC tại TP.HCM", "VKS KV2": "VKS KV2", "TAND KV15": "TAND KV15", "Công an quận Ninh Kiều": "Công an quận Ninh Kiều" };
for (const k in m) assert.strictEqual(S.chuanCoQuan(k), m[k], k);
assert.strictEqual(S.CO_QUAN.length, 16);
assert.strictEqual(S.chuanTruong({ noiGui: "TAND khu vực 1" }).noiGui, "TAND KV1");
console.log("TẤT CẢ TEST SẮP XẾP ĐẠT");
// 4. Phòng nhận
for (const [k, v] of [["P 9", "P9"], ["p9", "P9"], ["Phòng 9", "P9"], ["P.9", "P9"], ["phong 10", "P10"], [" P11 ", "P11"], ["TTr - KT", "TTr - KT"], ["", ""]]) assert.strictEqual(S.chuanNoiNhan(k), v, k);
assert.deepStrictEqual(S.PHONG, ["P1", "P2", "P7", "P9", "P10", "P11"]);
assert.strictEqual(S.chuanTruong({ donVi: "Phòng 7" }).donVi, "P7");
const g2 = S.nhomNoiNhan([r("1", "TTr - KT"), r("2", "P 9"), r("3", "Phòng 1"), r("4", "p9"), r("5", ""), r("6", "P11"), r("7", "ttr - kt"), r("8", "P1"), r("9", "Trả về Tòa")]);
assert.deepStrictEqual(g2.rows.map(x => x.soDen), ["3", "8", "2", "4", "6", "1", "7", "9", "5"]);
assert.deepStrictEqual(g2.merges, [{ start: 0, len: 2, value: "P1" }, { start: 2, len: 2, value: "P9" }, { start: 5, len: 2, value: "TTr - KT" }]);
console.log("TEST PHÒNG NHẬN ĐẠT");
