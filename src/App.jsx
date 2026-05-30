import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import './design-system.css'
import Login from './pages/Login'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Discover from './pages/Discover'
import UserProfile from './pages/UserProfile'
import CreateMenu from './components/CreateMenu'
import { useTranslation } from './i18n'

// ── Badge definitions (shared between saveTour and Profile) ──────────────────
const ALL_BADGES = [
  { type: 'first_ride',  condition: p => (p.total_rides  || 0) >= 1   },
  { type: 'km_100',      condition: p => (p.total_km     || 0) >= 100  },
  { type: 'km_500',      condition: p => (p.total_km     || 0) >= 500  },
  { type: 'km_1000',     condition: p => (p.total_km     || 0) >= 1000 },
  { type: 'km_5000',     condition: p => (p.total_km     || 0) >= 5000 },
  { type: 'speed_100',   condition: p => (p.max_speed    || 0) >= 100  },
  { type: 'speed_150',   condition: p => (p.max_speed    || 0) >= 150  },
  { type: 'speed_200',   condition: p => (p.max_speed    || 0) >= 200  },
  { type: 'long_100',    condition: p => (p.longest_ride || 0) >= 100  },
  { type: 'long_300',    condition: p => (p.longest_ride || 0) >= 300  },
  { type: 'rides_10',    condition: p => (p.total_rides  || 0) >= 10   },
  { type: 'rides_50',    condition: p => (p.total_rides  || 0) >= 50   },
]

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
  // showCreate removed — create functionality lives in the 'erstellen' tab
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

  // ── Vehicle picker ────────────────────────────────────────────────────────
  const [myBikes, setMyBikes] = useState([])
  const [showVehiclePicker, setShowVehiclePicker] = useState(false)

  // ── User profile navigation ───────────────────────────────────────────────
  const [viewingUserId, setViewingUserId] = useState(null)
  const [prevPage, setPrevPage] = useState(null)

  // ── Legal modals ──────────────────────────────────────────────────────────
  const [showImpressum, setShowImpressum] = useState(false)
  const [showAGB, setShowAGB] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)

  // ── Tour teilen (2-step post-ride modal) ──────────────────────────────────
  const [rideModalStep, setRideModalStep] = useState('stats') // 'stats' | 'share'
  const [shareCaption, setShareCaption] = useState('')

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  // ── Privacy settings ──────────────────────────────────────────────────────
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [privacyLevel, setPrivacyLevel] = useState('public')

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

  // Load user's vehicles once logged in
  useEffect(() => {
    if (!session) return
    const loadBikes = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('motorcycles')
        .select('id, brand, model, year, hp, image_url, vehicle_type')
        .eq('user_id', user.id)
      setMyBikes(data || [])
    }
    loadBikes()
    // Re-load whenever the garage tab might have changed (custom event)
    window.addEventListener('ridelog:bike-saved', loadBikes)
    return () => window.removeEventListener('ridelog:bike-saved', loadBikes)
  }, [session])

  // ── Notifications ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    let channel
    const loadNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(id, username, avatar_url)')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read).length)
      }

      // Also load privacy level
      const { data: prof } = await supabase.from('profiles').select('privacy_level').eq('id', user.id).single()
      if (prof?.privacy_level) setPrivacyLevel(prof.privacy_level)

      // Real-time subscription
      channel = supabase.channel('notifications-' + user.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, async (payload) => {
          const { data: full } = await supabase
            .from('notifications')
            .select('*, sender:profiles!notifications_sender_id_fkey(id, username, avatar_url)')
            .eq('id', payload.new.id).single()
          const notif = full || payload.new
          setNotifications(prev => [notif, ...prev])
          setUnreadCount(prev => prev + 1)
        })
        .subscribe()
    }
    loadNotifications()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [session])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    const sizes = { sm: '13px', md: '15px', lg: '17px' }
    document.documentElement.dataset.fontSize = fontSize
    // Set inline style on <html> so rem-based values scale immediately.
    // Inline style has highest specificity and overrides all CSS rules.
    document.documentElement.style.fontSize = sizes[fontSize] || '15px'
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

  // Entry point — shows vehicle picker if user has multiple bikes
  const startRide = async () => {
    if (myBikes.length > 1) {
      setShowVehiclePicker(true)
      return
    }
    // 0 or 1 bike — start immediately
    const vehicleId = myBikes.length === 1 ? myBikes[0].id : null
    await doStartRide(vehicleId)
  }

  // Actual ride start — called after vehicle is picked (or directly if 0/1 bike)
  const doStartRide = async (vehicleId) => {
    setShowVehiclePicker(false)
    setSelectedVehicleId(vehicleId)

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

  const saveTour = async (andShare = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const tourName = `Tour ${new Date().toLocaleDateString('de-DE')}`

      // 1. Save route (graceful — ignore missing columns)
      try {
        await supabase.from('routes').insert({
          user_id: user.id,
          name: tourName,
          distance_km: parseFloat(distance.toFixed(2)),
          duration_secs: rideTime,
          max_speed: maxSpeed,
          avg_speed: avgSpeed,
          waypoints: JSON.stringify(myTrail),
          vehicle_id: selectedVehicleId || null,
        })
      } catch { /* column may not exist yet */ }

      // 2. Recompute stats from ALL routes (fresh, accurate)
      const { data: allRoutes } = await supabase
        .from('routes').select('distance_km, max_speed').eq('user_id', user.id)

      if (allRoutes) {
        const total_km      = allRoutes.reduce((s, r) => s + (r.distance_km || 0), 0)
        const total_rides   = allRoutes.length
        const max_spd       = Math.max(0, ...allRoutes.map(r => r.max_speed || 0))
        const longest_ride  = Math.max(0, ...allRoutes.map(r => r.distance_km || 0))
        const newStats      = { total_km, total_rides, max_speed: max_spd, longest_ride }

        await supabase.from('profiles').update(newStats).eq('id', user.id)

        // 3. Check & save newly earned badges
        try {
          const { data: existingBadges } = await supabase
            .from('badges').select('type').eq('user_id', user.id)
          const earned = existingBadges?.map(b => b.type) || []
          const newBadges = ALL_BADGES
            .filter(b => !earned.includes(b.type) && b.condition(newStats))
            .map(b => ({ user_id: user.id, type: b.type, earned_at: new Date().toISOString() }))
          if (newBadges.length > 0) {
            await supabase.from('badges').insert(newBadges)
          }
        } catch { /* badges table may not exist */ }
      }

      // 4. If sharing: build pre-filled caption and show share step
      if (andShare) {
        const dur = formatTime(rideTime)
        setShareCaption(`🏍️ ${tourName} • ${parseFloat(distance.toFixed(1))} km • ${dur} • max ${maxSpeed} km/h`)
        setRideModalStep('share')
        return // keep modal open, switch to share step
      }
    } catch (err) {
      console.error('saveTour:', err)
    }
    setShowRideStats(false)
    setRideModalStep('stats')
  }

  const submitSharePost = async () => {
    if (!shareCaption.trim()) { setShowRideStats(false); setRideModalStep('stats'); return }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('posts').insert({ user_id: user.id, content: shareCaption.trim(), photos: [] })
      window.dispatchEvent(new CustomEvent('ridelog:post-created'))
    } catch (e) { console.error('submitSharePost:', e) }
    setShowRideStats(false)
    setRideModalStep('stats')
    setShareCaption('')
    setActivePage('feed')
  }

  const markAllNotificationsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const savePrivacyLevel = async (level) => {
    setPrivacyLevel(level)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ privacy_level: level }).eq('id', user.id)
    setShowPrivacy(false)
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
  const navigateToProfile = (userId) => {
    if (!userId) return
    setPrevPage(activePage)
    setViewingUserId(userId)
    setActivePage('userprofile')
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
    // Fremdes Profil — hat Vorrang vor allem anderen
    if (activePage === 'userprofile' && viewingUserId) {
      return (
        <UserProfile
          userId={viewingUserId}
          darkMode={darkMode}
          onBack={() => {
            setViewingUserId(null)
            setActivePage(prevPage || 'discover')
          }}
        />
      )
    }

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
      case 'erstellen':
        return (
          <CreateMenu
            pageMode
            lang={selectedLanguage}
            onCreated={(kind) => {
              if (kind === 'post') setActivePage('feed')
              if (kind === 'meetup') setActivePage('map')
            }}
          />
        )
      case 'feed':
        return <Feed darkMode={darkMode} lang={selectedLanguage} onSelectUser={navigateToProfile} />
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
      id: 'erstellen',
      label: 'Erstellen',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
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
    <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--color-bg-secondary)', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column',
        height: '100vh', background: t.bg, position: 'relative',
        boxShadow: '0 0 60px rgba(0,0,0,0.4)',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--space-3) var(--space-4)', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          background: t.surface, flexShrink: 0,
        }}>
          {/* Logo — RL + Road element */}
          <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="rl-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0f172a"/>
                <stop offset="100%" stopColor="#020617"/>
              </linearGradient>
            </defs>
            {/* Background */}
            <rect width="32" height="32" rx="8" fill="url(#rl-bg)"/>
            {/* Ride element — road curve (swoosh) */}
            <path d="M 2 29 Q 16 22 30 29" stroke="#3b82f6" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55"/>
            {/* Speed dot — center of road = vanishing point */}
            <circle cx="16" cy="22.5" r="1.5" fill="#3b82f6" opacity="0.9"/>
            {/* R — smooth bezier strokes */}
            <path d="M 6 7 L 6 23" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M 6 7 C 6 7 15.5 7 15.5 12 C 15.5 17 6 17 6 17" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M 11.5 17 L 16.5 23" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            {/* L — smooth strokes */}
            <path d="M 19.5 7 L 19.5 23 L 27 23" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

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
          <button
            onClick={() => { setShowNotifications(true); markAllNotificationsRead() }}
            style={{
              background: 'transparent', border: 'none', color: unreadCount > 0 ? t.accent : t.muted,
              cursor: 'pointer', padding: 'var(--space-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color var(--transition-fast)', position: 'relative',
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.accent}
            onMouseLeave={e => e.currentTarget.style.color = unreadCount > 0 ? t.accent : t.muted}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: 'white', fontFamily: "'Barlow', sans-serif" }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
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

          {/* Center Map button — tire icon, pulses green when ride is live */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 1600 }}>
            {/* Wrapper lifts both rings + button together */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(-12px)', zIndex: 1700 }}>
              {/* Sonar rings when live */}
              {isLive && (
                <>
                  <div className="live-ring" />
                  <div className="live-ring live-ring-2" />
                </>
              )}
              <button
                onClick={() => { setActivePage('map'); setSearchQuery('') }}
                style={{
                  width: '52px', height: '52px',
                  background: isLive
                    ? 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)'
                    : `linear-gradient(135deg, ${t.accent} 0%, #2563eb 100%)`,
                  border: 'none', borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isLive
                    ? '0 4px 20px rgba(74,222,128,0.55)'
                    : '0 4px 16px rgba(59,130,246,0.45)',
                  transition: 'background 0.4s, box-shadow 0.4s, transform var(--transition-fast)',
                  position: 'relative', zIndex: 1,
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
              </button>
            </div>
          </div>

          {NAV_RIGHT.map(item => <NavBtn key={item.id} item={item} />)}
        </div>

        {/* CreateMenu is now rendered as a full page via the 'erstellen' tab */}

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
                { label: T('settings_privacy'), action: () => { setShowSettings(false); setShowPrivacy(true) },
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
                { label: T('settings_language'), action: () => setShowLanguage(true),
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                { label: 'Impressum', action: () => { setShowSettings(false); setShowImpressum(true) },
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
                { label: 'AGB', action: () => { setShowSettings(false); setShowAGB(true) },
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> },
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
                  <span style={{ color: t.muted, display: 'flex' }}>{item.icon}</span>
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

        {/* ── Impressum Modal ──────────────────────────────────────────── */}
        {showImpressum && (
          <div onClick={() => setShowImpressum(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2100, backdropFilter: 'blur(4px)' }} className="animate-fadeIn">
            <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: `1px solid ${t.border}`, boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' }} className="animate-scaleIn">
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: t.border }} />
              </div>
              {/* Header */}
              <div style={{ padding: '8px 20px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: t.text, fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em', margin: 0 }}>IMPRESSUM</h3>
                <button onClick={() => setShowImpressum(false)} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: t.muted, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', lineHeight: '1.7' }}>
                <p style={{ color: t.muted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Angaben gemäß § 5 TMG</p>
                <p style={{ color: t.text, fontSize: '14px', marginBottom: '20px', fontFamily: "'Barlow', sans-serif" }}>
                  <strong>[PLATZHALTER — Vor- und Nachname]</strong><br />
                  [Straße und Hausnummer]<br />
                  [PLZ] [Ort]<br />
                  Deutschland
                </p>

                <p style={{ color: t.muted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Kontakt</p>
                <p style={{ color: t.text, fontSize: '14px', marginBottom: '20px', fontFamily: "'Barlow', sans-serif" }}>
                  E-Mail: [PLATZHALTER — email@beispiel.de]
                </p>

                <p style={{ color: t.muted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)</p>
                <p style={{ color: t.text, fontSize: '14px', marginBottom: '20px', fontFamily: "'Barlow', sans-serif" }}>
                  [PLATZHALTER — Vor- und Nachname]<br />
                  [Adresse wie oben]
                </p>

                <p style={{ color: t.muted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Haftungsausschluss</p>
                <p style={{ color: t.text, fontSize: '13px', marginBottom: '20px', fontFamily: "'Barlow', sans-serif" }}>
                  Die Inhalte dieser App wurden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich.
                </p>

                <p style={{ color: t.muted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Urheberrecht</p>
                <p style={{ color: t.text, fontSize: '13px', marginBottom: '32px', fontFamily: "'Barlow', sans-serif" }}>
                  Die durch den Betreiber erstellten Inhalte und Werke in dieser App unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des Betreibers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── AGB Modal ────────────────────────────────────────────────── */}
        {showAGB && (
          <div onClick={() => setShowAGB(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2100, backdropFilter: 'blur(4px)' }} className="animate-fadeIn">
            <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: `1px solid ${t.border}`, boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' }} className="animate-scaleIn">
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: t.border }} />
              </div>
              {/* Header */}
              <div style={{ padding: '8px 20px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: t.text, fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em', margin: 0 }}>ALLGEMEINE GESCHÄFTSBEDINGUNGEN</h3>
                <button onClick={() => setShowAGB(false)} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: t.muted, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', lineHeight: '1.7' }}>
                {[
                  {
                    title: '§ 1 Geltungsbereich',
                    text: 'Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der mobilen Anwendung RideLog. Mit der Registrierung und Nutzung der App erklärt der Nutzer sein Einverständnis mit diesen Bedingungen.'
                  },
                  {
                    title: '§ 2 Leistungsbeschreibung',
                    text: 'RideLog ist eine Plattform für Motorradfahrer zur Aufzeichnung von Touren, zum Austausch mit anderen Fahrern sowie zur Verwaltung von Fahrzeugen und Routen. Die Nutzung der Grundfunktionen ist kostenlos.'
                  },
                  {
                    title: '§ 3 Registrierung und Nutzerkonto',
                    text: 'Zur Nutzung der App ist eine Registrierung erforderlich. Der Nutzer ist verpflichtet, wahrheitsgemäße Angaben zu machen und seine Zugangsdaten vertraulich zu behandeln. Eine Weitergabe des Kontos an Dritte ist nicht gestattet.'
                  },
                  {
                    title: '§ 4 Nutzerverhalten',
                    text: 'Der Nutzer verpflichtet sich, keine rechtswidrigen, beleidigenden oder anderweitig anstößigen Inhalte zu veröffentlichen. Das Erstellen von Fake-Profilen oder das Missbrauchen der Plattform ist untersagt. Verstöße können zur Sperrung des Kontos führen.'
                  },
                  {
                    title: '§ 5 Inhalte und Urheberrecht',
                    text: 'Vom Nutzer hochgeladene Inhalte (Fotos, Texte, Routen) bleiben dessen Eigentum. Der Nutzer räumt RideLog jedoch das Recht ein, diese Inhalte im Rahmen des Betriebs der Plattform zu nutzen und anzuzeigen.'
                  },
                  {
                    title: '§ 6 Datenschutz',
                    text: 'Die Erhebung und Verarbeitung personenbezogener Daten erfolgt gemäß der geltenden Datenschutzgrundverordnung (DSGVO). Standortdaten werden nur während aktiver Fahrten erfasst und nicht dauerhaft gespeichert. Details entnehmen Sie bitte unserer Datenschutzerklärung.'
                  },
                  {
                    title: '§ 7 Haftungsbeschränkung',
                    text: 'RideLog übernimmt keine Haftung für die Richtigkeit von Streckendaten oder Navigationshinweisen. Die Nutzung der App im Straßenverkehr erfolgt auf eigene Gefahr. Für Schäden, die durch die Nutzung der App entstehen, haftet der Betreiber nur bei grober Fahrlässigkeit oder Vorsatz.'
                  },
                  {
                    title: '§ 8 Verfügbarkeit',
                    text: 'Ein Anspruch auf ununterbrochene Verfügbarkeit der App besteht nicht. Wartungsarbeiten und technisch bedingte Ausfälle können zu vorübergehenden Einschränkungen führen.'
                  },
                  {
                    title: '§ 9 Änderungen der AGB',
                    text: 'Der Betreiber behält sich vor, diese AGB jederzeit zu ändern. Über wesentliche Änderungen werden Nutzer per App-Benachrichtigung informiert. Die fortgesetzte Nutzung der App nach Änderungen gilt als Zustimmung zu den neuen Bedingungen.'
                  },
                  {
                    title: '§ 10 Anwendbares Recht',
                    text: 'Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist der Sitz des Betreibers, soweit gesetzlich zulässig.'
                  },
                ].map(section => (
                  <div key={section.title} style={{ marginBottom: '20px' }}>
                    <p style={{ color: t.text, fontSize: '13px', fontWeight: '700', fontFamily: "'Barlow', sans-serif", marginBottom: '4px' }}>{section.title}</p>
                    <p style={{ color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif" }}>{section.text}</p>
                  </div>
                ))}
                <p style={{ color: t.muted, fontSize: '11px', marginTop: '8px', marginBottom: '32px', fontFamily: "'Barlow', sans-serif" }}>
                  Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications Panel ──────────────────────────────────────── */}
        {showNotifications && (
          <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} className="animate-fadeIn">
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: t.surface, borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: t.border }} />
              </div>
              <div style={{ padding: '4px 16px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", margin: 0 }}>BENACHRICHTIGUNGEN</h3>
                <button onClick={() => setShowNotifications(false)} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: t.muted, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <p style={{ color: t.muted, fontSize: '14px', fontFamily: "'Barlow', sans-serif" }}>Noch keine Benachrichtigungen</p>
                  </div>
                ) : notifications.map(n => {
                  const typeLabel = { like: 'hat deinen Post geliked', comment: 'hat deinen Post kommentiert', follow: 'folgt dir jetzt', message: 'hat dir eine Nachricht geschickt' }[n.type] || ''
                  return (
                    <div key={n.id} onClick={() => { setShowNotifications(false); if (n.type === 'follow') { navigateToProfile(n.sender_id) } else if (n.type === 'message') { setActivePage('messages') } else { setActivePage('feed') } }}
                      style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: n.read ? 'transparent' : `${t.border}44` }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0, overflow: 'hidden' }}>
                        {n.sender?.avatar_url ? <img src={n.sender.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : n.sender?.username?.slice(0, 2).toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: t.text, fontSize: '13px', fontFamily: "'Barlow', sans-serif", lineHeight: '1.4' }}>
                          <span style={{ fontWeight: '700' }}>@{n.sender?.username}</span> {typeLabel}
                        </p>
                        <p style={{ color: t.muted, fontSize: '11px', marginTop: '2px' }}>{(() => { const d = Date.now() - new Date(n.created_at).getTime(); const m = Math.floor(d/60000); if(m<1) return 'Gerade'; if(m<60) return `${m}m`; if(m<1440) return `${Math.floor(m/60)}h`; return `${Math.floor(m/1440)}d` })()}</p>
                      </div>
                      {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Privacy Settings Modal ────────────────────────────────────── */}
        {showPrivacy && (
          <div onClick={() => setShowPrivacy(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} className="animate-fadeIn">
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '360px', background: t.surface, borderRadius: '16px', padding: '24px', border: `1px solid ${t.border}` }} className="animate-scaleIn">
              <h3 style={{ color: t.text, fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '6px' }}>PRIVATSPHÄRE</h3>
              <p style={{ color: t.muted, fontSize: '12px', marginBottom: '20px' }}>Wer darf dein Profil und deine Touren sehen?</p>
              {[
                { id: 'public',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
                  label: 'Öffentlich', desc: 'Jeder kann dein Profil und deine Touren sehen' },
                { id: 'followers',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                  label: 'Nur Follower', desc: 'Nur Nutzer die du folgst und die dir folgen' },
                { id: 'private',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                  label: 'Privat', desc: 'Niemand außer dir kann dein Profil sehen' },
              ].map(opt => (
                <button key={opt.id} onClick={() => savePrivacyLevel(opt.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px',
                  background: privacyLevel === opt.id ? 'rgba(59,130,246,0.1)' : t.bg,
                  border: `1px solid ${privacyLevel === opt.id ? '#3b82f6' : t.border}`,
                  borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                }}>
                  <span style={{ color: privacyLevel === opt.id ? '#3b82f6' : t.muted, flexShrink: 0, marginTop: '1px', display: 'flex' }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: privacyLevel === opt.id ? '#3b82f6' : t.text, fontSize: '14px', fontWeight: '700', fontFamily: "'Barlow', sans-serif", marginBottom: '2px' }}>{opt.label}</p>
                    <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>{opt.desc}</p>
                  </div>
                  {privacyLevel === opt.id && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
              <button onClick={() => setShowPrivacy(false)} style={{ width: '100%', padding: '12px', background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600', marginTop: '4px' }}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* ── Vehicle Picker Modal ─────────────────────────────────────── */}
        {showVehiclePicker && (
          <div
            onClick={() => setShowVehiclePicker(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              zIndex: 2200, padding: 0,
            }}
            className="animate-fadeIn"
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
                width: '100%', maxWidth: '480px',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
              }}
              className="animate-scaleIn"
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', margin: 0 }}>
                    FAHRZEUG WÄHLEN
                  </h3>
                  <p style={{ color: t.muted, fontSize: '12px', margin: '3px 0 0', fontFamily: "'Barlow', sans-serif" }}>
                    Mit welchem Fahrzeug fährst du heute?
                  </p>
                </div>
                <button
                  onClick={() => setShowVehiclePicker(false)}
                  style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: 0 }}
                >×</button>
              </div>

              {/* Bike list */}
              {myBikes.map(bike => (
                <button
                  key={bike.id}
                  onClick={() => doStartRide(bike.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                    background: t.bg, border: `1px solid ${t.border}`,
                    borderRadius: '14px', padding: '13px 16px', cursor: 'pointer',
                    marginBottom: '10px', transition: 'all 0.15s', textAlign: 'left',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = 'rgba(59,130,246,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.bg }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: '60px', height: '42px', borderRadius: '8px', background: '#0f172a', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {bike.image_url
                      ? <img src={bike.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                      : (
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          {bike.vehicle_type === 'auto'
                            ? <><path d="M3 11l2-5h14l2 5"/><rect x="1" y="11" width="22" height="7" rx="1"/><circle cx="6.5" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/><path d="M1 14h22"/></>
                            : <><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M5.5 17.5L8 10.5L12 9.5L15 6.5H18L19.5 9.5L21 11.5L18.5 17.5"/><path d="M8 10.5L12 11.5L15 10.5"/></>
                          }
                        </svg>
                      )
                    }
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: t.muted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                      {bike.brand}
                    </p>
                    <p style={{ color: t.text, fontSize: '17px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', margin: '1px 0 0', lineHeight: 1.1 }}>
                      {bike.model}
                      {bike.year ? <span style={{ fontSize: '12px', fontWeight: 400, color: t.muted, marginLeft: '6px' }}>{bike.year}</span> : null}
                    </p>
                    {bike.hp ? <p style={{ color: t.accent, fontSize: '11px', fontWeight: 600, fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>{bike.hp} PS</p> : null}
                  </div>
                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Post-ride stats modal ────────────────────────────────────────── */}
        {showRideStats && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: '20px' }} className="animate-fadeIn">
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '400px' }} className="animate-scaleIn">

              {/* ── Step 1: Stats ── */}
              {rideModalStep === 'stats' && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div>
                    <h3 style={{ color: t.text, fontSize: '20px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', margin: 0 }}>TOUR ABGESCHLOSSEN</h3>
                    <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>Deine Statistiken</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { label: 'Strecke',    value: distance.toFixed(1), unit: 'km',   color: '#4ade80',
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/></svg> },
                    { label: 'Fahrzeit',   value: formatTime(rideTime), unit: '',     color: '#3b82f6',
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                    { label: 'Max. Tempo', value: `${maxSpeed}`,        unit: 'km/h', color: '#f43f5e',
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
                    { label: 'Ø Tempo',    value: `${avgSpeed}`,        unit: 'km/h', color: '#facc15',
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                  ].map(s => (
                    <div key={s.label} style={{ background: t.bg, borderRadius: '12px', padding: '14px', border: `1px solid ${t.border}` }}>
                      <div style={{ color: s.color, marginBottom: '8px', display: 'flex' }}>{s.icon}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <p style={{ color: s.color, fontSize: '24px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, margin: 0 }}>{s.value}</p>
                        {s.unit && <p style={{ color: t.muted, fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", margin: 0 }}>{s.unit}</p>}
                      </div>
                      <p style={{ color: t.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Barlow', sans-serif", marginTop: '3px', marginBottom: 0 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setShowRideStats(false); setRideModalStep('stats') }} className="btn-press" style={{ flex: 1, background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '10px', padding: '13px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>Schließen</button>
                  <button onClick={() => saveTour(false)} className="btn-press" style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, color: t.text, borderRadius: '10px', padding: '13px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>Speichern</button>
                  <button onClick={() => saveTour(true)} className="btn-press" style={{ flex: 2, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: 'white', borderRadius: '10px', padding: '13px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Teilen
                  </button>
                </div>
              </>)}

              {/* ── Step 2: Share ── */}
              {rideModalStep === 'share' && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  </div>
                  <div>
                    <h3 style={{ color: t.text, fontSize: '20px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', margin: 0 }}>TOUR TEILEN</h3>
                    <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>Schreib etwas dazu (optional)</p>
                  </div>
                </div>
                <textarea
                  value={shareCaption}
                  onChange={e => setShareCaption(e.target.value)}
                  rows={4}
                  style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '12px', color: t.text, fontSize: '14px', fontFamily: "'Barlow', sans-serif", lineHeight: '1.5', resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setShowRideStats(false); setRideModalStep('stats') }} className="btn-press" style={{ flex: 1, background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '10px', padding: '13px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>Überspringen</button>
                  <button onClick={submitSharePost} className="btn-press" style={{ flex: 2, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: 'white', borderRadius: '10px', padding: '13px', cursor: 'pointer', fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: 700 }}>Jetzt posten</button>
                </div>
              </>)}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
