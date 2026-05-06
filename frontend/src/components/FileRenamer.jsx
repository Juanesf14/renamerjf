import { useState, useEffect } from 'react'
import api from '../services/api'

export default function FileRenamer({ selectedProvider }) {
  const [docTypes, setDocTypes] = useState([])
  const [form, setForm] = useState({
    docType: '',
    dosStart: '',
    dosEnd: '',
    updateDate: '',
    pipExhausted: 'N',
  })
  const [currentFile, setCurrentFile] = useState(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    api.get('/document-types').then(({ data }) => setDocTypes(data))
  }, [])

  useEffect(() => {
    buildName()
  }, [form, selectedProvider])

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const buildName = () => {
    if (!form.docType || !selectedProvider || !form.dosStart) {
      setNewName('')
      return
    }
    const entity = selectedProvider.name.replace(/\s+/g, '')
    const start = form.dosStart.replace(/-/g, '.').slice(2)
    const end = form.dosEnd ? form.dosEnd.replace(/-/g, '.').slice(2) : ''
    const pip = form.pipExhausted === 'Y' ? '_Y' : '_N'
    const name = `${form.docType}_${entity}_${start}${end ? '_' + end : ''}${pip}`
    setNewName(name)
  }

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder()
    if (!folderPath) return
    const files = await window.electronAPI.readFolder(folderPath)
    if (files.length > 0) setCurrentFile(files[0])
  }

  const handleRename = async () => {
    if (!currentFile || !newName) return
    const ext = currentFile.name.split('.').pop()
    const dir = currentFile.path.replace(currentFile.name, '')
    await window.electronAPI.renameFile({
      oldPath: currentFile.path,
      newPath: `${dir}${newName}.${ext}`
    })
    alert(`Archivo renombrado: ${newName}.${ext}`)
    setCurrentFile(null)
    setNewName('')
  }

  const handleClear = () => {
    setForm({ docType: '', dosStart: '', dosEnd: '', updateDate: '', pipExhausted: 'N' })
    setCurrentFile(null)
    setNewName('')
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>File Renamer</h3>

      <div style={styles.tabs}>
        <span style={styles.tabActive}>File Selection</span>
      </div>

      <div style={styles.preview} onClick={handleSelectFolder}>
        {currentFile
          ? <p style={styles.previewText}>📄 {currentFile.name}</p>
          : <p style={styles.previewPlaceholder}>Click para seleccionar carpeta</p>
        }
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Document Type</label>
        <select name="docType" value={form.docType} onChange={handleChange} style={styles.input}>
          <option value="">Seleccionar...</option>
          {docTypes.map(dt => (
            <option key={dt.id} value={dt.code}>{dt.code} – {dt.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Entity (hospital/insurance)</label>
        <input
          style={{ ...styles.input, background: '#2d3748', color: '#718096' }}
          value={selectedProvider?.name || 'Selecciona un provider →'}
          readOnly
        />
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>DOS Start</label>
          <input style={styles.input} type="date" name="dosStart" value={form.dosStart} onChange={handleChange} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>DOS End</label>
          <input style={styles.input} type="date" name="dosEnd" value={form.dosEnd} onChange={handleChange} />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Update Date</label>
        <input style={styles.input} type="date" name="updateDate" value={form.updateDate} onChange={handleChange} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>PIP Exhausted? (Y/N)</label>
        <select name="pipExhausted" value={form.pipExhausted} onChange={handleChange} style={styles.input}>
          <option value="N">N</option>
          <option value="Y">Y</option>
        </select>
      </div>

      <div style={styles.namePreview}>
        <p style={styles.nameLabel}>Current: <span style={styles.nameCurrent}>{currentFile?.name || '—'}</span></p>
        <p style={styles.nameLabel}>New: <span style={styles.nameNew}>{newName ? `${newName}.${currentFile?.name.split('.').pop() || 'pdf'}` : '—'}</span></p>
      </div>

      <div style={styles.actions}>
        <button style={styles.btnPrimary} onClick={handleRename} disabled={!currentFile || !newName}>
          Rename
        </button>
        <button style={styles.btnSecondary} onClick={handleClear}>Clear Fields</button>
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
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: { color: '#e2e8f0', margin: 0, fontSize: 15 },
  tabs: { display: 'flex', gap: 8 },
  tabActive: {
    color: '#e2e8f0',
    fontSize: 13,
    padding: '4px 12px',
    background: '#0f3460',
    borderRadius: 6,
  },
  preview: {
    height: 80,
    background: '#0f3460',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px dashed #2d3748',
  },
  previewText: { color: '#e2e8f0', margin: 0, fontSize: 13 },
  previewPlaceholder: { color: '#718096', margin: 0, fontSize: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { color: '#a0aec0', fontSize: 12 },
  input: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #2d3748',
    background: '#0f3460',
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
  },
  row: { display: 'flex', gap: 8 },
  namePreview: {
    background: '#0f3460',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nameLabel: { color: '#718096', margin: 0, fontSize: 12 },
  nameCurrent: { color: '#a0aec0' },
  nameNew: { color: '#68d391', fontWeight: 600 },
  actions: { display: 'flex', gap: 8, marginTop: 'auto' },
  btnPrimary: {
    flex: 1,
    padding: '9px',
    borderRadius: 8,
    border: 'none',
    background: '#e94560',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1,
    padding: '9px',
    borderRadius: 8,
    border: '1px solid #2d3748',
    background: 'transparent',
    color: '#a0aec0',
    fontSize: 14,
    cursor: 'pointer',
  },
}