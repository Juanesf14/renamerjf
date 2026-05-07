import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export default function ProviderCard({ provider, refreshTrigger }) {
  const [detail, setDetail] = useState(null)

  const fetchDetail = useCallback(async () => {
    if (!provider) return
    try {
      const { data } = await api.get(`/providers/${provider.id}`)
      setDetail(data)
    } catch (err) {
      console.error('Error cargando detalle', err)
    }
  }, [provider])

  useEffect(() => {
    setDetail(null)
    fetchDetail()
  }, [fetchDetail, refreshTrigger])

  if (!provider) return (
    <div style={styles.empty}>
      <p>Selecciona un provider para ver su detalle</p>
    </div>
  )

  if (!detail) return <div style={styles.empty}><p>Cargando...</p></div>

  const { provider: p, history } = detail

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>🏥</span>
        <div>
          <h3 style={styles.name}>{p.name}</h3>
          <p style={styles.type}>{p.type}</p>
        </div>
      </div>

      <div style={styles.info}>
        {p.phone && <p style={styles.row}>📞 {p.phone}</p>}
        {p.fax && <p style={styles.row}>📠 {p.fax}</p>}
        {p.email && <p style={styles.row}>✉️ {p.email}</p>}
        {p.address && <p style={styles.row}>📍 {p.address}</p>}
        {p.hours && <p style={styles.row}>🕐 {p.hours}</p>}
        {p.portal_url && (
          <p style={styles.row}>
            🔗 <a href={p.portal_url} style={styles.link} target="_blank" rel="noreferrer">
              Portal web
            </a>
          </p>
        )}
        {p.notes && <p style={styles.notes}>{p.notes}</p>}
      </div>

      <div style={styles.historySection}>
        <p style={styles.historyTitle}>Historial de archivos</p>
        {history.length === 0 ? (
          <p style={styles.historyEmpty}>Sin archivos renombrados aún</p>
        ) : (
          history.map(h => (
            <div key={h.id} style={styles.historyItem}>
              <p style={styles.historyName}>{h.new_name}</p>
              <p style={styles.historySub}>DOS: {h.dos_start} → {h.dos_end}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    height: '100%',
    padding: '1rem',
    background: '#16213e',
    borderRadius: 10,
    overflowY: 'auto',
  },
  empty: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#718096',
    fontSize: 13,
    background: '#16213e',
    borderRadius: 10,
  },
  header: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid #2d3748',
  },
  icon: { fontSize: 32 },
  name: { color: '#e2e8f0', margin: 0, fontSize: 16, fontWeight: 700 },
  type: { color: '#a0aec0', margin: 0, fontSize: 12, textTransform: 'capitalize' },
  info: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  row: { color: '#cbd5e0', margin: 0, fontSize: 13 },
  link: { color: '#e94560', textDecoration: 'none' },
  notes: {
    color: '#a0aec0',
    fontSize: 12,
    fontStyle: 'italic',
    background: '#0f3460',
    padding: '8px 10px',
    borderRadius: 6,
    margin: 0,
  },
  historySection: { borderTop: '1px solid #2d3748', paddingTop: 12 },
  historyTitle: { color: '#718096', fontSize: 12, margin: '0 0 8px 0', textTransform: 'uppercase' },
  historyEmpty: { color: '#718096', fontSize: 12, margin: 0 },
  historyItem: {
    background: '#0f3460',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 6,
  },
  historyName: { color: '#e2e8f0', margin: 0, fontSize: 12, fontWeight: 600 },
  historySub: { color: '#718096', margin: '2px 0 0 0', fontSize: 11 },
}