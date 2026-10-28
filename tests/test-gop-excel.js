const assert=require('assert');const {gop,normSoDen}=require('../gop-excel.js');
let n=0;const o={newId:()=>'id'+(++n),now:()=>'T',normLoai:x=>x.toUpperCase()};
assert.equal(normSoDen(' 0 12 '),'12');assert.equal(normSoDen('12.0'),'12');assert.equal(normSoDen('12A'),'12a');
const cu=[{id:'a',year:2026,soDen:'12',soKyHieu:'132/QĐ',ngayBanHanh:'2026-01-02',noiGui:'TAND KV 5',trichYeu:'Hoãn',kyNhan:'Lan',ghiChu:''},
          {id:'b',year:2026,soDen:'13 ',soKyHieu:'',ngayBanHanh:'',noiGui:'TAND',trichYeu:'X'}];
const rows=[{year:2026,soDen:12,soKyHieu:'132/QĐ',ngayBanHanh:'2026-01-02',noiGui:'TAND KV 5',trichYeu:'Hoãn',kyNhan:'',ghiChu:''}, // trùng, ô trống
 {year:2026,soDen:'012.0',trichYeu:'Khác',ghiChu:'mới'}, // xung đột + điền ghiChu
 {year:2026,soDen:'13',soKyHieu:'5/TB',ngayBanHanh:'2026-02-01'}, // điền thêm
 {year:2026,soDen:'',soKyHieu:'132 / qđ',ngayBanHanh:'2026-01-02',noiGui:'tand kv5'}, // khóa phụ -> trùng
 {year:2026,soDen:'14',loai:'qđ',trichYeu:'Mới'},{year:2026,soDen:'14'}, // mới + trùng trong chính file
 {year:2026,soDen:'',soKyHieu:''}];
const {records,result}=gop(cu,rows,o);console.log(result);
assert.deepEqual(result,{added:1,duplicates:3,filled:2,conflicts:1,skipped:1});
assert.equal(records.length,3);const a=records.find(r=>r.id==='a');
assert.equal(a.kyNhan,'Lan');assert.equal(a.trichYeu,'Hoãn');assert.equal(a.ghiChu,'mới');
assert.equal(records.find(r=>r.id==='b').soKyHieu,'5/TB');assert.equal(records[2].loai,'QĐ');
assert.equal(cu[0].ghiChu,'');// không sửa mảng gốc (cho hoàn tác)
console.log('TẤT CẢ TEST ĐẠT');
