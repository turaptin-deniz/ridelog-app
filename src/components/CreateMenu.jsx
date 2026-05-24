import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'

// Limits — chosen to keep Supabase free-tier storage healthy
const MAX_IMAGE_MB = 8
const MAX_VIDEO_MB = 25
const MAX_VIDEO_SECONDS = 60

export default function CreateMenu({ open, onClose, onCreated }) {
  // view: 'menu' | 'post' | 'meetup'
  const [view, setView] = useState('menu')
  const [error, setError] = useState('')

  // Post state
  const [postContent, setPostContent] = useState('')
  const [postFile, setPostFile] = useState(null)
  const [postPreview, setPostPreview] = useState(null)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef()

  // Meetup state
  const [meetup, setMeetup] = useState({
    title: '', date: '', time: '', location: '', lat: null, lng: null,
    description: '', maxParticipants: ''
  })
  const [creatingMeetup, setCreatingMeetup] = useState(false)

  // Address autocomplete
  const [locationInput, setLocationInput] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [addressFocused, setAddressFocused] = useState(false)

  // Debounced address search (Nominatim)
  useEffect(() => {
    if (!locationInput || locationInput.length < 3) {
      setAddressResults([])
      return
    }
    // Don't search if user already selected this exact string
    if (locationInput === meetup.location && meetup.lat) return

    const timer = setTimeout(async () => {
      setSearchingAddress(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationInput)}&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'de' } }
        )
        const data = await res.json()
        setAddressResults(data || [])
      } catch (e) {
        setAddressResults([])
      } finally {
        setSearchingAddress(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [locationInput, meetup.location, meetup.lat])

  const pickAddress = (result) => {
    setMeetup({
      ...meetup,
      location: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    })
    setLocationInput(result.display_name)
    setAddressResults([])
    setAddressFocused(false)
  }

  // Reset when opened
  useEffect(() => {
    if (open) {
      setView('menu')
      setError('')
    }
  }, [open])

  if (!open) return null

  const close = () => {
    setPostContent('')
    setPostFile(null)
    setPostPreview(null)
    setMeetup({ title: '', date: '', time: '', location: '', lat: null, lng: null, description: '', maxParticipants: '' })
    setLocationInput('')
    setAddressResults([])
    setError('')
    setView('menu')
    onClose()
  }

  const pickFile = async (e) => {
    setError('')
    const file = e.target.files[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) {
      setError('Nur Bilder oder Videos erlaubt.')
      return
    }

    const sizeMB = file.size / (1024 * 1024)
    if (isImage && sizeMB > MAX_IMAGE_MB) {
      setError(`Bild zu groß (${sizeMB.toFixed(1)} MB). Max ${MAX_IMAGE_MB} MB.`)
      return
    }
    if (isVideo && sizeMB > MAX_VIDEO_MB) {
      setError(`Video zu groß (${sizeMB.toFixed(1)} MB). Max ${MAX_VIDEO_MB} MB.`)
      return
    }

    // For videos, check duration
    if (isVideo) {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.src = url
      const duration = await new Promise(resolve => {
        v.onloadedmetadata = () => resolve(v.duration)
        v.onerror = () => resolve(0)
      })
      URL.revokeObjectURL(url)
      if (duration > MAX_VIDEO_SECONDS) {
        setError(`Video zu lang (${Math.round(duration)}s). Max ${MAX_VIDEO_SECONDS}s.`)
        return
      }
    }

    setPostFile(file)
    setPostPreview(URL.createObjectURL(file))
  }

  const createPost = async () => {
    setError('')
    if (!postContent.trim() && !postFile) {
      setError('Schreib was oder lade ein Bild/Video hoch.')
      return
    }
    setPosting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let mediaUrl = null

      if (postFile) {
        const ext = postFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const bucket = postFile.type.startsWith('video') ? 'videos' : 'post-images'
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, postFile)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        mediaUrl = urlData.publicUrl
      }

      const { error: insErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: postContent,
        photos: mediaUrl ? [mediaUrl] : [],
      })
      if (insErr) throw insErr

      onCreated && onCreated('post')
      close()
    } catch (e) {
      setError(e.message || 'Fehler beim Posten.')
    } finally {
      setPosting(false)
    }
  }

  const createMeetup = async () => {
    setError('')
    if (!meetup.title.trim()) { setError('Gib der Tour einen Titel.'); return }
    if (!meetup.date || !meetup.time) { setError('Wähle Datum und Uhrzeit.'); return }
    if (!meetup.location.trim()) { setError('Treffpunkt fehlt.'); return }
    if (!meetup.lat || !meetup.lng) { setError('Bitte wähle eine Adresse aus den Vorschlägen.'); return }

    setCreatingMeetup(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const meetupAt = new Date(`${meetup.date}T${meetup.time}`).toISOString()

      // Detect "table doesn't exist" robustly — PostgREST code PGRST205 or various message variants
      const isMissingTable = (err) => {
        if (!err) return false
        if (err.code === 'PGRST205' || err.code === '42P01') return true
        const m = (err.message || '') + ' ' + (err.details || '') + ' ' + (err.hint || '')
        return /does not exist|not find the table|schema cache|relation .* does not/i.test(m)
      }

      // Try dedicated `meetups` table first
      const payload = {
        user_id: user.id,
        title: meetup.title,
        description: meetup.description || null,
        meetup_at: meetupAt,
        location: meetup.location,
        lat: meetup.lat,
        lng: meetup.lng,
        max_participants: meetup.maxParticipants ? parseInt(meetup.maxParticipants, 10) : null,
      }

      let { error: insErr } = await supabase.from('meetups').insert(payload)

      if (isMissingTable(insErr)) {
        // Fallback: store in routes table with meetup data nested in waypoints
        const fallback = {
          user_id: user.id,
          title: meetup.title,
          distance_km: 0,
          duration_minutes: 0,
          difficulty: 'meetup',
          surface: 'meetup',
          waypoints: [{
            address: meetup.location,
            lat: meetup.lat,
            lng: meetup.lng,
            meetup_at: meetupAt,
            description: meetup.description,
            max_participants: meetup.maxParticipants ? parseInt(meetup.maxParticipants, 10) : null,
          }],
        }
        const r = await supabase.from('routes').insert(fallback)
        if (r.error) throw r.error
      } else if (insErr) {
        throw insErr
      }

      onCreated && onCreated('meetup')
      close()
    } catch (e) {
      setError(e.message || 'Fehler beim Erstellen der Tour.')
    } finally {
      setCreatingMeetup(false)
    }
  }

  const backdrop = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: 'var(--space-4)'
  }
  const sheet = {
    background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)', width: '100%', maxWidth: '440px',
    maxHeight: '90vh', overflowY: 'auto',
    border: '1px solid var(--color-border-base)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  }
  const inputBase = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border-base)',
    borderRadius: 'var(--radius-base)',
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--font-size-base)',
    fontFamily: 'var(--font-family-primary)',
    outline: 'none',
    transition: 'border-color var(--transition-fast)'
  }
  const labelStyle = {
    display: 'block', marginBottom: 'var(--space-2)',
    fontSize: 'var(--font-size-xs)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)'
  }
  const focusOn = e => e.target.style.borderColor = 'var(--color-accent-primary)'
  const focusOff = e => e.target.style.borderColor = 'var(--color-border-base)'

  return (
    <div onClick={close} style={backdrop} className="animate-fadeIn">
      <div onClick={e => e.stopPropagation()} style={sheet} className="animate-scaleIn">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {view !== 'menu' && (
              <button onClick={() => { setView('menu'); setError('') }} style={{
                background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
                cursor: 'pointer', padding: 0, display: 'flex'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
              </button>
            )}
            <h3 style={{
              fontFamily: 'var(--font-family-condensed)',
              fontSize: 'var(--font-size-xl)', fontWeight: 700,
              color: 'var(--color-text-primary)', margin: 0
            }}>
              {view === 'menu' && 'Erstellen'}
              {view === 'post' && 'Neuer Post'}
              {view === 'meetup' && 'Tour planen'}
            </h3>
          </div>
          <button onClick={close} style={{
            background: 'none', border: 'none', color: 'var(--color-text-muted)',
            cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1
          }}>×</button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--color-danger)', padding: 'var(--space-3)',
            borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--space-4)'
          }}>{error}</div>
        )}

        {/* === MENU === */}
        {view === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <OptionCard
              onClick={() => setView('post')}
              accent="var(--color-accent-primary)"
              title="Post erstellen"
              desc="Foto, Video oder einfach Text mit der Community teilen"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              }
            />
            <OptionCard
              onClick={() => setView('meetup')}
              accent="var(--color-accent-secondary)"
              title="Tour planen"
              desc="Biker-Treffen organisieren — Standort, Datum, Uhrzeit, Anmeldung"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              }
            />
          </div>
        )}

        {/* === POST === */}
        {view === 'post' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <textarea
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              placeholder="Was läuft? Welche Tour, welches Bike?"
              rows={4}
              style={{ ...inputBase, resize: 'none', fontSize: 'var(--font-size-base)', lineHeight: 1.5 }}
              onFocus={focusOn} onBlur={focusOff}
            />

            {/* Preview */}
            {postPreview && (
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-base)' }}>
                {postFile?.type.startsWith('video') ? (
                  <video src={postPreview} controls style={{ width: '100%', maxHeight: '300px', display: 'block' }} />
                ) : (
                  <img src={postPreview} alt="" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                )}
                <button onClick={() => { setPostFile(null); setPostPreview(null) }} style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.75)', border: 'none', color: 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Upload buttons */}
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pickFile} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => fileRef.current.click()} style={{
                flex: 1, background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-base)',
                color: 'var(--color-text-primary)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
                cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                fontFamily: 'var(--font-family-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-base)'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Bild / Video
              </button>
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Bild max {MAX_IMAGE_MB} MB · Video max {MAX_VIDEO_MB} MB / {MAX_VIDEO_SECONDS}s
            </div>

            <PrimaryButton onClick={createPost} disabled={posting} label={posting ? 'Lädt hoch…' : 'Posten'} />
          </div>
        )}

        {/* === MEETUP === */}
        {view === 'meetup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={labelStyle}>Titel</label>
              <input
                type="text" value={meetup.title}
                onChange={e => setMeetup({ ...meetup, title: e.target.value })}
                placeholder="z.B. Alpentour, Café-Treff, Trackday"
                style={inputBase} onFocus={focusOn} onBlur={focusOff}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={labelStyle}>Datum</label>
                <input
                  type="date" value={meetup.date}
                  onChange={e => setMeetup({ ...meetup, date: e.target.value })}
                  style={inputBase} onFocus={focusOn} onBlur={focusOff}
                />
              </div>
              <div>
                <label style={labelStyle}>Uhrzeit</label>
                <input
                  type="time" value={meetup.time}
                  onChange={e => setMeetup({ ...meetup, time: e.target.value })}
                  style={inputBase} onFocus={focusOn} onBlur={focusOff}
                />
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Treffpunkt (Adresse)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => {
                    setLocationInput(e.target.value)
                    if (meetup.lat) setMeetup({ ...meetup, location: '', lat: null, lng: null })
                  }}
                  onFocus={() => { setAddressFocused(true); focusOn({ target: { style: {} } }) }}
                  onBlur={(e) => {
                    // Delay so click on result registers
                    setTimeout(() => setAddressFocused(false), 200)
                    focusOff(e)
                  }}
                  placeholder="z.B. Marienplatz, München"
                  style={{ ...inputBase, paddingRight: '36px' }}
                />
                {/* Status icon */}
                <div style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center'
                }}>
                  {searchingAddress ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin" style={{ color: 'var(--color-text-muted)' }}>
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10"/>
                    </svg>
                  ) : meetup.lat ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  )}
                </div>
              </div>

              {/* Results dropdown */}
              {addressFocused && addressResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  marginTop: '4px', zIndex: 10,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-base)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  overflow: 'hidden', maxHeight: '240px', overflowY: 'auto'
                }}>
                  {addressResults.map(r => (
                    <button
                      key={r.place_id}
                      onMouseDown={(e) => { e.preventDefault(); pickAddress(r) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none',
                        padding: 'var(--space-3) var(--space-4)',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                        fontSize: 'var(--font-size-sm)',
                        lineHeight: 1.4,
                        borderBottom: '1px solid var(--color-border-light)',
                        transition: 'background var(--transition-fast)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>{r.display_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!meetup.lat && locationInput.length >= 3 && !searchingAddress && addressResults.length === 0 && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                  Keine Treffer — versuch's spezifischer.
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Beschreibung (optional)</label>
              <textarea
                value={meetup.description}
                onChange={e => setMeetup({ ...meetup, description: e.target.value })}
                placeholder="Route, Treffpunkt-Details, Anforderungen…"
                rows={3}
                style={{ ...inputBase, resize: 'none' }} onFocus={focusOn} onBlur={focusOff}
              />
            </div>

            <div>
              <label style={labelStyle}>Max. Teilnehmer (optional)</label>
              <input
                type="number" min="2" value={meetup.maxParticipants}
                onChange={e => setMeetup({ ...meetup, maxParticipants: e.target.value })}
                placeholder="z.B. 10"
                style={inputBase} onFocus={focusOn} onBlur={focusOff}
              />
            </div>

            <PrimaryButton onClick={createMeetup} disabled={creatingMeetup} label={creatingMeetup ? 'Wird erstellt…' : 'Tour erstellen'} />
          </div>
        )}

      </div>
    </div>
  )
}

// --- Small helpers ---

function OptionCard({ onClick, accent, title, desc, icon }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
      padding: 'var(--space-4)', textAlign: 'left',
      background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-base)',
      borderRadius: 'var(--radius-md)', cursor: 'pointer',
      transition: 'all var(--transition-fast)',
      fontFamily: 'var(--font-family-primary)'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = accent
      e.currentTarget.style.transform = 'translateY(-1px)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--color-border-base)'
      e.currentTarget.style.transform = 'translateY(0)'
    }}>
      <div style={{
        width: '44px', height: '44px', flexShrink: 0,
        borderRadius: 'var(--radius-md)',
        background: `${accent}22`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontWeight: 700, fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-primary)', margin: 0, marginBottom: '4px'
        }}>{title}</p>
        <p style={{
          fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
          margin: 0, lineHeight: 1.4
        }}>{desc}</p>
      </div>
    </button>
  )
}

function PrimaryButton({ onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: 'var(--space-3)',
      background: disabled ? 'var(--color-text-muted)' : 'linear-gradient(135deg, var(--color-accent-primary) 0%, #ff5a1f 100%)',
      color: 'white', border: 'none',
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--font-size-base)', fontWeight: 700,
      fontFamily: 'var(--font-family-primary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 15px rgba(255,107,53,0.25)',
      transition: 'all var(--transition-fast)'
    }}>{label}</button>
  )
}
