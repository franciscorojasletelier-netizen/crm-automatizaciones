'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { getRoleMeta, NAV_SECTIONS } from '@/lib/roles'
import { MessageCircle, Loader2, Pencil, X, Shield, Check } from 'lucide-react'
import DirectChat from '@/components/chat/direct-chat'

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
  section_access: string[] | null
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

const ADMIN_ONLY = new Set(['usuarios', 'actividad', 'configuracion'])

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
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
    const initials = getInitials(node.full_name, node.email)
    const isSelf = node.id === currentUserId
    const name = node.full_name ?? node.email ?? 'Usuario'
    const cargo = node.job_title || meta.label

    return (
      <div className={`relative bg-white rounded-2xl border shadow-sm px-4 py-3 w-60 ${
        node.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
      }`}>
        {/* Banda de color del área */}
        {node.area_color && (
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: node.area_color }} />
        )}

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
              {isSelf && <span className="text-[8px] font-bold bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-full shrink-0">Tú</span>}
            </div>
            <p className="text-xs font-medium text-slate-600 truncate">{cargo}</p>
          </div>
        </div>

        {/* Etiquetas: área + nivel de acceso */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {node.area_name && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: node.area_color ?? '#64748b' }}>
              {node.area_name}
            </span>
          )}
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* Acciones */}
        <div className="mt-2.5 flex items-center gap-2">
          {!isSelf && (
            <button onClick={() => setChatWith({ id: node.id, name, email: node.email })}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-1.5 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              Chatear
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setEditNode(node)}
              className={`flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl py-1.5 transition-colors ${isSelf ? 'flex-1' : 'px-3'}`}>
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
          width: 50%; height: 22px; border-top: 2px solid #cbd5e1;
        }
        .org-tree li::after { right: auto; left: 50%; border-left: 2px solid #cbd5e1; }
        .org-tree li:only-child::before, .org-tree li:only-child::after { display: none; }
        .org-tree li:only-child { padding-top: 0; }
        .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
        .org-tree li:last-child::before { border-right: 2px solid #cbd5e1; border-radius: 0 8px 0 0; }
        .org-tree li:first-child::after { border-radius: 8px 0 0 0; }
        .org-tree ul::before {
          content: ''; position: absolute; top: 0; left: 50%;
          border-left: 2px solid #cbd5e1; width: 0; height: 22px;
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
  node, people, areas, editorRole, supabase, onClose, onSaved, excluded,
}: {
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
  const [isAdmin, setIsAdmin] = useState(['super_admin', 'gerente'].includes(node.role))
  const [sections, setSections] = useState<string[]>(
    Array.isArray(node.section_access) ? node.section_access : NAV_SECTIONS.map(s => s.key)
  )
  const [saving, setSaving] = useState(false)

  const name = node.full_name ?? node.email ?? 'Usuario'
  const managerOptions = people.filter(p => !excluded.has(p.id))
  const canMakeAdmin = editorRole === 'super_admin'

  function toggleSection(key: string) {
    setSections(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function save() {
    setSaving(true)
    // El nivel base (RLS/datos) se deriva del interruptor; conserva super_admin si ya lo era
    const derivedRole = isAdmin
      ? (node.role === 'super_admin' ? 'super_admin' : 'gerente')
      : 'comercial'
    await supabase.from('profiles').update({
      job_title: jobTitle.trim() || null,
      area_id: areaId || null,
      manager_id: managerId || null,
      role: derivedRole,
      section_access: sections,
    }).eq('id', node.id)
    setSaving(false)
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center">
            <Pencil className="w-4 h-4 text-indigo-300" />
          </div>
          <h2 className="flex-1 text-sm font-bold text-white truncate">Editar: {name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Cargo / Puesto</label>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              placeholder="Ej: Jefe de Marketing"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Área / Departamento</label>
            <select value={areaId} onChange={e => setAreaId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 bg-white">
              <option value="">— Sin área —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Jefe directo</label>
            <select value={managerId} onChange={e => setManagerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 bg-white">
              <option value="">— Sin jefe —</option>
              {managerOptions.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
            </select>
          </div>
          {/* Interruptor Administrador */}
          {canMakeAdmin && (
            <button type="button" onClick={() => setIsAdmin(v => !v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${isAdmin ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
              <Shield className={`w-4 h-4 ${isAdmin ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold text-slate-700">Administrador</p>
                <p className="text-[10px] text-slate-400">Gestiona usuarios, áreas y datos sensibles</p>
              </div>
              <span className={`w-9 h-5 rounded-full transition-colors relative ${isAdmin ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isAdmin ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
          )}

          {/* Checklist de secciones */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Acceso a secciones</label>
            <div className="grid grid-cols-2 gap-1.5">
              {NAV_SECTIONS.map(s => {
                const checked = sections.includes(s.key)
                const disabled = ADMIN_ONLY.has(s.key) && !isAdmin
                return (
                  <button key={s.key} type="button" disabled={disabled} onClick={() => toggleSection(s.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                      disabled ? 'opacity-40 cursor-not-allowed border-slate-100' :
                      checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${checked ? 'bg-indigo-500' : 'border border-slate-300'}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 truncate">{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl py-2 transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
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
