import { useState } from 'react'

/**
 * FilePreview
 *
 * Renders a live preview of the currently loaded document inside the
 * "Preview" tab, with zoom in / zoom out controls.
 *
 *  - PDFs  → <iframe> using Chromium's built-in PDF viewer, scaled via
 *            a CSS transform wrapper inside a scrollable container.
 *  - Images → <img> whose width grows/shrinks proportionally with zoom.
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
  const [zoom, setZoom] = useState(1)

  const zoomIn    = () => setZoom(z => Math.min(3,    +(z + 0.25).toFixed(2)))
  const zoomOut   = () => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))
  const resetZoom = () => setZoom(1)

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

  /* ── Zoom toolbar (shared by PDF and image) ───────────────────────── */
  const toolbar = (
    <div style={styles.toolbar}>
      <span style={styles.fileName}>{file.name}</span>
      <div style={styles.zoomControls}>
        <button style={styles.zoomBtn} onClick={zoomOut} disabled={zoom <= 0.25} title="Zoom out">−</button>
        <button style={styles.zoomLabel} onClick={resetZoom} title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button style={styles.zoomBtn} onClick={zoomIn}  disabled={zoom >= 3}    title="Zoom in">+</button>
      </div>
    </div>
  )

  /* ── PDF ──────────────────────────────────────────────────────────── */
  if (mimeType === 'application/pdf') {
    // The iframe is placed inside a wrapper that grows with zoom.
    // The outer scroll container lets the user pan when zoomed in.
    return (
      <div style={styles.outerWrap}>
        {toolbar}
        <div style={styles.scrollArea}>
          <div style={{
            transformOrigin: 'top left',
            transform: `scale(${zoom})`,
            // When zoomed out the wrapper collapses; force minimum height.
            width:  `${100 / zoom}%`,
            height: `${Math.max(500, 500 * zoom)}px`,
          }}>
            <iframe
              src={dataUrl}
              style={styles.frame}
              title={file.name}
            />
          </div>
        </div>
      </div>
    )
  }

  /* ── Image ────────────────────────────────────────────────────────── */
  if (mimeType.startsWith('image/')) {
    return (
      <div style={styles.outerWrap}>
        {toolbar}
        <div style={styles.scrollArea}>
          <img
            src={dataUrl}
            alt={file.name}
            style={{ ...styles.image, width: `${zoom * 100}%` }}
          />
        </div>
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
  emptyIcon:  { fontSize: 32, lineHeight: 1 },
  emptyTitle: { color: '#556270', margin: 0, fontSize: 13, fontWeight: 600 },
  emptyHint:  { color: '#3A4A5A', margin: 0, fontSize: 12, textAlign: 'center', lineHeight: 1.5 },
  hint:       { color: '#C9A84C', fontWeight: 600 },

  outerWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 0,
  },

  /* Toolbar row: filename on the left, zoom controls on the right */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  fileName: {
    color: '#8B95A1',
    fontSize: 11,
    letterSpacing: '0.04em',
    wordBreak: 'break-all',
    flex: 1,
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  zoomBtn: {
    width: 28,
    height: 24,
    borderRadius: 3,
    border: '1px solid #2E4057',
    background: '#243447',
    color: '#F5F0E8',
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
  },
  zoomLabel: {
    minWidth: 46,
    height: 24,
    borderRadius: 3,
    border: '1px solid #2E4057',
    background: 'transparent',
    color: '#8B95A1',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
  },

  /* Scrollable viewport for zoomed content */
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    border: '1px solid #2E4057',
    borderRadius: 3,
    background: '#1a1a1a',
    minHeight: 400,
  },

  frame: {
    width: '100%',
    height: '100%',
    minHeight: 500,
    border: 'none',
    display: 'block',
    background: '#fff',
  },

  image: {
    display: 'block',
    maxWidth: '100%',
    background: '#fff',
  },
}
