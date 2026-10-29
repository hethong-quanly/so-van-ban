-- Kho chung cho Sổ văn bản: chỉ người trong danh sách được phép mới đọc/ghi.
-- Lưu ý: project đã có sẵn bảng public.van_ban (khác cấu trúc, rỗng) nên dùng tên so_van_ban để không đụng vào.
create table if not exists public.nguoi_dung_duoc_phep (
  email text primary key check (email = lower(email))
);
alter table public.nguoi_dung_duoc_phep enable row level security;

create table if not exists public.so_van_ban (
  id text primary key,
  year int,
  "ngayNhan" text, "soDen" text, "noiGui" text, "soKyHieu" text, "ngayBanHanh" text,
  loai text, "trichYeu" text, "nguoiNhan" text, "kyNhan" text, "ghiChu" text,
  nguon text, "doTinCay" double precision, "createdAt" text, rev text,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted boolean not null default false
);
create index if not exists so_van_ban_updated_at_idx on public.so_van_ban (updated_at);
alter table public.so_van_ban enable row level security;

-- Hàm kiểm tra quyền (security definer để đọc danh sách mà không lộ bảng).
create or replace function public.la_nguoi_duoc_phep()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.nguoi_dung_duoc_phep
                 where email = lower(coalesce((select auth.jwt() ->> 'email'), '')));
$$;
revoke all on function public.la_nguoi_duoc_phep() from public, anon;
grant execute on function public.la_nguoi_duoc_phep() to authenticated, service_role;

-- Người dùng chỉ được xem chính email mình trong danh sách (để app biết có quyền hay không).
create policy "xem email cua minh" on public.nguoi_dung_duoc_phep
  for select to authenticated
  using (email = lower(coalesce((select auth.jwt() ->> 'email'), '')));

create policy "doc van ban" on public.so_van_ban for select to authenticated
  using ((select public.la_nguoi_duoc_phep()));
create policy "them van ban" on public.so_van_ban for insert to authenticated
  with check ((select public.la_nguoi_duoc_phep()));
create policy "sua van ban" on public.so_van_ban for update to authenticated
  using ((select public.la_nguoi_duoc_phep())) with check ((select public.la_nguoi_duoc_phep()));
-- Không có policy delete: chỉ xóa mềm (deleted = true).

revoke all on public.so_van_ban from anon;
revoke all on public.nguoi_dung_duoc_phep from anon;
revoke insert, update, delete, truncate on public.nguoi_dung_duoc_phep from authenticated;
revoke delete, truncate on public.so_van_ban from authenticated;

-- Bản mới hơn thắng: không cho bản cũ (rev nhỏ hơn) ghi đè; tự ghi updated_at/updated_by.
create or replace function public.so_van_ban_truoc_khi_ghi()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and coalesce(new.rev, '') < coalesce(old.rev, '') then
    return null; -- bỏ qua bản cũ hơn
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := coalesce((select auth.jwt() ->> 'email'), new.updated_by);
  return new;
end;
$$;
drop trigger if exists so_van_ban_truoc_khi_ghi on public.so_van_ban;
create trigger so_van_ban_truoc_khi_ghi before insert or update on public.so_van_ban
  for each row execute function public.so_van_ban_truoc_khi_ghi();

-- Khóa Gemini lưu trong Vault (tên 'gemini_api_key'); chỉ service_role (Edge Function) đọc được.
create or replace function public.lay_khoa_gemini()
returns text language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key' limit 1; $$;
revoke all on function public.lay_khoa_gemini() from public, anon, authenticated;
grant execute on function public.lay_khoa_gemini() to service_role;

-- ===== Bổ sung (đã áp dụng trên project) =====
-- Hàm kiểm tra quyền chạy với quyền người gọi (security invoker)
alter function public.la_nguoi_duoc_phep() security invoker;

-- Policy: gọi auth.jwt() một lần mỗi câu lệnh (tránh initplan từng dòng)
drop policy if exists "xem email cua minh" on public.nguoi_dung_duoc_phep;
create policy "xem email cua minh" on public.nguoi_dung_duoc_phep
  for select to authenticated
  using (email = (select lower(coalesce(auth.jwt()->>'email',''))));

-- Quyền bảng (RLS vẫn kiểm soát từng dòng)
grant select, insert, update on public.so_van_ban to authenticated;
grant select on public.nguoi_dung_duoc_phep to authenticated;
grant all on public.so_van_ban, public.nguoi_dung_duoc_phep to service_role;
