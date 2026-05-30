// Renders the type-specific body of a post (route_tip, ride_buddy, poll,
// marketplace, tour_report, challenge). Standard posts return null and are
// rendered by the Feed's default text+media path.

const diffColor = (d) => ({ easy: '#4ade80', medium: '#facc15', hard: '#f97316', expert: '#f43f5e' }[d] || '#3b82f6')
const diffLabel = (d) => ({ easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', expert: 'Experte' }[d] || d)
const surfaceLabel = (s) => ({ asphalt: 'Asphalt', gravel: 'Schotter', mixed: 'Gemischt' }[s] || s)
const paceLabel = (p) => ({ chill: 'Gemütlich', normal: 'Normal', sportlich: 'Sportlich' }[p] || p)
const vehicleLabel = (v) => ({ all: 'Egal', motorrad: 'Motorrad', auto: 'Auto', sonstiges: 'Sonstiges' }[v] || v)
const catLabel = (c) => ({ bike: 'Fahrzeug', parts: 'Teile', gear: 'Ausrüstung', other: 'Sonstiges' }[c] || c)
const condLabel = (c) => ({ new: 'Neu', like_new: 'Wie neu', good: 'Gut', used: 'Gebraucht' }[c] || c)

function timeLeft(iso) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Beendet'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days >= 1) return `noch ${days} Tag${days === 1 ? '' : 'e'}`
  if (hours >= 1) return `noch ${hours} Std`
  return 'läuft bald ab'
}

function fmtDate(date, time) {
  if (!date) return ''
  const d = new Date(`${date}T${time || '00:00'}`)
  const ds = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
  return time ? `${ds} · ${time}` : ds
}

// ── Small shared pieces ───────────────────────────────────────────────────────
function Badge({ children, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: `${color}1f`, border: `1px solid ${color}55`, color,
      borderRadius: '50px', padding: '2px 9px', fontSize: '11px', fontWeight: 700,
      fontFamily: "'Barlow', sans-serif", whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function Card({ accent, t, children }) {
  return (
    <div style={{
      border: `1px solid ${t.border}`, borderLeft: `3px solid ${accent}`,
      borderRadius: '14px', padding: '14px', background: t.bg, marginTop: '4px',
    }}>{children}</div>
  )
}

function RatingBar({ value, color }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} style={{ flex: 1, height: '6px', borderRadius: '3px', background: n <= value ? color : `${color}22` }} />
      ))}
    </div>
  )
}

