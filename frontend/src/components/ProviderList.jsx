import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export default function ProviderList({ onSelect, selectedId }) {
  const [providers, setProviders] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

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

  const typeIcon = type => {
    const icons = { hospital: '🏥', insurance: '🛡️', doctor: '👨‍⚕️', pharmacy: '💊' }
    return icons[type] || '📋'
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Medical Contacts</h3>
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
              <div>
                <p style={styles.name}>{p.name}</p>
                {p.specialty && <p style={styles.sub}>{p.specialty}</p>}
                {p.phone && <p style={styles.sub}>📞 {p.phone}</p>}
              </div>
            </div>
          ))}
        </div>
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
  title: { color: '#e2e8f0', margin: '0 0 12px 0', fontSize: 15, fontStyle: 'italic' },
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
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    background: '#0f3460',
  },
  itemActive: { background: '#e94560' },
  icon: { fontSize: 20, marginTop: 2 },
  name: { color: '#e2e8f0', margin: 0, fontSize: 14, fontWeight: 600 },
  sub: { color: '#a0aec0', margin: '2px 0 0 0', fontSize: 12 },
  empty: { color: '#718096', fontSize: 13, textAlign: 'center', marginTop: 20 },
}