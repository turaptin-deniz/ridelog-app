import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'

const MAX_IMAGE_MB = 8
const MAX_VIDEO_MB = 25
const MAX_VIDEO_SECONDS = 60
const MAX_SLIDES = 10

const getVideoDuration = (file) => new Promise(resolve => {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.src = url
  v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
  v.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
})

const VEHICLE_FILTERS = [
  { id: 'all',   label: 'Alle Fahrzeuge',  emoji: '🚦' },
  { id: 'motos', label: 'Nur Motorräder',  emoji: '🏍️' },
  { id: 'cars',  label: 'Nur Autos',       emoji: '🚗' },
  { id: 'quads', label: 'Quads & ATVs',    emoji: '🚜' },
]

export default function CreateMenu({ open, onClose, onCreated, lang }) {
  const [view, setView] = useState('menu')
  const [error, setError] = useState('')

  // Post state — array of slides
  const [slides, setSlides] = useState([])     // [{id, file, preview, type}]
  const [activeSlide, setActiveSlide] = useState(0)
  const [postContent, setPostContent] = useState('')
  const [posting, setPosting] = useState(false)
  const fileRef = useRef()

  // Meetup state
  const [meetup, setMeetup] = useState({ title: '', date: '', time: '', description: '', maxParticipants: '' })
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [creatingMeetup, setCreatingMeetup] = useState(false)
  const newStop = () => ({ id: Math.random().toString(36).slice(2), input: '', address: '', lat: null, lng: null })
  const [stops, setStops] = useState([newStop()])
  const updateStop = (id, patch) => setStops(stops.map(s => s.id === id ? { ...s, ...patch } : s))
  const addStop = () => setStops([...stops, newStop()])
  const removeStop = (id) => setStops(stops.filter(s => s.id !== id))

  useEffect(() => {
    if (open) {
      setView('menu')
      setError('')
      setSlides([])
      setActiveSlide(0)
      setPostContent('')
      setMeetup({ title: '', date: '', time: '', description: '', maxParticipants: '' })
      setVehicleFilter('all')
      setStops([newStop()])
    }
  }, [open])

  if (!open) return null

  const close = () => {
    setSlides([])
    setActiveSlide(0)
    setPostContent('')
    setMeetup({ title: '', date: '', time: '', description: '', maxParticipants: '' })
    setStops([newStop()])
    setError('')
    setView('menu')
    onClose()
  }

  const addFiles = async (fileList) => {
    setError('')
    const incoming = Array.from(fileList)
    const toAdd = []

    for (const file of incoming) {
      if (slides.length + toAdd.length >= MAX_SLIDES) {
        setError(`Maximal ${MAX_SLIDES} Medien pro Post.`)
        break
      }
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) { setError('Nur Bilder oder Videos erlaubt.'); continue }

      const sizeMB = file.size / (1024 * 1024)
      if (isImage && sizeMB > MAX_IMAGE_MB) { setError(`${file.name}: max ${MAX_IMAGE_MB} MB`); continue }
      if (isVideo && sizeMB > MAX_VIDEO_MB) { setError(`${file.name}: max ${MAX_VIDEO_MB} MB`); continue }
      if (isVideo) {
        const dur = await getVideoDuration(file)
        if (dur > MAX_VIDEO_SECONDS) { setError(`Video zu lang (${Math.round(dur)}s). Max ${MAX_VIDEO_SECONDS}s.`); continue }
      }
      toAdd.push({ id: Math.random().toString(36).slice(2), file, preview: URL.createObjectURL(file), type: isVideo ? 'video' : 'image' })
    }

    if (toAdd.length) {
      setSlides(prev => {
        const next = [...prev, ...toAdd]
        setActiveSlide(next.length - 1)
        return next
      })
    }
    // reset input so same file can be re-added after remove
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeSlide = (id) => {
    setSlides(prev => {
      const next = prev.filter(s => s.id !== id)
      setActiveSlide(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  const createPost = async () => {
    setError('')
    if (!postContent.trim() && slides.length === 0) {
      setError('Schreib etwas oder lade Medien hoch.')
      return
    }
    setPosting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const photos = []

      for (const slide of slides) {
        const ext = slide.file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const bucket = slide.type === 'video' ? 'videos' : 'post-images'
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, slide.file)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        photos.push(urlData.publicUrl)
      }

      const { error: insErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: postContent,
        photos,
      })
      if (insErr) throw insErr

      // Notify Profile to refresh
      window.dispatchEvent(new CustomEvent('ridelog:post-created'))
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
    const validStops = stops.filter(s => s.address && s.lat && s.lng)
    if (validStops.length === 0) { setError('Wähle mindestens einen Treffpunkt aus den Adressvorschlägen.'); return }
    if (validStops.length < stops.length) { setError('Manche Stopps haben keine gültige Adresse. Wähle aus den Vorschlägen oder entferne den Stopp.'); return }

    setCreatingMeetup(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const meetupAt = new Date(`${meetup.date}T${meetup.time}`).toISOString()
      const meetingPoint = validStops[0]
      const isMissingTable = (err) => {
        if (!err) return false
        if (err.code === 'PGRST205' || err.code === '42P01') return true
        const m = (err.message || '') + ' ' + (err.details || '') + ' ' + (err.hint || '')
        return /does not exist|not find the table|schema cache|relation .* does not/i.test(m)
      }
      const waypointsJson = validStops.map((s, i) => ({
        type: i === 0 ? 'meetup' : 'stop', order: i,
        address: s.address, lat: s.lat, lng: s.lng,
        ...(i === 0 ? { meetup_at: meetupAt, description: meetup.description || null, max_participants: meetup.maxParticipants ? parseInt(meetup.maxParticipants, 10) : null } : {})
      }))
      const meetupPayload = {
        user_id: user.id, title: meetup.title, description: meetup.description || null,
        meetup_at: meetupAt, location: meetingPoint.address,
        lat: meetingPoint.lat, lng: meetingPoint.lng,
        max_participants: meetup.maxParticipants ? parseInt(meetup.maxParticipants, 10) : null,
        waypoints: waypointsJson,
        vehicle_filter: vehicleFilter,
      }
      let { error: insErr } = await supabase.from('meetups').insert(meetupPayload)
      if (insErr && /vehicle_filter|column/i.test(insErr.message || '')) {
        // vehicle_filter column missing — retry without it
        const { vehicle_filter: _, ...payloadNoFilter } = meetupPayload
        const r2 = await supabase.from('meetups').insert(payloadNoFilter)
        if (r2.error && isMissingTable(r2.error)) {
          const r3 = await supabase.from('routes').insert({ user_id: user.id, title: `[MEETUP] ${meetup.title}`, distance_km: 0, duration_minutes: 0, difficulty: 'easy', surface: 'asphalt', waypoints: waypointsJson })
          if (r3.error) throw r3.error
        } else if (r2.error) throw r2.error
      } else if (isMissingTable(insErr)) {
        const r = await supabase.from('routes').insert({
          user_id: user.id, title: `[MEETUP] ${meetup.title}`,
          distance_km: 0, duration_minutes: 0, difficulty: 'easy', surface: 'asphalt',
          waypoints: waypointsJson,
        })
        if (r.error) throw r.error
      } else if (insErr) throw insErr

      onCreated && onCreated('meetup')
      close()
    } catch (e) {
      setError(e.message || 'Fehler beim Erstellen der Tour.')
    } finally {
      setCreatingMeetup(false)
    }
  }

  // ---- Styles ----
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
    outline: 'none', transition: 'border-color var(--transition-fast)'
  }
  const labelStyle = {
    display: 'block', marginBottom: 'var(--space-2)',
    fontSize: 'var(--font-size-xs)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)'
  }
  const focusOn = e => e.target.style.borderColor = 'var(--color-accent-primary)'
  const focusOff = e => e.target.style.borderColor = 'var(--color-border-base)'

  const cur = slides[activeSlide]

  return (
    <div onClick={close} style={backdrop} className="animate-fadeIn">
      <div onClick={e => e.stopPropagation()} style={sheet} className="animate-scaleIn">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {view !== 'menu' && (
              <button onClick={() => { setView('menu'); setError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
              </button>
            )}
            <h3 style={{ fontFamily: 'var(--font-family-condensed)', fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {view === 'menu' && 'Erstellen'}
              {view === 'post' && 'Neuer Post'}
              {view === 'meetup' && 'Event planen'}
            </h3>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)', padding: 'var(--space-3)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        {/* === MENU === */}
        {view === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <OptionCard onClick={() => setView('post')} accent="var(--color-accent-primary)" title="Post erstellen" desc="Bis zu 10 Fotos, Videos oder Text mit der Community teilen"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
            />
            <OptionCard onClick={() => setView('meetup')} accent="var(--color-accent-secondary)" title="Event planen" desc="Treffen organisieren — Standort, Datum, Fahrzeugtyp, Anmeldung"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            />
          </div>
        )}

        {/* === POST === */}
        {view === 'post' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

            {/* Big preview */}
            {slides.length > 0 && cur && (
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
                {cur.type === 'video'
                  ? <video src={cur.preview} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <img src={cur.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                }
                {/* Slide counter */}
                {slides.length > 1 && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.65)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, color: 'white', fontFamily: "'Barlow', sans-serif" }}>
                    {activeSlide + 1} / {slides.length}
                  </div>
                )}
                {/* Arrows */}
                {slides.length > 1 && activeSlide > 0 && (
                  <button onClick={() => setActiveSlide(i => i - 1)} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                )}
                {slides.length > 1 && activeSlide < slides.length - 1 && (
                  <button onClick={() => setActiveSlide(i => i + 1)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
                {/* Dots */}
                {slides.length > 1 && (
                  <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                    {slides.map((_, i) => (
                      <div key={i} onClick={() => setActiveSlide(i)} style={{ height: '6px', width: i === activeSlide ? '18px' : '6px', borderRadius: '3px', background: i === activeSlide ? 'white' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s ease', cursor: 'pointer' }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Slide strip + add button */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'center' }}>
              {slides.map((slide, i) => (
                <div key={slide.id} onClick={() => setActiveSlide(i)} style={{ position: 'relative', flexShrink: 0, width: '64px', height: '64px', borderRadius: 'var(--radius-base)', overflow: 'hidden', cursor: 'pointer', border: i === activeSlide ? '2px solid var(--color-accent-primary)' : '2px solid transparent', transition: 'border 0.15s', boxSizing: 'border-box' }}>
                  {slide.type === 'video'
                    ? <video src={slide.preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={slide.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                  {/* Remove */}
                  <button onClick={e => { e.stopPropagation(); removeSlide(slide.id) }} style={{ position: 'absolute', top: '3px', right: '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', lineHeight: 1 }}>×</button>
                  {/* Video icon */}
                  {slide.type === 'video' && (
                    <div style={{ position: 'absolute', bottom: '3px', left: '3px', background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '1px 3px', display: 'flex', alignItems: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}
                </div>
              ))}
              {/* Add more button */}
              {slides.length < MAX_SLIDES && (
                <button onClick={() => fileRef.current.click()} style={{ flexShrink: 0, width: '64px', height: '64px', borderRadius: 'var(--radius-base)', background: 'var(--color-bg-primary)', border: '1px dashed var(--color-border-strong)', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all var(--transition-fast)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.color = 'var(--color-accent-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {slides.length === 0 && <span style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-family-primary)', textAlign: 'center', lineHeight: 1.2 }}>Medien</span>}
                </button>
              )}
            </div>

            {/* Empty state hint */}
            {slides.length === 0 && (
              <button onClick={() => fileRef.current.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-6)', background: 'var(--color-bg-primary)', border: '1px dashed var(--color-border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', width: '100%', boxSizing: 'border-box', transition: 'all var(--transition-fast)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-strong)'}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-family-primary)', marginBottom: '4px' }}>Fotos & Videos hinzufügen</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-primary)' }}>Bis zu {MAX_SLIDES} Medien · Bild max {MAX_IMAGE_MB} MB · Video max {MAX_VIDEO_MB} MB</p>
                </div>
              </button>
            )}

            <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />

            {/* Caption */}
            <textarea
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              placeholder="Was läuft? Welche Tour, welches Bike?"
              rows={3}
              style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }}
              onFocus={focusOn} onBlur={focusOff}
            />

            <PrimaryButton onClick={createPost} disabled={posting} label={posting ? `Lädt hoch… (${slides.length} Dateien)` : 'Posten'} />
          </div>
        )}

        {/* === MEETUP === */}
        {view === 'meetup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={labelStyle}>Titel</label>
              <input type="text" value={meetup.title} onChange={e => setMeetup({ ...meetup, title: e.target.value })} placeholder="z.B. Alpentour, Café-Treff, Trackday" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={labelStyle}>Datum</label>
                <input type="date" value={meetup.date} onChange={e => setMeetup({ ...meetup, date: e.target.value })} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <div>
                <label style={labelStyle}>Uhrzeit</label>
                <input type="time" value={meetup.time} onChange={e => setMeetup({ ...meetup, time: e.target.value })} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Route (Treffpunkt + Stopps)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {stops.map((stop, index) => (
                  <StopRow key={stop.id} stop={stop} index={index} canRemove={stops.length > 1} onChange={patch => updateStop(stop.id, patch)} onRemove={() => removeStop(stop.id)} />
                ))}
              </div>
              <button onClick={addStop} style={{ marginTop: 'var(--space-3)', width: '100%', padding: 'var(--space-3)', background: 'transparent', border: '1px dashed var(--color-border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-family-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all var(--transition-fast)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.color = 'var(--color-accent-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Stopp hinzufügen
              </button>
            </div>
            <div>
              <label style={labelStyle}>Beschreibung (optional)</label>
              <textarea value={meetup.description} onChange={e => setMeetup({ ...meetup, description: e.target.value })} placeholder="Route, Treffpunkt-Details, Anforderungen…" rows={3} style={{ ...inputBase, resize: 'none' }} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Max. Teilnehmer (optional)</label>
              <input type="number" min="2" value={meetup.maxParticipants} onChange={e => setMeetup({ ...meetup, maxParticipants: e.target.value })} placeholder="z.B. 10" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>

            {/* Vehicle filter */}
            <div>
              <label style={labelStyle}>Fahrzeugtyp</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {VEHICLE_FILTERS.map(vf => (
                  <button key={vf.id} onClick={() => setVehicleFilter(vf.id)} style={{
                    padding: '10px 12px', background: vehicleFilter === vf.id ? 'rgba(59,130,246,0.12)' : 'var(--color-bg-primary)',
                    border: `1.5px solid ${vehicleFilter === vf.id ? 'var(--color-accent-primary)' : 'var(--color-border-base)'}`,
                    borderRadius: 'var(--radius-base)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    color: vehicleFilter === vf.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)', fontWeight: 600,
                    fontFamily: 'var(--font-family-primary)', transition: 'all var(--transition-fast)'
                  }}>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>{vf.emoji}</span>
                    <span>{vf.label}</span>
                    {vehicleFilter === vf.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <PrimaryButton onClick={createMeetup} disabled={creatingMeetup} label={creatingMeetup ? 'Wird erstellt…' : 'Event erstellen'} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Sub-components ----

function OptionCard({ onClick, accent, title, desc, icon }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'left', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-base)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontFamily: 'var(--font-family-primary)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-base)'; e.currentTarget.style.transform = 'translateY(0)' }}>
      <div style={{ width: '44px', height: '44px', flexShrink: 0, borderRadius: 'var(--radius-md)', background: `${accent}22`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', margin: 0, marginBottom: '4px' }}>{title}</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>{desc}</p>
      </div>
    </button>
  )
}

function StopRow({ stop, index, canRemove, onChange, onRemove }) {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!stop.input || stop.input.length < 3) { setResults([]); return }
    if (stop.input === stop.address && stop.lat) return
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(stop.input)}&limit=5&addressdetails=1`, { headers: { 'Accept-Language': 'de' } })
        const data = await res.json()
        setResults(data || [])
      } catch { setResults([]) } finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [stop.input, stop.address, stop.lat])

  const pick = (r) => {
    onChange({ input: r.display_name, address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })
    setResults([])
    setFocused(false)
  }

  const isMeetingPoint = index === 0
  const label = isMeetingPoint ? 'A' : (index + 1).toString()

  return (
    <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: '32px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-base)', background: isMeetingPoint ? 'linear-gradient(135deg, var(--color-accent-primary) 0%, #2563eb 100%)' : 'var(--color-surface-active)', color: isMeetingPoint ? 'white' : 'var(--color-text-secondary)', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input type="text" value={stop.input} onChange={e => onChange({ input: e.target.value, ...(stop.lat ? { address: '', lat: null, lng: null } : {}) })} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)} placeholder={isMeetingPoint ? 'Treffpunkt-Adresse' : `Stopp ${index + 1}`}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-base)', borderRadius: 'var(--radius-base)', padding: '10px 36px 10px 12px', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-primary)', outline: 'none', transition: 'border-color var(--transition-fast)' }}
            onFocusCapture={e => e.target.style.borderColor = 'var(--color-accent-primary)'}
            onBlurCapture={e => e.target.style.borderColor = 'var(--color-border-base)'} />
          <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            {searching ? <svg width="13" height="13" viewBox="0 0 24 24" className="animate-spin" style={{ color: 'var(--color-text-muted)' }}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10"/></svg>
              : stop.lat ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
          </div>
        </div>
        {focused && results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border-base)', borderRadius: 'var(--radius-base)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
            {results.map(r => (
              <button key={r.place_id} onMouseDown={e => { e.preventDefault(); pick(r) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.4, borderBottom: '1px solid var(--color-border-light)', transition: 'background var(--transition-fast)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>{r.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {canRemove && (
        <button onClick={onRemove} style={{ flexShrink: 0, width: '40px', height: '40px', background: 'transparent', border: '1px solid var(--color-border-base)', borderRadius: 'var(--radius-base)', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--transition-fast)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-danger)'; e.currentTarget.style.color = 'var(--color-danger)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-base)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  )
}

function PrimaryButton({ onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: 'var(--space-3)', background: disabled ? 'var(--color-text-muted)' : 'linear-gradient(135deg, var(--color-accent-primary) 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)', fontWeight: 700, fontFamily: 'var(--font-family-primary)', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: disabled ? 'none' : '0 4px 15px rgba(59,130,246,0.25)', transition: 'all var(--transition-fast)' }}>
      {label}
    </button>
  )
}
