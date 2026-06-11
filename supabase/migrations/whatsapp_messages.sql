-- Tabla para mensajes de WhatsApp vinculados a un deal
create table if not exists whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references deals(id) on delete cascade,
  direction     text not null check (direction in ('inbound', 'outbound')),
  body          text not null,
  wa_message_id text,                    -- ID del mensaje en WhatsApp
  status        text default 'sent'      check (status in ('sent','delivered','read','failed')),
  sent_by       uuid references profiles(id),  -- quien envió (null si es inbound)
  created_at    timestamptz default now()
);

create index if not exists whatsapp_messages_deal_id_idx on whatsapp_messages(deal_id);
create index if not exists whatsapp_messages_created_at_idx on whatsapp_messages(created_at);

-- RLS
alter table whatsapp_messages enable row level security;

-- Política: ver mensajes de deals a los que tienes acceso
create policy "whatsapp_messages_select" on whatsapp_messages
  for select using (
    exists (
      select 1 from deals d
      join profiles p on p.id = auth.uid()
      where d.id = whatsapp_messages.deal_id
        and (
          p.role in ('super_admin','admin','gerente')
          or d.owner_id = auth.uid()
          or exists (
            select 1 from deal_members dm
            where dm.deal_id = d.id and dm.user_id = auth.uid()
          )
        )
    )
  );

-- Política: insertar solo desde service_role (el webhook inserta inbound)
-- y usuarios autenticados con acceso al deal (outbound)
create policy "whatsapp_messages_insert" on whatsapp_messages
  for insert with check (
    exists (
      select 1 from deals d
      join profiles p on p.id = auth.uid()
      where d.id = whatsapp_messages.deal_id
        and (
          p.role in ('super_admin','admin','gerente','comercial')
          or d.owner_id = auth.uid()
        )
    )
  );

-- Service role puede hacer todo (webhook inbound)
grant all on whatsapp_messages to service_role;
grant select, insert on whatsapp_messages to authenticated;
