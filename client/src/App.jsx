import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Title, TextInput, Select, Button, Card, Text, Badge, Group, Container, Grid, Anchor, Stack, Avatar, SimpleGrid, UnstyledButton, Box } from '@mantine/core';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconClock, IconSearch, IconUser, IconX, IconId, IconCheck, IconArrowRight, IconUserCircle } from '@tabler/icons-react';
import '@mantine/dates/styles.css'; 
import './App.css'; 

import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

const heroImage = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1000&auto=format&fit=crop";

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

// --- COMPONENTE HOME ---
function Home() {
  const navigate = useNavigate(); 
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: null, date: null, time: null });
  const [servicios, setServicios] = useState([]); 
  const [barberos, setBarberos] = useState([]); // Array completo de objetos barbero
  const [availableSlots, setAvailableSlots] = useState([]);

  // Estados "Mis Citas"
  const [searchDni, setSearchDni] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [rescheduleDates, setRescheduleDates] = useState({}); 


  // 1. CARGAR DATOS INICIALES
  useEffect(() => {
    // Servicios
    api.get('/services').then(res => {
        const serviciosMapeados = res.data.map(s => ({
          value: s.id.toString(),
          label: `${s.nombre} (${s.duracion} min) - S/.${s.precio}`,
          duracion: s.duracion
        }));
        setServicios(serviciosMapeados);
    }).catch(console.error);

    // Barberos (Solo los activos)
    api.get('/barbers').then(res => {
        setBarberos(res.data);
    }).catch(console.error);
  }, []);

  // 2. GENERAR HORARIOS
  useEffect(() => {
    if (form.date && form.barberId) {
        setForm(f => ({...f, time: null}));
        calculateSlots(form.date, form.barberId);
    } else {
        setAvailableSlots([]);
    }
  }, [form.date, form.barberId]);

  const calculateSlots = async (dateInput, selectedBarberId) => {
      try {
          if (!dateInput) return;
          const selectedDate = new Date(dateInput); 
          const res = await api.get('/appointments');
          
          const takenTimes = res.data
            .filter(a => {
                const citaDate = new Date(a.fechaInicio);
                return citaDate.toDateString() === selectedDate.toDateString() 
                    && a.estado !== 'CANCELADO'
                    && a.barberId === parseInt(selectedBarberId);
            })
            .map(a => {
                const d = new Date(a.fechaInicio);
                return `${d.getHours()}:${d.getMinutes() === 0 ? '00' : d.getMinutes()}`;
            });

          const slots = [];
          for (let h = 9; h < 20; h++) {
              ['00', '30'].forEach(m => {
                  const timeString = `${h}:${m}`;
                  slots.push({
                      time: timeString,
                      taken: takenTimes.includes(timeString)
                  });
              });
          }
          setAvailableSlots(slots);
      } catch (error) { console.error("Error slots", error); }
  };

  const handleSubmit = async () => {
    // VALIDACIONES CORRECTAS
    if (!form.clientName || !form.clientDni || !form.clientPhone || !form.serviceId || !form.barberId || !form.date || !form.time) {
        return notifications.show({ message: 'Por favor, completa todos los campos de la reserva.', color: 'red' });
    }
    if (form.clientDni.length !== 8) return notifications.show({ message: 'El DNI debe tener 8 dígitos.', color: 'red' });
    if (form.clientPhone.length !== 9) return notifications.show({ message: 'El celular debe tener 9 dígitos.', color: 'red' });

    const [hh, mm] = form.time.split(':');
    const finalDate = new Date(form.date);
    finalDate.setHours(parseInt(hh), parseInt(mm), 0);

    setLoading(true);
    try {
        // El backend espera barberId como número
        await api.post('/appointments', { ...form, dateISO: finalDate, barberId: parseInt(form.barberId) });
        notifications.show({ title: '¡Reserva Exitosa!', message: 'Te esperamos.', color: 'green', icon: <IconCheck/> });
        setForm({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: null, date: null, time: null });
        setAvailableSlots([]);
        if(searchDni) handleSearch();
    } catch (error) {
        // AQUÍ SE MOSTRARÁ EL ERROR 500 SI SIGUE PASANDO
        notifications.show({ 
            title: 'Error al reservar',
            message: error.response?.data?.error || 'Ocurrió un problema técnico. Intenta nuevamente.', 
            color: 'red' 
        });
        console.error("Error submit:", error);
    }
    setLoading(false);
  };

  // --- FUNCIONES CLIENTE (Buscar, Cancelar, Reprogramar) ---
  const handleSearch = async () => {
     if(!searchDni || searchDni.length !== 8) return notifications.show({message:'Ingresa un DNI válido de 8 dígitos', color:'yellow'});
     setLoading(true);
     try {
       const res = await api.get(`/appointments/dni/${searchDni}`); 
       setMyAppointments(res.data);
       if(res.data.length === 0) notifications.show({message: 'No se encontraron citas para este DNI', color: 'yellow'});
     } catch (error) { notifications.show({message: 'Error al buscar citas', color: 'red'}); }
     setLoading(false);
  };

  const handleCancelClient = async (apptId) => {
      if(!window.confirm("¿Seguro deseas cancelar?")) return;
      try { await api.put(`/appointments/${apptId}/cancel`); notifications.show({ message: 'Cita cancelada.', color: 'orange', icon: <IconX/> }); handleSearch(); } catch (error) { notifications.show({ message: 'No se pudo cancelar.', color: 'red' }); }
  };

  const handleRescheduleClient = async (apptId) => {
      const newDate = rescheduleDates[apptId];
      if(!newDate) return notifications.show({ message: 'Selecciona fecha y hora.', color: 'red' });
      try { await api.put(`/appointments/${apptId}`, { newDateISO: newDate }); notifications.show({ title: '¡Reprogramada!', color: 'green', icon: <IconCalendarEvent/> }); setRescheduleDates(prev => { const n = { ...prev }; delete n[apptId]; return n; }); handleSearch(); } catch (error) { notifications.show({ message: 'Error al reprogramar.', color: 'red' }); }
  };

  return (
    <div className="app-container">
      {/* Header y Hero igual que antes */}
      <header className="header-container"><Container size="xl"><Group justify="space-between" h="100%"><div className="logo" style={{fontSize:'1.8rem', fontWeight:900, color:'white', letterSpacing:'-1px'}}>BARBER<span style={{color:'var(--primary-gold)'}}>SHOP</span>.</div><Group gap="xl" visibleFrom="sm" className="header-links"><Anchor href="#" className="nav-link">Inicio</Anchor><Anchor href="#servicios" className="nav-link" onClick={(e)=>{e.preventDefault(); document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})}}>Servicios</Anchor></Group><Button variant="default" radius="xl" onClick={() => navigate('/admin')} leftSection={<IconUser size={16}/>} styles={{root:{borderColor:'#333', backgroundColor:'transparent', color:'white', '&:hover':{backgroundColor:'#222'}}}}>Admin</Button></Group></Container></header>
      <section className="hero-section" style={{textAlign:'center', padding:'80px 20px', background:`linear-gradient(to bottom, rgba(10,10,10,0.3), rgba(10,10,10,0.9)), url(${heroImage}) no-repeat center center`, backgroundSize:'cover', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Container size="md"><Badge variant="filled" color="yellow" size="lg" mb="md">PREMIUM BARBER EXPERIENCE</Badge><Title order={1} className="hero-title" style={{color:'white', marginBottom:'20px'}}>Tu Estilo,<br/> <span style={{color:'var(--primary-gold)'}}>Nuestra Pasión.</span></Title><Button size="xl" radius="md" className="btn-gold-pro" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})} leftSection={<IconCalendarEvent/>}>RESERVAR AHORA</Button></Container></section>

      {/* --- ÁREA PRINCIPAL --- */}
      <Container size="xl" id="booking-area" py={50}>
        <Grid gutter={50}>
            
            {/* FORMULARIO DE RESERVA (IZQUIERDA) */}
            <Grid.Col span={{ base: 12, md: 7 }}>
                <div>
                    <Group mb="lg" align="center"><IconCalendarEvent size={28} color="var(--primary-gold)"/><Title order={2} style={{fontWeight:800, letterSpacing:'-0.5px'}}>RESERVAR TU CITA</Title></Group>
                    <Card shadow="sm" padding="xl" radius="lg" style={{background:'#1a1a1a', border:'1px solid #333'}}>
                        <Stack gap="md">
                            <TextInput label="NOMBRE COMPLETO" placeholder="Ej. Juan Pérez" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc', fontWeight:600, fontSize:'0.9rem'}}}/>
                            <Grid>
                                <Grid.Col span={6}><TextInput label="DNI" maxLength={8} placeholder="8 dígitos" value={form.clientDni} onChange={(e) => setForm({...form, clientDni: e.target.value.replace(/\D/g, '')})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc', fontWeight:600, fontSize:'0.9rem'}}}/></Grid.Col>
                                <Grid.Col span={6}><TextInput label="CELULAR" maxLength={9} placeholder="9 dígitos" value={form.clientPhone} onChange={(e) => setForm({...form, clientPhone: e.target.value.replace(/\D/g, '')})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc', fontWeight:600, fontSize:'0.9rem'}}}/></Grid.Col>
                            </Grid>
                            <Select label="SERVICIO" placeholder="Selecciona un servicio" data={servicios} value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc', fontWeight:600, fontSize:'0.9rem'}, dropdown:{background:'#25262b', color:'white'}}} rightSection={<IconArrowRight size={16}/>}/>
                            
                            {/* --- NUEVO: SELECTOR VISUAL DE BARBEROS --- */}
                            <div>
                                <Text size="sm" c="#ccc" fw={600} mb="sm">ELIGE TU BARBERO:</Text>
                                {barberos.length > 0 ? (
                                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                                    {barberos.map(barber => {
                                        const isSelected = form.barberId === barber.id;
                                        return (
                                        <UnstyledButton key={barber.id} onClick={() => setForm({...form, barberId: barber.id})}
                                            style={{
                                                padding: '10px', borderRadius: '12px',
                                                background: isSelected ? 'rgba(196, 155, 99, 0.2)' : '#25262b',
                                                border: `2px solid ${isSelected ? 'var(--primary-gold)' : '#333'}`,
                                                transition: 'all 0.2s ease', textAlign: 'center'
                                            }}>
                                            <Avatar src={barber.imagenUrl} size={60} radius={60} mx="auto" mb="xs" style={{border: isSelected ? '2px solid var(--primary-gold)' : 'none'}}>
                                                {barber.nombre.charAt(0)}
                                            </Avatar>
                                            <Text size="sm" fw={700} c="white" lineClamp={1}>{barber.nombre}</Text>
                                        </UnstyledButton>
                                        )
                                    })}
                                </SimpleGrid>
                                ) : <Text c="dimmed" size="sm">No hay barberos disponibles.</Text>}
                            </div>

                            <DatePickerInput label="SELECCIONA FECHA" placeholder={form.barberId ? "Elige un día" : "Primero elige un barbero"} minDate={new Date()} disabled={!form.barberId} value={form.date} onChange={(d) => setForm({...form, date: d})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc', fontWeight:600, fontSize:'0.9rem'}}}/>

                            {form.date && form.barberId && (
                                <div>
                                    <Text size="sm" c="#ccc" mb="xs" fw={600}>HORARIOS DISPONIBLES:</Text>
                                    {availableSlots.length > 0 ? (
                                        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px'}}>
                                            {availableSlots.map((slot) => (
                                                <Button key={slot.time} compact radius="md" variant={form.time === slot.time ? "filled" : "outline"} color={form.time === slot.time ? "yellow" : "gray"} disabled={slot.taken} onClick={() => setForm({...form, time: slot.time})} styles={{root: { borderColor: slot.taken ? '#333' : '#c49b63', color: slot.taken ? '#555' : 'white', textDecoration: slot.taken ? 'line-through' : 'none', transition:'all 0.2s'}}}>{slot.time}</Button>
                                            ))}
                                        </div>
                                    ) : <Text c="dimmed" size="sm">No hay horarios disponibles hoy.</Text>}
                                </div>
                            )}

                            <Button fullWidth size="lg" radius="md" mt="md" onClick={handleSubmit} loading={loading} className="btn-gold-pro" disabled={!form.time}>CONFIRMAR RESERVA</Button>
                        </Stack>
                    </Card>
                </div>
            </Grid.Col>

            {/* GESTIONAR MIS CITAS (DERECHA) */}
            <Grid.Col span={{ base: 12, md: 5 }}>
                {/* ... (Esta sección queda visualmente igual que el código anterior para ahorrar espacio, ya que no pediste cambios aquí) ... */}
                <div><Group mb="lg" align="center"><IconSearch size={28} color="var(--primary-gold)"/><Title order={2} style={{fontWeight:800, letterSpacing:'-0.5px'}}>GESTIONAR MIS CITAS</Title></Group><Card shadow="sm" padding="xl" radius="lg" style={{background:'#1a1a1a', border:'1px solid #333', height:'100%'}}><Text c="dimmed" mb="md">Ingresa tu DNI para ver, reprogramar o cancelar.</Text><Group mb="xl"><TextInput placeholder="DNI (8 dígitos)" value={searchDni} onChange={(e) => setSearchDni(e.target.value.replace(/\D/g, ''))} maxLength={8} style={{flex:1}} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444', fontSize:'1rem', padding:'20px'}}} leftSection={<IconId color="gray"/>}/><Button onClick={handleSearch} size="lg" radius="md" className="btn-gold-pro" loading={loading}>BUSCAR</Button></Group><Stack gap="sm">{myAppointments.length > 0 ? myAppointments.map((appt) => (<Card key={appt.id} padding="lg" radius="md" className="appt-card-pro" style={{borderLeftColor: appt.estado === 'PENDIENTE'?'var(--primary-gold)': appt.estado==='COMPLETADO'?'#228be6':'green'}}><Group justify="space-between" mb="xs"><div><Text fw={700} c="white" size="lg">{appt.service?.nombre}</Text><Text size="xs" c="yellow">Barbero: {appt.barber?.nombre || 'No asignado'}</Text></div><Badge variant="dot" size="lg" color={appt.estado==='PENDIENTE'?'yellow': appt.estado==='COMPLETADO'?'blue':'green'}>{appt.estado}</Badge></Group><Group mb="md"><IconCalendarEvent size={18} color="gray"/><Text size="sm" c="#ccc">{new Date(appt.fechaInicio).toLocaleDateString()}</Text><IconClock size={18} color="gray" style={{marginLeft:'10px'}}/><Text size="sm" c="#ccc" fw={700}>{new Date(appt.fechaInicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text></Group>{appt.estado === 'PENDIENTE' && (<div style={{marginTop:'15px', paddingTop:'15px', borderTop:'1px solid #333'}}><Group grow mb="sm"><DateTimePicker placeholder="Nueva fecha" valueFormat="DD/MM HH:mm" minDate={new Date()} styles={{input:{background:'#111', border:'1px solid #444', color:'white'}}} value={rescheduleDates[appt.id] || null} onChange={(date) => setRescheduleDates({...rescheduleDates, [appt.id]: date})}/><Button variant="light" color="yellow" disabled={!rescheduleDates[appt.id]} onClick={() => handleRescheduleClient(appt.id)}>Guardar</Button></Group><Button variant="subtle" color="red" fullWidth leftSection={<IconX size={16}/>} onClick={() => handleCancelClient(appt.id)}>Cancelar Cita</Button></div>)}</Card>)) : (searchDni && !loading && <Text c="dimmed" align="center" py="xl">No se encontraron citas.</Text>)}</Stack></Card></div>
            </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}

function App() { return <BrowserRouter><Routes><Route path="/" element={<Home />}/><Route path="/admin" element={<AdminLogin />}/><Route path="/admin/dashboard" element={<AdminDashboard />}/></Routes></BrowserRouter>; }
export default App;