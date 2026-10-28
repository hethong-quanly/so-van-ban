// ocr-gemini: đọc ảnh văn bản tố tụng (cả chữ viết tay) bằng Gemini, trả về các trường của sổ.
// Chỉ người dùng đã đăng nhập VÀ có email trong bảng nguoi_dung_duoc_phep mới gọi được.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODELS = [Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash", "gemini-flash-latest"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "OBJECT",
  properties: {
    soKyHieu: { type: "STRING", description: "Số, ký hiệu văn bản, ví dụ 132/2026/QĐ-TA. Rỗng nếu không thấy." },
    ngayBanHanh: { type: "STRING", description: "Ngày ban hành dạng YYYY-MM-DD. Rỗng nếu không thấy." },
    noiGui: { type: "STRING", description: "Cơ quan ban hành / nơi gửi, ví dụ TAND khu vực 5 - TP.HCM." },
    loai: { type: "STRING", description: "Loại văn bản viết tắt: QĐ, TB, CV, KL, BB, YC, GTT, CT, LĐ... hoặc tên loại." },
    trichYeu: { type: "STRING", description: "Trích yếu ngắn gọn nội dung, có tên bị can/bị cáo/đương sự nếu có." },
    donVi: { type: "STRING", description: "Đơn vị/người nhận ghi trên văn bản nếu có, không thì rỗng." },
    ghiChu: { type: "STRING", description: "Ghi chú viết tay thêm (bút phê) nếu có." },
    vanBan: { type: "STRING", description: "Toàn văn đọc được (tối đa khoảng 1500 ký tự)." },
    doTinCay: { type: "NUMBER", description: "Độ tin cậy 0..1." },
  },
  required: ["soKyHieu", "ngayBanHanh", "noiGui", "loai", "trichYeu", "doTinCay"],
};
const PROMPT = `Đây là ảnh chụp/scan một văn bản tố tụng tiếng Việt (có thể in hoặc VIẾT TAY, có dấu).
Đọc kỹ cả chữ viết tay. Trích xuất các trường theo schema. Không bịa: trường nào không đọc được thì để chuỗi rỗng.
Ngày đổi về dạng YYYY-MM-DD. Giữ nguyên dấu tiếng Việt và họ tên.`;

let khoaCache: string | null = null;
async function layKhoa(admin: ReturnType<typeof createClient>) {
  const env = Deno.env.get("GEMINI_API_KEY");
  if (env) return env;
  if (khoaCache) return khoaCache;
  const { data, error } = await admin.rpc("lay_khoa_gemini");
  if (error || !data) throw new Error("Chưa cấu hình khóa Gemini");
  khoaCache = data as string;
  return khoaCache;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Chỉ nhận POST" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: duocPhep, error: e1 } = await user.rpc("la_nguoi_duoc_phep");
  if (e1 || duocPhep !== true) return json({ error: "Tài khoản chưa được cấp quyền" }, 403);

  let body: { image?: string; mimeType?: string };
  try { body = await req.json(); } catch { return json({ error: "Dữ liệu không hợp lệ" }, 400); }
  let img = body.image ?? "", mime = body.mimeType ?? "image/jpeg";
  const m = /^data:([^;]+);base64,(.*)$/s.exec(img);
  if (m) { mime = m[1]; img = m[2]; }
  if (!img || !/^image\//.test(mime)) return json({ error: "Thiếu ảnh" }, 400);
  if (img.length > 14_000_000) return json({ error: "Ảnh quá lớn" }, 413);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let key: string;
  try { key = await layKhoa(admin); } catch (e) { return json({ error: String((e as Error).message) }, 500); }
  let r: Response | null = null, MODEL = "";
  for (const md of MODELS) {
    MODEL = md;
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${md}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: img } }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
    });
    if (r.status !== 404) break;
  }
  r = r!;
  if (!r.ok) return json({ error: "Gemini lỗi " + r.status }, 502);
  const out = await r.json();
  const text = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  try { return json({ fields: JSON.parse(text), model: MODEL }); }
  catch { return json({ error: "Không đọc được kết quả" }, 502); }
});
