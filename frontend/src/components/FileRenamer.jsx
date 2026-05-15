import { useState, useEffect } from 'react'
import api from '../services/api'

export default function FileRenamer({ selectedProvider, onRenameSuccess }) {
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
  const [entityName, setEntityName] = useState('')
  const [suggestedProvider, setSuggestedProvider] = useState(null)
  const [autoFilledFields, setAutoFilledFields] = useState({})
  const [flags, setFlags] = useState(null)

  useEffect(() => {
    api.get('/document-types').then(({ data }) => setDocTypes(data))
  }, [])

  useEffect(() => {
    if (selectedProvider) setEntityName(selectedProvider.name)
  }, [selectedProvider])

  useEffect(() => {
    buildName()
  }, [form, entityName])

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${m}.${d}.${y.slice(2)}`
  }

  const buildName = () => {
    if (!form.docType || !entityName) {
      setNewName('')
      return
    }

    const facility   = entityName
    const dosStart   = formatDate(form.dosStart)
    const dosEnd     = formatDate(form.dosEnd)
    const updateDate = formatDate(form.updateDate)
    const dosRange   = dosEnd ? `${dosStart}-${dosEnd}` : dosStart

    let name = ''

    if (form.docType === 'B') {
      if (!form.dosStart || !form.updateDate) { setNewName(''); return }
      name = `Bills-${facility}-DOS ${dosRange}-updated as of ${updateDate}`
    } else if (form.docType === 'MR') {
      if (!form.dosStart) { setNewName(''); return }
      name = `Records-${facility}-DOS ${dosRange}`
    } else if (form.docType === 'HL') {
      if (!form.updateDate) { setNewName(''); return }
      name = `${facility} Health Lien-updated as of ${updateDate}`
    } else if (form.docType === 'PIP') {
      if (!form.updateDate) { setNewName(''); return }
      if (form.pipExhausted === 'Y') {
        name = `${facility} PIP Log-exhausted-updated as of ${updateDate}`
      } else {
        name = `${facility} PIP Log-updated as of ${updateDate}`
      }
    }

    setNewName(name)
  }

  const handleSelectFile = async () => {
    const file = await window.electronAPI.selectFile()
    if (!file) return
    setCurrentFile(file)
    setSuggestedProvider(null)

    // Solo analizar PDFs
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext !== 'pdf') return

    try {
      const { data } = await api.post('/analyze', { filePath: file.path })
      const filled = {}

      if (data.suggestion) {
        const { provider_id, name, confidence, method } = data.suggestion
        setEntityName(name)
        setSuggestedProvider({ provider_id, name, confidence, method, usedOcr: data.usedOcr })
      }

      if (data.dates) {
        const updates = {}
        if (data.dates.dosStart)   { updates.dosStart   = data.dates.dosStart;   filled.dosStart   = true }
        if (data.dates.dosEnd)     { updates.dosEnd     = data.dates.dosEnd;     filled.dosEnd     = true }
        if (data.dates.updateDate) { updates.updateDate = data.dates.updateDate; filled.updateDate = true }
        if (Object.keys(updates).length > 0) setForm(f => ({ ...f, ...updates }))
      }

      setAutoFilledFields(filled)
      if (data.flags) setFlags(data.flags)
    } catch (err) {
      console.error('Error en Doc Analyzer:', err)
    }
  }

  const handleRename = async () => {
    if (!currentFile || !newName) return
    const ext = currentFile.name.split('.').pop()
    const dir = currentFile.path.replace(currentFile.name, '')
    const newFullName = `${newName}.${ext}`

    try {
      await window.electronAPI.renameFile({
        oldPath: currentFile.path,
        newPath: `${dir}${newFullName}`
      })

      const docType = docTypes.find(dt => dt.code === form.docType)
      await api.post('/history', {
        provider_id: selectedProvider?.id || suggestedProvider?.provider_id || null,
        doc_type_id: docType?.id || null,
        original_name: currentFile.name,
        new_name: newFullName,
        dos_start: form.dosStart || null,
        dos_end: form.dosEnd || null,
        update_date: form.updateDate || null,
        pip_exhausted: form.pipExhausted === 'Y'
      })

      setCurrentFile(null)
      setNewName('')
      setEntityName('')
      setSuggestedProvider(null)
      setAutoFilledFields({})
      setFlags(null)
      alert(`✅ Archivo renombrado: ${newFullName}`)
      setForm({ docType: '', dosStart: '', dosEnd: '', updateDate: '', pipExhausted: 'N' })
      if (onRenameSuccess) onRenameSuccess()

    } catch (err) {
      console.error('Error al renombrar:', err)
      alert('❌ Error al renombrar el archivo')
    }
  }

  const handleClear = () => {
    setForm({ docType: '', dosStart: '', dosEnd: '', updateDate: '', pipExhausted: 'N' })
    setCurrentFile(null)
    setNewName('')
    setEntityName('')
    setSuggestedProvider(null)
    setAutoFilledFields({})
    setFlags(null)
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>File Renamer</h3>

      <div style={styles.tabs}>
        <span style={styles.tabActive}>File Selection</span>
      </div>

      <div style={styles.preview} onClick={handleSelectFile}>
        {currentFile
          ? <p style={styles.previewText}>📄 {currentFile.name}</p>
          : <p style={styles.previewPlaceholder}>Click para seleccionar archivo</p>
        }
      </div>

      {suggestedProvider && (
        <div style={styles.suggestion}>
          <span>🤖 Suggested: <strong>{suggestedProvider.name}</strong></span>
          <span style={styles.confidence}>
            {Math.round(suggestedProvider.confidence * 100)}% — {suggestedProvider.method}
            {suggestedProvider.usedOcr && <span style={styles.ocrBadge}>OCR</span>}
          </span>
        </div>
      )}

      {flags?.hasAmbulance && (
        <div style={{ ...styles.flagBanner, borderColor: '#f6ad55', background: '#2d1f0a' }}>
          <span style={{ color: '#f6ad55', fontWeight: 700 }}>🚑 Ambulance transport detected</span>
          <span style={{ color: '#a0aec0', fontSize: 11 }}>
            {flags.ambulanceCompany
              ? <>Company: <strong style={{ color: '#f6ad55' }}>{flags.ambulanceCompany}</strong></>
              : 'Verify if this affects billing or document type'
            }
          </span>
        </div>
      )}

      {flags?.hasReferral && (
        <div style={{ ...styles.flagBanner, borderColor: '#76e4f7', background: '#0a2233' }}>
          <span style={{ color: '#76e4f7', fontWeight: 700 }}>↗ Referral detected</span>
          {flags.referrals?.length > 0 && (
            <span style={{ color: '#a0aec0', fontSize: 11 }}>
              {flags.referrals.join(' · ')}
            </span>
          )}
        </div>
      )}

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
          style={styles.input}
          placeholder="Escribe o selecciona un provider..."
          value={entityName}
          onChange={e => setEntityName(e.target.value)}
        />
      </div>

      {(form.docType === 'B' || form.docType === 'MR') && (
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>
              DOS Start {autoFilledFields.dosStart && <span style={styles.autoBadge}>auto</span>}
            </label>
            <input
              style={{ ...styles.input, ...(autoFilledFields.dosStart ? styles.inputAuto : {}) }}
              type="date" name="dosStart" value={form.dosStart}
              onChange={e => { handleChange(e); setAutoFilledFields(f => ({ ...f, dosStart: false })) }}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>
              DOS End {autoFilledFields.dosEnd && <span style={styles.autoBadge}>auto</span>}
            </label>
            <input
              style={{ ...styles.input, ...(autoFilledFields.dosEnd ? styles.inputAuto : {}) }}
              type="date" name="dosEnd" value={form.dosEnd}
              onChange={e => { handleChange(e); setAutoFilledFields(f => ({ ...f, dosEnd: false })) }}
            />
          </div>
        </div>
      )}

      {(form.docType === 'B' || form.docType === 'HL' || form.docType === 'PIP') && (
        <div style={styles.field}>
          <label style={styles.label}>
            Updated as of {autoFilledFields.updateDate && <span style={styles.autoBadge}>auto</span>}
          </label>
          <input
            style={{ ...styles.input, ...(autoFilledFields.updateDate ? styles.inputAuto : {}) }}
            type="date" name="updateDate" value={form.updateDate}
            onChange={e => { handleChange(e); setAutoFilledFields(f => ({ ...f, updateDate: false })) }}
          />
        </div>
      )}

      {form.docType === 'PIP' && (
        <div style={styles.field}>
          <label style={styles.label}>PIP Exhausted? (Y/N)</label>
          <select name="pipExhausted" value={form.pipExhausted} onChange={handleChange} style={styles.input}>
            <option value="N">N</option>
            <option value="Y">Y</option>
          </select>
        </div>
      )}

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
    minHeight: '100%',
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
    minHeight: 80,
    background: '#0f3460',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px dashed #2d3748',
    padding: '8px',
    textAlign: 'center',
  },
  previewText: { color: '#e2e8f0', margin: 0, fontSize: 12, wordBreak: 'break-all' },
  previewPlaceholder: { color: '#718096', margin: 0, fontSize: 12 },
  suggestion: {
    background: '#1a3a2a',
    border: '1px solid #2d6a4f',
    borderRadius: 8,
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    color: '#68d391',
  },
  confidence: {
    color: '#a0aec0',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  ocrBadge: {
    display: 'inline-block',
    padding: '1px 5px',
    background: '#744210',
    color: '#f6ad55',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  flagBanner: {
    borderRadius: 8,
    border: '1px solid',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 12,
  },
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
    width: '100%',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: 8 },
  autoBadge: {
    display: 'inline-block',
    marginLeft: 4,
    padding: '1px 5px',
    background: '#2d6a4f',
    color: '#68d391',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    verticalAlign: 'middle',
  },
  inputAuto: {
    borderColor: '#2d6a4f',
    background: '#1a3a2a',
  },
  namePreview: {
    background: '#0f3460',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nameLabel: { color: '#718096', margin: 0, fontSize: 12 },
  nameCurrent: { color: '#a0aec0', wordBreak: 'break-all' },
  nameNew: { color: '#68d391', fontWeight: 600, wordBreak: 'break-all' },
  actions: { display: 'flex', gap: 8, paddingBottom: '1rem' },
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