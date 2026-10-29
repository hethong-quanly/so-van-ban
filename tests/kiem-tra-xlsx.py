import sys, openpyxl, re
# Kiểm: số đến tăng dần; mỗi ô gộp cột H là 1 đoạn liền nhau cùng nơi nhận; không còn 2 dòng liền nhau cùng nơi nhận mà chưa gộp.
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb.active
H = 3
mr = [m for m in ws.merged_cells.ranges if m.min_col == 8]
def num(v):
    m = re.match(r"\s*(\d+)", str(v or "")); return int(m.group(1)) if m else 10**9
sos = [num(ws.cell(i, 2).value) for i in range(H + 1, ws.max_row + 1)]
bad = 0 if sos == sorted(sos) else 1
spans = {m.min_row: m.max_row for m in mr}; r = H + 1; prev = None
while r <= ws.max_row:
    end = spans.get(r, r); v = str(ws.cell(r, 8).value or "").strip().upper()
    for i in range(r + 1, end + 1):
        if ws.cell(i, 8).value not in (None, ""): bad += 1
    if v and v == prev: bad += 1
    prev = v; r = end + 1
print("Dòng:", ws.max_row - H, "| ô gộp H:", len(mr), "| autofilter:", ws.auto_filter.ref, "| màu:", ws.cell(H + 1, 2).font.color.rgb if ws.cell(H+1,2).font.color else None)
print("Lỗi:", bad); sys.exit(1 if bad else 0)
