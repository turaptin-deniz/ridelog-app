import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../supabase'

const numberedMarker = (n, accent = false) => L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:${accent ? '#3b82f6' : '#ffffff'};
    color:${accent ? '#ffffff' : '#111111'};
    border:2px solid ${accent ? '#ffffff' : '#3b82f6'};
    display:flex;align-items:center;justify-content:center;
    font-weight:700;font-family:'Barlow Condensed',sans-serif;font-size:13px;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  ">${n}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

/**
 * Normalizes a route or meetup row into a common shape.
 * Returns: { kind, title, stops, meetup_at?, description?, max_participants?,
 *           distance_km?, duration_minutes?, fuel_cost?, difficulty?, surface?,
 *           profile?, owner_id, source, id }
 */
export function normalizeRow(row) {
  const isMeetupTitle = typeof row.title === 'string' && row.title.startsWith('[MEETUP]')
  const isMeetupSource = row.source === 'meetups' || (row.waypoints || []).some(w => w?.type === 'meetup')

  if (isMeetupTitle || isMeetupSource) {
    const wps = row.waypoints || row.stops || []
    const meetupWp = wps.find(w => w?.type === 'meetup') || wps[0] || {}
    return {
      kind: 'meetup',
      id: row.id,
      source: row.source || 'routes',
      title: (row.title || '').replace(/^\[MEETUP\]\s*/, ''),
      meetup_at: row.meetup_at || meetupWp.meetup_at,
      description: row.description || meetupWp.description,
      max_participants: row.max_participants || meetupWp.max_participants,
      stops: wps,
      profile: row.profile || row.profiles,
      owner_id: row.owner_id || row.user_id,
    }
  }

  return {
    kind: 'route',
    id: row.id,
    source: 'routes',
    title: row.title,
    distance_km: row.distance_km,
    duration_minutes: row.duration_minutes,
    fuel_cost: row.fuel_cost,
    difficulty: row.difficulty,
    surface: row.surface,
    region: row.region,
    stops: row.waypoints || [],
    profile: row.profile || row.profiles,
    owner_id: row.user_id,
    created_at: row.created_at,
  }
}

