import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import RouteDetail from '../components/RouteDetail'

// ── helpers (module-level, no hooks) ────────────────────────────────────────
const isVideoUrl = url => url && /\.(mp4|mov|webm)/i.test(url)

function formatTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Gerade'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

// ── PostCard with carousel ───────────────────────────────────────────────────
function PostCard({ post, t, onLike, onComment, onRepost }) {
  const [slideIdx, setSlideIdx] = useState(0)
  const photos = post.photos || []

  return (
    <div style={{ borderBottom: `1px solid ${t.border}` }} className="animate-fadeIn">

      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'white', overflow: 'hidden', flexShrink: 0 }}>
          {post.profiles?.avatar_url
            ? <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : post.profiles?.username?.slice(0, 2).toUpperCase() || '??'}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>@{post.profiles?.username}</p>
          <p style={{ color: t.muted, fontSize: '11px' }}>{formatTime(post.created_at)}</p>
        </div>
        <button style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '18px' }}>···</button>
      </div>

      {/* Media carousel */}
      {photos.length > 0 && (
        <div style={{ position: 'relative', background: '#000', width: '100%' }}>
          {isVideoUrl(photos[slideIdx])
            ? <video src={photos[slideIdx]} controls style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
            : <img src={photos[slideIdx]} alt="" style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
          }

          {/* Prev arrow */}
          {photos.length > 1 && slideIdx > 0 && (
            <button onClick={() => setSlideIdx(i => i - 1)} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {/* Next arrow */}
          {photos.length > 1 && slideIdx < photos.length - 1 && (
            <button onClick={() => setSlideIdx(i => i + 1)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {/* Dots + counter */}
          {photos.length > 1 && (
            <>
              <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                {photos.map((_, i) => (
                  <div key={i} onClick={() => setSlideIdx(i)} style={{ height: '6px', width: i === slideIdx ? '18px' : '6px', borderRadius: '3px', background: i === slideIdx ? 'white' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s ease', cursor: 'pointer' }} />
                ))}
              </div>
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: 'white', fontFamily: "'Barlow', sans-serif" }}>
                {slideIdx + 1} / {photos.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Caption */}
      {post.content && (
        <div style={{ padding: '10px 16px 4px' }}>
          <p style={{ fontSize: '14px', lineHeight: '1.5', color: t.text, fontFamily: "'Barlow', sans-serif" }}>
            <span style={{ fontWeight: 700, marginRight: '6px' }}>@{post.profiles?.username}</span>
            {post.content}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '8px 16px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button onClick={() => onLike(post)} className="btn-press" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: post.liked ? '#f43f5e' : t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600', padding: '8px 12px', borderRadius: '8px', transition: 'all 0.15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={post.liked ? '#f43f5e' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {post.like_count > 0 && post.like_count}
        </button>
        <button onClick={() => onComment(post)} className="btn-press" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600', padding: '8px 12px', borderRadius: '8px', transition: 'all 0.15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {post.comment_count > 0 && post.comment_count}
        </button>
        <button onClick={() => onRepost(post)} className="btn-press" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: post.reposted ? '#4ade80' : t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600', padding: '8px 12px', borderRadius: '8px', transition: 'all 0.15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          {post.repost_count > 0 && post.repost_count}
        </button>
        <button className="btn-press" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: t.muted, padding: '8px 12px', borderRadius: '8px', marginLeft: 'auto' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function Feed({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState({ content: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('foryou')
  const [nearbyMeetups, setNearbyMeetups] = useState([])
  const [loadingMeetups, setLoadingMeetups] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [selectedMeetup, setSelectedMeetup] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeComments, setActiveComments] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const fileRef = useRef()
  const commentsEndRef = useRef()

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    loadPosts(user.id)
  }

  // Haversine distance in km
  const distanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const toRad = d => d * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
  }

  const loadMeetups = async (location) => {
    setLoadingMeetups(true)
    let collected = []

    // 1) Dedicated meetups table — silently skip if not present
    try {
      const { data, error } = await supabase
        .from('meetups')
        .select('*, profiles(username, avatar_url)')
        .gte('meetup_at', new Date().toISOString())
      if (!error && data) {
        collected = collected.concat(data.map(m => ({
          id: m.id,
          source: 'meetups',
          title: m.title,
          meetup_at: m.meetup_at,
          location: m.location,
          lat: m.lat, lng: m.lng,
          description: m.description,
          max_participants: m.max_participants,
          stops: m.waypoints || [{ address: m.location, lat: m.lat, lng: m.lng }],
          profile: m.profiles,
          owner_id: m.user_id,
        })))
      }
    } catch { /* table missing — fine */ }

    // 2) Fallback rows in routes table — title prefixed "[MEETUP]"
    const { data: routeRows } = await supabase
      .from('routes')
      .select('*, profiles(username, avatar_url)')
      .like('title', '[MEETUP]%')
    if (routeRows) {
      collected = collected.concat(routeRows.map(r => {
        const wps = r.waypoints || []
        const meetupWp = wps.find(w => w.type === 'meetup') || wps[0] || {}
        return {
          id: r.id,
          source: 'routes',
          title: r.title.replace(/^\[MEETUP\]\s*/, ''),
          meetup_at: meetupWp.meetup_at,
          location: meetupWp.address,
          lat: meetupWp.lat, lng: meetupWp.lng,
          description: meetupWp.description,
          max_participants: meetupWp.max_participants,
          stops: wps,
          profile: r.profiles,
          owner_id: r.user_id,
        }
      }).filter(m => m.meetup_at && new Date(m.meetup_at) >= new Date()))
    }

    // Compute distance + sort
    if (location && collected.length) {
      collected = collected
        .filter(m => typeof m.lat === 'number' && typeof m.lng === 'number')
        .map(m => ({ ...m, distance: distanceKm(location.lat, location.lng, m.lat, m.lng) }))
        .sort((a, b) => a.distance - b.distance)
    } else {
      collected.sort((a, b) => new Date(a.meetup_at) - new Date(b.meetup_at))
    }

    setNearbyMeetups(collected)
    setLoadingMeetups(false)
  }

  const requestLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Geolokation nicht verfügbar.')
      loadMeetups(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        loadMeetups(loc)
      },
      () => {
        setLocationError('Kein Standort — Touren nach Datum sortiert.')
        loadMeetups(null)
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  }

  useEffect(() => { init() }, [])
  useEffect(() => { if (commentsEndRef.current) commentsEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  // Load meetups when nearby tab is opened
  useEffect(() => {
    if (activeTab === 'nearby' && nearbyMeetups.length === 0 && !loadingMeetups) {
      if (userLocation) loadMeetups(userLocation)
      else requestLocation()
    }
  }, [activeTab])

  const loadPosts = async (userId) => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url)')
      .order('created_at', { ascending: false })

    if (data) {
      const postsWithLikes = await Promise.all(data.map(async (post) => {
        const { data: like } = await supabase.from('likes')
          .select('id').eq('user_id', userId).eq('post_id', post.id).single()
        const { data: repost } = await supabase.from('reposts')
          .select('id').eq('user_id', userId).eq('post_id', post.id).single()
        const { count: likeCount } = await supabase.from('likes')
          .select('id', { count: 'exact' }).eq('post_id', post.id)
        const { count: commentCount } = await supabase.from('comments')
          .select('id', { count: 'exact' }).eq('post_id', post.id)
        const { count: repostCount } = await supabase.from('reposts')
          .select('id', { count: 'exact' }).eq('post_id', post.id)
        return {
          ...post,
          liked: !!like,
          reposted: !!repost,
          like_count: likeCount || 0,
          comment_count: commentCount || 0,
          repost_count: repostCount || 0,
        }
      }))
      setPosts(postsWithLikes)
    }
    setLoading(false)
  }

  const toggleLike = async (post) => {
    if (!currentUser) return
    if (post.liked) {
      await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', post.id)
    } else {
      await supabase.from('likes').insert({ user_id: currentUser.id, post_id: post.id })
    }
    setPosts(posts.map(p => p.id === post.id ? {
      ...p, liked: !p.liked, like_count: p.like_count + (p.liked ? -1 : 1)
    } : p))
  }

  const toggleRepost = async (post) => {
    if (!currentUser) return
    if (post.reposted) {
      await supabase.from('reposts').delete().eq('user_id', currentUser.id).eq('post_id', post.id)
    } else {
      await supabase.from('reposts').insert({ user_id: currentUser.id, post_id: post.id })
    }
    setPosts(posts.map(p => p.id === post.id ? {
      ...p, reposted: !p.reposted, repost_count: p.repost_count + (p.reposted ? -1 : 1)
    } : p))
    // Notify Profile page so the Reposts tab refreshes
    window.dispatchEvent(new CustomEvent('ridelog:repost-changed'))
  }

  const openComments = async (post) => {
    setActiveComments(post)
    setLoadingComments(true)
    const { data } = await supabase.from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoadingComments(false)
  }

  const sendComment = async () => {
    if (!newComment.trim() || !activeComments) return
    const { data } = await supabase.from('comments').insert({
      user_id: currentUser.id,
      post_id: activeComments.id,
      content: newComment.trim()
    }).select('*, profiles(username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data])
      setPosts(posts.map(p => p.id === activeComments.id ? { ...p, comment_count: p.comment_count + 1 } : p))
      setNewComment('')
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const createPost = async () => {
    if (!newPost.content && !selectedFile) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let mediaUrl = null

    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const bucket = selectedFile.type.startsWith('video') ? 'videos' : 'post-images'
      const { error } = await supabase.storage.from(bucket).upload(path, selectedFile)
      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        mediaUrl = urlData.publicUrl
      }
    }

    await supabase.from('posts').insert({
      user_id: user.id,
      content: newPost.content,
      photos: mediaUrl ? [mediaUrl] : [],
    })

    setNewPost({ content: '' })
    setSelectedFile(null)
    setPreview(null)
    setShowCreate(false)
    setUploading(false)
    loadPosts(user.id)
  }

  const filteredPosts = activeTab === 'foryou' ? posts : posts.filter(p => p.profiles?.id !== currentUser?.id)

  // Comments Modal
  if (activeComments) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => setActiveComments(null)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px' }}>←</button>
        <h3 style={{ color: t.text, fontSize: '16px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Kommentare</h3>
      </div>

      {/* Original Post */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0, overflow: 'hidden' }}>
            {activeComments.profiles?.avatar_url
              ? <img src={activeComments.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : activeComments.profiles?.username?.slice(0,2).toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: '700', fontSize: '13px', color: t.text }}>@{activeComments.profiles?.username}</p>
            <p style={{ fontSize: '13px', color: t.text, lineHeight: '1.5', marginTop: '2px' }}>{activeComments.content}</p>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loadingComments ? (
          <p style={{ color: t.muted, textAlign: 'center', padding: '20px' }}>Laden...</p>
        ) : comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>💬</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Noch keine Kommentare</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '11px', flexShrink: 0, overflow: 'hidden' }}>
                {comment.profiles?.avatar_url
                  ? <img src={comment.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : comment.profiles?.username?.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '10px 12px' }}>
                  <p style={{ fontWeight: '700', fontSize: '12px', color: '#3b82f6', marginBottom: '4px' }}>@{comment.profiles?.username}</p>
                  <p style={{ fontSize: '13px', color: t.text, lineHeight: '1.5' }}>{comment.content}</p>
                </div>
                <p style={{ color: t.muted, fontSize: '11px', marginTop: '4px', marginLeft: '4px' }}>{formatTime(comment.created_at)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment Input */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendComment()}
          placeholder="Kommentar schreiben..."
          style={{
            flex: 1, background: t.bg, border: `1px solid ${t.border}`,
            borderRadius: '20px', padding: '10px 16px', color: t.text,
            fontSize: '13px', fontFamily: "'Barlow', sans-serif", outline: 'none'
          }}
        />
        <button onClick={sendComment} disabled={!newComment.trim()} style={{
          background: newComment.trim() ? '#3b82f6' : t.border,
          border: 'none', borderRadius: '50%', width: '38px', height: '38px',
          cursor: newComment.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        {[
          { id: 'foryou', label: 'Für dich' },
          { id: 'following', label: 'Folge ich' },
          { id: 'nearby', label: 'In der Nähe' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '14px 8px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--color-accent-primary)' : t.muted,
            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s',
            whiteSpace: 'nowrap'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* === NEARBY TAB === */}
        {activeTab === 'nearby' && (
          <NearbyMeetups
            t={t}
            loading={loadingMeetups}
            meetups={nearbyMeetups}
            userLocation={userLocation}
            locationError={locationError}
            onRetry={requestLocation}
            onSelect={setSelectedMeetup}
          />
        )}

        {/* Meetup detail modal */}
        {selectedMeetup && (
          <RouteDetail
            row={selectedMeetup}
            currentUser={currentUser}
            t={t}
            onClose={() => setSelectedMeetup(null)}
          />
        )}

        {activeTab !== 'nearby' && (
        <>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <p style={{ color: '#3b82f6' }}>Laden...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏍️</p>
            <p style={{ color: t.muted, fontSize: '14px', marginBottom: '8px' }}>Noch keine Posts</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Sei der Erste und teile deine Tour!</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              t={t}
              onLike={toggleLike}
              onComment={openComments}
              onRepost={toggleRepost}
            />
          ))
        )}
        </>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          className="animate-fadeIn">
          <div style={{ background: t.surface, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto' }}
            className="animate-scaleIn">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>NEUER POST</h3>
              <button onClick={() => { setShowCreate(false); setPreview(null); setSelectedFile(null) }}
                style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.muted, cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {preview && (
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                {selectedFile?.type.startsWith('video') ? (
                  <video src={preview} controls style={{ width: '100%', borderRadius: '10px', maxHeight: '220px', objectFit: 'cover' }} />
                ) : (
                  <img src={preview} style={{ width: '100%', borderRadius: '10px', maxHeight: '220px', objectFit: 'cover' }} />
                )}
                <button onClick={() => { setPreview(null); setSelectedFile(null) }} style={{
                  position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)',
                  border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px',
                  cursor: 'pointer', fontSize: '14px'
                }}>✕</button>
              </div>
            )}

            {!preview && (
              <div onClick={() => fileRef.current.click()} style={{
                border: `2px dashed ${t.border}`, borderRadius: '10px',
                padding: '28px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style={{ color: t.muted, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>Foto oder Video hochladen</p>
                <p style={{ color: t.muted, fontSize: '11px', marginTop: '4px' }}>Tippe hier zum Auswählen</p>
              </div>
            )}

            <textarea
              value={newPost.content}
              onChange={e => setNewPost({...newPost, content: e.target.value})}
              placeholder="Was willst du teilen? 🏍️"
              rows={3}
              style={{
                width: '100%', background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '12px', color: t.text, fontSize: '14px',
                resize: 'none', boxSizing: 'border-box', marginBottom: '16px',
                fontFamily: "'Barlow', sans-serif", lineHeight: '1.5', outline: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowCreate(false); setPreview(null); setSelectedFile(null) }} style={{
                flex: 1, background: 'transparent', border: `1px solid ${t.border}`,
                color: t.muted, borderRadius: '8px', padding: '12px',
                cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>Abbrechen</button>
              <button onClick={createPost} disabled={uploading} className="btn-press" style={{
                flex: 2, background: '#3b82f6', border: 'none', color: 'white',
                borderRadius: '8px', padding: '12px', cursor: 'pointer',
                fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '700'
              }}>{uploading ? 'Hochladen...' : 'Posten'}</button>
            </div>

            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
              onChange={handleFileSelect} />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Nearby Meetups — sub-view for the "In der Nähe" tab
// ============================================================

function NearbyMeetups({ t, loading, meetups, userLocation, locationError, onRetry, onSelect }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--color-accent-primary)', fontFamily: "'Barlow', sans-serif" }}>Suche Touren in deiner Nähe…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Location banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 12px', marginBottom: '12px',
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: '10px',
        fontSize: '12px', color: t.muted, fontFamily: "'Barlow', sans-serif"
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={userLocation ? 'var(--color-accent-primary)' : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span style={{ flex: 1 }}>
          {userLocation
            ? `Sortiert nach Distanz zu deinem Standort`
            : (locationError || 'Standort nicht freigegeben')}
        </span>
        {!userLocation && (
          <button onClick={onRetry} style={{
            background: 'var(--color-accent-primary)', color: 'white', border: 'none',
            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif"
          }}>Standort</button>
        )}
      </div>

      {meetups.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p style={{ color: t.muted, fontSize: '14px', marginBottom: '4px', fontFamily: "'Barlow', sans-serif" }}>Noch keine Touren in der Nähe</p>
          <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>
            Plane selbst eine über den Plus-Button!
          </p>
        </div>
      ) : (
        meetups.map(m => <MeetupCard key={m.id} m={m} t={t} onClick={() => onSelect(m)} />)
      )}
    </div>
  )
}

function MeetupCard({ m, t, onClick }) {
  const date = new Date(m.meetup_at)
  const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
  const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const stopCount = m.stops?.length || 1

  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: '12px', padding: '14px', marginBottom: '10px',
        transition: 'all 0.15s', cursor: 'pointer'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.border
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      className="animate-fadeIn">

      {/* Header: title + distance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
        <h4 style={{
          fontSize: '16px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: '0.3px', color: t.text, margin: 0, lineHeight: 1.2, flex: 1
        }}>{m.title}</h4>
        {typeof m.distance === 'number' && (
          <span style={{
            flexShrink: 0,
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '50px', padding: '2px 8px',
            fontSize: '11px', fontWeight: 700,
            color: 'var(--color-accent-primary)',
            fontFamily: "'Barlow', sans-serif"
          }}>
            {m.distance < 1 ? '<1 km' : `${Math.round(m.distance)} km`}
          </span>
        )}
      </div>

      {/* Date + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontWeight: 600, color: t.text }}>{dateStr}</span>
        <span>·</span>
        <span>{timeStr}</span>
      </div>

      {/* Location */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: m.description ? '8px' : '10px', color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span style={{ flex: 1 }}>{m.location}</span>
        {stopCount > 1 && (
          <span style={{
            flexShrink: 0,
            background: 'rgba(0,217,255,0.12)',
            border: '1px solid rgba(0,217,255,0.25)',
            borderRadius: '50px', padding: '1px 7px',
            fontSize: '10px', fontWeight: 700,
            color: 'var(--color-accent-secondary)'
          }}>+{stopCount - 1} Stopps</span>
        )}
      </div>

      {/* Description */}
      {m.description && (
        <p style={{ color: t.text, fontSize: '13px', lineHeight: 1.5, marginBottom: '10px', fontFamily: "'Barlow', sans-serif" }}>
          {m.description}
        </p>
      )}

      {/* Footer: organizer + join button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'var(--color-accent-primary)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '10px', fontWeight: 700
          }}>
            {m.profile?.avatar_url
              ? <img src={m.profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (m.profile?.username?.slice(0,2).toUpperCase() || '??')}
          </div>
          <span style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif" }}>
            @{m.profile?.username || 'jemand'}
          </span>
          {m.max_participants && (
            <span style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif" }}>
              · max {m.max_participants}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
          style={{
            background: 'var(--color-accent-primary)', color: 'white', border: 'none',
            borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif"
          }}>Details</button>
      </div>
    </div>
  )
}