export default function PostTypeBody({ post, t, currentUserId, onVote, onParticipate, onToggleSold, onContactSeller }) {
  const m = post.metadata || {}
  const isOwner = post.profiles?.id === currentUserId

  // ── ROUTE TIP ───────────────────────────────────────────────────────────
  if (post.post_type === 'route_tip') {
    return (
      <Card accent="#22c55e" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>Strecken-Tipp</span>
        </div>
        <h4 style={{ fontSize: '17px', fontWeight: 800, color: t.text, fontFamily: "'Barlow Condensed', sans-serif", margin: '0 0 4px', lineHeight: 1.15 }}>{m.road_name}</h4>
        {m.region && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px', color: t.muted, fontSize: '12px', margin: '0 0 10px', fontFamily: "'Barlow', sans-serif" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {m.region}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {m.distance_km ? <Badge color="#3b82f6" t={t}>{m.distance_km} km</Badge> : null}
          {m.difficulty ? <Badge color={diffColor(m.difficulty)} t={t}>{diffLabel(m.difficulty)}</Badge> : null}
          {m.surface ? <Badge color={t.muted} t={t}>{surfaceLabel(m.surface)}</Badge> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: m.tip_text ? '12px' : 0 }}>
          <div>
            <p style={{ fontSize: '10px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px', fontFamily: "'Barlow', sans-serif" }}>Kurven</p>
            <RatingBar value={m.curviness || 0} color="#22c55e" />
          </div>
          <div>
            <p style={{ fontSize: '10px', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px', fontFamily: "'Barlow', sans-serif" }}>Landschaft</p>
            <RatingBar value={m.scenery || 0} color="#22c55e" />
          </div>
        </div>
        {m.tip_text && <p style={{ fontSize: '14px', lineHeight: 1.55, color: t.text, fontFamily: "'Barlow', sans-serif", margin: 0 }}>{m.tip_text}</p>}
      </Card>
    )
  }

  // ── RIDE BUDDY ──────────────────────────────────────────────────────────
  if (post.post_type === 'ride_buddy') {
    const part = post.participation || { count: 0, joined: false }
    return (
      <Card accent="#f59e0b" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>Mitfahrer gesucht</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: t.text, fontSize: '14px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {fmtDate(m.date, m.time)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: t.text, fontSize: '14px', fontFamily: "'Barlow', sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span><strong>{m.start_location}</strong>{m.destination ? <> → <strong>{m.destination}</strong></> : null}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {m.distance_km ? <Badge color="#3b82f6" t={t}>{m.distance_km} km</Badge> : null}
          <Badge color="#f59e0b" t={t}>{paceLabel(m.pace)}</Badge>
          {m.vehicle_type && m.vehicle_type !== 'all' ? <Badge color={t.muted} t={t}>{vehicleLabel(m.vehicle_type)}</Badge> : null}
          {m.spots ? <Badge color="#22c55e" t={t}>{m.spots} Plätze</Badge> : null}
        </div>
        <ParticipateButton part={part} isOwner={isOwner} t={t} accent="#f59e0b"
          joinLabel="Bin dabei!" joinedLabel="Du bist dabei" countNoun="Interessenten"
          onClick={() => onParticipate?.(post)} />
      </Card>
    )
  }

  // ── POLL ────────────────────────────────────────────────────────────────
  if (post.post_type === 'poll') {
    const pollData = post.poll || { counts: {}, myVote: null, total: 0 }
    const options = m.options || []
    const total = pollData.total || 0
    const voted = pollData.myVote !== null && pollData.myVote !== undefined
    const ended = m.ends_at && new Date(m.ends_at).getTime() <= Date.now()
    const tl = timeLeft(m.ends_at)
    return (
      <Card accent="#0ea5e9" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0ea5e9', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>Umfrage</span>
        </div>
        <h4 style={{ fontSize: '16px', fontWeight: 700, color: t.text, fontFamily: "'Barlow', sans-serif", margin: '0 0 12px', lineHeight: 1.3 }}>{m.question}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, i) => {
            const count = pollData.counts?.[i] || 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const mine = pollData.myVote === i
            const showResults = voted || ended
            return (
              <button key={i}
                onClick={() => !ended && onVote?.(post, i)}
                disabled={ended}
                style={{
                  position: 'relative', width: '100%', textAlign: 'left',
                  border: `1.5px solid ${mine ? '#0ea5e9' : t.border}`,
                  borderRadius: '10px', padding: '10px 12px', cursor: ended ? 'default' : 'pointer',
                  background: t.surface, overflow: 'hidden', transition: 'border-color 0.15s',
                  fontFamily: "'Barlow', sans-serif",
                }}>
                {showResults && (
                  <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: mine ? 'rgba(14,165,233,0.22)' : 'rgba(14,165,233,0.10)', transition: 'width 0.4s ease' }} />
                )}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: mine ? 700 : 600, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {mine && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    {opt}
                  </span>
                  {showResults && <span style={{ fontSize: '13px', fontWeight: 700, color: mine ? '#0ea5e9' : t.muted }}>{pct}%</span>}
                </div>
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: '12px', color: t.muted, margin: '10px 0 0', fontFamily: "'Barlow', sans-serif" }}>
          {total} {total === 1 ? 'Stimme' : 'Stimmen'}{tl ? ` · ${tl}` : ''}{!voted && !ended ? ' · Tippe zum Abstimmen' : ''}
        </p>
      </Card>
    )
  }

  // ── MARKETPLACE ─────────────────────────────────────────────────────────
  if (post.post_type === 'marketplace') {
    const sold = m.sold
    return (
      <Card accent="#eab308" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#eab308', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>{catLabel(m.category)}</span>
          </div>
          {sold && <Badge color="#f43f5e" t={t}>Verkauft</Badge>}
        </div>
        <h4 style={{ fontSize: '16px', fontWeight: 700, color: t.text, fontFamily: "'Barlow', sans-serif", margin: '0 0 6px', lineHeight: 1.25, textDecoration: sold ? 'line-through' : 'none', opacity: sold ? 0.6 : 1 }}>{m.item_title}</h4>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#eab308', fontFamily: "'Barlow Condensed', sans-serif" }}>{m.price} {m.currency || '€'}</span>
          <Badge color={t.muted} t={t}>{condLabel(m.condition)}</Badge>
          {m.location ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: t.muted, fontFamily: "'Barlow', sans-serif" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {m.location}
            </span>
          ) : null}
        </div>
        {m.description && <p style={{ fontSize: '14px', lineHeight: 1.5, color: t.text, fontFamily: "'Barlow', sans-serif", margin: '0 0 12px' }}>{m.description}</p>}
        {isOwner ? (
          <button onClick={() => onToggleSold?.(post)} style={{
            width: '100%', padding: '10px', borderRadius: '10px', cursor: 'pointer',
            border: `1.5px solid ${sold ? '#22c55e' : t.border}`,
            background: sold ? 'rgba(34,197,94,0.12)' : 'transparent',
            color: sold ? '#22c55e' : t.muted, fontSize: '13px', fontWeight: 700,
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
          }}>{sold ? 'Wieder verfügbar machen' : 'Als verkauft markieren'}</button>
        ) : (
          <button onClick={() => onContactSeller?.(post)} disabled={sold} style={{
            width: '100%', padding: '10px', borderRadius: '10px', cursor: sold ? 'default' : 'pointer',
            border: 'none', background: sold ? t.border : '#eab308',
            color: sold ? t.muted : '#1a1400', fontSize: '13px', fontWeight: 800,
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
          }}>{sold ? 'Nicht mehr verfügbar' : 'Verkäufer kontaktieren'}</button>
        )}
      </Card>
    )
  }

  // ── TOUR REPORT ─────────────────────────────────────────────────────────
  if (post.post_type === 'tour_report') {
    const highlights = m.highlights || []
    return (
      <Card accent="#a855f7" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>Tour-Bericht</span>
        </div>
        <h4 style={{ fontSize: '18px', fontWeight: 800, color: t.text, fontFamily: "'Barlow Condensed', sans-serif", margin: '0 0 8px', lineHeight: 1.15 }}>{m.title}</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: m.story || highlights.length ? '12px' : 0 }}>
          {m.region ? <Badge color="#a855f7" t={t}>{m.region}</Badge> : null}
          {m.days ? <Badge color="#3b82f6" t={t}>{m.days} {m.days === 1 ? 'Tag' : 'Tage'}</Badge> : null}
          {m.distance_km ? <Badge color="#22c55e" t={t}>{m.distance_km} km</Badge> : null}
        </div>
        {highlights.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {highlights.map((h, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: '50px', padding: '3px 10px', fontSize: '12px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#a855f7" stroke="none"><polygon points="12 2 15 9 22 9 16 14 18 22 12 17 6 22 8 14 2 9 9 9"/></svg>
                {h}
              </span>
            ))}
          </div>
        )}
        {m.story && <p style={{ fontSize: '14px', lineHeight: 1.6, color: t.text, fontFamily: "'Barlow', sans-serif", margin: 0, whiteSpace: 'pre-wrap' }}>{m.story}</p>}
      </Card>
    )
  }

  // ── CHALLENGE ───────────────────────────────────────────────────────────
  if (post.post_type === 'challenge') {
    const part = post.participation || { count: 0, joined: false }
    const tl = timeLeft(m.ends_at)
    const ended = m.ends_at && new Date(m.ends_at).getTime() <= Date.now()
    return (
      <Card accent="#f43f5e" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f43f5e', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>Challenge</span>
        </div>
        <h4 style={{ fontSize: '18px', fontWeight: 800, color: t.text, fontFamily: "'Barlow Condensed', sans-serif", margin: '0 0 10px', lineHeight: 1.15 }}>{m.title}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '10px 12px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div>
            <p style={{ fontSize: '17px', fontWeight: 800, color: t.text, fontFamily: "'Barlow Condensed', sans-serif", margin: 0, lineHeight: 1 }}>{m.goal_value} {m.unit}</p>
            <p style={{ fontSize: '12px', color: t.muted, margin: '2px 0 0', fontFamily: "'Barlow', sans-serif" }}>{tl || 'Ziel'}</p>
          </div>
        </div>
        {m.description && <p style={{ fontSize: '14px', lineHeight: 1.55, color: t.text, fontFamily: "'Barlow', sans-serif", margin: '0 0 12px' }}>{m.description}</p>}
        {ended ? (
          <div style={{ textAlign: 'center', padding: '10px', borderRadius: '10px', background: t.surface, border: `1px solid ${t.border}`, color: t.muted, fontSize: '13px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
            Challenge beendet · {part.count} Teilnehmer
          </div>
        ) : (
          <ParticipateButton part={part} isOwner={isOwner} t={t} accent="#f43f5e"
            joinLabel="Mitmachen" joinedLabel="Du machst mit" countNoun="Teilnehmer"
            onClick={() => onParticipate?.(post)} ownerCanJoin />
        )}
      </Card>
    )
  }

  return null
}

// ── Participate button (ride_buddy + challenge) ───────────────────────────────
function ParticipateButton({ part, isOwner, t, accent, joinLabel, joinedLabel, countNoun, onClick, ownerCanJoin }) {
  const { count = 0, joined = false } = part || {}
  const countText = count > 0 ? `${count} ${countNoun}` : `Noch keine ${countNoun}`
  // Event owner of a ride_buddy gesuch can't "join" their own (they are the driver),
  // but a challenge owner can participate in their own challenge.
  if (isOwner && !ownerCanJoin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: t.surface, border: `1px solid ${t.border}` }}>
        <span style={{ fontSize: '13px', color: t.muted, fontWeight: 600, fontFamily: "'Barlow', sans-serif" }}>Dein Gesuch</span>
        <span style={{ fontSize: '13px', color: accent, fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>{countText}</span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button onClick={onClick} className="btn-press" style={{
        flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
        border: joined ? `1.5px solid ${accent}` : 'none',
        background: joined ? `${accent}1f` : accent,
        color: joined ? accent : 'white', fontSize: '14px', fontWeight: 800,
        fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
        {joined && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        {joined ? joinedLabel : joinLabel}
      </button>
      <span style={{ fontSize: '13px', color: t.muted, fontWeight: 600, fontFamily: "'Barlow', sans-serif", whiteSpace: 'nowrap' }}>{countText}</span>
    </div>
  )
}
