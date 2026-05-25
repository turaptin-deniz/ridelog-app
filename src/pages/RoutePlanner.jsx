import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet'
import { supabase } from '../supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createStopIcon = (index) => L.divIcon({
  className: '',
  html: `<div style="
    width:30px;height:30px;border-radius:50%;
    background:#3b82f6;border:2px solid white;
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:12px;font-weight:700;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
    font-family:'Barlow',sans-serif;
  ">${index + 1}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] })
    } else if (positions.length === 1) {
      map.setView(positions[0], 13)
    }
  }, [positions])
  return null
}

export default function RoutePlanner({ darkMode, onClose, destinationPoint }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const destLabel = destinationPoint?.label || ''

  const [stops, setStops] = useState([
    { id: 1, address: '', coords: null, loading: false },
    {
      id: 2,
      address: destinationPoint ? destLabel : '',
      coords: destinationPoint ? { lat: destinationPoint.lat, lng: destinationPoint.lng } : null,
      loading: false,
    },
  ])
  const [routeCoords, setRouteCoords] = useState([])
  const [routeInfo, setRouteInfo] = useState(null)
  const [fuelPrice, setFuelPrice] = useState(1.85)
  const [consumption, setConsumption] = useState(5)
  const [bike, setBike] = useState(null)
  const [saving, setSaving] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => { loadBike() }, [])

  const loadBike = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('motorcycles')
      .select('*').eq('user_id', user.id).limit(1).single()
    if (data) {
      setBike(data)
      if (data.cc) {
        const estimatedConsumption = data.cc < 300 ? 4 : data.cc < 600 ? 5 : data.cc < 1000 ? 6 : 7
        setConsumption(estimatedConsumption)
      }
    }
  }

  const geocode = async (address) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
    const data = await res.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
    }
    return null
  }

  const updateStop = (id, address) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, address, coords: null } : s))
  }

  const resolveStop = async (id) => {
    const stop = stops.find(s => s.id === id)
    if (!stop.address.trim()) return
    setStops(prev => prev.map(s => s.id === id ? { ...s, loading: true } : s))
    const coords = await geocode(stop.address)
    setStops(prev => prev.map(s => s.id === id ? {
      ...s, coords, loading: false,
      address: coords?.display || s.address
    } : s))
  }

  const addStop = () => {
    const newId = Math.max(...stops.map(s => s.id)) + 1
    setStops(prev => {
      const newStops = [...prev]
      newStops.splice(newStops.length - 1, 0, { id: newId, address: '', coords: null, loading: false })
      return newStops
    })
  }

  const removeStop = (id) => {
    if (stops.length <= 2) return
    setStops(prev => prev.filter(s => s.id !== id))
  }

  const calculateRoute = async () => {
    const validStops = stops.filter(s => s.coords)
    if (validStops.length < 2) return
    setCalculating(true)
    const coords = validStops.map(s => `${s.coords.lng},${s.coords.lat}`).join(';')
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
      const data = await res.json()
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        const points = route.geometry.coordinates.map(c => [c[1], c[0]])
        setRouteCoords(points)
        const distanceKm = (route.distance / 1000).toFixed(1)
        const durationMin = Math.round(route.duration / 60)
        const fuelNeeded = ((distanceKm / 100) * consumption).toFixed(2)
        const fuelCost = (fuelNeeded * fuelPrice).toFixed(2)
        setRouteInfo({ distance: distanceKm, duration: durationMin, fuelNeeded, fuelCost, stops: validStops.length })
      }
    } catch (e) { console.error(e) }
    setCalculating(false)
  }

  const saveRoute = async () => {
    if (!routeName.trim() || !routeInfo) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('routes').insert({
      user_id: user.id,
      title: routeName,
      distance_km: parseFloat(routeInfo.distance),
      duration_minutes: routeInfo.duration,
      fuel_cost: parseFloat(routeInfo.fuelCost),
      waypoints: stops.filter(s => s.coords).map(s => ({ address: s.address, lat: s.coords.lat, lng: s.coords.lng })),
      difficulty: 'medium',
      surface: 'asphalt',
    })
    setSaving(false)
    setShowSave(false)
    onClose && onClose()
  }

  const formatDuration = (mins) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  const validCoords = stops.filter(s => s.coords).map(s => [s.coords.lat, s.coords.lng])

  const inputStyle = {
    flex: 1, background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '8px', padding: '10px 12px', color: t.text,
    fontSize: '13px', fontFamily: "'Barlow', sans-serif", outline: 'none'
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      height: '100vh',
      background: t.bg,
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 0 60px rgba(0,0,0,0.8)'
    }} className="animate-fadeIn">

      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
        background: t.surface, display: 'flex', alignItems: 'center',
        gap: '12px', flexShrink: 0
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px' }}>←</button>
        <h2 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", flex: 1, letterSpacing: '0.5px' }}>
          ROUTENPLANUNG
        </h2>
        {routeInfo && (
          <button onClick={() => setShowSave(true)} className="btn-press" style={{
            background: '#3b82f6', border: 'none', color: 'white',
            borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
            fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '700'
          }}>💾 Speichern</button>
        )}
      </div>

      {/* Map */}
      <div style={{ height: '240px', flexShrink: 0 }}>
        <MapContainer center={[48.1351, 11.5820]} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {validCoords.length > 0 && <FitBounds positions={validCoords} />}
          {stops.filter(s => s.coords).map((stop, i) => (
            <Marker key={stop.id} position={[stop.coords.lat, stop.coords.lng]} icon={createStopIcon(i)}>
              <Popup>{stop.address}</Popup>
            </Marker>
          ))}
          {routeCoords.length > 0 && (
            <Polyline positions={routeCoords} color="#3b82f6" weight={4} opacity={0.85} />
          )}
        </MapContainer>
      </div>

      {/* Stops & Controls */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Stops */}
        <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontFamily: "'Barlow', sans-serif" }}>
          STOPPS
        </p>

        {stops.map((stop, index) => (
          <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: index === 0 ? '#4ade80' : index === stops.length - 1 ? '#f43f5e' : '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '11px', fontWeight: '700',
              fontFamily: "'Barlow', sans-serif"
            }}>
              {index === 0 ? 'A' : index === stops.length - 1 ? 'B' : index}
            </div>

            <input
              value={stop.address}
              onChange={e => updateStop(stop.id, e.target.value)}
              onBlur={() => resolveStop(stop.id)}
              onKeyDown={e => e.key === 'Enter' && resolveStop(stop.id)}
              placeholder={
                index === 0 ? 'Startpunkt eingeben...' :
                index === stops.length - 1 ? 'Ziel eingeben...' :
                `Stopp ${index}...`
              }
              style={inputStyle}
            />

            {stop.loading && <p style={{ color: t.muted, fontSize: '12px', flexShrink: 0 }}>⏳</p>}
            {stop.coords && !stop.loading && <p style={{ color: '#4ade80', fontSize: '16px', flexShrink: 0 }}>✓</p>}

            {stops.length > 2 && index !== 0 && index !== stops.length - 1 && (
              <button onClick={() => removeStop(stop.id)} style={{
                background: 'none', border: 'none', color: '#f87171',
                cursor: 'pointer', fontSize: '16px', flexShrink: 0
              }}>✕</button>
            )}
          </div>
        ))}

        <button onClick={addStop} style={{
          background: 'transparent', border: `1px dashed ${t.border}`,
          color: t.muted, borderRadius: '8px', padding: '10px',
          cursor: 'pointer', fontSize: '13px', width: '100%',
          fontFamily: "'Barlow', sans-serif", marginBottom: '16px'
        }}>+ Stopp hinzufügen</button>

        {/* Fuel Settings */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: '10px', padding: '14px', marginBottom: '16px'
        }}>
          <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: "'Barlow', sans-serif" }}>
            ⛽ BENZINKOSTEN
            {bike && <span style={{ color: '#3b82f6', marginLeft: '6px' }}>({bike.brand} {bike.model})</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ color: t.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Verbrauch (L/100km)</label>
              <input
                type="number"
                value={consumption}
                onChange={e => setConsumption(parseFloat(e.target.value))}
                style={{ ...inputStyle, flex: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ color: t.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Kraftstoffpreis (€/L)</label>
              <input
                type="number"
                step="0.01"
                value={fuelPrice}
                onChange={e => setFuelPrice(parseFloat(e.target.value))}
                style={{ ...inputStyle, flex: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateRoute}
          disabled={stops.filter(s => s.coords).length < 2 || calculating}
          className="btn-press"
          style={{
            width: '100%',
            background: stops.filter(s => s.coords).length >= 2 ? '#3b82f6' : t.border,
            border: 'none', color: 'white', borderRadius: '10px', padding: '14px',
            cursor: stops.filter(s => s.coords).length >= 2 ? 'pointer' : 'default',
            fontSize: '15px', fontWeight: '700', fontFamily: "'Barlow', sans-serif",
            marginBottom: '16px', letterSpacing: '0.5px'
          }}
        >
          {calculating ? '⏳ Berechne Route...' : '🗺️ ROUTE BERECHNEN'}
        </button>

        {/* Route Info */}
        {routeInfo && (
        <div style={{
            background: '#3b82f615', border: '1px solid #3b82f644',
            borderRadius: '12px', padding: '16px'
        }} className="animate-scaleIn">
            <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '700', marginBottom: '12px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px' }}>
            ROUTENINFO
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
                { icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                ), label: 'Stopps', value: `${routeInfo.stops}` },
                { icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
                ), label: 'Strecke', value: `${routeInfo.distance} km` },
                { icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                ), label: 'Dauer', value: formatDuration(routeInfo.duration) },
                { icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/>
                </svg>
                ), label: 'Benzin', value: `${routeInfo.fuelNeeded} L` },
                { icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                ), label: 'Kosten', value: `${routeInfo.fuelCost} €` },
                { icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                ), label: 'Verbrauch', value: `${consumption} L/100km` },
            ].map(info => (
                <div key={info.label} style={{
                background: t.bg, borderRadius: '8px', padding: '10px',
                display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                <div style={{ flexShrink: 0 }}>{info.icon}</div>
                <div>
                    <p style={{ color: t.muted, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px', fontFamily: "'Barlow', sans-serif" }}>{info.label}</p>
                    <p style={{ color: t.text, fontSize: '14px', fontWeight: '400', fontFamily: "'Barlow', sans-serif" }}>{info.value}</p>
                </div>
                </div>
            ))}
            </div>
        </div>
        )}
      </div>

      {/* Save Modal */}
      {showSave && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 3000, padding: '20px'
        }} className="animate-fadeIn">
          <div style={{
            background: t.surface, borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '380px'
          }} className="animate-scaleIn">
            <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '16px' }}>
              Route speichern
            </h3>
            <input
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
              placeholder="Name der Route..."
              style={{ ...inputStyle, flex: 'none', width: '100%', boxSizing: 'border-box', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSave(false)} style={{
                flex: 1, background: 'transparent', border: `1px solid ${t.border}`,
                color: t.muted, borderRadius: '8px', padding: '12px',
                cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif"
              }}>Abbrechen</button>
              <button onClick={saveRoute} disabled={saving} className="btn-press" style={{
                flex: 2, background: '#3b82f6', border: 'none', color: 'white',
                borderRadius: '8px', padding: '12px', cursor: 'pointer',
                fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '700'
              }}>{saving ? 'Speichern...' : '💾 Speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}