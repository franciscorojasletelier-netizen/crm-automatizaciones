'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getRoleMeta } from '@/lib/roles'
import { MessageCircle, Loader2, UserCog } from 'lucide-react'
import DirectChat from '@/components/chat/direct-chat'

export interface OrgPerson {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_active: boolean
  manager_id: string | null
}

interface TreeNode extends OrgPerson {
  children: TreeNode[]
}

interface Props {
  people: OrgPerson[]
  currentUserId: string
  isAdmin: boolean
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

// Construye el árbol desde la lista plana, con guard anti-ciclos
function buildTree(people: OrgPerson[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  people.forEach(p => byId.set(p.id, { ...p, children: [] }))

  const roots: TreeNode[] = []
  byId.forEach(node => {
    const mgr = node.manager_id ? byId.get(node.manager_id) : null
    // Evita auto-referencia y referencias a jefes inexistentes
    if (mgr && mgr.id !== node.id) {
      mgr.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Detecta nodos atrapados en ciclos (no alcanzables desde una raíz) y los sube a raíz
  const seen = new Set<string>()
  const walk = (n: TreeNode) => {
    if (seen.has(n.id)) return
    seen.add(n.id)
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  byId.forEach(node => {
    if (!seen.has(node.id)) { roots.push(node); walk(node) }
  })

  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
    nodes.forEach(n => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

// IDs del subárbol de un nodo (para excluirlos como posibles jefes y evitar ciclos)
function descendantIds(node: TreeNode): Set<string> {
  const ids = new Set<string>()
  const rec = (n: TreeNode) => { ids.add(n.id); n.children.forEach(rec) }
  rec(node)
  return ids
}

export default function OrgChart({ people, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [chatWith, setChatWith] = useState<{ id: string; name: string; email: string | null } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const tree = useMemo(() => buildTree(people), [people])
  const peopleById = useMemo(() => {
    const m = new Map<string, TreeNode>()
    const rec = (n: TreeNode) => { m.set(n.id, n); n.children.forEach(rec) }
    tree.forEach(rec)
    return m
  }, [tree])

  async function changeManager(personId: string, managerId: string) {
    setSavingId(personId)
    await supabase.from('profiles')
      .update({ manager_id: managerId || null })
      .eq('id', personId)
    setSavingId(null)
    router.refresh()
  }

  function Card({ node }: { node: TreeNode }) {
    const meta = getRoleMeta(node.role)
    const initials = getInitials(node.full_name, node.email)
    const isSelf = node.id === currentUserId
    const name = node.full_name ?? node.email ?? 'Usuario'

    // Opciones de jefe: todos menos el propio nodo y sus descendientes
    const excluded = descendantIds(node)
    const managerOptions = isAdmin
      ? people.filter(p => !excluded.has(p.id))
      : []

    return (
      <div className={`relative bg-white rounded-2xl border shadow-sm px-4 py-3 w-56 ${
        node.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
      }`}>
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
            <span className={`inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${meta.color}`}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-2.5 flex flex-col gap-2">
          {!isSelf && (
            <button onClick={() => setChatWith({ id: node.id, name, email: node.email })}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-1.5 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              Chatear
            </button>
          )}

          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <UserCog className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={node.manager_id ?? ''}
                onChange={e => changeManager(node.id, e.target.value)}
                disabled={savingId === node.id}
                className="flex-1 min-w-0 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-indigo-300 disabled:opacity-50">
                <option value="">— Sin jefe —</option>
                {managerOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </select>
              {savingId === node.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />}
            </div>
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
          <ul>
            {node.children.map(c => <Node key={c.id} node={c} />)}
          </ul>
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
        .org-tree li:last-child::before {
          border-right: 2px solid #cbd5e1; border-radius: 0 8px 0 0;
        }
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
        <DirectChat
          currentUserId={currentUserId}
          recipient={chatWith}
          onClose={() => setChatWith(null)}
        />
      )}
    </>
  )
}
