import { useState } from 'react'
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { familyApi } from '../../api/family'
import FamilyMemberModal from './FamilyMemberModal'

export default function FamilyPanel({ visibleMembers, onToggleMember }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'add' | member-object

  const { data: members = [] } = useQuery({
    queryKey: ['family-members'],
    queryFn: familyApi.list,
  })

  const createMutation = useMutation({
    mutationFn: familyApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      setModal(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => familyApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      setModal(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: familyApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      setModal(null)
    },
  })

  const handleSave = (form) => {
    if (modal?.id) {
      updateMutation.mutate({ id: modal.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleDelete = (member) => {
    if (confirm(`Remove ${member.name} and all their events?`)) {
      deleteMutation.mutate(member.id)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-warm-200 bg-white flex-wrap shrink-0">
        {members.map(member => {
          const visible = visibleMembers.has(member.id)
          return (
            <div key={member.id} className="group relative flex items-center">
              <button
                onClick={() => onToggleMember(member.id)}
                className="flex items-center gap-1 pl-2 pr-6 py-0.5 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: visible ? member.color : 'transparent',
                  backgroundColor: visible ? member.color + '1a' : '#f3f4f6',
                  color: visible ? member.color : '#9ca3af',
                }}
                title={visible ? 'Hide calendar' : 'Show calendar'}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
                  style={{ backgroundColor: member.color, opacity: visible ? 1 : 0.4 }}
                />
                {member.name}
              </button>
              <button
                onClick={() => setModal(member)}
                className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/10"
                title="Edit member"
              >
                <PencilIcon className="w-2.5 h-2.5" style={{ color: visible ? member.color : '#9ca3af' }} />
              </button>
            </div>
          )
        })}

        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium text-warm-300 hover:text-warm-500 border border-dashed border-warm-200 hover:border-warm-400 hover:bg-warm-50 transition-all"
        >
          <PlusIcon className="w-3 h-3" />
          Add
        </button>
      </div>

      {modal && (
        <FamilyMemberModal
          member={modal === 'add' ? null : modal}
          onSave={handleSave}
          onDelete={modal !== 'add' ? handleDelete : null}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