export default function RouteDetail({ row, currentUser, t, onClose }) {
  const data = normalizeRow(row)

  const [participants, setParticipants] = useState([])
  const [isJoined, setIsJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [participantsLoaded, setParticipantsLoaded] = useState(false)
  const [participantsAvailable, setParticipantsAvailable] = useState(true)

  const validStops = (data.stops || []).filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
  const center = validStops[0] ? [validStops[0].lat, validStops[0].lng] : [51.16, 10.45]
  const polyline = validStops.map(s => [s.lat, s.lng])

  // Compute reasonable map zoom: if all stops fit in a small area, zoom in
  const mapZoom = validStops.length > 1 ? 9 : 13

  const isMeetup = data.kind === 'meetup'
  const date = data.meetup_at ? new Date(data.meetup_at) : null
  const dateStr = date && date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = date && date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  // Load participants (only meaningful for meetups)
  const loadParticipants = async () => {
    if (!isMeetup) return
    setParticipantsLoaded(false)
    const meetupKey = `${data.source}:${data.id}`
    const { data: rows, error } = await supabase
      .from('meetup_participants')
      .select('user_id, profiles(id, username, avatar_url)')
      .eq('meetup_key', meetupKey)

    if (error) {
      const m = (error.message || '') + ' ' + (error.details || '')
      if (/does not exist|not find the table|schema cache/i.test(m) || error.code === 'PGRST205' || error.code === '42P01') {
        setParticipantsAvailable(false)
      }
    } else if (rows) {
      setParticipants(rows)
      setIsJoined(rows.some(p => p.user_id === currentUser?.id))
    }
    setParticipantsLoaded(true)
  }

  useEffect(() => { loadParticipants() }, [data.id, isMeetup])

  const toggleJoin = async () => {
    if (!currentUser || joining || !participantsAvailable) return
    setJoining(true)
    const meetupKey = `${data.source}:${data.id}`
    if (isJoined) {
      await supabase.from('meetup_participants').delete()
        .eq('meetup_key', meetupKey).eq('user_id', currentUser.id)
      setIsJoined(false)
      setParticipants(participants.filter(p => p.user_id !== currentUser.id))
    } else {
      const { error } = await supabase.from('meetup_participants').insert({
        meetup_key: meetupKey, user_id: currentUser.id
      })
      if (!error) { setIsJoined(true); loadParticipants() }
    }
    setJoining(false)
  }

  const isOwner = currentUser?.id === data.owner_id
  const atCapacity = data.max_participants && participants.length >= data.max_participants && !isJoined

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 'var(--space-4)', backdropFilter: 'blur(4px)'
      }}
      className="animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface, borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: '460px',
          maxHeight: '90vh', overflowY: 'auto',
          border: `1px solid ${t.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
        className="animate-scaleIn"
      >
        {/* Header */}
        <div style={{
          padding: 'var(--space-4)',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <h3 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 'var(--font-size-xl)', fontWeight: 700,
                color: t.text, margin: 0, lineHeight: 1.2
              }}>{data.title}</h3>
              {isMeetup && (
                <span style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  color: 'var(--color-accent-primary)',
                  borderRadius: '4px', padding: '1px 6px',
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif"
                }}>Meetup</span>
              )}
            </div>
            <p style={{ color: t.muted, fontSize: '12px', margin: 0, fontFamily: "'Barlow', sans-serif" }}>
              von @{data.profile?.username || 'jemand'}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: t.muted,
            cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1
          }}>×</button>
        </div>

        {/* Map */}
        {validStops.length > 0 && (
          <div style={{ height: '220px', width: '100%' }}>
            <MapContainer
              center={center}
              zoom={mapZoom}
              scrollWheelZoom={false}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {polyline.length > 1 && (
                <Polyline positions={polyline} color="#3b82f6" weight={4} opacity={0.85} />
              )}
              {validStops.map((s, i) => (
                <Marker key={i} position={[s.lat, s.lng]} icon={numberedMarker(i === 0 ? 'A' : (i + 1), i === 0)} />
              ))}
            </MapContainer>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: 'var(--space-4)' }}>

          {/* Meetup: Date + time */}
          {isMeetup && date && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
              background: t.bg, borderRadius: 'var(--radius-md)',
              border: `1px solid ${t.border}`
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <div>
                <p style={{ color: t.text, fontSize: '13px', fontWeight: 700, margin: 0, fontFamily: "'Barlow', sans-serif" }}>{dateStr}</p>
                <p style={{ color: t.muted, fontSize: '12px', margin: 0, fontFamily: "'Barlow', sans-serif" }}>um {timeStr} Uhr</p>
              </div>
            </div>
          )}

          {/* Route: stats (distance/duration/fuel/difficulty) */}
          {!isMeetup && (data.distance_km || data.duration_minutes || data.fuel_cost) && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px',
              marginBottom: 'var(--space-3)'
            }}>
              {data.distance_km != null && (
                <StatTile t={t} label="km" value={Math.round(data.distance_km)} />
              )}
              {data.duration_minutes != null && (
                <StatTile t={t} label="Dauer" value={formatDuration(data.duration_minutes)} />
              )}
              {data.fuel_cost != null && (
                <StatTile t={t} label="Sprit" value={`${parseFloat(data.fuel_cost).toFixed(0)}€`} />
              )}
              {data.difficulty && (
                <StatTile t={t} label="Level" value={difficultyLabel(data.difficulty)} />
              )}
            </div>
          )}

          {/* Stops list */}
          {validStops.length > 0 && (
            <>
              <p style={{
                color: t.muted, fontSize: '11px', textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 600, marginBottom: '8px',
                fontFamily: "'Barlow', sans-serif"
              }}>
                {isMeetup ? `Route (${validStops.length} ${validStops.length === 1 ? 'Punkt' : 'Punkte'})` : `Wegpunkte (${validStops.length})`}
              </p>
              <div style={{
                background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
                marginBottom: 'var(--space-3)'
              }}>
                {(data.stops || []).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', padding: '10px 12px',
                    alignItems: 'flex-start',
                    borderBottom: i < (data.stops || []).length - 1 ? `1px solid ${t.border}` : 'none'
                  }}>
                    <div style={{
                      flexShrink: 0,
                      width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                      background: i === 0 ? 'var(--color-accent-primary)' : t.border,
                      color: i === 0 ? 'white' : t.muted,
                      fontSize: '11px', fontWeight: 700,
                      fontFamily: "'Barlow Condensed', sans-serif"
                    }}>{i === 0 ? 'A' : i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: t.text, fontSize: '13px', margin: 0,
                        fontFamily: "'Barlow', sans-serif", lineHeight: 1.4
                      }}>{s.address || '(ohne Adresse)'}</p>
                      {isMeetup && i === 0 && (
                        <p style={{
                          color: 'var(--color-accent-primary)', fontSize: '10px', margin: '2px 0 0',
                          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          fontFamily: "'Barlow', sans-serif"
                        }}>Treffpunkt</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Description */}
          {data.description && (
            <>
              <p style={{
                color: t.muted, fontSize: '11px', textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 600, marginBottom: '6px',
                fontFamily: "'Barlow', sans-serif"
              }}>Beschreibung</p>
              <p style={{
                color: t.text, fontSize: '13px', lineHeight: 1.5,
                fontFamily: "'Barlow', sans-serif", marginBottom: 'var(--space-3)'
              }}>{data.description}</p>
            </>
          )}

          {/* Meetup: Participants + join */}
          {isMeetup && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{
                  color: t.muted, fontSize: '11px', textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontWeight: 600, margin: 0,
                  fontFamily: "'Barlow', sans-serif"
                }}>
                  Teilnehmer ({participants.length}{data.max_participants ? ` / ${data.max_participants}` : ''})
                </p>
              </div>

              {!participantsAvailable ? (
                <div style={{
                  padding: '10px 12px', background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)',
                  color: 'var(--color-warning)', fontSize: '12px',
                  fontFamily: "'Barlow', sans-serif", marginBottom: 'var(--space-3)', lineHeight: 1.4
                }}>
                  Teilnehmer-Funktion braucht eine <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '3px' }}>meetup_participants</code> Tabelle in Supabase.
                </div>
              ) : !participantsLoaded ? (
                <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif", marginBottom: 'var(--space-3)' }}>Laden…</p>
              ) : participants.length === 0 ? (
                <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif", marginBottom: 'var(--space-3)' }}>
                  Noch keine Teilnehmer — sei der Erste!
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-3)' }}>
                  {participants.map(p => (
                    <div key={p.user_id} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: t.bg, border: `1px solid ${t.border}`,
                      borderRadius: '50px', padding: '4px 10px 4px 4px'
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'var(--color-accent-primary)', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '9px', fontWeight: 700
                      }}>
                        {p.profiles?.avatar_url
                          ? <img src={p.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (p.profiles?.username?.slice(0,2).toUpperCase() || '??')}
                      </div>
                      <span style={{ color: t.text, fontSize: '12px', fontWeight: 600, fontFamily: "'Barlow', sans-serif" }}>
                        @{p.profiles?.username || 'jemand'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Join button / owner banner */}
              {!isOwner && participantsAvailable && (
                <button
                  onClick={toggleJoin}
                  disabled={joining || atCapacity}
                  style={{
                    width: '100%', padding: 'var(--space-3)',
                    background: isJoined
                      ? 'transparent'
                      : atCapacity
                        ? 'var(--color-text-muted)'
                        : 'linear-gradient(135deg, var(--color-accent-primary) 0%, #2563eb 100%)',
                    color: isJoined ? 'var(--color-danger)' : 'white',
                    border: isJoined ? '1px solid var(--color-danger)' : 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-base)', fontWeight: 700,
                    fontFamily: 'var(--font-family-primary)',
                    cursor: (joining || atCapacity) ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)',
                    boxShadow: isJoined ? 'none' : '0 4px 15px rgba(59,130,246,0.25)'
                  }}
                >
                  {joining ? '…' : atCapacity ? 'Voll besetzt' : isJoined ? 'Abmelden' : 'Teilnehmen'}
                </button>
              )}
              {isOwner && (
                <div style={{
                  textAlign: 'center', padding: 'var(--space-3)',
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-accent-primary)',
                  fontSize: '12px', fontWeight: 600, fontFamily: "'Barlow', sans-serif"
                }}>
                  Du hast diese Tour organisiert
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({ t, label, value }) {
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius-md)', padding: '10px 8px', textAlign: 'center'
    }}>
      <p style={{
        color: 'var(--color-accent-primary)',
        fontSize: '18px', fontWeight: 700,
        fontFamily: "'Barlow Condensed', sans-serif",
        margin: 0, lineHeight: 1
      }}>{value}</p>
      <p style={{
        color: t.muted, fontSize: '10px', textTransform: 'uppercase',
        letterSpacing: '0.05em', margin: '4px 0 0',
        fontFamily: "'Barlow', sans-serif"
      }}>{label}</p>
    </div>
  )
}

function formatDuration(mins) {
  if (!mins) return '–'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function difficultyLabel(d) {
  return { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', expert: 'Experte' }[d] || d
}
