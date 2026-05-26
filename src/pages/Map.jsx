import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { supabase } from '../supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import RoutePlanner from './RoutePlanner'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createRiderIcon = (color = '#3b82f6', isMe = false, avatarUrl = null, username = '') => {
  const size = isMe ? 44 : 36
  const content = avatarUrl
    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="color:white;font-size:${isMe ? 14 : 11}px;font-weight:700;font-family:'Barlow',sans-serif;">${username?.slice(0, 2).toUpperCase() || '??'}</span>`

  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 12px rgba(0,0,0,0.5);
      overflow:hidden;
    ">${content}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const getSpeedColor = (spd) => {
  if (spd < 30) return '#4ade80'
  if (spd < 60) return '#facc15'
  if (spd < 100) return '#f97316'
  return '#f43f5e'
}

function CenterMap({ position }) {
  const map = useMap()
  useEffect(() => { if (position) map.setView(position, map.getZoom()) }, [position])
  return null
}

export default function Map({
  darkMode,
  onSelectRider,
  // Ride state lifted to App.jsx — persists across tab navigation
  isLive = false,
  myPosition = null,
  myTrail = [],
  speed = 0,
  maxSpeed = 0,
  avgSpeed = 0,
  speedHistory = [],
  rideTime = 0,
  distance = 0,
  onStartRide,
  onStopRide,
  formatTime,
}) {
  const t = darkMode
    ? { bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555' }
    : { bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888' }

  // ── Map-local state ───────────────────────────────────────────────────────
  const [myProfile,     setMyProfile]     = useState(null)
  const [liveRiders,    setLiveRiders]    = useState([])
  const [followMe,      setFollowMe]      = useState(true)
  const [centerOn,      setCenterOn]      = useState(null)
  const [showRiders,    setShowRiders]    = useState(false)
  const [showPlanner,   setShowPlanner]   = useState(false)
  const [selectedRider, setSelectedRider] = useState(null)   // { rider, lat, lng }
  const [routeTarget,   setRouteTarget]   = useState(null)   // { lat, lng, label }
  const [isOnline,      setIsOnline]      = useState(false)  // presence / visibility toggle
  const [onlineLoading, setOnlineLoading] = useState(false)

  const presenceWatchRef   = useRef(null)
  const presenceSessionRef = useRef(null)

  // ── Sync myPosition → centerOn when followMe is on ───────────────────────
  useEffect(() => {
    if (myPosition && isLive && followMe) {
      setCenterOn(myPosition)
    }
  }, [myPosition, followMe, isLive])

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadMyProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setMyProfile(data)
  }

  const loadLiveRiders = async () => {
    const { data } = await supabase
      .from('live_sessions')
      .select('*, profiles(username, avatar_url)')
      .eq('is_active', true)
    if (data) setLiveRiders(data)
  }

  useEffect(() => {
    loadLiveRiders()
    loadMyProfile()
    const channel = supabase.channel('live-riders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, loadLiveRiders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // ── Online presence ───────────────────────────────────────────────────────
  const goOnline = async () => {
    setOnlineLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: sess } = await supabase
        .from('live_sessions')
        .insert({ user_id: user.id, is_active: true, visibility: 'public' })
        .select()
        .single()

      if (!sess) return
      presenceSessionRef.current = sess.id
      setIsOnline(true)

      // Keep position updated in live_sessions while online
      presenceWatchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          try {
            await supabase
              .from('live_sessions')
              .update({ lat, lng })
              .eq('id', presenceSessionRef.current)
          } catch { /* lat/lng column might not exist yet */ }
        },
        err => console.error('presence geo error:', err),
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 }
      )
    } catch (err) {
      console.error('goOnline:', err)
    } finally {
      setOnlineLoading(false)
    }
  }

  const goOffline = async () => {
    if (presenceWatchRef.current != null) {
      navigator.geolocation.clearWatch(presenceWatchRef.current)
      presenceWatchRef.current = null
    }
    if (presenceSessionRef.current) {
      await supabase
        .from('live_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', presenceSessionRef.current)
      presenceSessionRef.current = null
    }
    setIsOnline(false)
  }

  // Cleanup presence session when Map unmounts (tab switch / app close)
  useEffect(() => {
    return () => {
      if (presenceWatchRef.current != null) {
        navigator.geolocation.clearWatch(presenceWatchRef.current)
      }
      if (presenceSessionRef.current) {
        supabase
          .from('live_sessions')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('id', presenceSessionRef.current)
      }
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const safeFormatTime = formatTime || ((secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  })

  const defaultCenter = myPosition || [48.1351, 11.5820]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {showPlanner && (
        <RoutePlanner
          darkMode={darkMode}
          onClose={() => { setShowPlanner(false); setRouteTarget(null) }}
          destinationPoint={routeTarget}
        />
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {centerOn && followMe && <CenterMap position={centerOn} />}

          {myPosition && (
            <Marker
              position={myPosition}
              icon={createRiderIcon('#3b82f6', true, myProfile?.avatar_url, myProfile?.username)}
            />
          )}

          {speedHistory.length > 1 && speedHistory.map((point, i) => {
            if (i === 0) return null
            const prev = speedHistory[i - 1]
            return (
              <Polyline
                key={i}
                positions={[[prev.lat, prev.lng], [point.lat, point.lng]]}
                color={getSpeedColor(point.speed)}
                weight={5}
                opacity={0.9}
              />
            )
          })}

          {liveRiders.map(rider => {
            const lat = rider.lat || 48.14
            const lng = rider.lng || 11.58
            return (
              <Marker
                key={rider.id}
                position={[lat, lng]}
                icon={createRiderIcon('#f97316', false, rider.profiles?.avatar_url, rider.profiles?.username)}
                eventHandlers={{ click: () => setSelectedRider({ rider, lat, lng }) }}
              />
            )
          })}
        </MapContainer>

        {/* ── Top-right: Planen (bigger) + Online/Offline gestapelt ──── */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
        }}>
          {/* Route planner button — bigger */}
          <button onClick={() => setShowPlanner(true)} style={{
            background: 'rgba(0,0,0,0.82)', color: 'white', border: 'none',
            borderRadius: '10px', padding: '11px 20px', cursor: 'pointer',
            fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '700',
            backdropFilter: 'blur(6px)', letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Planen
          </button>

          {/* Online / Offline toggle — under Planen */}
          <div
            onClick={onlineLoading ? undefined : (isOnline ? goOffline : goOnline)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px 7px 12px',
              background: isOnline ? 'rgba(74,222,128,0.14)' : 'rgba(0,0,0,0.82)',
              border: `1px solid ${isOnline ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '50px',
              backdropFilter: 'blur(6px)',
              cursor: onlineLoading ? 'wait' : 'pointer',
              transition: 'background 0.25s, border-color 0.25s',
              userSelect: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}
          >
            {/* Status dot */}
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              background: onlineLoading ? '#facc15' : isOnline ? '#4ade80' : '#444',
              boxShadow: isOnline && !onlineLoading ? '0 0 7px rgba(74,222,128,0.8)' : 'none',
              transition: 'background 0.25s, box-shadow 0.25s',
            }} className={isOnline && !onlineLoading ? 'animate-pulse' : ''} />
            {/* Label */}
            <span style={{
              color: onlineLoading ? '#facc15' : isOnline ? '#4ade80' : '#888',
              fontSize: '12px', fontWeight: 700,
              fontFamily: "'Barlow', sans-serif", letterSpacing: '0.04em',
              minWidth: '42px', transition: 'color 0.25s',
            }}>
              {onlineLoading ? '...' : isOnline ? 'Online' : 'Offline'}
            </span>
            {/* Slide toggle pill */}
            <div style={{
              width: '40px', height: '22px', borderRadius: '11px',
              background: onlineLoading ? '#444' : isOnline ? '#4ade80' : '#2a2a2a',
              border: `1px solid ${isOnline ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
              position: 'relative', flexShrink: 0, transition: 'background 0.25s',
            }}>
              <div style={{
                position: 'absolute', top: '3px',
                left: isOnline ? '19px' : '3px',
                width: '14px', height: '14px', borderRadius: '50%',
                background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>
        </div>

        {/* Ride controls */}
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          {!isLive ? (
            <button onClick={onStartRide} style={{
              background: 'linear-gradient(135deg, var(--color-accent-primary) 0%, #2563eb 100%)',
              color: 'white', border: 'none',
              borderRadius: '50px', padding: '14px 32px', cursor: 'pointer',
              fontSize: '15px', fontWeight: '700', fontFamily: "'Barlow', sans-serif",
              boxShadow: '0 4px 24px rgba(59,130,246,0.6)', letterSpacing: '0.5px',
              display: 'flex', alignItems: 'center', gap: '10px',
              transition: 'transform var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              RIDE STARTEN
            </button>
          ) : (
            <button onClick={onStopRide} style={{
              background: '#f43f5e', color: 'white', border: 'none',
              borderRadius: '50px', padding: '14px 32px', cursor: 'pointer',
              fontSize: '16px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif",
              boxShadow: '0 4px 24px rgba(244,63,94,0.7)', letterSpacing: '1px',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'transform var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              RIDE BEENDEN
            </button>
          )}
        </div>

        {/* Live-only helper controls */}
        {isLive && (
          <>
            {/* Follow-me toggle */}
            <button onClick={() => setFollowMe(!followMe)} style={{
              position: 'absolute', bottom: '290px', right: '12px', zIndex: 1000,
              background: followMe ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.7)',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '10px 12px', cursor: 'pointer', fontSize: '12px',
              fontFamily: "'Barlow', sans-serif", fontWeight: '600',
            }}>{followMe ? '📍' : '🗺️'}</button>

            {/* Speed legend */}
            <div style={{
              position: 'absolute', bottom: '290px', left: '12px', zIndex: 1000,
              background: 'rgba(0,0,0,0.75)', borderRadius: '8px', padding: '8px 10px',
              backdropFilter: 'blur(4px)',
            }}>
              {[
                { color: '#4ade80', label: '< 30' },
                { color: '#facc15', label: '30–60' },
                { color: '#f97316', label: '60–100' },
                { color: '#f43f5e', label: '> 100' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <div style={{ width: '14px', height: '4px', background: s.color, borderRadius: '2px' }} />
                  <p style={{ color: 'white', fontSize: '10px', fontFamily: "'Barlow', sans-serif", margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Rider action card ─────────────────────────────────────────── */}
        {selectedRider && (() => {
          const r = selectedRider.rider
          const username = r.profiles?.username || 'Fahrer'
          const avatar = r.profiles?.avatar_url
          const initials = username.slice(0, 2).toUpperCase()
          return (
            <div style={{
              position: 'absolute', bottom: '80px', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1200, width: 'calc(100% - 32px)', maxWidth: '380px',
            }} className="animate-scaleIn">
              <div style={{
                background: t.surface, borderRadius: '18px',
                border: `1px solid ${t.border}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                overflow: 'hidden',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px 10px', borderBottom: `1px solid ${t.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%',
                      background: '#f97316', overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700, color: 'white',
                      border: '2px solid rgba(249,115,22,0.4)',
                    }}>
                      {avatar
                        ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials}
                    </div>
                    <div>
                      <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                        @{username}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e', flexShrink: 0 }} className="animate-pulse" />
                        <span style={{ color: '#f43f5e', fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Jetzt live</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedRider(null)} style={{
                    background: t.bg, border: `1px solid ${t.border}`,
                    color: t.muted, borderRadius: '50%', width: '30px', height: '30px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: '16px', lineHeight: 1,
                  }}>×</button>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {/* Profil ansehen */}
                  <button
                    onClick={() => { setSelectedRider(null); onSelectRider && onSelectRider(r.profiles?.id || r.user_id) }}
                    style={{
                      padding: '14px 8px', background: 'transparent', border: 'none',
                      borderRight: `1px solid ${t.border}`, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: t.text, fontFamily: "'Barlow', sans-serif", textAlign: 'center', lineHeight: 1.3 }}>Profil{'\n'}ansehen</span>
                  </button>

                  {/* Nachricht senden */}
                  <button
                    onClick={() => { setSelectedRider(null); onSelectRider && onSelectRider(r.profiles?.id || r.user_id) }}
                    style={{
                      padding: '14px 8px', background: 'transparent', border: 'none',
                      borderRight: `1px solid ${t.border}`, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: t.text, fontFamily: "'Barlow', sans-serif", textAlign: 'center', lineHeight: 1.3 }}>Nachricht{'\n'}senden</span>
                  </button>

                  {/* Route planen */}
                  <button
                    onClick={() => {
                      setSelectedRider(null)
                      setRouteTarget({ lat: selectedRider.lat, lng: selectedRider.lng, label: `@${username}` })
                      setShowPlanner(true)
                    }}
                    style={{
                      padding: '14px 8px', background: 'transparent', border: 'none',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '6px',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                    </svg>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: t.text, fontFamily: "'Barlow', sans-serif", textAlign: 'center', lineHeight: 1.3 }}>Route{'\n'}planen</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Live riders button */}
        {liveRiders.length > 0 && (
          <button onClick={() => setShowRiders(!showRiders)} style={{
            position: 'absolute', bottom: '20px', left: '12px', zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', color: 'white', border: 'none',
            borderRadius: '50px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px',
            fontFamily: "'Barlow', sans-serif", fontWeight: '600', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} className="animate-pulse" />
            {liveRiders.length} Live
          </button>
        )}
      </div>

      {/* ── Live stats bar ─────────────────────────────────────────────────── */}
      {isLive && (
        <div style={{
          background: t.surface,
          borderTop: `2px solid ${getSpeedColor(speed)}`,
          padding: '12px 16px 14px',
          flexShrink: 0,
        }}>
          {/* REC badge + speed row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '20px', padding: '4px 10px', flexShrink: 0 }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f43f5e' }} className="animate-pulse" />
              <span style={{ color: '#f43f5e', fontSize: '10px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", letterSpacing: '0.06em' }}>REC</span>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ color: getSpeedColor(speed), fontSize: '52px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, letterSpacing: '-1px' }}>{speed}</span>
              <span style={{ color: t.muted, fontSize: '13px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", marginLeft: '5px', letterSpacing: '0.06em' }}>km/h</span>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ color: t.muted, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Barlow', sans-serif", marginBottom: '2px', marginTop: 0 }}>ZEIT</p>
              <p style={{ color: t.text, fontSize: '18px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, margin: 0 }}>{safeFormatTime(rideTime)}</p>
            </div>
          </div>

          {/* 3 stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'MAX TEMPO',   value: maxSpeed,          unit: 'km/h', color: '#f43f5e' },
              { label: 'DURCHSCHN.', value: avgSpeed,          unit: 'km/h', color: '#facc15' },
              { label: 'STRECKE',    value: distance.toFixed(1), unit: 'km',   color: '#4ade80' },
            ].map(stat => (
              <div key={stat.label} style={{ background: t.bg, borderRadius: '10px', padding: '10px 8px', textAlign: 'center', border: `1px solid ${t.border}` }}>
                <p style={{ color: t.muted, fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Barlow', sans-serif", marginBottom: '4px', marginTop: 0, textTransform: 'uppercase' }}>{stat.label}</p>
                <p style={{ color: t.text, fontSize: '20px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, margin: 0 }}>{stat.value}</p>
                <p style={{ color: stat.color, fontSize: '9px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", marginTop: '3px', marginBottom: 0, letterSpacing: '0.06em' }}>{stat.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Live riders panel ─────────────────────────────────────────────── */}
      {showRiders && liveRiders.length > 0 && (
        <div style={{ background: t.surface, borderTop: `1px solid ${t.border}`, padding: '12px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {liveRiders.map(rider => (
              <button
                key={rider.id}
                onClick={() => onSelectRider && onSelectRider(rider.profiles?.id || rider.user_id)}
                style={{
                  background: t.bg, borderRadius: '10px', padding: '10px 14px',
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
                  border: `1px solid ${t.border}`, cursor: 'pointer',
                  transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = t.border
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: '#f97316', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', color: 'white', fontWeight: '700',
                }}>
                  {rider.profiles?.avatar_url
                    ? <img src={rider.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : rider.profiles?.username?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ color: t.text, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                    {rider.profiles?.username || 'Fahrer'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e' }} className="animate-pulse" />
                    <p style={{ color: t.muted, fontSize: '11px', margin: 0 }}>Live</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
