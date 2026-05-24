import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const BRANDS = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'KTM', 'Triumph', 'Harley-Davidson', 'Aprilia', 'Andere']

const MOD_CATEGORIES = [
  { id: 'exhaust', label: 'Auspuff', icon: '💨' },
  { id: 'tires', label: 'Reifen', icon: '⚫' },
  { id: 'suspension', label: 'Fahrwerk', icon: '🔧' },
  { id: 'brakes', label: 'Bremsen', icon: '🛑' },
  { id: 'engine', label: 'Motor', icon: '⚙️' },
  { id: 'lighting', label: 'Beleuchtung', icon: '💡' },
  { id: 'ergonomics', label: 'Ergonomie', icon: '🏍️' },
  { id: 'aesthetics', label: 'Optik', icon: '🎨' },
  { id: 'electronics', label: 'Elektronik', icon: '📱' },
  { id: 'other', label: 'Sonstiges', icon: '➕' },
]

function BikeImage({ brand, model, year }) {
  const query = encodeURIComponent(`${year} ${brand} ${model} motorcycle`)
  const src = `https://loremflickr.com/400/200/${encodeURIComponent(brand + ' ' + model + ' motorcycle')}`
  const [imgError, setImgError] = useState(false)

  return imgError ? (
    <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
        <circle cx="25" cy="42" r="14" stroke="#3b82f6" strokeWidth="2.5" fill="none"/>
        <circle cx="95" cy="42" r="14" stroke="#3b82f6" strokeWidth="2.5" fill="none"/>
        <circle cx="25" cy="42" r="4" fill="#3b82f6"/>
        <circle cx="95" cy="42" r="4" fill="#3b82f6"/>
        <path d="M25 28 L45 18 L75 18 L95 28 L95 42 L25 42 Z" stroke="#3b82f6" strokeWidth="2" fill="#3b82f622" strokeLinejoin="round"/>
        <path d="M45 18 L50 10 L70 10 L75 18" stroke="#3b82f6" strokeWidth="1.5" fill="#3b82f611"/>
        <path d="M95 28 L108 30 L108 38 L95 38" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
        <line x1="25" y1="28" x2="15" y2="32" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  ) : (
    <img
      src={src}
      alt={`${brand} ${model}`}
      onError={() => setImgError(true)}
      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }}
    />
  )
}

function BikeCard({ bike, mods, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#111',
      border: `2px solid ${selected ? '#3b82f6' : '#222'}`,
      borderRadius: '12px',
      padding: '12px',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
      flexShrink: 0,
      width: '200px'
    }}>
      <BikeImage brand={bike.brand} model={bike.model} year={bike.year} />
      <p style={{ color: '#3b82f6', fontSize: '10px', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{bike.brand}</p>
      <p style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{bike.model} {bike.year}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {bike.hp && <div style={{ background: '#1a1a1a', borderRadius: '6px', padding: '6px 8px' }}>
          <p style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase' }}>PS</p>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{bike.hp}</p>
        </div>}
        {bike.cc && <div style={{ background: '#1a1a1a', borderRadius: '6px', padding: '6px 8px' }}>
          <p style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase' }}>CC</p>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{bike.cc}</p>
        </div>}
        {bike.torque && <div style={{ background: '#1a1a1a', borderRadius: '6px', padding: '6px 8px' }}>
          <p style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase' }}>NM</p>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{bike.torque}</p>
        </div>}
        {bike.weight && <div style={{ background: '#1a1a1a', borderRadius: '6px', padding: '6px 8px' }}>
          <p style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase' }}>KG</p>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{bike.weight}</p>
        </div>}
      </div>
      <p style={{ color: '#555', fontSize: '11px', marginTop: '8px' }}>{mods.length} Modifikationen</p>
    </div>
  )
}

