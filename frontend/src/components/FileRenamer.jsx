import { useState, useEffect } from 'react'
import api from '../services/api'
import ChatPanel from './ChatPanel'
import AIConsentModal from './AIConsentModal'

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
  const [sessionId, setSessionId] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  // AI consent is requested once per session before sending any document to Gemini.
  // Not persisted to localStorage — each app session requires a fresh acknowledgement.
  const [aiConsent, setAiConsent] = useState(null) // null = not asked | 'pending' | 'granted' | 'denied'
  const [pendingFile, setPendingFile] = useState(null) // file waiting for consent

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

  // Core analysis logic — called after consent is confirmed.
  const runAnalysis = async (file) => {
    try {
      const { data } = await api.post('/analyze', { filePath: file.path })
      const filled = {}

      if (data.sessionId) setSessionId(data.sessionId)

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
      console.error('Analysis error:', err)
    }
  }

  const handleSelectFile = async () => {
    const file = await window.electronAPI.selectFile()
    if (!file) return

    setCurrentFile(file)
    setSuggestedProvider(null)

    // Only PDF and image files can be analyzed.
    const ext = file.name.split('.').pop().toLowerCase()
    const analyzable = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp']
    if (!analyzable.includes(ext)) return

    // If consent was already granted this session, analyze immediately.
    if (aiConsent === 'granted') {
      runAnalysis(file)
      return
    }

    // If consent was denied, still set the file but skip AI analysis entirely.
    if (aiConsent === 'denied') {
      runAnalysis(file) // local-only (server still runs regex/fuzzy, no Gemini)
      return
    }

    // First time — show the consent modal before sending anything to the server.
    setPendingFile(file)
    setAiConsent('pending')
  }

  const handleConsentAccept = () => {
    setAiConsent('granted')
    if (pendingFile) runAnalysis(pendingFile)
    setPendingFile(null)
  }

  const handleConsentCancel = () => {
    setAiConsent('denied')
    // Still run local analysis (regex + fuzzy), just no Gemini escalation.
    // The server only calls Gemini if GEMINI_API_KEY is set, so no special
    // flag is needed — local analysis always runs regardless of consent.
    if (pendingFile) runAnalysis(pendingFile)
    setPendingFile(null)
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
      setSessionId(null)
      setChatOpen(false)
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
    setSessionId(null)
    setChatOpen(false)
  }

  return (
    <div style={styles.container}>
      {aiConsent === 'pending' && (
        <AIConsentModal
          onAccept={handleConsentAccept}
          onCancel={handleConsentCancel}
        />
      )}

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
        <div style={{ ...styles.flagBanner, borderColor: '#B8860B', background: '#2A1F08' }}>
          <span style={{ color: '#C9A84C', fontWeight: 600, fontSize: 12 }}>🚑 Ambulance transport detected</span>
          <span style={{ color: '#8B95A1', fontSize: 11 }}>
            {flags.ambulanceCompany
              ? <>Company: <strong style={{ color: '#E8C96A' }}>{flags.ambulanceCompany}</strong></>
              : 'Verify if this affects billing or document type'
            }
          </span>
        </div>
      )}

      {flags?.hasReferral && (
        <div style={{ ...styles.flagBanner, borderColor: '#2E6DA4', background: '#0A1E32' }}>
          <span style={{ color: '#7BB3D9', fontWeight: 600, fontSize: 12 }}>↗ Referral detected</span>
          {flags.referrals?.length > 0 && (
            <span style={{ color: '#8B95A1', fontSize: 11 }}>
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

      {sessionId && (
        <button style={styles.chatBtn} onClick={() => setChatOpen(true)}>
          💬 Ask AI about this document
        </button>
      )}

      {chatOpen && sessionId && (
        <ChatPanel
          sessionId={sessionId}
          documentName={currentFile?.name}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    flex: 1,
    minHeight: 0,
    padding: '1rem',
    background: '#1B2D42',
    borderRadius: 4,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: {
    color: '#C9A84C',
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  tabs: { display: 'flex', gap: 8 },
  tabActive: {
    color: '#F5F0E8',
    fontSize: 12,
    padding: '3px 12px',
    background: '#243447',
    borderRadius: 2,
    border: '1px solid #2E4057',
  },
  preview: {
    minHeight: 76,
    background: '#243447',
    borderRadius: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px dashed #2E4057',
    padding: '8px',
    textAlign: 'center',
    transition: 'border-color 0.2s',
  },
  previewText: { color: '#F5F0E8', margin: 0, fontSize: 12, wordBreak: 'break-all' },
  previewPlaceholder: { color: '#556270', margin: 0, fontSize: 12 },
  suggestion: {
    background: 'rgba(201,168,76,0.08)',
    border: '1px solid rgba(201,168,76,0.35)',
    borderRadius: 3,
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    color: '#C9A84C',
  },
  confidence: {
    color: '#8B95A1',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  ocrBadge: {
    display: 'inline-block',
    padding: '1px 5px',
    background: '#2A1F08',
    color: '#C9A84C',
    borderRadius: 2,
    fontSize: 10,
    fontWeight: 600,
  },
  flagBanner: {
    borderRadius: 3,
    border: '1px solid',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 12,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { color: '#8B95A1', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' },
  input: {
    padding: '7px 10px',
    borderRadius: 3,
    border: '1px solid #2E4057',
    background: '#243447',
    color: '#F5F0E8',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  row: { display: 'flex', gap: 8 },
  autoBadge: {
    display: 'inline-block',
    marginLeft: 4,
    padding: '1px 5px',
    background: 'rgba(201,168,76,0.15)',
    color: '#C9A84C',
    borderRadius: 2,
    fontSize: 10,
    fontWeight: 600,
    verticalAlign: 'middle',
  },
  inputAuto: {
    borderColor: 'rgba(201,168,76,0.4)',
    background: 'rgba(201,168,76,0.06)',
  },
  namePreview: {
    background: '#0D1B2A',
    borderRadius: 3,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    border: '1px solid #2E4057',
  },
  nameLabel: { color: '#556270', margin: 0, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' },
  nameCurrent: { color: '#8B95A1', wordBreak: 'break-all', fontSize: 12 },
  nameNew: { color: '#C9A84C', fontWeight: 600, wordBreak: 'break-all', fontSize: 12 },
  actions: { display: 'flex', gap: 8, paddingBottom: '1rem' },
  btnPrimary: {
    flex: 1,
    padding: '9px',
    borderRadius: 3,
    border: 'none',
    background: '#C9A84C',
    color: '#0D1B2A',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  btnSecondary: {
    flex: 1,
    padding: '9px',
    borderRadius: 3,
    border: '1px solid #2E4057',
    background: 'transparent',
    color: '#8B95A1',
    fontSize: 13,
    cursor: 'pointer',
  },
  chatBtn: {
    width: '100%',
    padding: '9px',
    borderRadius: 3,
    border: '1px solid rgba(201,168,76,0.35)',
    background: 'rgba(201,168,76,0.08)',
    color: '#C9A84C',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '0.5rem',
    letterSpacing: '0.04em',
  },
}