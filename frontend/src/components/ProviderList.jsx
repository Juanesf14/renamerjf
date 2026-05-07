import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import ProviderForm from './ProviderForm'

export default function ProviderList({ onSelect, selectedId }) {
  const [providers, setProviders] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState(null)

  const fetchProviders = useCallback(async (q = '') => {
    try {
      const { data } = await api.get('/providers', { params: { q } })
      setProviders(data)
    } catch (err) {
      console.error('Error cargando providers', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleSearch = e => {
    setSearch(e.target.value)
    fetchProviders(e.target.value)
  }

  const handleSave = () => {
    setShowForm(false)
    setEditingProvider(null)
    fetchProviders(search)
  }

  const handleEdit = (e, provider) => {
    e.stopPropagation()
    setEditingProvider(provider)
    setShowForm(true)
  }

  const handleDelete = async (e, provider) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar ' + provider.name + '?')) return
    try {
      await api.delete('/providers/' + provider.id)
      fetchProviders(search)
    } catch (err) {
      console.error('Error eliminando provider', err)
    }
  }

  const typeIcon = type => {
  const icons = {
    'Medical Provider': '🏥',
    'Insurance': '🛡️',
    'Legal': '⚖️'
  }
  return icons[type] || '📋'
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Medical Contacts</h3>
        <button style={styles.btnNew} onClick={() => { setEditingProvider(null); setShowForm(true) }}>
          + Nuevo
        </button>
      </div>

      <input
        style={styles.search}
        placeholder="Search providers..."
        value={search}
        onChange={handleSearch}
      />

      {loading ? (
        <p style={styles.empty}>Cargando...</p>
      ) : providers.length === 0 ? (
        <p style={styles.empty}>No hay providers registrados</p>
      ) : (
        <div style={styles.list}>
          {providers.map(p => (
            <div
              key={p.id}
              style={{ ...styles.item, ...(selectedId === p.id ? styles.itemActive : {}) }}
              onClick={() => onSelect(p)}
            >
              <span style={styles.icon}>{typeIcon(p.type)}</span>
              <div style={{ flex: 1 }}>
                <p style={styles.name}>{p.name}</p>
                {p.specialty && <p style={styles.sub}>{p.specialty}</p>}
                {p.phone && <p style={styles.sub}>📞 {p.phone}</p>}
              </div>
              <div style={styles.itemActions}>
                <button style={styles.btnEdit} onClick={e => handleEdit(e, p)}>✏️</button>
                <button style={styles.btnDelete} onClick={e => handleDelete(e, p)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProviderForm
          provider={editingProvider}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingProvider(null) }}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1rem',
    background: '#16213e',
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#e2e8f0', margin: 0, fontSize: 15, fontStyle: 'italic' },
  btnNew: {
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    background: '#e94560',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  search: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #2d3748',
    background: '#0f3460',
    color: '#e2e8f0',
    fontSize: 13,
    marginBottom: 12,
    outline: 'none',
  },
  list: { overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    background: '#0f3460',
  },
  itemActive: { background: '#e94560' },
  icon: { fontSize: 20 },
  name: { color: '#e2e8f0', margin: 0, fontSize: 14, fontWeight: 600 },
  sub: { color: '#a0aec0', margin: '2px 0 0 0', fontSize: 12 },
  empty: { color: '#718096', fontSize: 13, textAlign: 'center', marginTop: 20 },
  itemActions: { display: 'flex', gap: 4, marginLeft: 'auto' },
  btnEdit: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
    borderRadius: 4,
  },
  btnDelete: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
    borderRadius: 4,
  },
}
