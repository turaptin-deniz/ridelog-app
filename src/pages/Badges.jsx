import { useState, useEffect } from 'react'
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
  { type: 'long_100', icon: '🏕️', label: 'Langstrecke', desc: '100 km in einem Stück', condition: (p) => p.longest_ride >= 100 },
  { type: 'long_300', icon: '🏔️', label: 'Ausdauer', desc: '300 km in einem Stück', condition: (p) => p.longest_ride >= 300 },
  { type: 'rides_10', icon: '🏍️', label: 'Regelmäßig', desc: '10 Touren gefahren', condition: (p) => p.total_rides >= 10 },
  { type: 'rides_50', icon: '👑', label: 'Veteran', desc: '50 Touren gefahren', condition: (p) => p.total_rides >= 50 },
]

export default function Badges({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [profile, setProfile] = useState(null)
  const [earnedBadges, setEarnedBadges] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const { data: badges } = await supabase.from('badges').select('*').eq('user_id', user.id)
    setProfile(prof)
    setEarnedBadges(badges?.map(b => b.type) || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getCurrentLeague = () => {
    const km = profile?.total_km || 0
    return LEAGUES.find(l => km >= l.min && km < l.max) || LEAGUES[0]
  }

  const getNextLeague = () => {
    const current = getCurrentLeague()
    const idx = LEAGUES.findIndex(l => l.id === current.id)
    return idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null
  }

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

      {/* Liga Header */}
      <div style={{
        background: `linear-gradient(135deg, ${league.color}22, ${league.color}44)`,
        borderBottom: `1px solid ${t.border}`,
        padding: '24px 16px'
      }}>
        <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontFamily: "'Barlow', sans-serif" }}>DEINE LIGA</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <span style={{ fontSize: '48px' }}>{league.icon}</span>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif", color: league.color, letterSpacing: '0.5px' }}>
              {league.label.toUpperCase()}
            </h2>
            <p style={{ color: t.muted, fontSize: '13px' }}>{Math.round(km)} km gefahren</p>
          </div>
        </div>

        {/* Progress Bar */}
        {nextLeague && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: t.muted, fontSize: '11px' }}>{league.label}</span>
              <span style={{ color: t.muted, fontSize: '11px' }}>{nextLeague.label} ({nextLeague.min} km)</span>
            </div>
            <div style={{ background: t.border, borderRadius: '50px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '50px',
                background: `linear-gradient(90deg, ${league.color}, ${nextLeague.color})`,
                width: `${Math.min(progress, 100)}%`,
                transition: 'width 0.5s ease'
              }} />
            </div>
            <p style={{ color: t.muted, fontSize: '11px', marginTop: '6px' }}>
              Noch {Math.round(nextLeague.min - km)} km bis {nextLeague.label} {nextLeague.icon}
            </p>
          </div>
        )}
      </div>

      {/* Liga Übersicht */}
      <div style={{ padding: '16px', borderBottom: `1px solid ${t.border}` }}>
        <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: "'Barlow', sans-serif" }}>ALLE LIGEN</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {LEAGUES.map(l => (
            <div key={l.id} style={{ textAlign: 'center', opacity: l.id === league.id ? 1 : 0.4 }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 4px',
                background: l.id === league.id ? `${l.color}33` : 'transparent',
                border: l.id === league.id ? `2px solid ${l.color}` : `2px solid ${t.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
              }}>{l.icon}</div>
              <p style={{ fontSize: '9px', color: l.id === league.id ? l.color : t.muted, fontWeight: '700', fontFamily: "'Barlow', sans-serif" }}>
                {l.label.toUpperCase()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '16px', borderBottom: `1px solid ${t.border}` }}>
        {[
          { label: 'Touren', value: profile?.total_rides || 0, icon: '🏍️' },
          { label: 'Gesamt km', value: `${Math.round(profile?.total_km || 0)}`, icon: '🛣️' },
          { label: 'Max. km/h', value: profile?.max_speed || 0, icon: '⚡' },
          { label: 'Längste Tour', value: `${Math.round(profile?.longest_ride || 0)} km`, icon: '🏕️' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: '10px', padding: '14px'
          }}>
            <p style={{ fontSize: '22px', marginBottom: '6px' }}>{stat.icon}</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6', fontFamily: "'Barlow Condensed', sans-serif" }}>{stat.value}</p>
            <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Abzeichen */}
      <div style={{ padding: '16px' }}>
        <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: "'Barlow', sans-serif" }}>
          ABZEICHEN ({earnedBadges.length}/{ALL_BADGES.length})
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {ALL_BADGES.map(badge => {
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
                <p style={{ fontSize: '28px', marginBottom: '6px', filter: !unlocked && !earned ? 'grayscale(1)' : 'none' }}>
                  {badge.icon}
                </p>
                <p style={{ fontSize: '11px', fontWeight: '700', color: earned ? '#3b82f6' : t.text, fontFamily: "'Barlow', sans-serif", marginBottom: '2px' }}>
                  {badge.label}
                </p>
                <p style={{ fontSize: '10px', color: t.muted, lineHeight: '1.3' }}>
                  {badge.desc}
                </p>
                {unlocked && !earned && (
                  <div style={{
                    marginTop: '6px', background: '#3b82f6', borderRadius: '4px',
                    padding: '3px 6px', fontSize: '9px', color: 'white', fontWeight: '700'
                  }}>VERDIENT!</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Speed Hinweis */}
        <div style={{
          marginTop: '16px', background: '#f97316' + '15',
          border: '1px solid #f97316' + '44', borderRadius: '10px', padding: '12px'
        }}>
          <p style={{ color: '#f97316', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>⚠️ Sicherheitshinweis</p>
          <p style={{ color: t.muted, fontSize: '11px', lineHeight: '1.5' }}>
            Geschwindigkeits-Abzeichen sollen nur auf erlaubten Strecken (Rennstrecke, Autobahn) erreicht werden. Fahre immer sicher und verantwortungsbewusst.
          </p>
        </div>
      </div>
    </div>
  )
}