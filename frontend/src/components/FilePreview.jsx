/**
 * FilePreview
 *
 * Renders a live preview of the currently loaded document inside the
 * "Preview" tab.  PDFs are displayed via an <iframe> using Chromium's
 * built-in PDF viewer.  Images are displayed with an <img> tag.
 *
 * Both use a base64 data-URL built from bytes fetched via the
 * read-file-base64 IPC channel — no file:// access or custom protocol
 * required, so webSecurity stays enabled.
 *
 * Props:
 *   file        {object|null}  The file object from electronAPI.selectFile().
 *   previewData {null|'loading'|{base64, mimeType}}
 *               null      — no file loaded or load failed
 *               'loading' — IPC call in-flight
 *               object    — ready to render
 */
export default function FilePreview({ file, previewData }) {

  /* ── No file selected ─────────────────────────────────────────────── */
  if (!file) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>📄</span>
        <p style={styles.emptyTitle}>No file selected</p>
        <p style={styles.emptyHint}>
          Select a file in the <strong style={styles.hint}>Rename</strong> tab to preview it here.
        </p>
      </div>
    )
  }

  /* ── Loading ───────────────────────────────────────────────────────── */
  if (previewData === 'loading') {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>⏳</span>
        <p style={styles.emptyTitle}>Loading preview…</p>
      </div>
    )
  }

  /* ── Load failed / unsupported type ───────────────────────────────── */
  if (!previewData) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>🚫</span>
        <p style={styles.emptyTitle}>Preview not available</p>
        <p style={styles.emptyHint}>This file type cannot be previewed.</p>
      </div>
    )
  }

  const { base64, mimeType } = previewData
  const dataUrl = `data:${mimeType};base64,${base64}`

  /* ── PDF ──────────────────────────────────────────────────────────── */
  if (mimeType === 'application/pdf') {
    return (
      <div style={styles.frameWrap}>
        <p style={styles.fileName}>{file.name}</p>
        <iframe
          src={dataUrl}
          style={styles.frame}
          title={file.name}
        />
      </div>
    )
  }

  /* ── Image ────────────────────────────────────────────────────────── */
  if (mimeType.startsWith('image/')) {
    return (
      <div style={styles.imageWrap}>
        <p style={styles.fileName}>{file.name}</p>
        <img src={dataUrl} alt={file.name} style={styles.image} />
      </div>
    )
  }

  /* ── Fallback ─────────────────────────────────────────────────────── */
  return (
    <div style={styles.empty}>
      <span style={styles.emptyIcon}>🚫</span>
      <p style={styles.emptyTitle}>Preview not available</p>
      <p style={styles.emptyHint}>This file type cannot be previewed.</p>
    </div>
  )
}

const styles = {
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '2rem',
    background: '#0D1B2A',
    borderRadius: 3,
    border: '1px dashed #2E4057',
    minHeight: 300,
  },
  emptyIcon: {
    fontSize: 32,
    lineHeight: 1,
  },
  emptyTitle: {
    color: '#556270',
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
  },
  emptyHint: {
    color: '#3A4A5A',
    margin: 0,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  hint: {
    color: '#C9A84C',
    fontWeight: 600,
  },
  frameWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 0,
  },
  frame: {
    flex: 1,
    width: '100%',
    minHeight: 500,
    border: '1px solid #2E4057',
    borderRadius: 3,
    background: '#fff',
  },
  imageWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflow: 'auto',
  },
  image: {
    maxWidth: '100%',
    borderRadius: 3,
    border: '1px solid #2E4057',
    background: '#fff',
  },
  fileName: {
    color: '#8B95A1',
    fontSize: 11,
    margin: 0,
    letterSpacing: '0.04em',
    wordBreak: 'break-all',
  },
}
