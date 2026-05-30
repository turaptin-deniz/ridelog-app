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

// ── Option lists for the new content types ────────────────────────────────────
const DIFFICULTY_OPTS = [
  { id: 'easy',   label: 'Leicht' },
  { id: 'medium', label: 'Mittel' },
  { id: 'hard',   label: 'Schwer' },
  { id: 'expert', label: 'Experte' },
]
const SURFACE_OPTS = [
  { id: 'asphalt', label: 'Asphalt' },
  { id: 'gravel',  label: 'Schotter' },
  { id: 'mixed',   label: 'Gemischt' },
]
const PACE_OPTS = [
  { id: 'chill',     label: 'Gemütlich' },
  { id: 'normal',    label: 'Normal' },
  { id: 'sportlich', label: 'Sportlich' },
]
const VEHICLE_TYPE_OPTS = [
  { id: 'all',       label: 'Egal' },
  { id: 'motorrad',  label: 'Motorrad' },
  { id: 'auto',      label: 'Auto' },
  { id: 'sonstiges', label: 'Sonstiges' },
]
const MARKET_CATEGORIES = [
  { id: 'bike',  label: 'Fahrzeug' },
  { id: 'parts', label: 'Teile' },
  { id: 'gear',  label: 'Ausrüstung' },
  { id: 'other', label: 'Sonstiges' },
]
const CONDITION_OPTS = [
  { id: 'new',      label: 'Neu' },
  { id: 'like_new', label: 'Wie neu' },
  { id: 'good',     label: 'Gut' },
  { id: 'used',     label: 'Gebraucht' },
]
const GOAL_TYPE_OPTS = [
  { id: 'distance', label: 'Distanz' },
  { id: 'rides',    label: 'Touren' },
  { id: 'speed',    label: 'Topspeed' },
]
const POLL_DURATIONS = [
  { id: '1',  label: '1 Tag' },
  { id: '3',  label: '3 Tage' },
  { id: '7',  label: '7 Tage' },
  { id: '14', label: '14 Tage' },
]
const CHALLENGE_DURATIONS = [
  { id: '7',   label: '1 Woche' },
  { id: '30',  label: '1 Monat' },
  { id: '90',  label: '3 Monate' },
  { id: '365', label: '1 Jahr' },
]

const VIEW_TITLES = {
  menu:        'Erstellen',
  post:        'Neuer Post',
  meetup:      'Event planen',
  route_tip:   'Strecken-Tipp',
  ride_buddy:  'Mitfahrer gesucht',
  poll:        'Umfrage',
  marketplace: 'Anzeige aufgeben',
  tour_report: 'Tour-Bericht',
  challenge:   'Challenge',
}

