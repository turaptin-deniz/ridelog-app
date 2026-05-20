import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { supabase } from '../supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createRiderIcon = (color = '#6C63FF', isMe = false) => L.divIcon({
  className: '',
  html: `<div style="
    width:${isMe ? 44 : 36}px;height:${isMe ? 44 : 36}px;border-radius:50%;
    background:${color};border:3px solid white;
    display:flex;align-items:center;justify-content:center;
    font-size:${isMe ? 20 : 16}px;
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
    animation:pulse_${color.replace('#','')} 2s infinite;
  ">🏍️</div>
  <style>
    @keyframes pulse_${color.replace('#','')} {
      0%{box-shadow:0 0 0 0 ${color}88}
      70%{box-shadow:0 0 0 12px ${color}00}
      100%{box-shadow:0 0 0 0 ${color}00}
    }
  </style>`,
  iconSize: [isMe ? 44 : 36, isMe ? 44 : 36],
  iconAnchor: [isMe ? 22 : 18, isMe ? 22 : 18],
})

function CenterMap({ position }) {
  const map = useMap()
  useEffect(() => { if (position) map.setView(position, map.getZoom()) }, [position])
  return null
}

export default function Live({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [isLive, setIsLive] = useState(false)
  const [myPosition, setMyPosition] = useState(null)
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

  const watchRef = useRef(null)
  const intervalRef = useRef(null)
  const sessionRef = useRef(null)
  const lastPosRef = useRef(null)
  const speedsRef = useRef([])

  useEffect(() => {
    loadLiveRiders()
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

  const loadLiveRiders = async () => {
    const { data } = await supabase
      .from('live_sessions')
      .select('*, profiles(username, avatar_url)')
      .eq('is_active', true)
    if (data) setLiveRiders(data)
  }

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

          // Max Speed
          setMaxSpeed(prev => Math.max(prev, currentSpeed))

          // Avg Speed
          speedsRef.current.push(currentSpeed)
          setAvgSpeed(Math.round(speedsRef.current.reduce((a,b) => a+b, 0) / speedsRef.current.length))

          // Speed History für Streckenbereich
          setSpeedHistory(prev => [...prev, { lat, lng, speed: currentSpeed }])

          // Distance
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

  const getSpeedColor = (spd) => {
    if (spd < 30) return '#4ade80'
    if (spd < 60) return '#facc15'
    if (spd < 100) return '#f97316'
    return '#f43f5e'
  }

  const defaultCenter = myPosition || [48.1351, 11.5820]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, position: 'relative' }}>

      {/* Live Stats Bar */}
      {isLive && (
        <div style={{
          background: 'linear-gradient(90deg, #6C63FF, #8B5CF6)',
          padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4444' }} />
            <span style={{ color: 'white', fontSize: '12px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px' }}>LIVE</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { label: 'KM/H', value: speed },
              { label: 'MAX', value: maxSpeed },
              { label: 'Ø', value: avgSpeed },
              { label: 'KM', value: distance.toFixed(1) },
              { label: 'ZEIT', value: formatTime(rideTime) },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '9px', letterSpacing: '0.05em' }}>{stat.label}</p>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {centerOn && followMe && <CenterMap position={centerOn} />}

          {/* My position */}
          {myPosition && (
            <Marker position={myPosition} icon={createRiderIcon('#6C63FF', true)}>
              <Popup>
                <div style={{ fontFamily: "'Barlow', sans-serif" }}>
                  <p style={{ fontWeight: '700' }}>Du</p>
                  <p>{speed} km/h</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Speed-colored trail segments */}
          {speedHistory.length > 1 && speedHistory.map((point, i) => {
            if (i === 0) return null
            const prev = speedHistory[i-1]
            return (
              <Polyline
                key={i}
                positions={[[prev.lat, prev.lng], [point.lat, point.lng]]}
                color={getSpeedColor(point.speed)}
                weight={4}
                opacity={0.85}
              />
            )
          })}

          {/* Other live riders */}
          {liveRiders.map(rider => (
            <Marker key={rider.id} position={[48.14, 11.58]} icon={createRiderIcon('#f97316')}>
              <Popup>{rider.profiles?.username || 'Fahrer'}</Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Controls */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isLive && (
            <button onClick={() => setFollowMe(!followMe)} style={{
              background: followMe ? '#6C63FF' : 'rgba(0,0,0,0.7)',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
              fontFamily: "'Barlow', sans-serif", fontWeight: '600'
            }}>{followMe ? '📍 Folge' : '🗺️ Frei'}</button>
          )}
          {liveRiders.length > 0 && (
            <button onClick={() => setShowRiders(!showRiders)} style={{
              background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none',
              borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
              fontFamily: "'Barlow', sans-serif", fontWeight: '600'
            }}>🔴 {liveRiders.length}</button>
          )}
        </div>

        {/* Speed Legend */}
        {isLive && (
          <div style={{
            position: 'absolute', bottom: '80px', left: '10px', zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', borderRadius: '8px', padding: '8px 12px'
          }}>
            <p style={{ color: 'white', fontSize: '10px', marginBottom: '4px', fontFamily: "'Barlow', sans-serif", fontWeight: '600' }}>TEMPO</p>
            {[
              { color: '#4ade80', label: '< 30' },
              { color: '#facc15', label: '30-60' },
              { color: '#f97316', label: '60-100' },
              { color: '#f43f5e', label: '> 100' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ width: '12px', height: '4px', background: s.color, borderRadius: '2px' }} />
                <p style={{ color: 'white', fontSize: '10px', fontFamily: "'Barlow', sans-serif" }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Start / Stop Button */}
        <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          {!isLive ? (
            <button onClick={startRide} className="btn-press" style={{
              background: '#6C63FF', color: 'white', border: 'none',
              borderRadius: '50px', padding: '14px 36px', cursor: 'pointer',
              fontSize: '15px', fontWeight: '700', fontFamily: "'Barlow', sans-serif",
              boxShadow: '0 4px 24px rgba(108,99,255,0.6)', letterSpacing: '0.5px'
            }}>🏍️ RIDE STARTEN</button>
          ) : (
            <button onClick={stopRide} className="btn-press" style={{
              background: '#f43f5e', color: 'white', border: 'none',
              borderRadius: '50px', padding: '14px 36px', cursor: 'pointer',
              fontSize: '15px', fontWeight: '700', fontFamily: "'Barlow', sans-serif",
              boxShadow: '0 4px 24px rgba(244,63,94,0.6)', letterSpacing: '0.5px'
            }}>⏹ RIDE BEENDEN</button>
          )}
        </div>
      </div>

      {/* Live Riders Panel */}
      {showRiders && liveRiders.length > 0 && (
        <div style={{
          background: t.surface, borderTop: `1px solid ${t.border}`,
          padding: '12px 16px', flexShrink: 0
        }}>
          <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', fontFamily: "'Barlow', sans-serif" }}>
            🔴 Aktive Fahrer
          </p>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {liveRiders.map(rider => (
              <div key={rider.id} style={{
                background: t.bg, borderRadius: '10px', padding: '10px 14px',
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
                border: `1px solid ${t.border}`
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: '#f97316', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '13px', color: 'white', fontWeight: '700'
                }}>
                  {rider.profiles?.username?.slice(0,2).toUpperCase() || '??'}
                </div>
                <div>
                  <p style={{ color: t.text, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>
                    {rider.profiles?.username || 'Fahrer'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e' }} />
                    <p style={{ color: t.muted, fontSize: '11px' }}>Live</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-Ride Stats Modal */}
      {showStats && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          className="animate-fadeIn">
          <div style={{ background: '#111', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px' }}
            className="animate-scaleIn">
            <h3 style={{ color: 'white', fontSize: '22px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '4px', letterSpacing: '0.5px' }}>TOUR ABGESCHLOSSEN</h3>
            <p style={{ color: '#555', fontSize: '13px', marginBottom: '24px' }}>Deine Statistiken</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Strecke', value: `${distance.toFixed(1)} km`, icon: '🛣️' },
                { label: 'Fahrzeit', value: formatTime(rideTime), icon: '⏱️' },
                { label: 'Max. Tempo', value: `${maxSpeed} km/h`, icon: '⚡' },
                { label: 'Ø Tempo', value: `${avgSpeed} km/h`, icon: '📊' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#1a1a1a', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</p>
                  <p style={{ color: '#6C63FF', fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.value}</p>
                  <p style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowStats(false)} className="btn-press" style={{
                flex: 1, background: 'transparent', border: '1px solid #333',
                color: '#888', borderRadius: '8px', padding: '12px',
                cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>Schließen</button>
              <button onClick={() => setShowStats(false)} className="btn-press" style={{
                flex: 2, background: '#6C63FF', border: 'none',
                color: 'white', borderRadius: '8px', padding: '12px',
                cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '700'
              }}>Tour teilen 🚀</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}