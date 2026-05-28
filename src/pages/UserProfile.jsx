import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function UserProfile({ userId, darkMode, onBack }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [profile, setProfile]       = useState(null)
  const [routes, setRoutes]         = useState([])
  const [followers, setFollowers]   = useState(0)
  const [following, setFollowing]   = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('touren')

  useEffect(() => {
    if (userId) load()
  }, [userId])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    // Profil laden
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(prof)

    // Follower / Following zählen
    const [{ count: fwrCount }, { count: fwingCount }] = await Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    ])
    setFollowers(fwrCount || 0)
    setFollowing(fwingCount || 0)

    // Folge ich diesem Nutzer?
    const { data: followRow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single()
    setIsFollowing(!!followRow)

    // Öffentliche Touren laden
    const { data: rts } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    setRoutes(rts || [])

    setLoading(false)
  }

  const toggleFollow = async () => {
    if (!currentUser) return
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUser.id).eq('following_id', userId)
      setFollowers(prev => Math.max(0, prev - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: userId })
      setFollowers(prev => prev + 1)
    }
    setIsFollowing(prev => !prev)
  }

  const formatDuration = (secs) => {
    if (!secs) return '—'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const formatDate = (str) => {
    if (!str) return ''
    return new Date(str).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const totalKm    = routes.reduce((s, r) => s + (r.distance_km || 0), 0)
  const totalRides = routes.length

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <p style={{ color: '#3b82f6' }}>Laden...</p>
    </div>
  )

  if (!profile) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.bg, gap: '12px' }}>
      <p style={{ fontSize: '36px' }}>😕</p>
      <p style={{ color: t.muted, fontSize: '14px' }}>Profil nicht gefunden</p>
      <button onClick={onBack} style={{ background: '#3b82f6', border: 'none', color: 'white', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '600' }}>Zurück</button>
    </div>
  )

  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* ── Header mit Zurück-Button ─────────────────────────────────────── */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: t.surface, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px', padding: '0', display: 'flex', alignItems: 'center' }}>←</button>
        <p style={{ color: t.text, fontSize: '16px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>
          {profile.display_name || profile.username}
        </p>
      </div>

      {/* ── Profil-Header ────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 20px 20px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>

          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '24px', overflow: 'hidden', fontFamily: "'Barlow Condensed', sans-serif" }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : (profile.display_name || profile.username)?.slice(0, 2).toUpperCase()}
            </div>
            {profile.is_online && (
              <div style={{ position: 'absolute', bottom: '3px', right: '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.surface}` }} />
            )}
          </div>

          {/* Name + Username + Follow */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: t.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.display_name || profile.username}
            </h2>
            <p style={{ fontSize: '13px', color: t.muted, fontWeight: '400', marginBottom: '10px' }}>
              @{profile.username}
              {profile.is_online && <span style={{ color: '#4ade80', fontSize: '11px', marginLeft: '8px' }}>● Online</span>}
            </p>
            {/* Follow-Button */}
            {currentUser?.id !== userId && (
              <button onClick={toggleFollow} className="btn-press" style={{
                background: isFollowing ? 'transparent' : '#3b82f6',
                border: isFollowing ? `1px solid ${t.border}` : 'none',
                color: isFollowing ? t.muted : 'white',
                borderRadius: '8px', padding: '8px 20px', cursor: 'pointer',
                fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '700',
                transition: 'all 0.2s'
              }}>
                {isFollowing ? 'Gefolgt ✓' : '+ Folgen'}
              </button>
            )}
          </div>
        </div>

        {/* Bio + Location */}
        {profile.location && (
          <p style={{ color: t.muted, fontSize: '12px', marginBottom: '6px' }}>📍 {profile.location}</p>
        )}
        {profile.bio && (
          <p style={{ color: t.text, fontSize: '13px', lineHeight: '1.5', marginBottom: '16px', fontFamily: "'Barlow', sans-serif" }}>{profile.bio}</p>
        )}

        {/* Stats-Leiste */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { label: 'km', value: Math.round(totalKm) },
            { label: 'Touren', value: totalRides },
            { label: 'Follower', value: followers },
            { label: 'Folgt', value: following },
          ].map(s => (
            <div key={s.label} style={{ background: t.bg, borderRadius: '10px', padding: '10px 8px', textAlign: 'center', border: `1px solid ${t.border}` }}>
              <p style={{ fontSize: '18px', fontWeight: '800', color: t.text, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '10px', color: t.muted, marginTop: '3px', fontWeight: '600', letterSpacing: '0.04em' }}>{s.label.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: t.surface, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        {[{ id: 'touren', label: `Touren (${totalRides})` }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '12px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === tab.id ? '#3b82f6' : t.muted,
            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Touren-Liste ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        {routes.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '36px', marginBottom: '8px' }}>🏍️</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Noch keine Touren gespeichert</p>
          </div>
        ) : routes.map(route => (
          <div key={route.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Datum-Kachel */}
            <div style={{ width: '44px', flexShrink: 0, textAlign: 'center' }}>
              <p style={{ fontSize: '16px', fontWeight: '800', color: '#3b82f6', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                {new Date(route.created_at).getDate()}
              </p>
              <p style={{ fontSize: '10px', color: t.muted, fontWeight: '600', letterSpacing: '0.03em' }}>
                {new Date(route.created_at).toLocaleDateString('de-DE', { month: 'short' }).toUpperCase()}
              </p>
            </div>
            {/* Tour-Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                {route.name || 'Tour'}
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {route.distance_km && (
                  <span style={{ fontSize: '12px', color: t.muted }}>
                    <span style={{ color: t.text, fontWeight: '700' }}>{parseFloat(route.distance_km).toFixed(1)}</span> km
                  </span>
                )}
                {route.duration_secs && (
                  <span style={{ fontSize: '12px', color: t.muted }}>
                    <span style={{ color: t.text, fontWeight: '700' }}>{formatDuration(route.duration_secs)}</span>
                  </span>
                )}
                {route.max_speed && (
                  <span style={{ fontSize: '12px', color: t.muted }}>
                    max <span style={{ color: t.text, fontWeight: '700' }}>{Math.round(route.max_speed)}</span> km/h
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
