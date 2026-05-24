import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
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

const createRiderIcon = (color = '#6C63FF', isMe = false, avatarUrl = null, username = '') => {
  const size = isMe ? 44 : 36
  const content = avatarUrl
    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="color:white;font-size:${isMe ? 14 : 11}px;font-weight:700;font-family:'Barlow',sans-serif;">${username?.slice(0,2).toUpperCase() || '??'}</span>`

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
    iconAnchor: [size/2, size/2],
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

function LiveDisplay({ speed, distance }) {
  const [showKm, setShowKm] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setShowKm(prev => !prev), 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ textAlign: 'center', position: 'relative', height: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transition: 'opacity 0.5s', opacity: showKm ? 0 : 1, position: showKm ? 'absolute' : 'relative' }}>
        <p style={{ color: '#555', fontSize: '10px', fontWeight: '700', letterSpacing: '0.15em', fontFamily: "'Barlow', sans-serif", marginBottom: '2px' }}>GESCHWINDIGKEIT</p>
        <p style={{ color: 'white', fontSize: '64px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{speed}</p>
        <p style={{ color: '#6C63FF', fontSize: '12px', fontWeight: '700', fontFamily: "'Barlow', sans-serif", letterSpacing: '0.1em' }}>KM/H</p>
      </div>
      <div style={{ transition: 'opacity 0.5s', opacity: showKm ? 1 : 0, position: showKm ? 'relative' : 'absolute' }}>
        <p style={{ color: '#555', fontSize: '10px', fontWeight: '700', letterSpacing: '0.15em', fontFamily: "'Barlow', sans-serif", marginBottom: '2px' }}>GEFAHRENE KILOMETER</p>
        <p style={{ color: 'white', fontSize: '64px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{distance.toFixed(1)}</p>
        <p style={{ color: '#6C63FF', fontSize: '12px', fontWeight: '700', fontFamily: "'Barlow', sans-serif", letterSpacing: '0.1em' }}>KM</p>
      </div>
    </div>
  )
}

export default function Map({ darkMode, onSelectRider }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [isLive, setIsLive] = useState(false)
  const [myPosition, setMyPosition] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [myTrail, setMyTrail] = useState([])
  const [speed, setSpeed] = useState(0)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [avgSpeed, setAvgSpeed] = useState(0)
  const [speedHistory, setSpeedHistory] = useState([])
  const [rideTime, setRideTime] = useState(0)
  const [distance, setDistance] = useState(0)
  const [liveRiders, setLiveRiders] = useState([])
  const [followMe, setFollowMe] = useState(true)
  const [centerOn, setCenterOn] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showRiders, setShowRiders] = useState(false)
  const [activeMode, setActiveMode] = useState('map')
  const [showPlanner, setShowPlanner] = useState(false)

  const watchRef = useRef(null)
  const intervalRef = useRef(null)
  const sessionRef = useRef(null)
  const lastPosRef = useRef(null)
  const speedsRef = useRef([])

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

  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(() => setRideTime(t => t + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isLive])

  const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  const startRide = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: session } = await supabase.from('live_sessions').insert({
      user_id: user.id, is_active: true, visibility: 'public'
    }).select().single()

    if (session) {
      sessionRef.current = session.id
      setIsLive(true)
      setMyTrail([])
      setRideTime(0)
      setDistance(0)
      setMaxSpeed(0)
      setAvgSpeed(0)
      setSpeedHistory([])
      speedsRef.current = []
      lastPosRef.current = null

      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng, speed: spd } = pos.coords
          const position = [lat, lng]
          const currentSpeed = spd ? Math.round(spd * 3.6) : 0

          setMyPosition(position)
          setMyTrail(prev => [...prev, position])
          setSpeed(currentSpeed)
          setMaxSpeed(prev => Math.max(prev, currentSpeed))
          speedsRef.current.push(currentSpeed)
          setAvgSpeed(Math.round(speedsRef.current.reduce((a,b) => a+b, 0) / speedsRef.current.length))
          setSpeedHistory(prev => [...prev, { lat, lng, speed: currentSpeed }])

          if (lastPosRef.current) {
            const d = calcDistance(lastPosRef.current[0], lastPosRef.current[1], lat, lng)
            setDistance(prev => prev + d)
          }
          lastPosRef.current = position
          if (followMe) setCenterOn(position)

          await supabase.from('live_positions').insert({
            session_id: sessionRef.current,
            user_id: user.id,
            lat, lng, speed: currentSpeed
          })
        },
        err => console.error(err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      )
    }
  }

  const stopRide = async () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    if (sessionRef.current) {
      await supabase.from('live_sessions').update({
        is_active: false, ended_at: new Date().toISOString()
      }).eq('id', sessionRef.current)
    }
    setIsLive(false)
    setShowStats(true)
    sessionRef.current = null
  }

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${m}:${String(s).padStart(2,'0')}`
  }

  const defaultCenter = myPosition || [48.1351, 11.5820]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {showPlanner && <RoutePlanner darkMode={darkMode} onClose={() => setShowPlanner(false)} />}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {centerOn && followMe && <CenterMap position={centerOn} />}

          {myPosition && (
            <Marker position={myPosition} icon={createRiderIcon('#6C63FF', true, myProfile?.avatar_url, myProfile?.username)}>
              <Popup>
                <div style={{ fontFamily: "'Barlow', sans-serif" }}>
                  <p style={{ fontWeight: '700' }}>Du</p>
                  <p>{speed} km/h · Max: {maxSpeed} km/h</p>
                  <p>{distance.toFixed(2)} km gefahren</p>
                </div>
              </Popup>
            </Marker>
          )}

          {speedHistory.length > 1 && speedHistory.map((point, i) => {
            if (i === 0) return null
            const prev = speedHistory[i-1]
            return (
              <Polyline
                key={i}
                positions={[[prev.lat, prev.lng], [point.lat, point.lng]]}
                color={getSpeedColor(point.speed)}
                weight={5} opacity={0.9}
              />
            )
          })}

          {liveRiders.map(rider => (
            <Marker
              key={rider.id}
              position={[48.14, 11.58]}
              icon={createRiderIcon('#f97316', false, rider.profiles?.avatar_url, rider.profiles?.username)}
              eventHandlers={{
                click: () => onSelectRider && onSelectRider(rider.profiles?.id || rider.user_id)
              }}
            >
              <Popup>
                <div
                  onClick={() => onSelectRider && onSelectRider(rider.profiles?.id || rider.user_id)}
                  style={{ cursor: 'pointer', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}
                >
                  {rider.profiles?.username || 'Fahrer'} →
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Top Mode Toggle */}
        <div style={{
          position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, display: 'flex', background: 'rgba(0,0,0,0.75)',
          borderRadius: '50px', padding: '4px', gap: '2px', backdropFilter: 'blur(8px)'
        }}>
          {[
            { id: 'map', label: '🗺️ Karte' },
            { id: 'live', label: '🔴 Live' },
          ].map(mode => (
            <button key={mode.id} onClick={() => setActiveMode(mode.id)} style={{
              background: activeMode === mode.id ? '#6C63FF' : 'transparent',
              color: 'white', border: 'none', borderRadius: '50px',
              padding: '6px 16px', cursor: 'pointer', fontSize: '12px',
              fontWeight: '700', fontFamily: "'Barlow', sans-serif",
              transition: 'all 0.2s'
            }}>{mode.label}</button>
          ))}
        </div>

        {/* Route Planner Button */}
        <button onClick={() => setShowPlanner(true)} style={{
          position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', color: 'white', border: 'none',
          borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
          fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600',
          backdropFilter: 'blur(4px)'
        }}>🗺️ Planen</button>

        {/* Live Mode Controls */}
        {activeMode === 'live' && (
          <>
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
              {!isLive ? (
                <button onClick={startRide} className="btn-press" style={{
                  background: '#6C63FF', color: 'white', border: 'none',
                  borderRadius: '50px', padding: '14px 36px', cursor: 'pointer',
                  fontSize: '15px', fontWeight: '700', fontFamily: "'Barlow', sans-serif",
                  boxShadow: '0 4px 24px rgba(108,99,255,0.7)', letterSpacing: '0.5px'
                }}>🏍️ RIDE STARTEN</button>
              ) : (
                <button onClick={stopRide} className="btn-press" style={{
                  background: '#f43f5e', color: 'white', border: 'none',
                  borderRadius: '50px', padding: '14px 36px', cursor: 'pointer',
                  fontSize: '16px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif",
                  boxShadow: '0 4px 24px rgba(244,63,94,0.7)', letterSpacing: '1px',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                  RIDE BEENDEN
                </button>
              )}
            </div>

            {isLive && (
              <>
                <button onClick={() => setFollowMe(!followMe)} style={{
                  position: 'absolute', bottom: '290px', right: '12px', zIndex: 1000,
                  background: followMe ? '#6C63FF' : 'rgba(0,0,0,0.7)',
                  color: 'white', border: 'none', borderRadius: '8px',
                  padding: '10px 12px', cursor: 'pointer', fontSize: '12px',
                  fontFamily: "'Barlow', sans-serif", fontWeight: '600'
                }}>{followMe ? '📍' : '🗺️'}</button>

                <div style={{
                  position: 'absolute', bottom: '290px', left: '12px', zIndex: 1000,
                  background: 'rgba(0,0,0,0.75)', borderRadius: '8px', padding: '8px 10px',
                  backdropFilter: 'blur(4px)'
                }}>
                  {[
                    { color: '#4ade80', label: '< 30' },
                    { color: '#facc15', label: '30–60' },
                    { color: '#f97316', label: '60–100' },
                    { color: '#f43f5e', label: '> 100' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <div style={{ width: '14px', height: '4px', background: s.color, borderRadius: '2px' }} />
                      <p style={{ color: 'white', fontSize: '10px', fontFamily: "'Barlow', sans-serif" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Live Riders Button */}
        {liveRiders.length > 0 && (
          <button onClick={() => setShowRiders(!showRiders)} style={{
            position: 'absolute', top: '56px', right: '10px', zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', color: 'white', border: 'none',
            borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
            fontFamily: "'Barlow', sans-serif", fontWeight: '600', backdropFilter: 'blur(4px)'
          }}>🔴 {liveRiders.length} Live</button>
        )}
      </div>

      {/* Live Stats Bar */}
      {isLive && (
        <div style={{
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid #1f1f1f',
          padding: '16px', flexShrink: 0
        }}>
          <LiveDisplay speed={speed} distance={distance} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
            {[
              { label: 'MAX', value: maxSpeed, unit: 'km/h' },
              { label: 'DURCHSCHN.', value: avgSpeed, unit: 'km/h' },
              { label: 'STRECKE', value: distance.toFixed(1), unit: 'km' },
              { label: 'ZEIT', value: formatTime(rideTime), unit: '' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: '#1a1a1a', borderRadius: '8px', padding: '10px 6px',
                textAlign: 'center', border: '1px solid #2a2a2a'
              }}>
                <p style={{ color: '#555', fontSize: '9px', fontWeight: '700', letterSpacing: '0.08em', fontFamily: "'Barlow', sans-serif", marginBottom: '4px' }}>{stat.label}</p>
                <p style={{ color: 'white', fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{stat.value}</p>
                {stat.unit && <p style={{ color: '#6C63FF', fontSize: '9px', fontWeight: '700', fontFamily: "'Barlow', sans-serif", marginTop: '2px' }}>{stat.unit}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Riders Panel — clickable to open profile */}
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
                  fontFamily: 'inherit'
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
                  fontSize: '13px', color: 'white', fontWeight: '700'
                }}>
                  {rider.profiles?.avatar_url
                    ? <img src={rider.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : rider.profiles?.username?.slice(0,2).toUpperCase() || '??'}
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

      {/* Post-Ride Stats Modal */}
      {showStats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
          className="animate-fadeIn">
          <div style={{ background: '#111', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px' }}
            className="animate-scaleIn">
            <h3 style={{ color: 'white', fontSize: '24px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '4px', letterSpacing: '0.5px' }}>
              TOUR ABGESCHLOSSEN 🏁
            </h3>
            <p style={{ color: '#555', fontSize: '13px', marginBottom: '24px' }}>Deine Statistiken</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Strecke', value: `${distance.toFixed(1)} km`, icon: '🛣️' },
                { label: 'Fahrzeit', value: formatTime(rideTime), icon: '⏱️' },
                { label: 'Max. Tempo', value: `${maxSpeed} km/h`, icon: '⚡' },
                { label: 'Ø Tempo', value: `${avgSpeed} km/h`, icon: '📊' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#1a1a1a', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '22px', marginBottom: '6px' }}>{stat.icon}</p>
                  <p style={{ color: '#6C63FF', fontSize: '20px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.value}</p>
                  <p style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowStats(false)} className="btn-press" style={{
                flex: 1, background: 'transparent', border: '1px solid #333',
                color: '#888', borderRadius: '8px', padding: '13px',
                cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>Schließen</button>
              <button onClick={() => setShowStats(false)} className="btn-press" style={{
                flex: 2, background: '#6C63FF', border: 'none', color: 'white',
                borderRadius: '8px', padding: '13px', cursor: 'pointer',
                fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '700'
              }}>Tour teilen 🚀</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}