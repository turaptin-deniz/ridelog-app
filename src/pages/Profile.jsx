import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import RouteDetail from '../components/RouteDetail'

// ── Vehicle types (3 categories) ──────────────────────────────────────────────
const VEHICLE_TYPES = [
  { id: 'motorrad',  label: 'Motorrad' },
  { id: 'auto',      label: 'Auto'     },
  { id: 'sonstiges', label: 'Sonstiges'},
]

// SVG icon per vehicle type (stroke-based, no emoji)
function VehicleIcon({ type, size = 32, color = 'currentColor' }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'motorrad') return (
    <svg {...s}>
      <circle cx="5.5" cy="17.5" r="2.5"/>
      <circle cx="18.5" cy="17.5" r="2.5"/>
      <path d="M5.5 17.5L8 10.5L12 9.5L15 6.5H18L19.5 9.5L21 11.5L18.5 17.5"/>
      <path d="M8 10.5L12 11.5L15 10.5"/>
    </svg>
  )
  if (type === 'auto') return (
    <svg {...s}>
      <path d="M3 11l2-5h14l2 5"/>
      <rect x="1" y="11" width="22" height="7" rx="1"/>
      <circle cx="6.5" cy="18" r="1.5"/>
      <circle cx="17.5" cy="18" r="1.5"/>
      <path d="M1 14h22"/>
    </svg>
  )
  // sonstiges — steering wheel / generic
  return (
    <svg {...s}>
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="3" x2="12" y2="9"/>
      <line x1="3" y1="12" x2="9" y2="12"/>
      <line x1="15" y1="12" x2="21" y2="12"/>
    </svg>
  )
}

// ── Brands per category ───────────────────────────────────────────────────────
const MOTO_BRANDS = [
  'Aprilia', 'Benelli', 'Beta', 'BMW', 'Brixton', 'CF Moto', 'Ducati',
  'Gas Gas', 'Harley-Davidson', 'Honda', 'Husqvarna', 'Indian', 'Jawa',
  'Kawasaki', 'KTM', 'Kove', 'Moto Guzzi', 'MV Agusta', 'Royal Enfield',
  'Sherco', 'Suzuki', 'Triumph', 'Ural', 'Yamaha', 'Zontes',
]
const CAR_BRANDS = [
  'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Bugatti',
  'Chevrolet', 'Ferrari', 'Ford', 'Honda', 'Hyundai', 'Jaguar', 'Jeep',
  'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Maserati', 'Mazda',
  'McLaren', 'Mercedes-Benz', 'MINI', 'Mitsubishi', 'Nissan', 'Opel',
  'Peugeot', 'Porsche', 'Renault', 'Rolls-Royce', 'Seat', 'Skoda',
  'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
]
const OTHER_BRANDS = [
  'Arctic Cat', 'Can-Am', 'CF Moto', 'Honda', 'Kawasaki', 'KTM',
  'Kymco', 'Polaris', 'Suzuki', 'Yamaha',
  ...CAR_BRANDS, ...MOTO_BRANDS,
].filter((b, i, a) => a.indexOf(b) === i).sort()

// Legacy alias so nothing else breaks
const BIKE_BRANDS = MOTO_BRANDS

// ── Wikipedia image fetch ────────────────────────────────────────────────────
async function fetchBikeImage(brand, model) {
  const query = `${brand} ${model} motorcycle`
  try {
    const sr = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`,
      { headers: { 'Accept': 'application/json' } }
    )
    const sd = await sr.json()
    for (const hit of sd.query?.search || []) {
      const ir = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=pageimages&format=json&origin=*&pithumbsize=700&piprop=thumbnail`
      )
      const id = await ir.json()
      const src = Object.values(id.query?.pages || {})[0]?.thumbnail?.source
      // Skip flags, logos, icons, and maps
      if (src && !/flag|logo|icon|map|coat|emblem/i.test(src)) return src
    }
  } catch { /* network fail — fine */ }
  return null
}

const LEAGUES = [
  { id: 'bronze', label: 'Bronze', icon: '🥉', color: '#cd7f32', min: 0, max: 500 },
  { id: 'silver', label: 'Silber', icon: '🥈', color: '#c0c0c0', min: 500, max: 1500 },
  { id: 'gold', label: 'Gold', icon: '🥇', color: '#ffd700', min: 1500, max: 3000 },
  { id: 'platinum', label: 'Platin', icon: '💎', color: '#e5e4e2', min: 3000, max: 6000 },
  { id: 'diamond', label: 'Diamant', icon: '💠', color: '#b9f2ff', min: 6000, max: 99999 },
]

const MOTO_BADGES = [
  { type: 'first_ride',  icon: '🏁', label: 'Erste Fahrt',   desc: 'Erste Motorrad-Tour getracked', condition: (p) => p.total_rides >= 1 },
  { type: 'rides_10',   icon: '🏍️', label: 'Regelmäßig',   desc: '10 Motorrad-Touren gefahren',   condition: (p) => p.total_rides >= 10 },
  { type: 'rides_50',   icon: '👑',  label: 'Veteran',       desc: '50 Motorrad-Touren gefahren',   condition: (p) => p.total_rides >= 50 },
  { type: 'speed_100',  icon: '⚡',  label: 'Triple Digits', desc: '100 km/h erreicht',              condition: (p) => p.max_speed >= 100 },
  { type: 'speed_150',  icon: '🔥',  label: 'Speed Demon',   desc: '150 km/h erreicht',              condition: (p) => p.max_speed >= 150 },
  { type: 'speed_200',  icon: '💨',  label: '200er Club',    desc: '200 km/h auf dem Motorrad',      condition: (p) => p.max_speed >= 200 },
]

const CAR_BADGES = [
  { type: 'car_first',    icon: '🚗', label: 'Erste Ausfahrt',  desc: 'Erste Auto-Tour getracked',        condition: (p) => p.total_rides >= 1 },
  { type: 'car_10',       icon: '🏎️', label: 'Car Enthusiast', desc: '10 Auto-Touren gefahren',           condition: (p) => p.total_rides >= 10 },
  { type: 'car_autobahn', icon: '🛣️', label: 'Autobahnkind',   desc: '200 km/h im Auto erreicht',        condition: (p) => p.max_speed >= 200 },
  { type: 'car_weekend',  icon: '🌅', label: 'Weekender',       desc: '5 Wochenend-Ausfahrten getracked', condition: (p) => p.total_rides >= 5 },
]

const GENERAL_BADGES = [
  { type: 'km_100',   icon: '🛣️', label: '100 km Club',  desc: '100 km gefahren (gesamt)',  condition: (p) => p.total_km >= 100 },
  { type: 'km_500',   icon: '🗺️', label: '500 km Club',  desc: '500 km gefahren (gesamt)',  condition: (p) => p.total_km >= 500 },
  { type: 'km_1000',  icon: '🌍', label: '1000 km Club', desc: '1000 km gefahren (gesamt)', condition: (p) => p.total_km >= 1000 },
  { type: 'km_5000',  icon: '🚀', label: '5000 km Club', desc: '5000 km gefahren (gesamt)', condition: (p) => p.total_km >= 5000 },
  { type: 'long_100', icon: '🏕️', label: 'Langstrecke',  desc: '100 km am Stück',           condition: (p) => p.longest_ride >= 100 },
  { type: 'long_300', icon: '🏔️', label: 'Ausdauer',     desc: '300 km am Stück',           condition: (p) => p.longest_ride >= 300 },
]

const ALL_BADGES = [...MOTO_BADGES, ...CAR_BADGES, ...GENERAL_BADGES]

