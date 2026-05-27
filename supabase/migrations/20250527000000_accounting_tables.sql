-- DTT Accounting backup tables
-- Run this once in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists accounting_sales (
  id integer primary key,
  invoice_no text not null,
  timestamp timestamptz not null,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_tpn text,
  items jsonb not null default '[]',
  gross_amount numeric(12,2) not null,
  gst_rate numeric(5,2) not null,
  gst_amount numeric(12,2) not null,
  net_amount numeric(12,2) not null,
  notes text,
  synced_at timestamptz default now()
);

create table if not exists accounting_purchases (
  id integer primary key,
  purchase_order_no text not null,
  timestamp timestamptz not null,
  supplier_name text,
  supplier_phone text,
  supplier_address text,
  supplier_tpn text,
  items jsonb not null default '[]',
  gross_amount numeric(12,2) not null,
  gst_rate numeric(5,2) not null,
  gst_amount numeric(12,2) not null,
  net_amount numeric(12,2) not null,
  notes text,
  synced_at timestamptz default now()
);

create table if not exists accounting_inventory (
  id integer primary key,
  item_code text,
  description text not null,
  unit text not null,
  base_rate numeric(12,2) not null,
  stock_qty numeric(12,3) not null,
  reorder_level numeric(12,3) not null,
  last_updated timestamptz not null,
  notes text,
  synced_at timestamptz default now()
);

create table if not exists accounting_parties (
  id integer primary key,
  party_type text not null,
  name text not null,
  phone text,
  address text,
  email text,
  tpn text,
  license_no text,
  gst_no text,
  opening_balance numeric(12,2) default 0,
  outstanding_balance numeric(12,2) not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  synced_at timestamptz default now()
);

create table if not exists accounting_expenses (
  id integer primary key,
  date date not null,
  category text not null,
  description text not null,
  amount numeric(12,2) not null,
  reference text,
  notes text,
  synced_at timestamptz default now()
);

create table if not exists accounting_payments (
  id integer primary key,
  party_id integer not null,
  timestamp timestamptz not null,
  amount numeric(12,2) not null,
  direction text not null,
  mode text not null,
  reference text,
  notes text,
  synced_at timestamptz default now()
);

-- Enable Row Level Security
alter table accounting_sales enable row level security;
alter table accounting_purchases enable row level security;
alter table accounting_inventory enable row level security;
alter table accounting_parties enable row level security;
alter table accounting_expenses enable row level security;
alter table accounting_payments enable row level security;

-- Allow all authenticated users full access
create policy "auth_full_access_sales"
  on accounting_sales for all to authenticated using (true) with check (true);

create policy "auth_full_access_purchases"
  on accounting_purchases for all to authenticated using (true) with check (true);

create policy "auth_full_access_inventory"
  on accounting_inventory for all to authenticated using (true) with check (true);

create policy "auth_full_access_parties"
  on accounting_parties for all to authenticated using (true) with check (true);

create policy "auth_full_access_expenses"
  on accounting_expenses for all to authenticated using (true) with check (true);

create policy "auth_full_access_payments"
  on accounting_payments for all to authenticated using (true) with check (true);
