const assert=require('assert');require('../gop-excel.js');const D=require('../dong-bo-logic.js');
// gopTaiVe
const loc=[{id:'a',soDen:'1',rev:'2026-01-02',canhBao:'x'},{id:'b',soDen:'2',rev:'2026-01-05'},{id:'c',soDen:'3',rev:'2026-01-01'},{id:'d',soDen:'4',rev:'2026-01-01'}];
const dd={a:'2026-01-02',b:'2026-01-05',c:'2026-01-01',d:'2026-01-01'};
const rem=[{id:'a',soDen:'1 sửa',rev:'2026-01-03',deleted:false},{id:'b',soDen:'cũ',rev:'2026-01-04',deleted:false},
 {id:'c',rev:'2026-01-02',deleted:true},{id:'d',rev:'2025-12-31',deleted:true},{id:'e',soDen:'5',rev:'2026-01-01',deleted:false,year:2026},{id:'f',rev:'x',deleted:true}];
let r=D.gopTaiVe(loc,rem,dd);
assert.deepEqual(r.ketQua,{moi:1,capNhat:1,xoa:1,giuMay:2});
assert.equal(r.records.find(x=>x.id==='a').soDen,'1 sửa');assert.equal(r.records.find(x=>x.id==='a').canhBao,'x');
assert.equal(r.records.find(x=>x.id==='b').soDen,'2');assert.ok(!r.records.find(x=>x.id==='c'));assert.ok(r.records.find(x=>x.id==='d'));
assert.ok(!r.records.find(x=>x.id==='f'));assert.equal(dd.c,undefined);assert.equal(dd.e,'2026-01-01');
assert.equal(loc.length,4);// không sửa mảng gốc
// canDay: chỉ bản đổi + xóa trên máy; chặn xóa hàng loạt
let p=D.canDay(r.records,dd,20,'NOW');
assert.deepEqual(p.dongs.map(x=>x.id).sort(),[]);// a,b? b rev=01-05 == dd.b, d unchanged
const rec2=r.records.filter(x=>x.id!=='e').concat([{id:'g',soDen:'7',rev:'R',year:'2026',doTinCay:'abc'}]);
p=D.canDay(rec2,dd,20,'NOW');
assert.deepEqual(p.dongs.map(x=>x.id+':'+x.deleted).sort(),['e:true','g:false']);
const g=p.dongs.find(x=>x.id==='g');assert.equal(g.year,2026);assert.equal(g.doTinCay,null);
p=D.canDay([],dd,1,'NOW');assert.ok(p.chanXoa);assert.equal(p.dongs.length,0);
// gopLanDau: hai máy cùng nạp sổ mẫu với id khác nhau -> không nhân đôi
const remote=[{id:'r1',year:2026,soDen:'12',soKyHieu:'132/QĐ',ngayBanHanh:'2026-01-02',noiGui:'TAND',trichYeu:'Hoãn',kyNhan:'',rev:'1'},
 {id:'r2',year:2026,soDen:'13',trichYeu:'A',rev:'1'}];
const local=[{id:'l1',year:2026,soDen:'012',soKyHieu:'132/QĐ',ngayBanHanh:'2026-01-02',noiGui:'TAND',trichYeu:'Hoãn',kyNhan:'Lan',rev:'1'},
 {id:'l2',year:2026,soDen:'',soKyHieu:'132 / qđ',ngayBanHanh:'2026-01-02',noiGui:'tand',rev:'1'},
 {id:'l3',year:2026,soDen:'13',trichYeu:'B',rev:'1'},{id:'l4',year:2026,soDen:'14',rev:'1'},{id:'r2',year:2026,soDen:'13',trichYeu:'A2',rev:'2'}];
const L=D.gopLanDau(local,remote,{now:()=>'NOW'});
console.log(L.ketQua);
assert.equal(L.records.length,3);assert.equal(L.records[0].kyNhan,'Lan');assert.equal(L.records[0].rev,'NOW');
assert.equal(L.records[1].trichYeu,'A2');
assert.deepEqual(L.dongs.map(x=>x.id).sort(),['l4','r1','r2']);
assert.deepEqual(L.ketQua,{trung:3,boSung:1,moi:1,xungDot:1});
console.log('TẤT CẢ TEST ĐỒNG BỘ ĐẠT');