export default function Profile({ darkMode, setDarkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [profile, setProfile] = useState(null)
  const [bikes, setBikes] = useState([])
  const [routes, setRoutes] = useState([])
  const [earnedBadges, setEarnedBadges] = useState([])
  const [userPosts, setUserPosts] = useState([])
  const [userReposts, setUserReposts] = useState([])
  const [postsSubTab, setPostsSubTab] = useState('fotos')
  const [selectedPost, setSelectedPost] = useState(null)
  const [showAddBike, setShowAddBike] = useState(false)
  const [editingBike, setEditingBike] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vehicleStats, setVehicleStats] = useState({}) // { [bike.id]: { km, rides } }

  // Fahrzeug-Detail View
  const [bikeDetailBike, setBikeDetailBike]       = useState(null)
  const [bikeDetailRoutes, setBikeDetailRoutes]   = useState([])
  const [bikeDetailLoading, setBikeDetailLoading] = useState(false)
  const [bikeDetailTab, setBikeDetailTab]         = useState('stats')
  const [activeTab, setActiveTab] = useState('posts')
  const [editing, setEditing] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', location: '' })
  const [usernameError, setUsernameError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const avatarRef = useRef()
  const bannerRef = useRef()

  // Plus button in nav no longer triggers edit — edit is the pencil icon next to username

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const { data: bikeData } = await supabase.from('motorcycles').select('*').eq('user_id', user.id)
    const { data: routeData } = await supabase.from('routes').select('*, profiles(username, avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false })
    const { data: badgeData } = await supabase.from('badges').select('*').eq('user_id', user.id)

    // Per-vehicle stats (routes with vehicle_id)
    const stats = {}
    routeData?.forEach(r => {
      if (!r.vehicle_id) return
      if (!stats[r.vehicle_id]) stats[r.vehicle_id] = { km: 0, rides: 0 }
      stats[r.vehicle_id].km += r.distance_km || 0
      stats[r.vehicle_id].rides += 1
    })
    setVehicleStats(stats)
    const { data: postData } = await supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

    // Load reposted posts
    let repostList = []
    const { data: repostRows } = await supabase.from('reposts').select('post_id').eq('user_id', user.id)
    if (repostRows?.length) {
      const ids = repostRows.map(r => r.post_id)
      const { data: rPosts } = await supabase.from('posts').select('*, profiles(username, avatar_url)').in('id', ids)
      repostList = rPosts || []
    }

    // Compute live stats from routes so historical tours are counted
    // (profiles.total_km etc. is updated on save, but old tours may predate that)
    const rts = routeData || []
    const computed = {
      total_km:     rts.reduce((s, r) => s + (r.distance_km || 0), 0),
      total_rides:  rts.length,
      max_speed:    rts.reduce((m, r) => Math.max(m, r.max_speed    || 0), 0),
      longest_ride: rts.reduce((m, r) => Math.max(m, r.distance_km  || 0), 0),
    }
    // Merge computed stats into profile (prefer computed over DB values)
    const mergedProf = prof ? { ...prof, ...computed } : prof

    setProfile(mergedProf)
    setBikes(bikeData || [])
    setRoutes(rts)
    setEarnedBadges(badgeData?.map(b => b.type) || [])
    setUserPosts(postData || [])
    setUserReposts(repostList)
    setEditData({ display_name: prof?.display_name || '', username: prof?.username || '', bio: prof?.bio || '', location: prof?.location || '' })
    setLoading(false)
  }

  const [isFollowing, setIsFollowing] = useState(false)
const [followerCount, setFollowerCount] = useState(0)
const [followingCount, setFollowingCount] = useState(0)

const checkFollow = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('follows')
    .select('id').eq('follower_id', user.id).eq('following_id', profile?.id).single()
  setIsFollowing(!!data)

  const { count: followers } = await supabase.from('follows')
    .select('id', { count: 'exact' }).eq('following_id', profile?.id)
  const { count: following } = await supabase.from('follows')
    .select('id', { count: 'exact' }).eq('follower_id', profile?.id)
  setFollowerCount(followers || 0)
  setFollowingCount(following || 0)
}

const toggleFollow = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (isFollowing) {
    await supabase.from('follows').delete()
      .eq('follower_id', user.id).eq('following_id', profile?.id)
    setIsFollowing(false)
    setFollowerCount(prev => prev - 1)
  } else {
    await supabase.from('follows').insert({
      follower_id: user.id, following_id: profile?.id
    })
    setIsFollowing(true)
    setFollowerCount(prev => prev + 1)
  }
}

  useEffect(() => { loadProfile() }, [])
  useEffect(() => { if (profile) checkFollow() }, [profile])

  // Refresh posts + reposts when a new post is created or reposted
  useEffect(() => {
    const refresh = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setUserPosts(data || [])
      // Also refresh reposts
      const { data: repostRows } = await supabase.from('reposts').select('post_id').eq('user_id', user.id)
      if (repostRows?.length) {
        const ids = repostRows.map(r => r.post_id)
        const { data: rPosts } = await supabase.from('posts').select('*, profiles(username, avatar_url)').in('id', ids)
        setUserReposts(rPosts || [])
      } else {
        setUserReposts([])
      }
    }
    window.addEventListener('ridelog:post-created', refresh)
    window.addEventListener('ridelog:repost-changed', refresh)
    return () => {
      window.removeEventListener('ridelog:post-created', refresh)
      window.removeEventListener('ridelog:repost-changed', refresh)
    }
  }, [])

  const canChangeUsername = () => {
    if (!profile?.username_changed_at) return true
    const msPerDay = 1000 * 60 * 60 * 24
    const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / msPerDay
    return daysSince >= 30
  }

  const daysUntilUsernameChange = () => {
    if (!profile?.username_changed_at) return 0
    const msPerDay = 1000 * 60 * 60 * 24
    const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / msPerDay
    return Math.ceil(30 - daysSince)
  }

  const saveProfile = async () => {
    setUsernameError('')
    const { data: { user } } = await supabase.auth.getUser()
    const updates = {
      display_name: editData.display_name,
      bio: editData.bio,
      location: editData.location,
    }
    // Nur updaten wenn Username sich geändert hat
    if (editData.username.trim() !== (profile?.username || '')) {
      if (!canChangeUsername()) {
        setUsernameError(`Gesperrt — noch ${daysUntilUsernameChange()} Tag${daysUntilUsernameChange() === 1 ? '' : 'e'} bis zur nächsten Änderung.`)
        return
      }
      if (!editData.username.trim()) {
        setUsernameError('Username darf nicht leer sein.')
        return
      }
      updates.username = editData.username.trim()
      updates.username_changed_at = new Date().toISOString()
    }
    let { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (error) {
      // Fallback: Spalte existiert noch nicht → ohne display_name speichern,
      // aber display_name im lokalen State behalten damit es sofort sichtbar ist
      if (/display_name|username_changed_at/i.test(error.message || '')) {
        const { display_name: dn, username_changed_at: _uc, ...safeUpdates } = updates
        const r = await supabase.from('profiles').update(safeUpdates).eq('id', user.id).select().single()
        if (r.data) {
          // display_name in lokalen State mergen (bleibt bis zum Reload sichtbar)
          setProfile(prev => ({ ...prev, ...r.data, display_name: dn ?? prev?.display_name }))
        }
        setEditing(false)
        return
      }
      // Anderer Fehler — nicht schließen, damit User es erneut versuchen kann
      console.error('saveProfile error:', error)
      return
    }
    if (data) setProfile(data)
    setEditing(false)
  }

  const cancelEdit = () => {
    setEditData({
      display_name: profile?.display_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      location: profile?.location || ''
    })
    setUsernameError('')
    setEditing(false)
  }

  const openBikeDetail = async (bike) => {
    setBikeDetailBike(bike)
    setBikeDetailTab('stats')
    setBikeDetailLoading(true)
    setBikeDetailRoutes([])
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('routes')
        .select('*')
        .eq('user_id', user.id)
        .eq('vehicle_id', bike.id)
        .order('created_at', { ascending: false })
      setBikeDetailRoutes(data || [])
    } catch { setBikeDetailRoutes([]) }
    setBikeDetailLoading(false)
  }

  const uploadImage = async (file, bucket, type) => {
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${type}.${ext}`
    if (type === 'avatar') setUploadingAvatar(true)
    else setUploadingBanner(true)
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (uploadError) { console.error(uploadError); return }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
    const url = urlData.publicUrl + '?t=' + Date.now()
    const field = type === 'avatar' ? 'avatar_url' : 'banner_url'
    const { data } = await supabase.from('profiles').update({ [field]: url }).eq('id', user.id).select().single()
    if (data) setProfile(data)
    if (type === 'avatar') setUploadingAvatar(false)
    else setUploadingBanner(false)
  }

  const deleteImage = async (type) => {
    const { data: { user } } = await supabase.auth.getUser()
    const bucket = type === 'avatar' ? 'avatars' : 'banners'
    const field = type === 'avatar' ? 'avatar_url' : 'banner_url'
    const extensions = ['jpg', 'jpeg', 'png', 'webp']
    for (const ext of extensions) {
      await supabase.storage.from(bucket).remove([`${user.id}/${type}.${ext}`])
    }
    const { data } = await supabase.from('profiles').update({ [field]: null }).eq('id', user.id).select().single()
    if (data) setProfile(data)
  }

  const getCurrentLeague = () => {
    const km = profile?.total_km || 0
    return LEAGUES.find(l => km >= l.min && km < l.max) || LEAGUES[0]
  }

  const getNextLeague = () => {
    const current = getCurrentLeague()
    const idx = LEAGUES.findIndex(l => l.id === current.id)
    return idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() || '??'
  const totalKm = routes.reduce((sum, r) => sum + (r.distance_km || 0), 0)
  const league = getCurrentLeague()
  const nextLeague = getNextLeague()
  const km = profile?.total_km || 0
  const progress = nextLeague ? ((km - league.min) / (nextLeague.min - league.min)) * 100 : 100

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <p style={{ color: '#3b82f6' }}>Laden...</p>
    </div>
  )

  return (
    <div style={{ flex: 1, background: t.bg, overflowY: 'auto', color: t.text }}>

      {/* Banner */}
      <div style={{ position: 'relative', height: '130px' }}>
        {profile?.banner_url
          ? <img src={profile.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${t.accent}33, ${t.accent}77)` }} />
        }
        {editing && (
          <>
            {/* Dim overlay so buttons stand out */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 2 }}>
              <button onClick={() => bannerRef.current.click()} style={{
                background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white',
                borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
                fontFamily: "'Barlow', sans-serif", fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px',
                backdropFilter: 'blur(4px)'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                {uploadingBanner ? '...' : 'Banner'}
              </button>
              {profile?.banner_url && (
                <button onClick={() => deleteImage('banner')} style={{
                  background: 'rgba(200,30,30,0.85)', border: 'none', color: 'white',
                  borderRadius: '8px', padding: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', backdropFilter: 'blur(4px)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
        <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'banners', 'banner')} />
      </div>

      {/* Avatar Row */}
      <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-40px', marginBottom: '12px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            border: `3px solid ${t.bg}`, overflow: 'hidden',
            background: 'var(--color-accent-primary)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: 'white'
          }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          {editing && (
            <>
              <button onClick={() => avatarRef.current.click()} style={{
                position: 'absolute', bottom: '0', right: '0',
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--color-accent-primary)', border: `2px solid ${t.bg}`,
                color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(59,130,246,0.4)'
              }}>
                {uploadingAvatar ? '...' : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                )}
              </button>
              {profile?.avatar_url && (
                <button onClick={() => deleteImage('avatar')} style={{
                  position: 'absolute', top: '0', right: '0',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(200,30,30,0.9)', border: `2px solid ${t.bg}`,
                  color: 'white', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </>
          )}
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'avatars', 'avatar')} />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '0 16px 12px', borderBottom: `1px solid ${t.border}` }}>

        {editing ? (
          /* ── EDIT MODE ── */
          <div style={{ marginBottom: '8px' }}>

            {/* Anzeigename (groß + fett) */}
            <input
              type="text"
              value={editData.display_name}
              onChange={e => setEditData({ ...editData, display_name: e.target.value })}
              placeholder="Anzeigename"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                fontSize: '22px', fontWeight: '800',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px',
                background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '7px 10px', marginBottom: '8px',
                color: t.text, outline: 'none', transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={e => e.target.style.borderColor = t.border}
            />

            {/* Username (dünn + kleiner) — mit 30-Tage-Sperre */}
            {canChangeUsername() ? (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.muted, fontSize: '14px', fontFamily: "'Barlow', sans-serif", pointerEvents: 'none' }}>@</span>
                  <input
                    type="text"
                    value={editData.username}
                    onChange={e => { setEditData({ ...editData, username: e.target.value }); setUsernameError('') }}
                    placeholder="username"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      fontSize: '14px', fontWeight: '400',
                      fontFamily: "'Barlow', sans-serif",
                      background: t.bg, border: `1px solid ${usernameError ? '#ef4444' : t.border}`,
                      borderRadius: '8px', padding: '7px 10px 7px 26px',
                      color: t.muted, outline: 'none', transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = usernameError ? '#ef4444' : 'var(--color-accent-primary)'}
                    onBlur={e => e.target.style.borderColor = usernameError ? '#ef4444' : t.border}
                  />
                </div>
                {usernameError ? (
                  <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontFamily: "'Barlow', sans-serif" }}>{usernameError}</p>
                ) : (
                  <p style={{ color: t.muted, fontSize: '10px', marginTop: '4px', fontFamily: "'Barlow', sans-serif", opacity: 0.7 }}>
                    Nach einer Änderung erst wieder in 30 Tagen änderbar
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px 10px', background: '#f59e0b12', border: '1px solid #f59e0b40', borderRadius: '8px' }}>
                <span style={{ color: t.muted, fontSize: '14px', fontFamily: "'Barlow', sans-serif" }}>@{profile?.username}</span>
                <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: '11px', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
                  🔒 {daysUntilUsernameChange()} Tag{daysUntilUsernameChange() === 1 ? '' : 'e'} gesperrt
                </span>
              </div>
            )}

            {/* Location im Edit-Modus */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <input
                type="text"
                value={editData.location}
                onChange={e => setEditData({ ...editData, location: e.target.value })}
                placeholder="z.B. München, Bayern"
                style={{
                  flex: 1, minWidth: 0, fontSize: '13px',
                  fontFamily: "'Barlow', sans-serif",
                  background: t.bg, border: `1px solid ${t.border}`,
                  borderRadius: '8px', padding: '6px 10px',
                  color: t.text, outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-accent-primary)'}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>

            {/* Bio im Edit-Modus */}
            <textarea
              value={editData.bio}
              onChange={e => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Erzähl was über dich..."
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                fontSize: '14px', lineHeight: '1.6',
                fontFamily: "'Barlow', sans-serif",
                background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '8px 10px', marginBottom: '10px',
                color: t.text, outline: 'none', resize: 'none',
                transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={e => e.target.style.borderColor = t.border}
            />

            {/* Speichern / Abbrechen */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={saveProfile}
                style={{
                  background: 'var(--color-accent-primary)', border: 'none',
                  padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
                  color: 'white', fontSize: '13px', fontWeight: 700,
                  fontFamily: "'Barlow', sans-serif",
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 10px rgba(59,130,246,0.3)', transition: 'all 0.15s'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Speichern
              </button>
              <button
                onClick={cancelEdit}
                style={{
                  background: 'transparent', border: `1px solid ${t.border}`,
                  padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
                  color: t.muted, fontSize: '13px', fontWeight: 600,
                  fontFamily: "'Barlow', sans-serif",
                  display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          /* ── DISPLAY MODE ── */
          <>
            {/* Name-Zeile: Anzeigename + Liga + Edit-Button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                {/* Anzeigename — groß & fett */}
                <h2 style={{ fontSize: '22px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', lineHeight: 1.1, marginBottom: '4px' }}>
                  {profile?.display_name || profile?.username}
                </h2>
                {/* Username — dünn & kleiner */}
                <p style={{ fontSize: '14px', fontWeight: '400', color: t.muted, fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                  @{profile?.username}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '4px' }}>
                {/* Liga Badge */}
                <div style={{
                  background: `${league.color}1a`, border: `1px solid ${league.color}55`,
                  borderRadius: '6px', padding: '3px 10px', display: 'flex', alignItems: 'center',
                }}>
                  <span style={{ color: league.color, fontSize: '11px', fontWeight: '700', fontFamily: "'Barlow', sans-serif", letterSpacing: '0.04em' }}>
                    {league.label}
                  </span>
                </div>
                {/* Edit Button */}
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    background: 'transparent', border: 'none', padding: '4px', borderRadius: '4px',
                    cursor: 'pointer', color: t.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = t.muted}
                  title="Profil bearbeiten"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Location */}
            {profile?.location && (
              <p style={{ color: t.muted, fontSize: '13px', marginBottom: '6px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {profile.location}
              </p>
            )}

            {/* Bio */}
            {profile?.bio && <p style={{ fontSize: '14px', lineHeight: '1.6', marginTop: profile?.location ? 0 : '8px' }}>{profile.bio}</p>}
          </>
        )}
      </div>

      {/* Stats als Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
        {[
          { label: 'Touren', value: routes.length },
          { label: 'km', value: Math.round(totalKm) },
          { label: 'Follower', value: followerCount },
          { label: 'Folge ich', value: followingCount },
        ].map(stat => (
          <div key={stat.label} style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '10px',
            padding: '10px 6px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-accent-primary)', marginBottom: '2px', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
              {stat.value}
            </p>
            <p style={{ fontSize: '9px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Barlow', sans-serif" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, overflowX: 'auto' }}>
        {[
          { id: 'posts', label: 'Posts' },
          { id: 'touren', label: 'Touren' },
          { id: 'garage', label: 'Garage' },
          { id: 'abzeichen', label: 'Abzeichen' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '12px 8px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === tab.id ? '#3b82f6' : t.muted,
            cursor: 'pointer', fontSize: '12px', fontWeight: '600',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
            whiteSpace: 'nowrap'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">

        {/* Posts — with sub-tabs: Fotos / Videos / Reposts */}
        {activeTab === 'posts' && (
          <div>
            {/* Sub-tab bar — icons only */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}` }}>
              {[
                {
                  id: 'fotos',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )
                },
                {
                  id: 'videos',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                  )
                },
                {
                  id: 'text',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6"/>
                      <line x1="4" y1="10" x2="20" y2="10"/>
                      <line x1="4" y1="14" x2="14" y2="14"/>
                    </svg>
                  )
                },
                {
                  id: 'reposts',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <polyline points="7 23 3 19 7 15"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                  )
                },
              ].map(sub => (
                <button key={sub.id} onClick={() => setPostsSubTab(sub.id)} style={{
                  flex: 1, padding: '12px 6px', background: 'transparent', border: 'none',
                  borderBottom: postsSubTab === sub.id ? '2px solid #3b82f6' : '2px solid transparent',
                  color: postsSubTab === sub.id ? '#3b82f6' : t.muted,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s'
                }}>
                  {sub.icon}
                </button>
              ))}
            </div>

            {/* Fotos sub-tab: only posts with at least one image */}
            {postsSubTab === 'fotos' && (() => {
              const fotoPosts = userPosts.filter(p =>
                p.photos?.some(url => !/\.(mp4|mov|webm)/i.test(url))
              )
              return fotoPosts.length === 0 ? (
                <EmptyPostState icon="📸" text="Noch keine Fotos" sub="Teile deine erste Tour über den Plus-Button!" t={t} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px' }}>
                  {fotoPosts.map(post => (
                    <PostThumb key={post.id} post={post} t={t} onClick={() => setSelectedPost(post)} />
                  ))}
                </div>
              )
            })()}

            {/* Videos sub-tab */}
            {postsSubTab === 'videos' && (() => {
              const videoPosts = userPosts.filter(p =>
                p.photos?.some(url => /\.(mp4|mov|webm)/i.test(url))
              )
              return videoPosts.length === 0 ? (
                <EmptyPostState icon="🎬" text="Noch keine Videos" sub="Lade dein erstes Video über den Plus-Button hoch!" t={t} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px' }}>
                  {videoPosts.map(post => (
                    <PostThumb key={post.id} post={post} t={t} onClick={() => setSelectedPost(post)} />
                  ))}
                </div>
              )
            })()}

            {/* Text sub-tab: posts with no media at all */}
            {postsSubTab === 'text' && (() => {
              const textPosts = userPosts.filter(p => !p.photos?.length)
              return textPosts.length === 0 ? (
                <EmptyPostState icon="✍️" text="Noch keine Textbeiträge" sub="Erstelle deinen ersten reinen Textpost!" t={t} />
              ) : (
                <div>
                  {textPosts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      style={{
                        padding: '16px', borderBottom: `1px solid ${t.border}`,
                        cursor: 'pointer', background: t.bg, transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = t.surface}
                      onMouseLeave={e => e.currentTarget.style.background = t.bg}
                    >
                      <p style={{
                        fontSize: '15px', lineHeight: 1.6, color: t.text,
                        fontFamily: "'Barlow', sans-serif",
                        display: '-webkit-box', WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden'
                      }}>
                        {post.content}
                      </p>
                      <p style={{ fontSize: '11px', color: t.muted, marginTop: '8px', fontFamily: "'Barlow', sans-serif" }}>
                        {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Reposts sub-tab */}
            {postsSubTab === 'reposts' && (
              userReposts.length === 0 ? (
                <EmptyPostState icon="🔁" text="Noch keine Reposts" sub="Reposte Beiträge anderer Fahrer im Feed!" t={t} />
              ) : (
                <div>
                  {userReposts.map(post => (
                    <RepostCard key={post.id} post={post} t={t} onClick={() => setSelectedPost(post)} />
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Touren */}
        {activeTab === 'touren' && (
          <div style={{ padding: '16px' }}>
            {routes.length === 0 ? (
              <p style={{ color: t.muted, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Noch keine Touren</p>
            ) : (
              routes.map(route => {
                const isMeetup = typeof route.title === 'string' && route.title.startsWith('[MEETUP]')
                const displayTitle = isMeetup ? route.title.replace(/^\[MEETUP\]\s*/, '') : route.title
                return (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRoute(route)}
                    style={{
                      background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: '10px', padding: '14px', marginBottom: '10px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer', transition: 'all 0.15s'
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <p style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{displayTitle}</p>
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
                      <p style={{ color: t.muted, fontSize: '12px', margin: 0 }}>
                        {route.region || (isMeetup ? `${(route.waypoints || []).length} ${(route.waypoints || []).length === 1 ? 'Punkt' : 'Punkte'}` : 'Keine Region')}
                        {!isMeetup && route.difficulty ? ` · ${route.difficulty}` : ''}
                      </p>
                    </div>
                    {!isMeetup && route.distance_km != null && (
                      <p style={{ fontSize: '15px', fontWeight: '700', color: '#3b82f6', margin: 0, marginLeft: '12px' }}>{route.distance_km} km</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Garage */}
        {activeTab === 'garage' && (
          <div style={{ padding: '16px' }}>
            {/* Add bike button */}
            <button
              onClick={() => setShowAddBike(true)}
              style={{
                width: '100%', marginBottom: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', background: 'var(--color-accent-primary)',
                border: 'none', borderRadius: '12px', cursor: 'pointer',
                color: 'white', fontSize: '14px', fontWeight: 700,
                fontFamily: "'Barlow', sans-serif",
                boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-accent-primary)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Fahrzeug hinzufügen
            </button>

            {bikes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '48px', margin: '0 auto 12px', display: 'block', lineHeight: 1 }}>🚗🏍️</div>
                <p style={{ color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif" }}>Noch kein Fahrzeug eingetragen</p>
                <p style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif", marginTop: '4px' }}>Motorräder, Autos, Quads & mehr</p>
              </div>
            ) : (
              bikes.map(bike => (
                <BikeCard
                  key={bike.id} bike={bike} t={t}
                  stats={vehicleStats[bike.id] || null}
                  onEdit={() => setEditingBike(bike)}
                  onDetail={() => openBikeDetail(bike)}
                />
              ))
            )}

            {showAddBike && (
              <AddVehicleModal
                t={t}
                onClose={() => setShowAddBike(false)}
                onSaved={() => { setShowAddBike(false); loadProfile() }}
              />
            )}

            {editingBike && (
              <EditBikeModal
                t={t}
                bike={editingBike}
                onClose={() => setEditingBike(null)}
                onSaved={() => { setEditingBike(null); loadProfile() }}
              />
            )}
          </div>
        )}

        {/* Abzeichen */}
        {activeTab === 'abzeichen' && (
          <div style={{ padding: '16px' }}>

            {/* Liga Progress */}
            <div style={{
              background: `linear-gradient(135deg, ${league.color}15, ${league.color}30)`,
              border: `1px solid ${league.color}44`,
              borderRadius: '12px', padding: '16px', marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '36px' }}>{league.icon}</span>
                <div>
                  <p style={{ color: league.color, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px' }}>
                    {league.label.toUpperCase()}
                  </p>
                  <p style={{ color: t.muted, fontSize: '12px' }}>{Math.round(km)} km gefahren</p>
                </div>
              </div>
              {nextLeague && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: t.muted, fontSize: '11px' }}>{league.label}</span>
                    <span style={{ color: t.muted, fontSize: '11px' }}>{nextLeague.label} {nextLeague.icon} ({nextLeague.min} km)</span>
                  </div>
                  <div style={{ background: t.border, borderRadius: '50px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '50px',
                      background: `linear-gradient(90deg, ${league.color}, ${nextLeague.color})`,
                      width: `${Math.min(progress, 100)}%`,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <p style={{ color: t.muted, fontSize: '11px', marginTop: '6px' }}>
                    Noch {Math.round(nextLeague.min - km)} km bis {nextLeague.label}
                  </p>
                </>
              )}
            </div>

            {/* Liga Übersicht */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              {LEAGUES.map(l => (
                <div key={l.id} style={{ textAlign: 'center', opacity: l.id === league.id ? 1 : 0.35 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%', margin: '0 auto 4px',
                    border: l.id === league.id ? `2px solid ${l.color}` : `2px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                  }}>{l.icon}</div>
                  <p style={{ fontSize: '9px', color: l.id === league.id ? l.color : t.muted, fontWeight: '700', fontFamily: "'Barlow', sans-serif" }}>
                    {l.label.slice(0,3).toUpperCase()}
                  </p>
                </div>
              ))}
            </div>

            {/* Abzeichen — three sections */}
            <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: "'Barlow', sans-serif" }}>
              ABZEICHEN ({earnedBadges.length}/{ALL_BADGES.length})
            </p>

            {[
              { label: '🏍️ Motorrad', badges: MOTO_BADGES },
              { label: '🚗 Auto', badges: CAR_BADGES },
              { label: '🌍 Allgemein', badges: GENERAL_BADGES },
            ].map(section => (
              <div key={section.label} style={{ marginBottom: '20px' }}>
                <p style={{ color: t.muted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: "'Barlow', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {section.label}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {section.badges.map(badge => {
                    const earned = earnedBadges.includes(badge.type)
                    const unlocked = badge.condition(profile || {})
                    return (
                      <div key={badge.type} style={{
                        background: earned ? '#3b82f622' : t.surface,
                        border: `1px solid ${earned ? '#3b82f6' : t.border}`,
                        borderRadius: '10px', padding: '12px', textAlign: 'center',
                        opacity: unlocked || earned ? 1 : 0.4,
                        transition: 'all 0.2s'
                      }}>
                        <p style={{ fontSize: '26px', marginBottom: '6px', filter: !unlocked && !earned ? 'grayscale(1)' : 'none' }}>
                          {badge.icon}
                        </p>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: earned ? '#3b82f6' : t.text, fontFamily: "'Barlow', sans-serif", marginBottom: '2px' }}>
                          {badge.label}
                        </p>
                        <p style={{ fontSize: '10px', color: t.muted, lineHeight: '1.3' }}>{badge.desc}</p>
                        {unlocked && !earned && (
                          <div style={{ marginTop: '6px', background: '#3b82f6', borderRadius: '4px', padding: '3px 6px', fontSize: '9px', color: 'white', fontWeight: '700' }}>
                            VERDIENT!
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Sicherheitshinweis */}
            <div style={{
              background: '#f9731615', border: '1px solid #f9731644',
              borderRadius: '10px', padding: '12px'
            }}>
              <p style={{ color: '#f97316', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>⚠️ Sicherheitshinweis</p>
              <p style={{ color: t.muted, fontSize: '11px', lineHeight: '1.5' }}>
                Geschwindigkeits-Abzeichen sollen nur auf erlaubten Strecken erreicht werden. Fahre immer sicher und verantwortungsbewusst.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Post detail carousel modal */}
      {selectedPost && (
        <PostDetailModal post={selectedPost} profile={profile} t={t} onClose={() => setSelectedPost(null)} />
      )}

      {/* Route / Meetup detail modal */}
      {selectedRoute && (
        <RouteDetail row={selectedRoute} currentUser={currentUser} t={t} onClose={() => setSelectedRoute(null)} />
      )}

      {/* Fahrzeug-Detail View */}
      {bikeDetailBike && (
        <BikeDetailView
          bike={bikeDetailBike}
          routes={bikeDetailRoutes}
          loading={bikeDetailLoading}
          tab={bikeDetailTab}
          onTabChange={setBikeDetailTab}
          onClose={() => setBikeDetailBike(null)}
          onSelectRoute={(route) => { setBikeDetailBike(null); setSelectedRoute(route) }}
          t={t}
        />
      )}

    </div>
  )
}

// ── EmptyPostState ───────────────────────────────────────────────────────────
function EmptyPostState({ icon, text, sub, t }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ color: t.muted, fontSize: '14px', marginBottom: '4px', fontFamily: "'Barlow', sans-serif" }}>{text}</p>
      {sub && <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>{sub}</p>}
    </div>
  )
}

// ── PostThumb (grid cell) ────────────────────────────────────────────────────
function PostThumb({ post, t, onClick }) {
  const firstPhoto = post.photos?.[0]
  const isVid = firstPhoto && /\.(mp4|mov|webm)/i.test(firstPhoto)
  const isMulti = (post.photos?.length || 0) > 1
  return (
    <div onClick={onClick} style={{ aspectRatio: '1', overflow: 'hidden', cursor: 'pointer', background: t.surface, position: 'relative' }}>
      {firstPhoto ? (
        isVid
          ? <video src={firstPhoto} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <img src={firstPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', boxSizing: 'border-box', background: t.surface }}>
          <p style={{ fontSize: '10px', color: t.text, lineHeight: 1.4, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
            {post.content}
          </p>
        </div>
      )}
      {isMulti && (
        <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}>
            <rect x="8" y="2" width="13" height="13" rx="2"/><path d="M3 8H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"/>
          </svg>
        </div>
      )}
      {isVid && !isMulti && (
        <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px 4px', display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      )}
    </div>
  )
}

// ── RepostCard (Reposts sub-tab) ─────────────────────────────────────────────
function RepostCard({ post, t, onClick }) {
  const firstPhoto = post.photos?.[0]
  const isVid = firstPhoto && /\.(mp4|mov|webm)/i.test(firstPhoto)
  const isMulti = (post.photos?.length || 0) > 1

  return (
    <div
      onClick={onClick}
      style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', background: t.bg, transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = t.surface}
      onMouseLeave={e => e.currentTarget.style.background = t.bg}
    >
      {/* Repost indicator badge */}
      <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
          <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
        </svg>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80', fontFamily: "'Barlow', sans-serif", letterSpacing: '0.02em' }}>
          Du hast repostet
        </span>
      </div>

      {/* Original post author */}
      <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', overflow: 'hidden', flexShrink: 0 }}>
          {post.profiles?.avatar_url
            ? <img src={post.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : post.profiles?.username?.slice(0, 2).toUpperCase() || '??'}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>
            @{post.profiles?.username || 'unbekannt'}
          </p>
        </div>
        {isMulti && (
          <span style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '50px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#3b82f6', fontFamily: "'Barlow', sans-serif" }}>
            {post.photos.length} Slides
          </span>
        )}
      </div>

      {/* Media preview */}
      {firstPhoto && (
        <div style={{ margin: '0 16px', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px', background: '#000', position: 'relative' }}>
          {isVid
            ? <video src={firstPhoto} muted playsInline style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} />
            : <img src={firstPhoto} alt="" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} />
          }
          {isVid && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.55)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      {post.content && (
        <div style={{ padding: '0 16px 12px' }}>
          <p style={{ fontSize: '13px', color: t.text, lineHeight: 1.5, fontFamily: "'Barlow', sans-serif" }}>
            <span style={{ fontWeight: 700, color: '#3b82f6', marginRight: '6px' }}>@{post.profiles?.username}</span>
            {post.content}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Post Detail Modal ────────────────────────────────────────────────────────
function PostDetailModal({ post, profile, t, onClose }) {
  const [slideIdx, setSlideIdx] = useState(0)
  const photos = post.photos || []
  const isVid = url => url && /\.(mp4|mov|webm)/i.test(url)

  const formatDate = (str) => new Date(str).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }} className="animate-fadeIn">
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: t.surface, borderRadius: '16px', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} className="animate-scaleIn">

        {/* Header */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#3b82f6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : profile?.username?.slice(0, 2).toUpperCase() || '??'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>@{profile?.username}</p>
            <p style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif" }}>{formatDate(post.created_at)}</p>
          </div>
          {photos.length > 1 && (
            <span style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
              {slideIdx + 1} / {photos.length}
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1, marginLeft: '4px' }}>×</button>
        </div>

        {/* Carousel */}
        {photos.length > 0 && (
          <div style={{ position: 'relative', background: '#000', flexShrink: 0 }}>
            {isVid(photos[slideIdx])
              ? <video src={photos[slideIdx]} controls style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
              : <img src={photos[slideIdx]} alt="" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
            }
            {/* Arrows */}
            {photos.length > 1 && slideIdx > 0 && (
              <button onClick={() => setSlideIdx(i => i - 1)} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {photos.length > 1 && slideIdx < photos.length - 1 && (
              <button onClick={() => setSlideIdx(i => i + 1)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {/* Dots */}
            {photos.length > 1 && (
              <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                {photos.map((_, i) => (
                  <div key={i} onClick={() => setSlideIdx(i)} style={{ height: '6px', width: i === slideIdx ? '18px' : '6px', borderRadius: '3px', background: i === slideIdx ? 'white' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s ease', cursor: 'pointer' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Slide strip (thumbnails) */}
        {photos.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', overflowX: 'auto', background: t.bg, flexShrink: 0 }}>
            {photos.map((url, i) => (
              <div key={i} onClick={() => setSlideIdx(i)} style={{ flexShrink: 0, width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: i === slideIdx ? '2px solid #3b82f6' : '2px solid transparent', boxSizing: 'border-box', transition: 'border 0.15s' }}>
                {isVid(url)
                  ? <video src={url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                }
              </div>
            ))}
          </div>
        )}

        {/* Text-only post */}
        {photos.length === 0 && (
          <div style={{ padding: '32px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
            <p style={{ fontSize: '18px', lineHeight: 1.6, color: t.text, fontFamily: "'Barlow', sans-serif", textAlign: 'center' }}>{post.content}</p>
          </div>
        )}

        {/* Caption */}
        {post.content && photos.length > 0 && (
          <div style={{ padding: '12px 16px', overflowY: 'auto' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: t.text, fontFamily: "'Barlow', sans-serif" }}>
              <span style={{ fontWeight: 700, color: '#3b82f6', marginRight: '6px' }}>@{profile?.username}</span>
              {post.content}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BikeCard ─────────────────────────────────────────────────────────────────
function BikeCard({ bike, t, onEdit, onDetail, stats }) {
  const [slideIdx, setSlideIdx] = useState(0)

  // User-uploaded photos take priority; fall back to Wikipedia image
  const photos = bike.user_photos?.length
    ? bike.user_photos
    : bike.image_url ? [bike.image_url] : []

  const isVid = url => url && /\.(mp4|mov|webm)/i.test(url)

  const specs = [
    { label: 'CC', value: bike.cc },
    { label: 'NM', value: bike.torque },
    { label: 'KG', value: bike.weight },
  ].filter(s => s.value)

  return (
    <div
      onClick={onDetail}
      style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px', border: `1px solid ${t.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)' }}
    >

      {/* Image header — carousel if multiple photos */}
      <div style={{ height: '200px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>

        {/* Current slide */}
        {photos.length > 0 && (
          isVid(photos[slideIdx])
            ? <video src={photos[slideIdx]} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={photos[slideIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
        )}

        {/* Dark gradient for text readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%)' }} />

        {/* Prev / Next arrows */}
        {photos.length > 1 && slideIdx > 0 && (
          <button onClick={e => { e.stopPropagation(); setSlideIdx(i => i - 1) }} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        {photos.length > 1 && slideIdx < photos.length - 1 && (
          <button onClick={e => { e.stopPropagation(); setSlideIdx(i => i + 1) }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}

        {/* Dots */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: '44px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
            {photos.map((_, i) => (
              <div key={i} onClick={() => setSlideIdx(i)} style={{ height: '5px', width: i === slideIdx ? '16px' : '5px', borderRadius: '3px', background: i === slideIdx ? 'white' : 'rgba(255,255,255,0.4)', transition: 'width 0.2s ease', cursor: 'pointer' }} />
            ))}
          </div>
        )}

        {/* Brand + model bottom-left */}
        <div style={{ position: 'absolute', bottom: '14px', left: '16px', right: bike.hp ? '70px' : '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <VehicleIcon type={bike.vehicle_type || 'motorrad'} size={13} color="var(--color-accent-primary)" />
            <p style={{ color: 'var(--color-accent-primary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              {bike.brand}
            </p>
          </div>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', lineHeight: 1 }}>
            {bike.model}
            {bike.year && <span style={{ fontSize: '15px', opacity: 0.65, marginLeft: '8px', fontWeight: 500 }}>{bike.year}</span>}
          </p>
        </div>

        {/* PS badge top-right */}
        {bike.hp && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(59,130,246,0.85)', borderRadius: '10px', padding: '8px 12px', textAlign: 'center', backdropFilter: 'blur(6px)', border: '1px solid rgba(59,130,246,0.4)' }}>
            <p style={{ color: 'white', fontSize: '22px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{bike.hp}</p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', marginTop: '1px' }}>PS</p>
          </div>
        )}

        {/* Edit button top-left */}
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', backdropFilter: 'blur(4px)', fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Bearbeiten
        </button>

        {/* Own photo badge */}
        {bike.user_photos?.length > 0 && (
          <div style={{ position: 'absolute', bottom: bike.hp ? '50px' : '14px', right: '12px', background: 'rgba(16,185,129,0.85)', borderRadius: '6px', padding: '3px 8px', fontSize: '10px', fontWeight: 700, color: 'white', fontFamily: "'Barlow', sans-serif", backdropFilter: 'blur(4px)' }}>
            {bike.user_photos.length} {bike.user_photos.length === 1 ? 'Foto' : 'Fotos'}
          </div>
        )}
      </div>

      {/* Specs row */}
      <div style={{ padding: '12px 14px', background: t.surface }}>
        {specs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${specs.length}, 1fr)`, gap: '8px', marginBottom: bike.odometer ? '10px' : 0 }}>
            {specs.map(spec => (
              <div key={spec.label} style={{ background: t.bg, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', border: `1px solid ${t.border}` }}>
                <p style={{ color: t.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px', fontFamily: "'Barlow', sans-serif" }}>{spec.label}</p>
                <p style={{ color: t.text, fontSize: '17px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{spec.value}</p>
              </div>
            ))}
          </div>
        )}
        {bike.odometer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px', background: t.bg, borderRadius: '8px', border: `1px solid ${t.border}`, marginBottom: stats ? '8px' : 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="17" r="2"/><circle cx="18" cy="17" r="2"/>
            </svg>
            <span style={{ color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
              {bike.odometer.toLocaleString('de-DE')} km
            </span>
          </div>
        )}

        {/* Per-vehicle ride stats */}
        {stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '8px', marginTop: specs.length === 0 && !bike.odometer ? 0 : '0',
          }}>
            <div style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '10px', padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
              <div>
                <p style={{ color: 'var(--color-accent-primary)', fontSize: '18px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, margin: 0 }}>
                  {stats.rides}
                </p>
                <p style={{ color: t.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>
                  Touren
                </p>
              </div>
            </div>
            <div style={{
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: '10px', padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <div>
                <p style={{ color: '#4ade80', fontSize: '18px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, margin: 0 }}>
                  {Math.round(stats.km)}
                </p>
                <p style={{ color: t.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>
                  km gefahren
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── EditBikeModal ─────────────────────────────────────────────────────────────
function EditBikeModal({ t, bike, onClose, onSaved }) {
  const CURRENT_YEAR = new Date().getFullYear()
  const [form, setForm] = useState({
    brand: bike.brand || '',
    model: bike.model || '',
    year: String(bike.year || ''),
    hp: String(bike.hp || ''),
    cc: String(bike.cc || ''),
    torque: String(bike.torque || ''),
    weight: String(bike.weight || ''),
    odometer: String(bike.odometer || ''),
  })

  // photos: array of { url: string, file: File|null }
  // url = existing public URL or blob preview for newly added files
  const [photos, setPhotos] = useState(
    (bike.user_photos || []).map(url => ({ url, file: null }))
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInputRef = useRef()
  const pendingSlotRef = useRef(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const openPicker = (slotIdx) => {
    pendingSlotRef.current = slotIdx
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    const url = URL.createObjectURL(file)
    const slot = pendingSlotRef.current
    setPhotos(prev => {
      const next = [...prev]
      if (slot !== null && slot < next.length) {
        next[slot] = { url, file }          // replace existing slot
      } else {
        next.push({ url, file })            // add new
      }
      return next
    })
  }

  const removePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    setError('')
    if (!form.brand || !form.model.trim()) { setError('Marke und Modell sind Pflichtfelder.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Upload new files, keep existing URLs
      const uploadedUrls = await Promise.all(photos.map(async (p) => {
        if (!p.file) return p.url   // already a remote URL
        const ext = p.file.name.split('.').pop()
        const path = `${user.id}/${bike.id}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`
        const { error: upErr } = await supabase.storage.from('post-images').upload(path, p.file, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path)
        return urlData.publicUrl
      }))

      const base = {
        brand: form.brand,
        model: form.model.trim(),
        year: form.year ? parseInt(form.year) : null,
        hp: form.hp ? parseFloat(form.hp) : null,
        cc: form.cc ? parseInt(form.cc) : null,
        torque: form.torque ? parseInt(form.torque) : null,
        weight: form.weight ? parseInt(form.weight) : null,
        odometer: form.odometer ? parseInt(form.odometer) : null,
        user_photos: uploadedUrls,
      }

      let { error: updErr } = await supabase.from('motorcycles').update(base).eq('id', bike.id)
      if (updErr && /user_photos|column/i.test(updErr.message || '')) {
        // Column missing → retry without user_photos
        const { user_photos: _, ...baseWithout } = base
        const r = await supabase.from('motorcycles').update(baseWithout).eq('id', bike.id)
        if (r.error) throw r.error
      } else if (updErr) throw updErr

      onSaved()
    } catch (e) {
      setError(e.message || 'Fehler beim Speichern.')
      setSaving(false)
    }
  }

  const deleteBike = async () => {
    setDeleting(true)
    await supabase.from('motorcycles').delete().eq('id', bike.id)
    onSaved()
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '10px', padding: '11px 14px',
    color: t.text, fontSize: '15px',
    fontFamily: "'Barlow', sans-serif",
    outline: 'none', transition: 'border-color 0.15s'
  }
  const labelStyle = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    color: t.muted, marginBottom: '5px', fontFamily: "'Barlow', sans-serif"
  }
  const focusOn = e => e.target.style.borderColor = '#3b82f6'
  const focusOff = e => e.target.style.borderColor = t.border

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} className="animate-fadeIn">
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: t.surface, borderRadius: '20px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-scaleIn">

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <VehicleIcon type={bike.vehicle_type || 'motorrad'} size={20} color="var(--color-accent-primary)" />
            <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', margin: 0 }}>Fahrzeug bearbeiten</h3>
          </div>
            <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif", margin: '2px 0 0' }}>{bike.brand} {bike.model}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '24px', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── Photo slots (up to 3) ── */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Eigene Fotos (max. 3)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[0, 1, 2].map(slot => {
                const photo = photos[slot]
                return (
                  <div key={slot} style={{ aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', position: 'relative', background: t.bg, border: `1.5px dashed ${photo ? 'transparent' : t.border}`, cursor: photo ? 'default' : 'pointer' }}
                    onClick={() => !photo && openPicker(slot)}
                  >
                    {photo ? (
                      <>
                        <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                        {/* Replace button */}
                        <button onClick={() => openPicker(slot)} style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {/* Remove button */}
                        <button onClick={() => removePhoto(slot)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(220,38,38,0.85)', border: 'none', color: 'white', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                        {/* Slot number */}
                        <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.55)', borderRadius: '4px', padding: '2px 5px', fontSize: '9px', fontWeight: 700, color: 'white', fontFamily: "'Barlow', sans-serif" }}>{slot + 1}</div>
                      </>
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: 0.5 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span style={{ fontSize: '10px', color: t.muted, fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>Foto {slot + 1}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: '10px', color: t.muted, marginTop: '6px', fontFamily: "'Barlow', sans-serif" }}>
              Tippe auf ein leeres Feld oder das Stift-Symbol zum Ersetzen
            </p>
          </div>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '14px', fontFamily: "'Barlow', sans-serif" }}>
              {error}
            </div>
          )}

          {/* Brand (read-only display — brand shouldn't change for an existing entry) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Marke</label>
            <input value={form.brand} onChange={e => set('brand', e.target.value)} style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>

          {/* Model */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Modell *</label>
            <input value={form.model} onChange={e => set('model', e.target.value)} style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>

          {/* Year + HP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Baujahr</label>
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)} min="1900" max={CURRENT_YEAR + 1} style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>PS (Leistung)</label>
              <input type="number" value={form.hp} onChange={e => set('hp', e.target.value)} min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {/* CC + NM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Hubraum (CC)</label>
              <input type="number" value={form.cc} onChange={e => set('cc', e.target.value)} min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Drehmoment (NM)</label>
              <input type="number" value={form.torque} onChange={e => set('torque', e.target.value)} min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {/* Weight + Odometer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Gewicht (KG)</label>
              <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Kilometerstand</label>
              <input type="number" value={form.odometer} onChange={e => set('odometer', e.target.value)} min="0" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {/* Save */}
          <button onClick={save} disabled={saving} style={{ width: '100%', padding: '14px', background: saving ? t.muted : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 15px rgba(59,130,246,0.3)', transition: 'all 0.15s', marginBottom: '10px' }}>
            {saving ? 'Wird gespeichert…' : 'Änderungen speichern'}
          </button>

          {/* Delete */}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '12px', background: 'transparent', border: `1px solid rgba(239,68,68,0.35)`, color: '#ef4444', borderRadius: '12px', fontSize: '13px', fontWeight: 600, fontFamily: "'Barlow', sans-serif", cursor: 'pointer', marginBottom: '8px' }}>
              Fahrzeug löschen
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '12px', fontSize: '13px', fontWeight: 600, fontFamily: "'Barlow', sans-serif", cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button onClick={deleteBike} disabled={deleting} style={{ flex: 1, padding: '12px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '12px', fontSize: '13px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Löschen…' : 'Ja, löschen'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── BikeDetailView ────────────────────────────────────────────────────────────
function BikeDetailView({ bike, routes, loading, tab, onTabChange, onClose, onSelectRoute, t }) {
  // Stats berechnen
  const rideRoutes = routes.filter(r => r.distance_km != null)
  const totalKm    = rideRoutes.reduce((s, r) => s + (r.distance_km || 0), 0)
  const maxSpd     = rideRoutes.reduce((m, r) => Math.max(m, r.max_speed   || 0), 0)
  const avgSpds    = rideRoutes.filter(r => (r.avg_speed || 0) > 0)
  const avgSpd     = avgSpds.length
    ? Math.round(avgSpds.reduce((s, r) => s + r.avg_speed, 0) / avgSpds.length)
    : 0
  const longest    = rideRoutes.reduce((m, r) => Math.max(m, r.distance_km || 0), 0)
  const totalSecs  = rideRoutes.reduce((s, r) => s + (r.duration_secs || 0), 0)

  const fmt = (secs) => {
    if (!secs) return '–'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return m > 0 ? `${m}m` : '< 1m'
  }

  const statItems = [
    { label: 'Kilometer',    value: Math.round(totalKm),           unit: 'km',   icon: '🛣️', color: '#4ade80' },
    { label: 'Touren',       value: rideRoutes.length,             unit: '',     icon: '🏁', color: '#3b82f6' },
    { label: 'Max. Tempo',   value: maxSpd,                        unit: 'km/h', icon: '⚡', color: '#f43f5e' },
    { label: 'Ø Tempo',      value: avgSpd,                        unit: 'km/h', icon: '📊', color: '#facc15' },
    { label: 'Längste Tour', value: longest.toFixed(1),            unit: 'km',   icon: '🗺️', color: '#a78bfa' },
    { label: 'Fahrzeit',     value: fmt(totalSecs),                unit: '',     icon: '⏱️', color: '#fb923c' },
  ]

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 3200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      className="animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '480px', background: t.surface, borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        className="animate-scaleIn"
      >
        {/* Drag handle */}
        <div style={{ width: '36px', height: '4px', background: t.border, borderRadius: '2px', margin: '10px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ color: t.muted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              {bike.brand}
            </p>
            <h3 style={{ color: t.text, fontSize: '22px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', margin: '2px 0 0', lineHeight: 1.1 }}>
              {bike.model}
              {bike.year
                ? <span style={{ fontSize: '14px', fontWeight: 400, color: t.muted, marginLeft: '8px' }}>{bike.year}</span>
                : null}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.muted, borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, lineHeight: 1 }}
          >×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '6px', padding: '14px 20px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          {[
            { id: 'stats',  label: 'Statistiken' },
            { id: 'touren', label: `Touren (${rideRoutes.length})` },
          ].map(tb => (
            <button
              key={tb.id}
              onClick={() => onTabChange(tb.id)}
              style={{
                flex: 1, padding: '9px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: tab === tb.id ? 'var(--color-accent-primary)' : t.bg,
                color: tab === tb.id ? 'white' : t.muted,
                fontSize: '13px', fontWeight: 700, fontFamily: "'Barlow', sans-serif",
                transition: 'all 0.15s',
              }}
            >{tb.label}</button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: t.muted, fontFamily: "'Barlow', sans-serif" }}>
              Laden...
            </div>
          ) : tab === 'stats' ? (
            /* ── Statistiken Tab ── */
            rideRoutes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏁</p>
                <p style={{ color: t.muted, fontSize: '14px', fontFamily: "'Barlow', sans-serif", lineHeight: 1.6 }}>
                  Noch keine gespeicherten Touren mit diesem Fahrzeug.
                  <br/>Starte eine Fahrt und speichere sie!
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {statItems.map(stat => (
                  <div key={stat.label} style={{ background: t.bg, borderRadius: '12px', padding: '14px', border: `1px solid ${t.border}` }}>
                    <p style={{ fontSize: '20px', margin: '0 0 6px' }}>{stat.icon}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                      <p style={{ color: stat.color, fontSize: '22px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", margin: 0, lineHeight: 1 }}>
                        {stat.value}
                      </p>
                      {stat.unit && (
                        <span style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>{stat.unit}</span>
                      )}
                    </div>
                    <p style={{ color: t.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Barlow', sans-serif", marginTop: '3px', marginBottom: 0 }}>
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── Touren Tab ── */
            rideRoutes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <p style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</p>
                <p style={{ color: t.muted, fontSize: '14px', fontFamily: "'Barlow', sans-serif" }}>
                  Noch keine Touren gespeichert
                </p>
              </div>
            ) : (
              rideRoutes.map(route => (
                <div
                  key={route.id}
                  onClick={() => onSelectRoute(route)}
                  style={{
                    background: t.bg, border: `1px solid ${t.border}`,
                    borderRadius: '12px', padding: '14px', marginBottom: '10px',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: t.text, margin: '0 0 4px', fontFamily: "'Barlow', sans-serif" }}>
                        {route.name || route.title || 'Unbenannte Tour'}
                      </p>
                      <p style={{ color: t.muted, fontSize: '12px', margin: 0, fontFamily: "'Barlow', sans-serif" }}>
                        {new Date(route.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {route.duration_secs ? ` · ${fmt(route.duration_secs)}` : ''}
                        {route.max_speed ? ` · Max ${route.max_speed} km/h` : ''}
                      </p>
                    </div>
                    {route.distance_km != null && (
                      <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-accent-primary)', margin: '0 0 0 12px', fontFamily: "'Barlow Condensed', sans-serif", whiteSpace: 'nowrap' }}>
                        {route.distance_km} km
                      </p>
                    )}
                  </div>
                  {/* Mini-Stats Zeile */}
                  {(route.avg_speed || route.max_speed) && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${t.border}` }}>
                      {route.avg_speed > 0 && (
                        <span style={{ color: '#facc15', fontSize: '11px', fontWeight: 600, fontFamily: "'Barlow', sans-serif" }}>
                          ⌀ {route.avg_speed} km/h
                        </span>
                      )}
                      {route.max_speed > 0 && (
                        <span style={{ color: '#f43f5e', fontSize: '11px', fontWeight: 600, fontFamily: "'Barlow', sans-serif" }}>
                          ⚡ {route.max_speed} km/h
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── AddVehicleModal ───────────────────────────────────────────────────────────
function AddVehicleModal({ t, onClose, onSaved }) {
  const CURRENT_YEAR = new Date().getFullYear()
  const [vehicleType, setVehicleType] = useState('motorrad')
  const [form, setForm] = useState({
    brand: '', customBrand: '', model: '',
    year: String(CURRENT_YEAR),
    hp: '', cc: '', torque: '', weight: '', odometer: ''
  })
  const [imageUrl, setImageUrl] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [showBrandList, setShowBrandList] = useState(false)

  const effectiveBrand = form.brand === '__other__' ? form.customBrand : form.brand

  // Pick the right brand list based on vehicle type
  const brandListForType = vehicleType === 'motorrad' ? MOTO_BRANDS
    : vehicleType === 'auto' ? CAR_BRANDS
    : OTHER_BRANDS
  const filteredBrands = brandListForType.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()))

  // Auto-fetch image when brand + model are set
  useEffect(() => {
    if (!effectiveBrand || !form.model || form.model.length < 2) return
    const timer = setTimeout(async () => {
      setImageLoading(true)
      setImageUrl(null)
      const url = await fetchBikeImage(effectiveBrand, form.model)
      setImageUrl(url)
      setImageLoading(false)
    }, 900)
    return () => clearTimeout(timer)
  }, [effectiveBrand, form.model])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    setError('')
    if (!effectiveBrand || !form.model.trim()) { setError('Marke und Modell sind Pflichtfelder.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const base = {
        user_id: user.id,
        brand: effectiveBrand,
        model: form.model.trim(),
        year: form.year ? parseInt(form.year) : null,
        hp: form.hp ? parseFloat(form.hp) : null,
        cc: form.cc ? parseInt(form.cc) : null,
        torque: form.torque ? parseInt(form.torque) : null,
        weight: form.weight ? parseInt(form.weight) : null,
        odometer: form.odometer ? parseInt(form.odometer) : null,
        vehicle_type: vehicleType,
      }
      // Try with image_url first; gracefully fall back if column doesn't exist
      let { error: insErr } = await supabase.from('motorcycles').insert({ ...base, image_url: imageUrl || null })
      if (insErr && /image_url|vehicle_type|column/i.test(insErr.message || '')) {
        // Try without vehicle_type if column is missing
        const { vehicle_type: _, image_url: __, ...baseMin } = { ...base, image_url: imageUrl || null }
        const r = await supabase.from('motorcycles').insert(baseMin)
        if (r.error) {
          const { image_url: ___, ...baseNoImg } = baseMin
          const r2 = await supabase.from('motorcycles').insert(baseNoImg)
          if (r2.error) throw r2.error
        }
      } else if (insErr) throw insErr
      onSaved()
    } catch (e) {
      setError(e.message || 'Fehler beim Speichern.')
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '10px', padding: '11px 14px',
    color: t.text, fontSize: '15px',
    fontFamily: "'Barlow', sans-serif",
    outline: 'none', transition: 'border-color 0.15s'
  }
  const labelStyle = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    color: t.muted, marginBottom: '5px', fontFamily: "'Barlow', sans-serif"
  }
  const focusOn = e => e.target.style.borderColor = '#3b82f6'
  const focusOff = e => e.target.style.borderColor = t.border

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} className="animate-fadeIn">
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: t.surface, borderRadius: '20px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} className="animate-scaleIn">

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', margin: 0 }}>Fahrzeug hinzufügen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '24px', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Vehicle type selector — 3 clean cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {VEHICLE_TYPES.map(vt => {
              const active = vehicleType === vt.id
              return (
                <button key={vt.id}
                  onClick={() => { setVehicleType(vt.id); setForm(f => ({ ...f, brand: '', customBrand: '' })); setBrandSearch('') }}
                  style={{
                    padding: '14px 8px 12px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '8px',
                    background: active ? 'var(--color-accent-primary)' : t.bg,
                    border: `1.5px solid ${active ? 'var(--color-accent-primary)' : t.border}`,
                    borderRadius: '14px', cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: active ? '0 4px 14px rgba(59,130,246,0.3)' : 'none',
                  }}>
                  <VehicleIcon type={vt.id} size={30} color={active ? '#fff' : t.muted} />
                  <span style={{
                    fontSize: '12px', fontWeight: 700,
                    color: active ? '#fff' : t.muted,
                    fontFamily: "'Barlow', sans-serif",
                    letterSpacing: '0.02em',
                  }}>{vt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Image preview */}
          <div style={{ height: '160px', borderRadius: '14px', overflow: 'hidden', marginBottom: '18px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {imageLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" className="animate-spin" style={{ color: '#3b82f6' }}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10"/>
                </svg>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>Bild wird geladen…</p>
              </div>
            ) : imageUrl ? (
              <>
                <img src={imageUrl} alt="bike" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setImageUrl(null)} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
                <div style={{ position: 'absolute', bottom: '10px', right: '12px', background: 'rgba(59,130,246,0.85)', borderRadius: '6px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Bild gefunden</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="17" r="2"/><circle cx="18" cy="17" r="2"/>
                </svg>
                <p style={{ color: 'white', fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>
                  {effectiveBrand && form.model ? 'Kein Bild gefunden' : 'Bild wird automatisch geladen'}
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '14px', fontFamily: "'Barlow', sans-serif" }}>
              {error}
            </div>
          )}

          {/* Brand picker */}
          <div style={{ marginBottom: '14px', position: 'relative' }}>
            <label style={labelStyle}>Marke *</label>
            <div style={{ position: 'relative' }}>
              <input
                value={brandSearch || effectiveBrand}
                onChange={e => { setBrandSearch(e.target.value); set('brand', ''); setShowBrandList(true) }}
                onFocus={() => setShowBrandList(true)}
                onBlur={() => setTimeout(() => setShowBrandList(false), 180)}
                placeholder="z.B. Yamaha, BMW, Kawasaki…"
                style={{ ...inputStyle, paddingRight: '36px' }}
                onFocusCapture={focusOn} onBlurCapture={focusOff}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            {showBrandList && filteredBrands.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                {filteredBrands.map(b => (
                  <button key={b} onMouseDown={() => { set('brand', b); setBrandSearch(''); setShowBrandList(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 14px', color: t.text, cursor: 'pointer', fontFamily: "'Barlow', sans-serif", fontSize: '14px', borderBottom: `1px solid ${t.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {b}
                  </button>
                ))}
                <button onMouseDown={() => { set('brand', '__other__'); setBrandSearch(''); setShowBrandList(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 14px', color: '#3b82f6', cursor: 'pointer', fontFamily: "'Barlow', sans-serif", fontSize: '14px', fontWeight: 600 }}>
                  + Andere Marke eingeben
                </button>
              </div>
            )}
          </div>

          {/* Custom brand input */}
          {form.brand === '__other__' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Markenname</label>
              <input value={form.customBrand} onChange={e => set('customBrand', e.target.value)} placeholder="Marke eingeben" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          )}

          {/* Model */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Modell *</label>
            <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="z.B. MT-07, Ninja ZX-6R, S1000RR" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>

          {/* Year + HP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Baujahr</label>
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)} min="1900" max={CURRENT_YEAR + 1} style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>PS (Leistung)</label>
              <input type="number" value={form.hp} onChange={e => set('hp', e.target.value)} placeholder="z.B. 95" min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {/* CC + NM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Hubraum (CC)</label>
              <input type="number" value={form.cc} onChange={e => set('cc', e.target.value)} placeholder="z.B. 689" min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Drehmoment (NM)</label>
              <input type="number" value={form.torque} onChange={e => set('torque', e.target.value)} placeholder="z.B. 75" min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {/* Weight + Odometer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Gewicht (KG)</label>
              <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="z.B. 193" min="1" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label style={labelStyle}>Kilometerstand</label>
              <input type="number" value={form.odometer} onChange={e => set('odometer', e.target.value)} placeholder="z.B. 12500" min="0" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {/* Save button */}
          <button onClick={save} disabled={saving} style={{ width: '100%', padding: '14px', background: saving ? t.muted : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, fontFamily: "'Barlow', sans-serif", cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 15px rgba(59,130,246,0.3)', transition: 'all 0.15s', marginBottom: '8px' }}>
            {saving ? 'Wird gespeichert…' : `${VEHICLE_TYPES.find(v => v.id === vehicleType)?.emoji || ''} Fahrzeug hinzufügen`}
          </button>
        </div>
      </div>
    </div>
  )
}