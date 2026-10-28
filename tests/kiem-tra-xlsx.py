import sys, openpyxl, re
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb.active
H = 3  # dòng tiêu đề, tên cột, số cột
mr = [m for m in ws.merged_cells.ranges if m.min_col == 8]
print("Số dòng dữ liệu:", ws.max_row - H, "| số ô gộp cột Đơn vị nhận:", len(mr))
def num(v):
    m = re.match(r"\s*(\d+)", str(v or "")); return int(m.group(1)) if m else 10**9
seen = {}; bad = 0; r = H + 1; blank_started = False
spans = {m.min_row: m.max_row for m in mr}
while r <= ws.max_row:
    end = spans.get(r, r); v = str(ws.cell(r, 8).value or "").strip()
    sos = [num(ws.cell(i, 2).value) for i in range(r, end + 1)]
    if sos != sorted(sos): bad += 1
    k = v.upper()
    if not k: blank_started = True
    elif blank_started or k in seen: bad += 1
    seen[k] = 1
    for i in range(r + 1, end + 1):
        if ws.cell(i, 8).value not in (None, ""): bad += 1
    r = end + 1
PH = ["P1","P2","P7","P9","P10","P11"]
order = [k for k in seen if k]
idx = [PH.index(k) if k in PH else 99 for k in order]
if idx != sorted(idx): bad += 1; print("Sai thứ tự nhóm:", order)
print("Thứ tự nhóm:", order[:10])
print("Lỗi:", bad); print("Ví dụ:", [(str(m), ws.cell(m.min_row, 8).value) for m in mr[:5]])
sys.exit(1 if bad else 0)
