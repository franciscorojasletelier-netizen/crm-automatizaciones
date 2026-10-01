'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { getRoleMeta, normalizeRole, NAV_SECTIONS, type SectionMode } from '@/lib/roles'
import { MessageCircle, Loader2, Pencil, X, Shield } from 'lucide-react'
import DirectChat from '@/components/chat/direct-chat'
import SectionChecklist from '@/components/admin/section-checklist'
import { getInitials } from '@/lib/format'
import { useDialog } from '@/lib/use-dialog'

export interface OrgPerson {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_active: boolean
  manager_id: string | null
  job_title: string | null
  area_id: string | null
  area_name: string | null
  area_color: string | null
  section_access: Record<string, SectionMode> | string[] | null
}

export interface Area {
  id: string
  name: string
  color: string
}

interface TreeNode extends OrgPerson {
  children: TreeNode[]
}

interface Props {
  people: OrgPerson[]
  areas: Area[]
  currentUserId: string
  isAdmin: boolean
  editorRole: string
}


function buildTree(people: OrgPerson[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  people.forEach(p => byId.set(p.id, { ...p, children: [] }))

  const roots: TreeNode[] = []
  byId.forEach(node => {
    const mgr = node.manager_id ? byId.get(node.manager_id) : null
    if (mgr && mgr.id !== node.id) mgr.children.push(node)
    else roots.push(node)
  })

  const seen = new Set<string>()
  const walk = (n: TreeNode) => { if (seen.has(n.id)) return; seen.add(n.id); n.children.forEach(walk) }
  roots.forEach(walk)
  byId.forEach(node => { if (!seen.has(node.id)) { roots.push(node); walk(node) } })

  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
    nodes.forEach(n => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

// id de la persona + todos sus subordinados (directos e indirectos), desde la lista plana
function descendantsFromFlat(rootId: string, people: OrgPerson[]): Set<string> {
  const ids = new Set<string>([rootId])
  let added = true
  while (added) {
    added = false
    for (const p of people) {
      if (p.manager_id && ids.has(p.manager_id) && !ids.has(p.id)) {
        ids.add(p.id); added = true
      }
    }
  }
  return ids
}

export default function OrgChart({ people, areas, currentUserId, isAdmin, editorRole }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [chatWith, setChatWith] = useState<{ id: string; name: string; email: string | null } | null>(null)
  const [editNode, setEditNode] = useState<TreeNode | null>(null)

  const tree = useMemo(() => buildTree(people), [people])

  function Card({ node }: { node: TreeNode }) {
    const meta = getRoleMeta(node.role)
    const initials = getInitials(node.full_name, node.email, '?')
    const isSelf = node.id === currentUserId
    const name = node.full_name ?? node.email ?? 'Usuario'
    const cargo = node.job_title || meta.label

    return (
      <div className={`relative bg-white rounded-lg border shadow-sm px-4 py-3 w-60 ${
        node.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
      }`}>
        {/* Banda de color del área */}
        {node.area_color && (
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ background: node.area_color }} />
        )}

        <div className="flex items-center gap-3">
          <div className="bg-accent-600 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
             >
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
              {isSelf && <span className="text-[11px] font-bold bg-accent-100 text-accent-600 px-1 py-0.5 rounded-full shrink-0">Tú</span>}
            </div>
            <p className="text-xs font-medium text-slate-600 truncate">{cargo}</p>
          </div>
        </div>

        {/* Etiquetas: área + nivel de acceso */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {node.area_name && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: node.area_color ?? 'var(--color-slate-500)' }}>
              {node.area_name}
            </span>
          )}
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* Acciones */}
        <div className="mt-2.5 flex items-center gap-2">
          {!isSelf && (
            <button onClick={() => setChatWith({ id: node.id, name, email: node.email })}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-600 bg-accent-50 hover:bg-accent-100 rounded-lg py-1.5 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              Chatear
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setEditNode(node)}
              className={`flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 transition-colors ${isSelf ? 'flex-1' : 'px-3'}`}>
              <Pencil className="w-3.5 h-3.5" />
              {isSelf && 'Editar'}
            </button>
          )}
        </div>
      </div>
    )
  }

  function Node({ node }: { node: TreeNode }) {
    return (
      <li>
        <Card node={node} />
        {node.children.length > 0 && (
          <ul>{node.children.map(c => <Node key={c.id} node={c} />)}</ul>
        )}
      </li>
    )
  }

  return (
    <>
      <style>{`
        .org-tree, .org-tree ul { position: relative; padding-top: 22px; display: flex; justify-content: center; }
        .org-tree li {
          list-style: none; position: relative;
          padding: 22px 10px 0; display: flex; flex-direction: column; align-items: center;
        }
        .org-tree li::before, .org-tree li::after {
          content: ''; position: absolute; top: 0; right: 50%;
          width: 50%; height: 22px; border-top: 2px solid var(--color-slate-300);
        }
        .org-tree li::after { right: auto; left: 50%; border-left: 2px solid var(--color-slate-300); }
        .org-tree li:only-child::before, .org-tree li:only-child::after { display: none; }
        .org-tree li:only-child { padding-top: 0; }
        .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
        .org-tree li:last-child::before { border-right: 2px solid var(--color-slate-300); border-radius: 0 8px 0 0; }
        .org-tree li:first-child::after { border-radius: 8px 0 0 0; }
        .org-tree ul::before {
          content: ''; position: absolute; top: 0; left: 50%;
          border-left: 2px solid var(--color-slate-300); width: 0; height: 22px;
        }
        .org-tree > li { padding-top: 0; }
        .org-tree > li::before, .org-tree > li::after { display: none; }
      `}</style>

      <div className="overflow-x-auto pb-4">
        <ul className="org-tree">
          {tree.map(node => <Node key={node.id} node={node} />)}
        </ul>
      </div>

      {chatWith && (
        <DirectChat currentUserId={currentUserId} recipient={chatWith} onClose={() => setChatWith(null)} />
      )}

      {editNode && (
        <EditModal
          isSelf={editNode.id === currentUserId}
          node={editNode}
          people={people}
          areas={areas}
          editorRole={editorRole}
          supabase={supabase}
          onClose={() => setEditNode(null)}
          onSaved={() => { setEditNode(null); router.refresh() }}
          excluded={descendantsFromFlat(editNode.id, people)}
        />
      )}
    </>
  )
}

