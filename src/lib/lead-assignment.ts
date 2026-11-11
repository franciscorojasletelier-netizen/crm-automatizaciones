import type { SupabaseClient } from '@supabase/supabase-js'

// Asignación automática de leads entrantes (formulario web, Meta Lead Ads):
// el comercial activo con menos negocios abiertos recibe el lead. Si la
// organización no tiene comerciales, el lead queda sin asignar y gerencia
// lo reparte. Gerencia siempre puede reasignarlo o eliminarlo después.
export async function pickLeastLoadedComercial(supabase: SupabaseClient, orgId: string): Promise<string | null> {
  const { data: comerciales } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('role', 'comercial')
    .eq('is_active', true)
  if (!comerciales?.length) return null

  const counts = await Promise.all(comerciales.map(async c => {
    const { count } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', c.id)
      .eq('status', 'open')
      .is('deleted_at', null)
    return { id: c.id as string, count: count ?? 0 }
  }))
  counts.sort((a, b) => a.count - b.count)
  return counts[0].id
}

// Avisa en el CRM al comercial asignado y a gerencia que entró un lead.
export async function notifyIncomingLead(supabase: SupabaseClient, opts: {
  orgId: string; dealId: string; ownerId: string | null; name: string; detail: string
}) {
  const targets: { user_id: string; title: string; body: string }[] = []
  if (opts.ownerId) {
    targets.push({ user_id: opts.ownerId, title: `🆕 Nuevo lead asignado: ${opts.name}`, body: `${opts.detail} — contactar pronto` })
  }
  const { data: gerentes } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', opts.orgId)
    .in('role', ['gerente', 'super_admin', 'admin'])
    .eq('is_active', true)
  for (const g of gerentes ?? []) {
    if (g.id !== opts.ownerId) {
      targets.push({
        user_id: g.id,
        title: `📥 Lead entrante: ${opts.name}`,
        body: opts.ownerId ? opts.detail : `${opts.detail} · sin vendedor asignado`,
      })
    }
  }
  if (!targets.length) return
  await supabase.from('notifications').insert(
    targets.map(t => ({ ...t, type: 'deal_assigned', entity_type: 'deal', entity_id: opts.dealId }))
  )
}
