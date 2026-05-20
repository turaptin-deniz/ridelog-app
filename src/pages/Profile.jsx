import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const LEAGUES = [
  { id: 'bronze', label: 'Bronze', icon: '🥉', color: '#cd7f32', min: 0, max: 500 },
  { id: 'silver', label: 'Silber', icon: '🥈', color: '#c0c0c0', min: 500, max: 1500 },
  { id: 'gold', label: 'Gold', icon: '🥇', color: '#ffd700', min: 1500, max: 3000 },
  { id: 'platinum', label: 'Platin', icon: '💎', color: '#e5e4e2', min: 3000, max: 6000 },
  { id: 'diamond', label: 'Diamant', icon: '💠', color: '#b9f2ff', min: 6000, max: 99999 },
]

const ALL_BADGES = [
  { type: 'first_ride', icon: '🏁', label: 'Erste Fahrt', desc: 'Erste Tour getracked', condition: (p) => p.total_rides >= 1 },
  { type: 'km_100', icon: '🛣️', label: '100 km Club', desc: '100 km gefahren', condition: (p) => p.total_km >= 100 },
  { type: 'km_500', icon: '🗺️', label: '500 km Club', desc: '500 km gefahren', condition: (p) => p.total_km >= 500 },
  { type: 'km_1000', icon: '🌍', label: '1000 km Club', desc: '1000 km gefahren', condition: (p) => p.total_km >= 1000 },
  { type: 'km_5000', icon: '🚀', label: '5000 km Club', desc: '5000 km gefahren', condition: (p) => p.total_km >= 5000 },
  { type: 'speed_100', icon: '⚡', label: 'Triple Digits', desc: '100 km/h erreicht', condition: (p) => p.max_speed >= 100 },
  { type: 'speed_150', icon: '🔥', label: 'Speed Demon', desc: '150 km/h erreicht', condition: (p) => p.max_speed >= 150 },
  { type: 'speed_200', icon: '💨', label: '200er Club', desc: '200 km/h erreicht', condition: (p) => p.max_speed >= 200 },
  { type: 'long_100', icon: '🏕️', label: 'Langstrecke', desc: '100 km am Stück', condition: (p) => p.longest_ride >= 100 },
  { type: 'long_300', icon: '🏔️', label: 'Ausdauer', desc: '300 km am Stück', condition: (p) => p.longest_ride >= 300 },
  { type: 'rides_10', icon: '🏍️', label: 'Regelmäßig', desc: '10 Touren gefahren', condition: (p) => p.total_rides >= 10 },
  { type: 'rides_50', icon: '👑', label: 'Veteran', desc: '50 Touren gefahren', condition: (p) => p.total_rides >= 50 },
]

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
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posts')
  const [editing, setEditing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('de')
  const [editingImages, setEditingImages] = useState(false)
  const [editData, setEditData] = useState({ username: '', bio: '', location: '' })
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const avatarRef = useRef()
  const bannerRef = useRef()

  useEffect(() => { loadProfile() }, [])
  useEffect(() => { if (profile) checkFollow() }, [profile])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const { data: bikeData } = await supabase.from('motorcycles').select('*').eq('user_id', user.id)
    const { data: routeData } = await supabase.from('routes').select('*').eq('user_id', user.id)
    const { data: badgeData } = await supabase.from('badges').select('*').eq('user_id', user.id)
    setProfile(prof)
    setBikes(bikeData || [])
    setRoutes(routeData || [])
    setEarnedBadges(badgeData?.map(b => b.type) || [])
    setEditData({ username: prof?.username || '', bio: prof?.bio || '', location: prof?.location || '' })
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

  const saveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('profiles').update(editData).eq('id', user.id).select().single()
    if (data) { setProfile(data); setEditing(false) }
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

  const inputStyle = {
    width: '100%', background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '8px', padding: '12px', color: t.text,
    fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px',
    fontFamily: "'Barlow', sans-serif"
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() || '??'
  const totalKm = routes.reduce((sum, r) => sum + (r.distance_km || 0), 0)
  const league = getCurrentLeague()
  const nextLeague = getNextLeague()
  const km = profile?.total_km || 0
  const progress = nextLeague ? ((km - league.min) / (nextLeague.min - league.min)) * 100 : 100

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <p style={{ color: '#6C63FF' }}>Laden...</p>
    </div>
  )

  return (
    <div style={{ flex: 1, background: t.bg, overflowY: 'auto', color: t.text }}>

      {/* Banner */}
      <div style={{ position: 'relative', height: '130px' }}>
        {profile?.banner_url
          ? <img src={profile.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6C63FF33, #6C63FF77)' }} />
        }
        {editingImages && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
            <button onClick={() => bannerRef.current.click()} style={{
              background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white',
              borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
              fontFamily: "'Barlow', sans-serif"
            }}>{uploadingBanner ? '...' : '📷 Banner'}</button>
            {profile?.banner_url && (
              <button onClick={() => deleteImage('banner')} style={{
                background: 'rgba(200,0,0,0.75)', border: 'none', color: 'white',
                borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px'
              }}>🗑️</button>
            )}
          </div>
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
            background: '#6C63FF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: 'white'
          }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          {editingImages && (
            <>
              <button onClick={() => avatarRef.current.click()} style={{
                position: 'absolute', bottom: '0', right: '0',
                width: '26px', height: '26px', borderRadius: '50%',
                background: '#6C63FF', border: `2px solid ${t.bg}`,
                color: 'white', cursor: 'pointer', fontSize: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{uploadingAvatar ? '...' : '✎'}</button>
              {profile?.avatar_url && (
                <button onClick={() => deleteImage('avatar')} style={{
                  position: 'absolute', top: '0', right: '0',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'rgba(200,0,0,0.85)', border: 'none',
                  color: 'white', cursor: 'pointer', fontSize: '11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>✕</button>
              )}
            </>
          )}
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'avatars', 'avatar')} />
        </div>
        <button onClick={() => { setEditing(true); setEditingImages(true) }} style={{
          background: 'transparent', border: `1px solid ${t.border}`,
          color: t.text, borderRadius: '8px', padding: '8px 16px',
          cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
        }}>✏️ Bearbeiten</button>
      </div>

      {/* Info */}
      <div style={{ padding: '0 16px 12px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px' }}>
            @{profile?.username}
          </h2>
          {/* Liga Badge */}
          <div style={{
            background: league.color + '22', border: `1px solid ${league.color}66`,
            borderRadius: '50px', padding: '2px 8px',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <span style={{ fontSize: '12px' }}>{league.icon}</span>
            <span style={{ color: league.color, fontSize: '10px', fontWeight: '700', fontFamily: "'Barlow', sans-serif" }}>
              {league.label.toUpperCase()}
            </span>
          </div>
        </div>
        {profile?.location && <p style={{ color: t.muted, fontSize: '13px', marginBottom: '6px' }}>📍 {profile.location}</p>}
        {profile?.bio && <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{profile.bio}</p>}
      </div>

      {/* Stats */}
      {/* Stats */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: `1px solid ${t.border}` }}>
  {[
    { label: 'Touren', value: routes.length },
    { label: 'km', value: Math.round(totalKm) },
    { label: 'Follower', value: followerCount },
    { label: 'Folge ich', value: followingCount },
  ].map((stat, i) => (
    <div key={stat.label} style={{
      padding: '14px 4px', textAlign: 'center',
      borderRight: i < 3 ? `1px solid ${t.border}` : 'none'
    }}>
      <p style={{ fontSize: '20px', fontWeight: '700', color: '#6C63FF', marginBottom: '2px', fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.value}</p>
      <p style={{ fontSize: '10px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
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
            borderBottom: activeTab === tab.id ? '2px solid #6C63FF' : '2px solid transparent',
            color: activeTab === tab.id ? '#6C63FF' : t.muted,
            cursor: 'pointer', fontSize: '12px', fontWeight: '600',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
            whiteSpace: 'nowrap'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">

        {/* Posts */}
        {activeTab === 'posts' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px' }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{
                  aspectRatio: '1', background: t.surface,
                  border: `1px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <p style={{ color: t.muted, fontSize: '20px' }}>📷</p>
                </div>
              ))}
            </div>
            <p style={{ color: t.muted, fontSize: '13px', textAlign: 'center', padding: '16px' }}>
              Posts kommen in Runde 4
            </p>
          </div>
        )}

        {/* Touren */}
        {activeTab === 'touren' && (
          <div style={{ padding: '16px' }}>
            {routes.length === 0 ? (
              <p style={{ color: t.muted, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Noch keine Touren</p>
            ) : (
              routes.map(route => (
                <div key={route.id} style={{
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: '10px', padding: '14px', marginBottom: '10px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>{route.title}</p>
                    <p style={{ color: t.muted, fontSize: '12px' }}>{route.region || 'Keine Region'} · {route.difficulty}</p>
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '700', color: '#6C63FF' }}>{route.distance_km} km</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Garage */}
        {activeTab === 'garage' && (
          <div style={{ padding: '16px' }}>
            {bikes.length === 0 ? (
              <p style={{ color: t.muted, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Noch kein Motorrad eingetragen</p>
            ) : (
              bikes.map(bike => (
                <div key={bike.id} style={{
                  background: '#111', border: `1px solid #222`,
                  borderRadius: '12px', padding: '16px', marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ color: '#6C63FF', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{bike.brand}</p>
                      <p style={{ color: '#fff', fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>{bike.model} {bike.year}</p>
                    </div>
                    <div style={{ background: '#6C63FF22', borderRadius: '8px', padding: '6px 10px', textAlign: 'center' }}>
                      <p style={{ color: '#6C63FF', fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>{bike.hp || '–'}</p>
                      <p style={{ color: '#6C63FF', fontSize: '10px' }}>PS</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                      { label: 'CC', value: bike.cc },
                      { label: 'NM', value: bike.torque },
                      { label: 'KG', value: bike.weight },
                    ].filter(s => s.value).map(spec => (
                      <div key={spec.label} style={{ background: '#1a1a1a', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <p style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' }}>{spec.label}</p>
                        <p style={{ color: '#fff', fontSize: '14px', fontWeight: '700' }}>{spec.value}</p>
                      </div>
                    ))}
                  </div>
                  {bike.odometer && (
                    <p style={{ color: '#555', fontSize: '12px', marginTop: '10px' }}>🛣️ {bike.odometer.toLocaleString()} km</p>
                  )}
                </div>
              ))
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

            {/* Abzeichen Grid */}
            <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: "'Barlow', sans-serif" }}>
              ABZEICHEN ({earnedBadges.length}/{ALL_BADGES.length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {ALL_BADGES.map(badge => {
                const earned = earnedBadges.includes(badge.type)
                const unlocked = badge.condition(profile || {})
                return (
                  <div key={badge.type} style={{
                    background: earned ? '#6C63FF22' : t.surface,
                    border: `1px solid ${earned ? '#6C63FF' : t.border}`,
                    borderRadius: '10px', padding: '12px', textAlign: 'center',
                    opacity: unlocked || earned ? 1 : 0.4,
                    transition: 'all 0.2s'
                  }}>
                    <p style={{ fontSize: '26px', marginBottom: '6px', filter: !unlocked && !earned ? 'grayscale(1)' : 'none' }}>
                      {badge.icon}
                    </p>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: earned ? '#6C63FF' : t.text, fontFamily: "'Barlow', sans-serif", marginBottom: '2px' }}>
                      {badge.label}
                    </p>
                    <p style={{ fontSize: '10px', color: t.muted, lineHeight: '1.3' }}>{badge.desc}</p>
                    {unlocked && !earned && (
                      <div style={{ marginTop: '6px', background: '#6C63FF', borderRadius: '4px', padding: '3px 6px', fontSize: '9px', color: 'white', fontWeight: '700' }}>
                        VERDIENT!
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

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

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          className="animate-fadeIn">
          <div style={{ background: t.surface, borderRadius: '16px 16px 0 0', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}
            className="animate-slideUp">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Profil bearbeiten</h3>
              <button onClick={() => { setEditing(false); setEditingImages(false) }} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px' }}>✕</button>
            </div>
            <label style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
            <input value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})}
              placeholder="dein_username" style={inputStyle} />
            <label style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standort</label>
            <input value={editData.location} onChange={e => setEditData({...editData, location: e.target.value})}
              placeholder="z.B. München, Bayern" style={inputStyle} />
            <label style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bio</label>
            <textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})}
              placeholder="Erzähl was über dich..." rows={3}
              style={{ ...inputStyle, resize: 'none' }} />
            <button onClick={saveProfile} className="btn-press" style={{
              width: '100%', background: '#6C63FF', color: 'white', border: 'none',
              borderRadius: '8px', padding: '14px', cursor: 'pointer', fontSize: '15px',
              fontWeight: '700', fontFamily: "'Barlow', sans-serif"
            }}>Speichern</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
    className="animate-fadeIn">
    <div style={{ background: t.surface, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px' }}
      className="animate-scaleIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Einstellungen</h3>
        <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px' }}>✕</button>
      </div>
      {[
        { label: darkMode ? '☀️ Light Mode' : '🌙 Dark Mode', action: () => setDarkMode(!darkMode) },
        { label: '🔒 Privatsphäre', action: () => {} },
        { label: '🌍 Sprache', action: () => setShowLanguage(true) },
      ].map(item => (
        <button key={item.label} onClick={item.action} className="btn-press" style={{
          width: '100%', background: t.bg, border: `1px solid ${t.border}`,
          color: t.text, borderRadius: '8px', padding: '14px 16px',
          cursor: 'pointer', fontSize: '14px', fontWeight: '600',
          fontFamily: "'Barlow', sans-serif", textAlign: 'left', marginBottom: '8px'
        }}>{item.label}</button>
      ))}
      <button onClick={() => supabase.auth.signOut()} className="btn-press" style={{
        width: '100%', background: 'transparent', border: '1px solid #f87171',
        color: '#f87171', borderRadius: '8px', padding: '14px 16px',
        cursor: 'pointer', fontSize: '14px', fontWeight: '600',
        fontFamily: "'Barlow', sans-serif", marginTop: '8px'
      }}>🚪 Abmelden</button>
    </div>
  </div>
)}

{/* Language Modal */}
{showLanguage && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}
    className="animate-fadeIn">
    <div style={{ background: t.surface, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px' }}
      className="animate-scaleIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Sprache</h3>
        <button onClick={() => setShowLanguage(false)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '22px' }}>✕</button>
      </div>
      {[
        { label: 'Deutsch', flag: '🇩🇪', id: 'de' },
        { label: 'Englisch', flag: '🇬🇧', id: 'en' },
        { label: 'Französisch', flag: '🇫🇷', id: 'fr' },
        { label: 'Spanisch', flag: '🇪🇸', id: 'es' },
      ].map(lang => (
        <button key={lang.id} onClick={() => { setSelectedLanguage(lang.id); setShowLanguage(false) }} className="btn-press" style={{
          width: '100%', background: selectedLanguage === lang.id ? '#6C63FF22' : t.bg,
          border: `1px solid ${selectedLanguage === lang.id ? '#6C63FF' : t.border}`,
          color: t.text, borderRadius: '8px', padding: '14px 16px',
          cursor: 'pointer', fontSize: '14px', fontWeight: '600',
          fontFamily: "'Barlow', sans-serif", textAlign: 'left', marginBottom: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>{lang.flag} {lang.label}</span>
          {selectedLanguage === lang.id && <span style={{ color: '#6C63FF', fontSize: '16px' }}>✓</span>}
        </button>
      ))}
    </div>
  </div>
)}

      {/* Settings Button */}
      <button onClick={() => setShowSettings(true)} style={{
        position: 'fixed', bottom: '80px', right: 'calc(50% - 224px)',
        background: '#6C63FF', border: 'none', borderRadius: '50%',
        width: '44px', height: '44px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(108,99,255,0.4)', zIndex: 100
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  )
}