export default function Garage({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#222', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e0e0e0', text: '#0a0a0a', muted: '#888'
  }

  const [bikes, setBikes] = useState([])
  const [mods, setMods] = useState([])
  const [selectedBike, setSelectedBike] = useState(null)
  const [showAddBike, setShowAddBike] = useState(false)
  const [showEditBike, setShowEditBike] = useState(false)
  const [showAddMod, setShowAddMod] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newBike, setNewBike] = useState({ brand: 'Kawasaki', model: '', year: '', cc: '', hp: '', torque: '', weight: '', color: '', odometer: '' })
  const [editBike, setEditBike] = useState(null)
  const [newMod, setNewMod] = useState({ category: 'exhaust', product_name: '', brand: '', notes: '' })

  useEffect(() => { loadBikes() }, [])

  const loadBikes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('motorcycles').select('*').eq('user_id', user.id)
    setBikes(data || [])
    if (data && data.length > 0) {
      setSelectedBike(data[0])
      loadMods(data[0].id)
    }
    setLoading(false)
  }

  const loadMods = async (bikeId) => {
    const { data } = await supabase.from('modifications').select('*').eq('motorcycle_id', bikeId)
    setMods(data || [])
  }

  const parseBike = (bike) => ({
    brand: bike.brand,
    model: bike.model,
    year: bike.year ? parseInt(bike.year) : null,
    cc: bike.cc ? parseInt(bike.cc) : null,
    hp: bike.hp ? parseInt(bike.hp) : null,
    torque: bike.torque ? parseInt(bike.torque) : null,
    weight: bike.weight ? parseInt(bike.weight) : null,
    odometer: bike.odometer ? parseInt(bike.odometer) : null,
    color: bike.color || null,
  })

  const addBike = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('motorcycles').insert({ ...parseBike(newBike), user_id: user.id }).select()
    if (data) {
      setBikes([...bikes, data[0]])
      setSelectedBike(data[0])
      setShowAddBike(false)
      setNewBike({ brand: 'Kawasaki', model: '', year: '', cc: '', hp: '', torque: '', weight: '', color: '', odometer: '' })
    }
    if (error) console.error(error)
  }

  const saveBikeEdit = async () => {
    const { data, error } = await supabase.from('motorcycles').update(parseBike(editBike)).eq('id', editBike.id).select()
    if (data) {
      setBikes(bikes.map(b => b.id === editBike.id ? data[0] : b))
      setSelectedBike(data[0])
      setShowEditBike(false)
      setEditBike(null)
    }
    if (error) console.error(error)
  }

  const deleteBike = async (bikeId) => {
    if (!confirm('Motorrad wirklich löschen?')) return
    const { error } = await supabase.from('motorcycles').delete().eq('id', bikeId)
    if (!error) {
      const updated = bikes.filter(b => b.id !== bikeId)
      setBikes(updated)
      setSelectedBike(updated[0] || null)
      if (updated[0]) loadMods(updated[0].id)
      else setMods([])
    }
  }

  const deleteMod = async (modId) => {
    const { error } = await supabase.from('modifications').delete().eq('id', modId)
    if (!error) setMods(mods.filter(m => m.id !== modId))
  }

  const addMod = async () => {
    const { data, error } = await supabase.from('modifications').insert({ ...newMod, motorcycle_id: selectedBike.id }).select()
    if (data) {
      setMods([...mods, data[0]])
      setShowAddMod(false)
      setNewMod({ category: 'exhaust', product_name: '', brand: '', notes: '' })
    }
    if (error) console.error(error)
  }

  const inputStyle = {
    width: '100%', background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '6px', padding: '10px 12px', color: t.text,
    fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px'
  }

  const BikeForm = ({ data, setData, onSave, onClose, title }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: t.surface, borderRadius: '16px 16px 0 0', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: t.text, fontSize: '16px', fontWeight: '600' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        <label style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase' }}>Marke</label>
        <select value={data.brand} onChange={e => setData({...data, brand: e.target.value})} style={inputStyle}>
          {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {[['model','Modell (z.B. Ninja 250R)','text'],['year','Baujahr','number'],['cc','Hubraum (cc)','number'],['hp','PS','number'],['torque','Drehmoment (Nm)','number'],['weight','Gewicht (kg)','number'],['odometer','Kilometerstand','number'],['color','Farbe','text']].map(([key, placeholder, type]) => (
          <input key={key} placeholder={placeholder} value={data[key] || ''}
            onChange={e => setData({...data, [key]: e.target.value})}
            style={inputStyle} type={type}
          />
        ))}
        <button onClick={onSave} style={{
          width: '100%', background: '#3b82f6', color: 'white', border: 'none',
          borderRadius: '8px', padding: '14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
        }}>Speichern</button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <p style={{ color: '#3b82f6' }}>Laden...</p>
    </div>
  )

  return (
    <div style={{ flex: 1, background: t.bg, overflowY: 'auto', color: t.text }}>

      <div style={{ padding: '16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Meine Garage</h2>
        <button onClick={() => setShowAddBike(true)} style={{
          background: '#3b82f6', color: 'white', border: 'none',
          borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px'
        }}>+ Motorrad</button>
      </div>

      {bikes.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏍️</p>
          <p style={{ color: t.muted, fontSize: '14px', marginBottom: '16px' }}>Noch kein Motorrad in der Garage</p>
          <button onClick={() => setShowAddBike(true)} style={{
            background: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px'
          }}>Motorrad hinzufügen</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '12px', padding: '16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {bikes.map(bike => (
              <BikeCard
                key={bike.id}
                bike={bike}
                mods={bike.id === selectedBike?.id ? mods : []}
                selected={selectedBike?.id === bike.id}
                onClick={() => { setSelectedBike(bike); loadMods(bike.id) }}
              />
            ))}
          </div>

          {selectedBike && (
            <div style={{ padding: '0 16px 16px' }}>

              {/* Edit / Delete Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => { setEditBike({...selectedBike}); setShowEditBike(true) }} style={{
                  flex: 1, background: 'transparent', color: '#3b82f6', border: `1px solid #3b82f6`,
                  borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '13px'
                }}>✏️ Bearbeiten</button>
                <button onClick={() => deleteBike(selectedBike.id)} style={{
                  flex: 1, background: 'transparent', color: '#f87171', border: `1px solid #f87171`,
                  borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '13px'
                }}>🗑️ Löschen</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Modifikationen</h3>
                <button onClick={() => setShowAddMod(true)} style={{
                  background: 'transparent', color: '#3b82f6', border: `1px solid #3b82f6`,
                  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px'
                }}>+ Hinzufügen</button>
              </div>

              {mods.length === 0 ? (
                <p style={{ color: t.muted, fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  Noch keine Modifikationen eingetragen
                </p>
              ) : (
                MOD_CATEGORIES.filter(cat => mods.some(m => m.category === cat.id)).map(cat => (
                  <div key={cat.id} style={{ marginBottom: '16px' }}>
                    <p style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      {cat.icon} {cat.label}
                    </p>
                    {mods.filter(m => m.category === cat.id).map(mod => (
                      <div key={mod.id} style={{
                        background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: '8px', padding: '12px', marginBottom: '8px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                      }}>
                        <div>
                          <p style={{ fontWeight: '500', fontSize: '14px', marginBottom: '2px' }}>{mod.product_name}</p>
                          {mod.brand && <p style={{ color: t.muted, fontSize: '12px', marginBottom: '2px' }}>{mod.brand}</p>}
                          {mod.notes && <p style={{ color: t.muted, fontSize: '12px' }}>{mod.notes}</p>}
                        </div>
                        <button onClick={() => deleteMod(mod.id)} style={{
                          background: 'none', border: 'none', color: '#f87171',
                          cursor: 'pointer', fontSize: '16px', padding: '0 0 0 8px'
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showAddBike && (
        <BikeForm data={newBike} setData={setNewBike} onSave={addBike} onClose={() => setShowAddBike(false)} title="Motorrad hinzufügen" />
      )}

      {showEditBike && editBike && (
        <BikeForm data={editBike} setData={setEditBike} onSave={saveBikeEdit} onClose={() => setShowEditBike(false)} title="Motorrad bearbeiten" />
      )}

      {showAddMod && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: t.surface, borderRadius: '16px 16px 0 0', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '16px', fontWeight: '600' }}>Modifikation hinzufügen</h3>
              <button onClick={() => setShowAddMod(false)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <label style={{ color: t.muted, fontSize: '11px', textTransform: 'uppercase' }}>Kategorie</label>
            <select value={newMod.category} onChange={e => setNewMod({...newMod, category: e.target.value})} style={inputStyle}>
              {MOD_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            <input placeholder="Produktname (z.B. Akrapovic Slip-On)" value={newMod.product_name}
              onChange={e => setNewMod({...newMod, product_name: e.target.value})} style={inputStyle} />
            <input placeholder="Marke" value={newMod.brand}
              onChange={e => setNewMod({...newMod, brand: e.target.value})} style={inputStyle} />
            <textarea placeholder="Notizen..." value={newMod.notes}
              onChange={e => setNewMod({...newMod, notes: e.target.value})}
              style={{ ...inputStyle, height: '80px', resize: 'none' }} />
            <button onClick={addMod} style={{
              width: '100%', background: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '8px', padding: '14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
            }}>Speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}