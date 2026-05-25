import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import './design-system.css'
import Login from './pages/Login'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Discover from './pages/Discover'
import CreateMenu from './components/CreateMenu'
import { useTranslation } from './i18n'

function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── UI ────────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(true)
  const [activePage, setActivePage] = useState('map')
  const [showSettings, setShowSettings] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('de')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('revmeet-fontsize') || 'md')

  // ── Ride tracking (lifted so it persists across tab navigation) ───────────
  const [isLive, setIsLive] = useState(false)
  const [myPosition, setMyPosition] = useState(null)
  const [myTrail, setMyTrail] = useState([])
  const [speed, setSpeed] = useState(0)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [avgSpeed, setAvgSpeed] = useState(0)
  const [speedHistory, setSpeedHistory] = useState([])
  const [rideTime, setRideTime] = useState(0)
  const [distance, setDistance] = useState(0)
  const [showRideStats, setShowRideStats] = useState(false)

  const watchRef = useRef(null)
  const intervalRef = useRef(null)
  const sessionRef = useRef(null)
  const lastPosRef = useRef(null)
  const speedsRef = useRef([])

  const T = useTranslation(selectedLanguage)

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize
    localStorage.setItem('revmeet-fontsize', fontSize)
  }, [fontSize])

  // Ride timer — keeps counting no matter which tab is active
  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(() => setRideTime(prev => prev + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isLive])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }

  // ── Ride functions ────────────────────────────────────────────────────────
  const startRide = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: sess } = await supabase
      .from('live_sessions')
      .insert({ user_id: user.id, is_active: true, visibility: 'public' })
      .select()
      .single()

    if (sess) {
      sessionRef.current = sess.id
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
          setAvgSpeed(
            Math.round(
              speedsRef.current.reduce((a, b) => a + b, 0) / speedsRef.current.length
            )
          )
          setSpeedHistory(prev => [...prev, { lat, lng, speed: currentSpeed }])

          if (lastPosRef.current) {
            const d = calcDistance(
              lastPosRef.current[0], lastPosRef.current[1], lat, lng
            )
            setDistance(prev => prev + d)
          }
          lastPosRef.current = position

          await supabase.from('live_positions').insert({
            session_id: sessionRef.current,
            user_id: user.id,
            lat, lng, speed: currentSpeed,
          })
        },
        err => console.error(err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      )
    }
  }

  const stopRide = async () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    clearInterval(intervalRef.current)
    if (sessionRef.current) {
      await supabase.from('live_sessions').update({
        is_active: false, ended_at: new Date().toISOString(),
      }).eq('id', sessionRef.current)
    }
    setIsLive(false)
    setSpeed(0)
    setShowRideStats(true)
    sessionRef.current = null
    watchRef.current = null
  }

  const saveTour = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const tourName = `Tour ${new Date().toLocaleDateString('de-DE')}`

      // Save route (graceful – ignore missing columns)
      try {
        await supabase.from('routes').insert({
          user_id: user.id,
          name: tourName,
          distance_km: parseFloat(distance.toFixed(2)),
          duration_secs: rideTime,
          max_speed: maxSpeed,
          avg_speed: avgSpeed,
          waypoints: JSON.stringify(myTrail),
        })
      } catch { /* column may not exist yet */ }

      // Update profile stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_km, max_speed')
        .eq('id', user.id)
        .single()

      if (profile) {
        const updates = {}
        if (distance > 0)
          updates.total_km = (profile.total_km || 0) + parseFloat(distance.toFixed(2))
        if (maxSpeed > (profile.max_speed || 0))
          updates.max_speed = maxSpeed
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', user.id)
        }
      }
    } catch (err) {
      console.error('saveTour:', err)
    }
    setShowRideStats(false)
  }

  // ── Theme shorthand ───────────────────────────────────────────────────────
  const t = {
    bg: 'var(--color-bg-primary)',
    surface: 'var(--color-surface)',
    border: 'var(--color-border-base)',
    text: 'var(--color-text-primary)',
    muted: 'var(--color-text-muted)',
    accent: 'var(--color-accent-primary)',
  }

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: 'var(--color-bg-primary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="animate-spin">
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20"/>
      </svg>
    </div>
  )

  if (!session) return <Login onLogin={() => {}} darkMode={darkMode} setDarkMode={setDarkMode} />

  // Navigate to another user's profile from anywhere
  const navigateToProfile = () => {
    setActivePage('profil')
  }

  // ── Map props (shared ride state) ─────────────────────────────────────────
  const rideProps = {
    isLive, myPosition, myTrail, speed, maxSpeed, avgSpeed,
    speedHistory, rideTime, distance,
    onStartRide: startRide,
    onStopRide: stopRide,
    formatTime,
  }

  const renderPage = () => {
    if (searchQuery.trim().length > 0) {
      return (
        <Discover
          darkMode={darkMode}
          searchQuery={searchQuery}
          onSelectUser={navigateToProfile}
          lang={selectedLanguage}
        />
      )
    }
    switch (activePage) {
      case 'map':
        return (
          <Map
            darkMode={darkMode}
            onSelectRider={navigateToProfile}
            lang={selectedLanguage}
            {...rideProps}
          />
        )
      case 'feed':
        return <Feed darkMode={darkMode} lang={selectedLanguage} />
      case 'messages':
        return <Messages darkMode={darkMode} lang={selectedLanguage} />
      case 'profil':
        return <Profile darkMode={darkMode} setDarkMode={setDarkMode} lang={selectedLanguage} />
      case 'discover':
        return <Discover darkMode={darkMode} onSelectUser={navigateToProfile} lang={selectedLanguage} />
      default:
        return (
          <Map
            darkMode={darkMode}
            onSelectRider={navigateToProfile}
            lang={selectedLanguage}
            {...rideProps}
          />
        )
    }
  }

  // ── Nav items ─────────────────────────────────────────────────────────────
  const NAV_LEFT = [
    {
      id: 'map',
      label: T('nav_map'),
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
      ),
    },
    {
      id: 'feed',
      label: T('nav_feed'),
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      ),
    },
  ]

  const NAV_RIGHT = [
    {
      id: 'messages',
      label: T('nav_chats'),
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'profil',
      label: T('nav_profile'),
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ]

  const NavBtn = ({ item }) => {
    const isActive = activePage === item.id && !searchQuery
    return (
      <button
        onClick={() => { setActivePage(item.id); setSearchQuery('') }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-3) 0 var(--space-2)', background: 'transparent', border: 'none',
          cursor: 'pointer',
          color: isActive ? t.accent : t.muted,
          gap: 'var(--space-1)', position: 'relative',
          transition: 'color var(--transition-fast)',
        }}
      >
        {/* Active page top bar */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '24px', height: '2px', background: t.accent, borderRadius: '0 0 2px 2px',
          }} />
        )}

        {/* Live ride pulsing dot on Karte tab */}
        {item.id === 'map' && isLive && (
          <div style={{
            position: 'absolute', top: '7px', right: 'calc(50% - 19px)',
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#f43f5e',
            boxShadow: '0 0 0 2px rgba(244,63,94,0.25)',
            zIndex: 10,
          }} className="animate-pulse" />
        )}

        {item.icon(isActive)}
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
          fontFamily: 'var(--font-family-primary)',
        }}>
          {item.label}
        </span>
      </button>
    )
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--color-bg-secondary)', minHeight: '100vh' }}>
      <div style={{
        width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column',
        minHeight: '100vh', background: t.bg, position: 'relative',
        boxShadow: '0 0 60px rgba(0,0,0,0.4)',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--space-3) var(--space-4)', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          background: t.surface, flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{
            width: '36px', height: '36px',
            background: `linear-gradient(135deg, ${t.accent} 0%, var(--color-accent-secondary) 100%)`,
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(59, 130, 246, 0.25)',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="5.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
              <circle cx="18.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
              <path d="M5.5 17.5L8 10L12 9L15 6H18L19.5 9L21 11L18.5 17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 10L12 11L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Search field */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            background: t.bg, border: `1px solid ${searchFocused ? t.accent : t.border}`,
            borderRadius: 'var(--radius-full)', padding: '6px 12px',
            transition: 'border-color var(--transition-fast)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? t.accent : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke var(--transition-fast)' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={T('search_placeholder')}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                color: t.text, fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-primary)', outline: 'none', padding: '2px 0',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                background: 'transparent', border: 'none', color: t.muted,
                cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'transparent', border: 'none', color: t.muted,
              cursor: 'pointer', padding: 'var(--space-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.accent}
            onMouseLeave={e => e.currentTarget.style.color = t.muted}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          {/* Notification Bell */}
          <button style={{
            background: 'transparent', border: 'none', color: t.muted,
            cursor: 'pointer', padding: 'var(--space-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = t.accent}
          onMouseLeave={e => e.currentTarget.style.color = t.muted}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>

        {/* ── Page content ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fadeIn">
          {renderPage()}
        </div>

        {/* ── Bottom nav ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderTop: `1px solid ${t.border}`,
          background: t.surface, flexShrink: 0, paddingBottom: 'var(--space-1)',
          alignItems: 'center', position: 'relative', zIndex: 1500, overflow: 'visible',
        }}>
          {NAV_LEFT.map(item => <NavBtn key={item.id} item={item} />)}

          {/* Center Plus button */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 1600 }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: '52px', height: '52px',
                background: `linear-gradient(135deg, ${t.accent} 0%, #2563eb 100%)`,
                border: 'none', borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
                transform: 'translateY(-12px)',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                position: 'relative', zIndex: 1700,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-14px) scale(1.05)'
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(59,130,246,0.6)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(-12px) scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)'
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          {NAV_RIGHT.map(item => <NavBtn key={item.id} item={item} />)}
        </div>

        {/* ── Create menu ──────────────────────────────────────────────────── */}
        <CreateMenu
          open={showCreate}
          onClose={() => setShowCreate(false)}
          lang={selectedLanguage}
          onCreated={(kind) => {
            if (kind === 'post') setActivePage('feed')
            if (kind === 'meetup') setActivePage('map')
          }}
        />

        {/* ── Settings modal ───────────────────────────────────────────────── */}
        {showSettings && (
          <div
            onClick={() => setShowSettings(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2000, padding: 'var(--space-4)', backdropFilter: 'blur(4px)',
            }}
            className="animate-fadeIn"
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: t.surface, borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)', width: '100%', maxWidth: '380px',
                border: `1px solid ${t.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
              className="animate-scaleIn"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <h3 style={{ color: t.text, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-family-condensed)', margin: 0 }}>
                  {T('settings')}
                </h3>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1 }}>×</button>
              </div>

              {/* Theme label */}
              <div style={{ color: t.muted, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-family-primary)' }}>
                {T('settings_theme')}
              </div>

              {/* Theme toggle */}
              <div style={{
                position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr',
                background: t.bg, border: `1px solid ${t.border}`, borderRadius: 'var(--radius-full)',
                padding: '4px', marginBottom: 'var(--space-4)', height: '44px', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: '4px',
                  left: darkMode ? 'calc(50% + 0px)' : '4px',
                  width: 'calc(50% - 4px)', height: 'calc(100% - 8px)',
                  background: `linear-gradient(135deg, ${t.accent} 0%, #2563eb 100%)`,
                  borderRadius: 'var(--radius-full)',
                  boxShadow: '0 2px 10px rgba(59, 130, 246, 0.35)',
                  transition: 'left 280ms cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 1,
                }} />
                <button onClick={() => setDarkMode(false)} style={{ position: 'relative', zIndex: 2, background: 'transparent', border: 'none', color: !darkMode ? '#fff' : t.text, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', fontFamily: 'var(--font-family-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                  </svg>
                  {T('settings_light')}
                </button>
                <button onClick={() => setDarkMode(true)} style={{ position: 'relative', zIndex: 2, background: 'transparent', border: 'none', color: darkMode ? '#fff' : t.text, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', fontFamily: 'var(--font-family-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  {T('settings_dark')}
                </button>
              </div>

              {/* Font size label */}
              <div style={{ color: t.muted, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-family-primary)' }}>
                {T('settings_font_size')}
              </div>

              {/* Font size 3-way toggle */}
              <div style={{
                position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                background: t.bg, border: `1px solid ${t.border}`, borderRadius: 'var(--radius-full)',
                padding: '4px', marginBottom: 'var(--space-4)', height: '44px', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: '4px',
                  left: fontSize === 'sm' ? '4px' : fontSize === 'md' ? 'calc(33.33% + 0px)' : 'calc(66.66% + 0px)',
                  width: 'calc(33.33% - 4px)', height: 'calc(100% - 8px)',
                  background: `linear-gradient(135deg, ${t.accent} 0%, #2563eb 100%)`,
                  borderRadius: 'var(--radius-full)',
                  boxShadow: '0 2px 10px rgba(59, 130, 246, 0.35)',
                  transition: 'left 280ms cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 1,
                }} />
                {[
                  { id: 'sm', label: T('settings_font_sm') },
                  { id: 'md', label: T('settings_font_md') },
                  { id: 'lg', label: T('settings_font_lg') },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setFontSize(opt.id)} style={{
                    position: 'relative', zIndex: 2, background: 'transparent', border: 'none',
                    color: fontSize === opt.id ? '#fff' : t.text,
                    fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                    fontFamily: 'var(--font-family-primary)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}>{opt.label}</button>
                ))}
              </div>

              {/* Other settings */}
              {[
                { label: T('settings_privacy'), icon: '🔒', action: () => {} },
                { label: T('settings_language'), icon: '🌍', action: () => setShowLanguage(true) },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  width: '100%', background: t.bg, border: `1px solid ${t.border}`,
                  color: t.text, borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                  fontFamily: 'var(--font-family-primary)', textAlign: 'left',
                  marginBottom: 'var(--space-2)', transition: 'all var(--transition-fast)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              <button onClick={() => supabase.auth.signOut()} style={{
                width: '100%', background: 'transparent', border: '1px solid #f87171',
                color: '#f87171', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-family-primary)', marginTop: 'var(--space-2)',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {T('settings_logout')}
              </button>
            </div>
          </div>
        )}

        {/* ── Language modal ───────────────────────────────────────────────── */}
        {showLanguage && (
          <div
            onClick={() => setShowLanguage(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2100, padding: 'var(--space-4)', backdropFilter: 'blur(4px)',
            }}
            className="animate-fadeIn"
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: t.surface, borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)', width: '100%', maxWidth: '360px',
                border: `1px solid ${t.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
              className="animate-scaleIn"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <h3 style={{ color: t.text, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-family-condensed)', margin: 0 }}>
                  {T('settings_language')}
                </h3>
                <button onClick={() => setShowLanguage(false)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1 }}>×</button>
              </div>
              {[
                { key: 'lang_de', flag: '🇩🇪', id: 'de' },
                { key: 'lang_en', flag: '🇬🇧', id: 'en' },
                { key: 'lang_fr', flag: '🇫🇷', id: 'fr' },
                { key: 'lang_es', flag: '🇪🇸', id: 'es' },
              ].map(lang => (
                <button key={lang.id} onClick={() => { setSelectedLanguage(lang.id); setShowLanguage(false) }} style={{
                  width: '100%',
                  background: selectedLanguage === lang.id ? 'rgba(59,130,246,0.12)' : t.bg,
                  border: `1px solid ${selectedLanguage === lang.id ? t.accent : t.border}`,
                  color: t.text, borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                  fontFamily: 'var(--font-family-primary)', textAlign: 'left',
                  marginBottom: 'var(--space-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all var(--transition-fast)',
                }}>
                  <span>{lang.flag} {T(lang.key)}</span>
                  {selectedLanguage === lang.id && <span style={{ color: t.accent, fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Post-ride stats modal (app-level so it shows on any tab) ───── */}
        {showRideStats && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2200, padding: '20px',
            }}
            className="animate-fadeIn"
          >
            <div
              style={{
                background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '400px',
              }}
              className="animate-scaleIn"
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', flexShrink: 0,
                }}>🏁</div>
                <div>
                  <h3 style={{ color: t.text, fontSize: '20px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', margin: 0 }}>
                    TOUR ABGESCHLOSSEN
                  </h3>
                  <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>
                    Deine Statistiken
                  </p>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Strecke',    value: distance.toFixed(1), unit: 'km',   icon: '🛣️', color: '#4ade80' },
                  { label: 'Fahrzeit',   value: formatTime(rideTime), unit: '',    icon: '⏱️', color: '#3b82f6' },
                  { label: 'Max. Tempo', value: `${maxSpeed}`,        unit: 'km/h', icon: '⚡', color: '#f43f5e' },
                  { label: 'Ø Tempo',    value: `${avgSpeed}`,        unit: 'km/h', icon: '📊', color: '#facc15' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: t.bg, borderRadius: '12px', padding: '14px', border: `1px solid ${t.border}` }}>
                    <p style={{ fontSize: '18px', marginBottom: '6px' }}>{stat.icon}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <p style={{ color: stat.color, fontSize: '24px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, margin: 0 }}>{stat.value}</p>
                      {stat.unit && <p style={{ color: t.muted, fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", margin: 0 }}>{stat.unit}</p>}
                    </div>
                    <p style={{ color: t.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Barlow', sans-serif", marginTop: '3px', marginBottom: 0 }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowRideStats(false)}
                  className="btn-press"
                  style={{
                    flex: 1, background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.muted, borderRadius: '10px', padding: '13px',
                    cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 600,
                  }}
                >
                  Schließen
                </button>
                <button
                  onClick={saveTour}
                  className="btn-press"
                  style={{
                    flex: 2, background: 'var(--color-accent-primary)', border: 'none', color: 'white',
                    borderRadius: '10px', padding: '13px', cursor: 'pointer',
                    fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Tour speichern
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
