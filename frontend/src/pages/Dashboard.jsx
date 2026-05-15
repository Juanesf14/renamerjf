import { useState } from 'react'
import ProviderList from '../components/ProviderList'
import ProviderCard from '../components/ProviderCard'
import FileRenamer from '../components/FileRenamer'
import BatchRenamer from '../components/BatchRenamer'
import CaseTracker from '../components/CaseTracker'

export default function Dashboard({ user, onLogout }) {
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [refreshTrigger, setRefreshTrigger]     = useState(0)
  const [mode, setMode]                         = useState('single') // 'single' | 'batch' | 'cases'

  const handleRenameSuccess = () => setRefreshTrigger(prev => prev + 1)

  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <div style={styles.topbarLeft}>
          <span style={styles.logo}>🗂 RenamerJF</span>
          <span style={styles.appName}>Medical Records Manager</span>

          <div style={styles.modeToggle}>
            <button
              style={mode === 'single' ? styles.modeActive : styles.modeInactive}
              onClick={() => setMode('single')}
            >
              Single File
            </button>
            <button
              style={mode === 'batch' ? styles.modeActive : styles.modeInactive}
              onClick={() => setMode('batch')}
            >
              Batch
            </button>
            <button
              style={mode === 'cases' ? styles.modeActive : styles.modeInactive}
              onClick={() => setMode('cases')}
            >
              📅 Cases
            </button>
          </div>
        </div>

        <div style={styles.topbarRight}>
          <span style={styles.welcome}>👤 {user.name}</span>
          <button style={styles.logout} onClick={onLogout}>Log Out</button>
        </div>
      </div>

      {mode === 'single' ? (
        <div style={styles.layout}>
          <div style={styles.panel}>
            <FileRenamer
              selectedProvider={selectedProvider}
              onRenameSuccess={handleRenameSuccess}
            />
          </div>
          <div style={styles.panel}>
            <ProviderList
              onSelect={setSelectedProvider}
              selectedId={selectedProvider?.id}
            />
          </div>
          <div style={styles.panel}>
            <ProviderCard
              provider={selectedProvider}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      ) : mode === 'batch' ? (
        <div style={styles.batchLayout}>
          <BatchRenamer />
        </div>
      ) : (
        <div style={styles.casesLayout}>
          <CaseTracker />
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#1a1a2e',
    overflow: 'hidden',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#16213e',
    borderBottom: '1px solid #2d3748',
  },
  topbarLeft:  { display: 'flex', alignItems: 'center', gap: 14 },
  logo:        { fontSize: 20 },
  appName:     { color: '#718096', fontSize: 13 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: 12 },
  welcome:     { color: '#a0aec0', fontSize: 13 },
  logout: {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: '#e94560', color: '#fff', fontSize: 13, cursor: 'pointer',
  },
  modeToggle: {
    display: 'flex',
    background: '#0f3460',
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  modeActive: {
    padding: '4px 12px', borderRadius: 5, border: 'none',
    background: '#e94560', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  modeInactive: {
    padding: '4px 12px', borderRadius: 5, border: 'none',
    background: 'transparent', color: '#718096', fontSize: 12, cursor: 'pointer',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12,
    padding: 12,
    flex: 1,
    overflow: 'hidden',
  },
  batchLayout: {
    flex: 1,
    padding: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  casesLayout: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  panel: {
    overflow: 'hidden',
    borderRadius: 10,
  },
}