// ── Modal de edición (cargo, área, jefe, nivel de acceso) ──
function EditModal({
  node, people, areas, editorRole, supabase, onClose, onSaved, excluded, isSelf,
}: {
  isSelf: boolean
  node: TreeNode
  people: OrgPerson[]
  areas: Area[]
  editorRole: string
  supabase: ReturnType<typeof createClient>
  onClose: () => void
  onSaved: () => void
  excluded: Set<string>
}) {
  const [jobTitle, setJobTitle] = useState(node.job_title ?? '')
  const [areaId, setAreaId] = useState(node.area_id ?? '')
  const [managerId, setManagerId] = useState(node.manager_id ?? '')
  // 'admin' es el nombre legacy de super_admin: sin normalizar, el interruptor
  // partía apagado y al guardar intentaba degradar la cuenta.
  const nodeRole = normalizeRole(node.role)
  const [isAdmin, setIsAdmin] = useState(['super_admin', 'gerente'].includes(nodeRole))
  const [sections, setSections] = useState<Record<string, SectionMode>>(() => {
    if (Array.isArray(node.section_access)) {
      return Object.fromEntries(node.section_access.map(k => [k, 'full' as SectionMode]))
    }
    if (node.section_access && typeof node.section_access === 'object') return node.section_access
    return Object.fromEntries(NAV_SECTIONS.map(s => [s.key, 'full' as SectionMode]))
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialog(true, onClose, saving)

  const name = node.full_name ?? node.email ?? 'Usuario'
  const managerOptions = people.filter(p => !excluded.has(p.id))
  // Nadie cambia su propio nivel ni sus accesos (la base también lo impide):
  // evita quedar fuera por error.
  const canMakeAdmin = normalizeRole(editorRole) === 'super_admin' && !isSelf

  async function save() {
    setSaving(true); setError('')
    const changes: Record<string, unknown> = {
      job_title: jobTitle.trim() || null,
      area_id: areaId || null,
      manager_id: managerId || null,
    }
    if (!isSelf) {
      // El nivel base (RLS/datos) se deriva del interruptor. Un rol que ya era
      // de jefatura o específico (finanzas, producción…) se conserva si el
      // interruptor no cambió.
      const wasAdmin = ['super_admin', 'gerente'].includes(nodeRole)
      const derivedRole = isAdmin === wasAdmin ? nodeRole : isAdmin ? 'gerente' : 'comercial'
      if (derivedRole !== nodeRole) changes.role = derivedRole
      changes.section_access = sections
    }
    const { error: err } = await supabase.from('profiles').update(changes).eq('id', node.id)
    setSaving(false)
    if (err) {
      setError(err.message.includes('row-level security')
        ? 'No tienes permiso para hacer este cambio.'
        : err.message)
      return
    }
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Editar persona" className="w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden outline-none" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 px-5 py-4 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent-500/30 flex items-center justify-center">
            <Pencil className="w-4 h-4 text-accent-300" />
          </div>
          <h2 className="flex-1 text-sm font-bold text-white truncate">Editar: {name}</h2>
          <button aria-label="Cerrar" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto">
          <div>
            <label htmlFor="org-chart-f1" className="text-xs font-semibold text-slate-600 mb-1 block">Cargo / Puesto</label>
            <input id="org-chart-f1" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              placeholder="Ej: Jefe de Marketing"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100" />
          </div>
          <div>
            <label htmlFor="org-chart-f2" className="text-xs font-semibold text-slate-600 mb-1 block">Área / Departamento</label>
            <select id="org-chart-f2" value={areaId} onChange={e => setAreaId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 bg-white">
              <option value="">— Sin área —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="org-chart-f3" className="text-xs font-semibold text-slate-600 mb-1 block">Jefe directo</label>
            <select id="org-chart-f3" value={managerId} onChange={e => setManagerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-300 bg-white">
              <option value="">— Sin jefe —</option>
              {managerOptions.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
            </select>
          </div>
          {/* Interruptor Administrador */}
          {canMakeAdmin && (
            <button type="button" onClick={() => setIsAdmin(v => !v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${isAdmin ? 'border-accent-300 bg-accent-50' : 'border-slate-200 bg-white'}`}>
              <Shield className={`w-4 h-4 ${isAdmin ? 'text-accent-600' : 'text-slate-400'}`} />
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold text-slate-700">Administrador</p>
                <p className="text-[11px] text-slate-400">Gestiona usuarios, áreas y datos sensibles</p>
              </div>
              <span className={`w-9 h-5 rounded-full transition-colors relative ${isAdmin ? 'bg-accent-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isAdmin ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
          )}

          {isSelf ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              Tu nivel de administrador y tus accesos los cambia otro administrador; así nadie se deja fuera por error.
              Como {getRoleMeta(nodeRole).label} ves todos los módulos.
            </p>
          ) : (
          <SectionChecklist
            value={sections}
            isAdmin={isAdmin}
            onChange={(key, mode) => setSections(prev => {
              const next = { ...prev }
              if (mode === null) delete next[key]
              else next[key] = mode
              return next
            })}
          />
          )}

          {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="bg-accent-600 flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-lg py-2 disabled:opacity-50 transition-all"
               >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