export default function CreateMenu({ open, onClose, onCreated, lang, pageMode = false }) {
  const [view, setView] = useState('menu')
  const [error, setError] = useState('')

  // Post / shared photo state — array of slides
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

  // New content-type form states
  const blankRouteTip  = { road_name: '', region: '', distance_km: '', difficulty: 'medium', surface: 'asphalt', curviness: 3, scenery: 3, tip_text: '' }
  const blankRideBuddy = { date: '', time: '', start_location: '', destination: '', distance_km: '', pace: 'normal', vehicle_type: 'all', spots: '' }
  const blankPoll      = { question: '', options: ['', ''], duration: '7' }
  const blankMarket    = { category: 'bike', item_title: '', price: '', condition: 'good', location: '', description: '' }
  const blankReport    = { title: '', region: '', days: '', distance_km: '', highlights: '', story: '' }
  const blankChallenge = { title: '', goal_type: 'distance', goal_value: '', duration: '30', description: '' }

  const [routeTip, setRouteTip]   = useState(blankRouteTip)
  const [rideBuddy, setRideBuddy] = useState(blankRideBuddy)
  const [poll, setPoll]           = useState(blankPoll)
  const [market, setMarket]       = useState(blankMarket)
  const [report, setReport]       = useState(blankReport)
  const [challenge, setChallenge] = useState(blankChallenge)

  const resetAll = () => {
    setSlides([]); setActiveSlide(0); setPostContent('')
    setMeetup({ title: '', date: '', time: '', description: '', maxParticipants: '' })
    setVehicleFilter('all'); setStops([newStop()])
    setRouteTip(blankRouteTip); setRideBuddy(blankRideBuddy); setPoll(blankPoll)
    setMarket(blankMarket); setReport(blankReport); setChallenge(blankChallenge)
    setError('')
  }

  useEffect(() => {
    if (open) { setView('menu'); resetAll() }
  }, [open])

  if (!open && !pageMode) return null

  const close = () => {
    resetAll()
    setView('menu')
    if (!pageMode) onClose()
  }

  const addFiles = async (fileList) => {
    setError('')
    const incoming = Array.from(fileList)
    const toAdd = []

    for (const file of incoming) {
      if (slides.length + toAdd.length >= MAX_SLIDES) {
        setError(`Maximal ${MAX_SLIDES} Medien.`)
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
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeSlide = (id) => {
    setSlides(prev => {
      const next = prev.filter(s => s.id !== id)
      setActiveSlide(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  // Upload all current slides, return public URLs
  const uploadSlides = async (userId) => {
    const photos = []
    for (const slide of slides) {
      const ext = slide.file.name.split('.').pop()
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const bucket = slide.type === 'video' ? 'videos' : 'post-images'
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, slide.file)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      photos.push(urlData.publicUrl)
    }
    return photos
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
      const photos = await uploadSlides(user.id)
      const { error: insErr } = await supabase.from('posts').insert({
        user_id: user.id, content: postContent, photos,
      })
      if (insErr) throw insErr
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
        const msg = (err.message || '') + ' ' + (err.details || '') + ' ' + (err.hint || '')
        return /does not exist|not find the table|schema cache|relation .* does not/i.test(msg)
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
        const payloadNoFilter = { ...meetupPayload }
        delete payloadNoFilter.vehicle_filter
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

  // Generic typed-post creator (route_tip, ride_buddy, poll, marketplace, tour_report, challenge)
  const createTyped = async (postType, metadata, content, withPhotos = false) => {
    setError('')
    setPosting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const photos = withPhotos ? await uploadSlides(user.id) : []
      const { error: insErr } = await supabase.from('posts').insert({
        user_id: user.id, content, photos, post_type: postType, metadata,
      })
      if (insErr) throw insErr
      window.dispatchEvent(new CustomEvent('ridelog:post-created'))
      onCreated && onCreated('post')
      close()
    } catch (e) {
      if (/post_type|metadata|column|schema cache/i.test(e.message || '')) {
        setError('Datenbank muss aktualisiert werden: Bitte „database-migration.sql" einmal im Supabase SQL-Editor ausführen.')
      } else {
        setError(e.message || 'Fehler beim Erstellen.')
      }
    } finally {
      setPosting(false)
    }
  }

  const createRouteTip = () => {
    if (!routeTip.road_name.trim()) return setError('Gib der Strecke einen Namen.')
    const meta = {
      road_name: routeTip.road_name.trim(),
      region: routeTip.region.trim(),
      distance_km: parseFloat(routeTip.distance_km) || null,
      difficulty: routeTip.difficulty,
      surface: routeTip.surface,
      curviness: routeTip.curviness,
      scenery: routeTip.scenery,
      tip_text: routeTip.tip_text.trim(),
    }
    const content = routeTip.tip_text.trim() || `Strecken-Tipp: ${routeTip.road_name.trim()}`
    createTyped('route_tip', meta, content, true)
  }

  const createRideBuddy = () => {
    if (!rideBuddy.date || !rideBuddy.time) return setError('Wähle Datum und Uhrzeit.')
    if (!rideBuddy.start_location.trim()) return setError('Gib einen Startort an.')
    const meta = {
      date: rideBuddy.date, time: rideBuddy.time,
      start_location: rideBuddy.start_location.trim(),
      destination: rideBuddy.destination.trim(),
      distance_km: parseFloat(rideBuddy.distance_km) || null,
      pace: rideBuddy.pace, vehicle_type: rideBuddy.vehicle_type,
      spots: rideBuddy.spots ? parseInt(rideBuddy.spots, 10) : null,
    }
    const content = `Suche Mitfahrer · ${meta.start_location}${meta.destination ? ' → ' + meta.destination : ''}`
    createTyped('ride_buddy', meta, content, false)
  }

  const createPoll = () => {
    const opts = poll.options.map(o => o.trim()).filter(Boolean)
    if (!poll.question.trim()) return setError('Formuliere eine Frage.')
    if (opts.length < 2) return setError('Mindestens 2 Antwortoptionen.')
    const ends_at = new Date(Date.now() + parseInt(poll.duration, 10) * 86400000).toISOString()
    const meta = { question: poll.question.trim(), options: opts, ends_at }
    createTyped('poll', meta, poll.question.trim(), false)
  }

  const createMarketplace = () => {
    if (!market.item_title.trim()) return setError('Gib einen Titel an.')
    if (!market.price) return setError('Gib einen Preis an.')
    const meta = {
      category: market.category,
      item_title: market.item_title.trim(),
      price: parseFloat(market.price) || 0,
      currency: '€',
      condition: market.condition,
      location: market.location.trim(),
      description: market.description.trim(),
      sold: false,
    }
    const content = `${meta.item_title} · ${meta.price} €`
    createTyped('marketplace', meta, content, true)
  }

  const createReport = () => {
    if (!report.title.trim()) return setError('Gib dem Bericht einen Titel.')
    const meta = {
      title: report.title.trim(),
      region: report.region.trim(),
      days: parseInt(report.days, 10) || null,
      distance_km: parseFloat(report.distance_km) || null,
      highlights: report.highlights.split(',').map(h => h.trim()).filter(Boolean),
      story: report.story.trim(),
    }
    const content = report.story.trim() ? `${meta.title}\n\n${report.story.trim()}` : meta.title
    createTyped('tour_report', meta, content, true)
  }

  const createChallenge = () => {
    if (!challenge.title.trim()) return setError('Gib der Challenge einen Namen.')
    if (!challenge.goal_value) return setError('Lege ein Ziel fest.')
    const unit = challenge.goal_type === 'distance' ? 'km' : challenge.goal_type === 'rides' ? 'Touren' : 'km/h'
    const ends_at = new Date(Date.now() + parseInt(challenge.duration, 10) * 86400000).toISOString()
    const meta = {
      title: challenge.title.trim(),
      goal_type: challenge.goal_type,
      goal_value: parseFloat(challenge.goal_value) || 0,
      unit,
      ends_at,
      description: challenge.description.trim(),
    }
    createTyped('challenge', meta, `Challenge: ${meta.title}`, false)
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

  // ── Reusable photo uploader (used by post, marketplace, tour_report, route_tip) ──
  const PhotoArea = (hintLabel = 'Fotos & Videos hinzufügen') => (
    <>
      {slides.length > 0 && cur && (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
          {cur.type === 'video'
            ? <video src={cur.preview} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={cur.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          }
          {slides.length > 1 && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.65)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, color: 'white', fontFamily: "'Barlow', sans-serif" }}>
              {activeSlide + 1} / {slides.length}
            </div>
          )}
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
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'center' }}>
        {slides.map((slide, i) => (
          <div key={slide.id} onClick={() => setActiveSlide(i)} style={{ position: 'relative', flexShrink: 0, width: '64px', height: '64px', borderRadius: 'var(--radius-base)', overflow: 'hidden', cursor: 'pointer', border: i === activeSlide ? '2px solid var(--color-accent-primary)' : '2px solid transparent', transition: 'border 0.15s', boxSizing: 'border-box' }}>
            {slide.type === 'video'
              ? <video src={slide.preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={slide.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
            <button onClick={e => { e.stopPropagation(); removeSlide(slide.id) }} style={{ position: 'absolute', top: '3px', right: '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', lineHeight: 1 }}>×</button>
          </div>
        ))}
        {slides.length < MAX_SLIDES && (
          <button onClick={() => fileRef.current.click()} style={{ flexShrink: 0, width: '64px', height: '64px', borderRadius: 'var(--radius-base)', background: 'var(--color-bg-primary)', border: '1px dashed var(--color-border-strong)', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all var(--transition-fast)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.color = 'var(--color-accent-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {slides.length === 0 && <span style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-family-primary)', textAlign: 'center', lineHeight: 1.2 }}>Medien</span>}
          </button>
        )}
      </div>

      {slides.length === 0 && (
        <button onClick={() => fileRef.current.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-6)', background: 'var(--color-bg-primary)', border: '1px dashed var(--color-border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', width: '100%', boxSizing: 'border-box', transition: 'all var(--transition-fast)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-strong)'}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-family-primary)', marginBottom: '4px' }}>{hintLabel}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-primary)' }}>Bis zu {MAX_SLIDES} Medien · Bild max {MAX_IMAGE_MB} MB · Video max {MAX_VIDEO_MB} MB</p>
          </div>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
    </>
  )

  // ── Shared inner content ────────────────────────────────────────────────
  const innerContent = (
    <>
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
            {VIEW_TITLES[view] || 'Erstellen'}
          </h3>
        </div>
        {!pageMode && (
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)', padding: 'var(--space-3)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {/* === MENU === */}
      {view === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          <SectionLabel>Teilen</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <OptionCard onClick={() => setView('post')} accent="var(--color-accent-primary)" title="Post erstellen" desc="Bis zu 10 Fotos, Videos oder Text mit der Community teilen"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
            />
            <OptionCard onClick={() => setView('route_tip')} accent="#22c55e" title="Strecken-Tipp" desc="Eine geniale Straße empfehlen — Schwierigkeit, Kurven, Landschaft"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>}
            />
            <OptionCard onClick={() => setView('tour_report')} accent="#a855f7" title="Tour-Bericht" desc="Eine längere Reise dokumentieren — Etappen, Highlights, Fotos"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
            />
          </div>

          <SectionLabel>Community</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <OptionCard onClick={() => setView('meetup')} accent="var(--color-accent-secondary)" title="Event planen" desc="Treffen organisieren — Standort, Datum, Fahrzeugtyp, Anmeldung"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            />
            <OptionCard onClick={() => setView('ride_buddy')} accent="#f59e0b" title="Mitfahrer gesucht" desc="Spontan jemanden zum Mitfahren finden — Datum, Start, Tempo"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            />
            <OptionCard onClick={() => setView('poll')} accent="#0ea5e9" title="Umfrage" desc="Die Community abstimmen lassen — Frage + bis zu 6 Optionen"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
            />
            <OptionCard onClick={() => setView('challenge')} accent="#f43f5e" title="Challenge" desc="Eine Herausforderung ausrufen — Ziel, Zeitraum, Teilnehmer"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>}
            />
          </div>

          <SectionLabel>Marktplatz</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <OptionCard onClick={() => setView('marketplace')} accent="#eab308" title="Anzeige aufgeben" desc="Fahrzeug, Teile oder Ausrüstung verkaufen — Preis, Zustand, Fotos"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>}
            />
          </div>
        </div>
      )}

      {/* === POST === */}
      {view === 'post' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {PhotoArea()}
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
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton onClick={createMeetup} disabled={creatingMeetup} label={creatingMeetup ? 'Wird erstellt…' : 'Event erstellen'} />
        </div>
      )}

      {/* === ROUTE TIP === */}
      {view === 'route_tip' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={labelStyle}>Strecke / Straße</label>
            <input type="text" value={routeTip.road_name} onChange={e => setRouteTip({ ...routeTip, road_name: e.target.value })} placeholder="z.B. Großglockner Hochalpenstraße" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Region</label>
              <input type="text" value={routeTip.region} onChange={e => setRouteTip({ ...routeTip, region: e.target.value })} placeholder="z.B. Tirol" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Länge (km)</label>
              <input type="number" min="0" value={routeTip.distance_km} onChange={e => setRouteTip({ ...routeTip, distance_km: e.target.value })} placeholder="48" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Schwierigkeit</label>
            <ChipSelect options={DIFFICULTY_OPTS} value={routeTip.difficulty} onChange={id => setRouteTip({ ...routeTip, difficulty: id })} columns={4} />
          </div>
          <div>
            <label style={labelStyle}>Belag</label>
            <ChipSelect options={SURFACE_OPTS} value={routeTip.surface} onChange={id => setRouteTip({ ...routeTip, surface: id })} columns={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label style={labelStyle}>Kurvenreichtum</label>
              <SegmentRating value={routeTip.curviness} onChange={n => setRouteTip({ ...routeTip, curviness: n })} color="#22c55e" />
            </div>
            <div>
              <label style={labelStyle}>Landschaft</label>
              <SegmentRating value={routeTip.scenery} onChange={n => setRouteTip({ ...routeTip, scenery: n })} color="#22c55e" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Dein Tipp (optional)</label>
            <textarea value={routeTip.tip_text} onChange={e => setRouteTip({ ...routeTip, tip_text: e.target.value })} placeholder="Was macht diese Strecke besonders? Beste Jahreszeit, Einkehrtipps…" rows={3} style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Fotos (optional)</label>
            {PhotoArea('Fotos der Strecke hinzufügen')}
          </div>
          <PrimaryButton onClick={createRouteTip} disabled={posting} label={posting ? 'Wird geteilt…' : 'Strecken-Tipp teilen'} />
        </div>
      )}

      {/* === RIDE BUDDY === */}
      {view === 'ride_buddy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Datum</label>
              <input type="date" value={rideBuddy.date} onChange={e => setRideBuddy({ ...rideBuddy, date: e.target.value })} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Uhrzeit</label>
              <input type="time" value={rideBuddy.time} onChange={e => setRideBuddy({ ...rideBuddy, time: e.target.value })} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Startort</label>
            <input type="text" value={rideBuddy.start_location} onChange={e => setRideBuddy({ ...rideBuddy, start_location: e.target.value })} placeholder="z.B. München Hauptbahnhof" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Ziel (optional)</label>
            <input type="text" value={rideBuddy.destination} onChange={e => setRideBuddy({ ...rideBuddy, destination: e.target.value })} placeholder="z.B. Tegernsee" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Distanz (km, opt.)</label>
              <input type="number" min="0" value={rideBuddy.distance_km} onChange={e => setRideBuddy({ ...rideBuddy, distance_km: e.target.value })} placeholder="120" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Freie Plätze</label>
              <input type="number" min="1" value={rideBuddy.spots} onChange={e => setRideBuddy({ ...rideBuddy, spots: e.target.value })} placeholder="3" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tempo</label>
            <ChipSelect options={PACE_OPTS} value={rideBuddy.pace} onChange={id => setRideBuddy({ ...rideBuddy, pace: id })} columns={3} />
          </div>
          <div>
            <label style={labelStyle}>Fahrzeugtyp</label>
            <ChipSelect options={VEHICLE_TYPE_OPTS} value={rideBuddy.vehicle_type} onChange={id => setRideBuddy({ ...rideBuddy, vehicle_type: id })} columns={4} />
          </div>
          <PrimaryButton onClick={createRideBuddy} disabled={posting} label={posting ? 'Wird erstellt…' : 'Mitfahrer-Gesuch posten'} />
        </div>
      )}

      {/* === POLL === */}
      {view === 'poll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={labelStyle}>Frage</label>
            <input type="text" value={poll.question} onChange={e => setPoll({ ...poll, question: e.target.value })} placeholder="z.B. Wohin am Wochenende?" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Antwortoptionen</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {poll.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flexShrink: 0, width: '28px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px' }}>{i + 1}</div>
                  <input type="text" value={opt} onChange={e => { const o = [...poll.options]; o[i] = e.target.value; setPoll({ ...poll, options: o }) }} placeholder={`Option ${i + 1}`}
                    style={{ ...inputBase, flex: 1 }} onFocus={focusOn} onBlur={focusOff} />
                  {poll.options.length > 2 && (
                    <button onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })} style={{ flexShrink: 0, width: '40px', height: '40px', background: 'transparent', border: '1px solid var(--color-border-base)', borderRadius: 'var(--radius-base)', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {poll.options.length < 6 && (
              <button onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })} style={{ marginTop: 'var(--space-3)', width: '100%', padding: 'var(--space-3)', background: 'transparent', border: '1px dashed var(--color-border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-family-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Option hinzufügen
              </button>
            )}
          </div>
          <div>
            <label style={labelStyle}>Laufzeit</label>
            <ChipSelect options={POLL_DURATIONS} value={poll.duration} onChange={id => setPoll({ ...poll, duration: id })} columns={4} />
          </div>
          <PrimaryButton onClick={createPoll} disabled={posting} label={posting ? 'Wird erstellt…' : 'Umfrage starten'} />
        </div>
      )}

      {/* === MARKETPLACE === */}
      {view === 'marketplace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={labelStyle}>Kategorie</label>
            <ChipSelect options={MARKET_CATEGORIES} value={market.category} onChange={id => setMarket({ ...market, category: id })} columns={4} />
          </div>
          <div>
            <label style={labelStyle}>Titel</label>
            <input type="text" value={market.item_title} onChange={e => setMarket({ ...market, item_title: e.target.value })} placeholder="z.B. Shoei NXR2 Helm Gr. L" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Preis (€)</label>
              <input type="number" min="0" value={market.price} onChange={e => setMarket({ ...market, price: e.target.value })} placeholder="250" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Standort</label>
              <input type="text" value={market.location} onChange={e => setMarket({ ...market, location: e.target.value })} placeholder="z.B. München" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Zustand</label>
            <ChipSelect options={CONDITION_OPTS} value={market.condition} onChange={id => setMarket({ ...market, condition: id })} columns={4} />
          </div>
          <div>
            <label style={labelStyle}>Beschreibung (optional)</label>
            <textarea value={market.description} onChange={e => setMarket({ ...market, description: e.target.value })} placeholder="Details, Mängel, Versand…" rows={3} style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Fotos</label>
            {PhotoArea('Fotos des Artikels hinzufügen')}
          </div>
          <PrimaryButton onClick={createMarketplace} disabled={posting} label={posting ? 'Wird eingestellt…' : 'Anzeige veröffentlichen'} />
        </div>
      )}

      {/* === TOUR REPORT === */}
      {view === 'tour_report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={labelStyle}>Titel</label>
            <input type="text" value={report.title} onChange={e => setReport({ ...report, title: e.target.value })} placeholder="z.B. 7 Tage Dolomiten" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Region</label>
              <input type="text" value={report.region} onChange={e => setReport({ ...report, region: e.target.value })} placeholder="Südtirol" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Tage</label>
              <input type="number" min="1" value={report.days} onChange={e => setReport({ ...report, days: e.target.value })} placeholder="7" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>km</label>
              <input type="number" min="0" value={report.distance_km} onChange={e => setReport({ ...report, distance_km: e.target.value })} placeholder="1850" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Highlights (mit Komma trennen)</label>
            <input type="text" value={report.highlights} onChange={e => setReport({ ...report, highlights: e.target.value })} placeholder="Stelvio, Sella Ronda, Passo Giau" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Bericht</label>
            <textarea value={report.story} onChange={e => setReport({ ...report, story: e.target.value })} placeholder="Erzähl von deiner Reise…" rows={5} style={{ ...inputBase, resize: 'none', lineHeight: 1.6 }} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Fotos (optional)</label>
            {PhotoArea('Fotos der Tour hinzufügen')}
          </div>
          <PrimaryButton onClick={createReport} disabled={posting} label={posting ? 'Wird geteilt…' : 'Bericht veröffentlichen'} />
        </div>
      )}

      {/* === CHALLENGE === */}
      {view === 'challenge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={labelStyle}>Name der Challenge</label>
            <input type="text" value={challenge.title} onChange={e => setChallenge({ ...challenge, title: e.target.value })} placeholder="z.B. 1000 km im Mai" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Zieltyp</label>
            <ChipSelect options={GOAL_TYPE_OPTS} value={challenge.goal_type} onChange={id => setChallenge({ ...challenge, goal_type: id })} columns={3} />
          </div>
          <div>
            <label style={labelStyle}>
              Zielwert ({challenge.goal_type === 'distance' ? 'km' : challenge.goal_type === 'rides' ? 'Touren' : 'km/h'})
            </label>
            <input type="number" min="1" value={challenge.goal_value} onChange={e => setChallenge({ ...challenge, goal_value: e.target.value })} placeholder={challenge.goal_type === 'distance' ? '1000' : challenge.goal_type === 'rides' ? '20' : '200'} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label style={labelStyle}>Zeitraum</label>
            <ChipSelect options={CHALLENGE_DURATIONS} value={challenge.duration} onChange={id => setChallenge({ ...challenge, duration: id })} columns={4} />
          </div>
          <div>
            <label style={labelStyle}>Beschreibung (optional)</label>
            <textarea value={challenge.description} onChange={e => setChallenge({ ...challenge, description: e.target.value })} placeholder="Regeln, Motivation, Belohnung…" rows={3} style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <PrimaryButton onClick={createChallenge} disabled={posting} label={posting ? 'Wird erstellt…' : 'Challenge starten'} />
        </div>
      )}
    </>
  )

  // ── Page mode ─────────────────────────────────────────────────────────────
  if (pageMode) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }} className="animate-fadeIn">
        {innerContent}
      </div>
    )
  }

  // ── Modal mode ────────────────────────────────────────────────────────────
  return (
    <div onClick={close} style={backdrop} className="animate-fadeIn">
      <div onClick={e => e.stopPropagation()} style={sheet} className="animate-scaleIn">
        {innerContent}
      </div>
    </div>
  )
}

// ---- Sub-components ----

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: 0, marginTop: 'var(--space-1)' }}>
      {children}
    </p>
  )
}

function ChipSelect({ options, value, onChange, columns }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
      {options.map(opt => {
        const active = value === opt.id
        return (
          <button key={opt.id} type="button" onClick={() => onChange(opt.id)} style={{
            padding: '10px 8px',
            background: active ? 'rgba(59,130,246,0.12)' : 'var(--color-bg-primary)',
            border: `1.5px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-base)'}`,
            borderRadius: 'var(--radius-base)', cursor: 'pointer',
            color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-family-primary)',
            transition: 'all var(--transition-fast)', textAlign: 'center', whiteSpace: 'nowrap'
          }}>{opt.label}</button>
        )
      })}
    </div>
  )
}

function SegmentRating({ value, onChange, color = 'var(--color-accent-primary)' }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} style={{
          flex: 1, height: '30px', borderRadius: 'var(--radius-base)', cursor: 'pointer',
          border: `1.5px solid ${n <= value ? color : 'var(--color-border-base)'}`,
          background: n <= value ? color : 'transparent',
          transition: 'all var(--transition-fast)'
        }} />
      ))}
    </div>
  )
}

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
