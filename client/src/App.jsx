import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Title, TextInput, Select, Button, Card, Text, Badge, Group, Container, Grid, Anchor, Stack, 
  Avatar, SimpleGrid, UnstyledButton, Box, ActionIcon 
} from '@mantine/core';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { 
  IconCalendarEvent, IconClock, IconSearch, IconUser, IconX, IconId, IconCheck, 
  IconArrowRight, IconUserCircle, IconPhone, IconScissors, IconMapPin 
} from '@tabler/icons-react';
import '@mantine/dates/styles.css'; 
import './App.css'; 

import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

const heroImage = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop";

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

// --- COMPONENTE HOME ---
function Home() {
  const navigate = useNavigate(); 
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: null, date: null, time: null });
  const [servicios, setServicios] = useState([]); 
  const [barberos, setBarberos] = useState([]); 
  const [availableSlots, setAvailableSlots] = useState([]);

  // Estados "Mis Citas"
  const [searchDni, setSearchDni] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [rescheduleDates, setRescheduleDates] = useState({}); 

  // 1. CARGAR DATOS
  useEffect(() => {
    api.get('/services').then(res => {
        setServicios(res.data.map(s => ({ value: s.id.toString(), label: `${s.nombre} - S/.${s.precio}`, duracion: s.duracion })));
    }).catch(console.error);

    api.get('/barbers').then(res => setBarberos(res.data)).catch(console.error);
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
                  slots.push({ time: timeString, taken: takenTimes.includes(timeString) });
              });
          }
          setAvailableSlots(slots);
      } catch (error) { console.error("Error slots", error); }
  };

  const handleSubmit = async () => {
    if (!form.clientName || !form.clientDni || !form.clientPhone || !form.serviceId || !form.barberId || !form.date || !form.time) {
        return notifications.show({ message: 'Por favor, completa todos los campos.', color: 'red' });
    }
    if (form.clientDni.length !== 8) return notifications.show({ message: 'DNI inválido.', color: 'red' });

    // CORRECCIÓN DE FECHA: Crear fecha local explícita
    const [hh, mm] = form.time.split(':');
    const finalDate = new Date(form.date);
    finalDate.setHours(parseInt(hh), parseInt(mm), 0, 0); 

    setLoading(true);
    try {
        await api.post('/appointments', { ...form, dateISO: finalDate, barberId: parseInt(form.barberId) });
        notifications.show({ title: '¡Reserva Exitosa!', message: 'Te esperamos.', color: 'green', icon: <IconCheck/> });
        setForm({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: null, date: null, time: null });
        setAvailableSlots([]);
        if(searchDni) handleSearch();
    } catch (error) {
        notifications.show({ title: 'Error', message: error.response?.data?.error || 'Error técnico.', color: 'red' });
    }
    setLoading(false);
  };

  const handleSearch = async () => {
     if(!searchDni || searchDni.length !== 8) return notifications.show({message:'DNI inválido', color:'yellow'});
     setLoading(true);
     try {
       const res = await api.get(`/appointments/dni/${searchDni}`); 
       setMyAppointments(res.data);
       if(res.data.length === 0) notifications.show({message: 'Sin citas encontradas.', color: 'yellow'});
     } catch (error) { notifications.show({message: 'Error al buscar.', color: 'red'}); }
     setLoading(false);
  };

  const handleCancelClient = async (apptId) => {
      if(!window.confirm("¿Cancelar cita?")) return;
      try { await api.put(`/appointments/${apptId}/cancel`); notifications.show({ message: 'Cita cancelada.', color: 'orange', icon: <IconX/> }); handleSearch(); } catch (error) { notifications.show({ message: 'Error.', color: 'red' }); }
  };

  const handleRescheduleClient = async (apptId) => {
      const newDate = rescheduleDates[apptId];
      if(!newDate) return notifications.show({ message: 'Selecciona fecha.', color: 'red' });
      try { await api.put(`/appointments/${apptId}`, { newDateISO: newDate }); notifications.show({ title: '¡Listo!', color: 'green' }); setRescheduleDates(prev => { const n = { ...prev }; delete n[apptId]; return n; }); handleSearch(); } catch (error) { notifications.show({ message: 'Error.', color: 'red' }); }
  };

  return (
    <div className="app-container">
      {/* --- HEADER MODERNO GLASS --- */}
      <header style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '80px', 
          background: 'rgba(10, 10, 10, 0.8)', backdropFilter: 'blur(12px)', 
          borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 1000, display: 'flex', alignItems: 'center'
      }}>
          <Container size="xl" style={{width: '100%'}}>
            <Group justify="space-between" h="100%">
                <Group gap={5} style={{cursor:'pointer'}} onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <IconScissors size={32} color="var(--primary-gold)" stroke={2.5}/>
                    <Text size="xl" fw={900} c="white" style={{letterSpacing:'-1px'}}>BARBER<span style={{color:'var(--primary-gold)'}}>SHOP</span>.</Text>
                </Group>
                <Group gap="xl" visibleFrom="sm">
                    <Button variant="subtle" color="gray" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})}>Servicios</Button>
                    <Button variant="outline" color="yellow" radius="xl" onClick={() => navigate('/admin')} leftSection={<IconUserCircle size={18}/>}>Admin Acceso</Button>
                </Group>
            </Group>
          </Container>
      </header>

      {/* --- HERO SECTION --- */}
      <section style={{
          position: 'relative', height: '650px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(10,10,10,1)), url(${heroImage}) center/cover no-repeat`
      }}>
          <Container size="md" style={{textAlign: 'center', zIndex: 2}}>
              <Badge variant="gradient" gradient={{ from: 'yellow', to: 'orange' }} size="xl" mb="xl">PREMIUM CUTS & SHAVES</Badge>
              <Title order={1} style={{fontSize: '4rem', lineHeight: 1.1, color: 'white', marginBottom: '20px', textShadow: '0 4px 20px rgba(0,0,0,0.5)'}}>
                  Tu Estilo, <br/> <span style={{color: 'var(--primary-gold)', fontStyle: 'italic'}}>Nuestra Maestría.</span>
              </Title>
              <Text size="xl" c="dimmed" mb="xl" maw={600} mx="auto">Reserva tu cita en segundos y vive la experiencia de una barbería de clase mundial.</Text>
              <Button size="xl" radius="xl" color="yellow" className="btn-glow" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})} rightSection={<IconArrowRight/>}>RESERVAR AHORA</Button>
          </Container>
      </section>

      {/* --- ÁREA PRINCIPAL --- */}
      <Container size="xl" id="booking-area" py={80}>
        <Grid gutter={60}>
            
            {/* IZQUIERDA: FORMULARIO */}
            <Grid.Col span={{ base: 12, md: 7 }}>
                <Group mb="xl"><IconCalendarEvent size={32} color="var(--primary-gold)"/><Title order={2} c="white">RESERVAR CITA</Title></Group>
                
                <Card padding="xl" radius="xl" style={{background: '#151515', border: '1px solid #333'}}>
                    <Stack gap="lg">
                        <TextInput label="NOMBRE COMPLETO" placeholder="Tu nombre" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} 
                            leftSection={<IconUser size={18} color="var(--primary-gold)"/>}
                            styles={{input:{background:'#222', border:'1px solid #444', color:'white', height:'50px'}, label:{color:'#888', marginBottom:'5px', fontSize:'0.8rem', letterSpacing:'1px'}}}
                        />
                        
                        <Grid>
                            <Grid.Col span={6}>
                                <TextInput label="DNI (8 DÍGITOS)" placeholder="12345678" maxLength={8} value={form.clientDni} onChange={(e) => setForm({...form, clientDni: e.target.value.replace(/\D/g, '')})} 
                                    leftSection={<IconId size={18} color="gray"/>}
                                    styles={{input:{background:'#222', border:'1px solid #444', color:'white', height:'50px'}, label:{color:'#888', marginBottom:'5px', fontSize:'0.8rem'}}}
                                />
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <TextInput label="CELULAR" placeholder="999..." maxLength={9} value={form.clientPhone} onChange={(e) => setForm({...form, clientPhone: e.target.value.replace(/\D/g, '')})} 
                                    leftSection={<IconPhone size={18} color="gray"/>}
                                    styles={{input:{background:'#222', border:'1px solid #444', color:'white', height:'50px'}, label:{color:'#888', marginBottom:'5px', fontSize:'0.8rem'}}}
                                />
                            </Grid.Col>
                        </Grid>

                        <Select label="SERVICIO" placeholder="Selecciona un servicio" data={servicios} value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})} 
                            leftSection={<IconScissors size={18} color="var(--primary-gold)"/>}
                            styles={{input:{background:'#222', border:'1px solid #444', color:'white', height:'50px'}, label:{color:'#888', marginBottom:'5px', fontSize:'0.8rem'}, dropdown:{background:'#222', color:'white', border:'1px solid #444'}}}
                        />
                        
                        {/* SELECTOR BARBEROS */}
                        <Box>
                            <Text size="xs" c="#888" fw={700} mb="sm" style={{letterSpacing:'1px'}}>ELIGE TU BARBERO</Text>
                            {barberos.length > 0 ? (
                            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                                {barberos.map(barber => {
                                    const isSelected = form.barberId === barber.id;
                                    return (
                                    <UnstyledButton key={barber.id} onClick={() => setForm({...form, barberId: barber.id})}
                                        style={{
                                            padding: '15px', borderRadius: '16px',
                                            background: isSelected ? 'linear-gradient(145deg, #2a2a2a, #1a1a1a)' : '#1a1a1a',
                                            border: `2px solid ${isSelected ? 'var(--primary-gold)' : '#333'}`,
                                            transition: 'all 0.3s ease', textAlign: 'center',
                                            transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                                        }}>
                                        <Avatar src={barber.imagenUrl} size={60} radius={60} mx="auto" mb="sm" style={{border: isSelected ? '2px solid var(--primary-gold)' : '2px solid #333'}}>{barber.nombre.charAt(0)}</Avatar>
                                        <Text size="sm" fw={700} c="white">{barber.nombre}</Text>
                                    </UnstyledButton>
                                    )
                                })}
                            </SimpleGrid>
                            ) : <Text c="dimmed" size="sm">Cargando barberos...</Text>}
                        </Box>

                        <DatePickerInput label="FECHA DE CITA" placeholder={form.barberId ? "Elige un día" : "Primero elige barbero"} minDate={new Date()} disabled={!form.barberId} value={form.date} onChange={(d) => setForm({...form, date: d})} 
                            leftSection={<IconCalendarEvent size={18} color={form.barberId ? "var(--primary-gold)" : "gray"}/>}
                            styles={{input:{background:'#222', border:'1px solid #444', color:'white', height:'50px'}, label:{color:'#888', marginBottom:'5px', fontSize:'0.8rem'}}}
                        />

                        {form.date && form.barberId && (
                            <Box>
                                <Text size="xs" c="#888" fw={700} mb="sm" style={{letterSpacing:'1px'}}>HORARIOS DISPONIBLES</Text>
                                {availableSlots.length > 0 ? (
                                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:'10px'}}>
                                        {availableSlots.map((slot) => (
                                            <Button key={slot.time} radius="md" variant={form.time === slot.time ? "filled" : "default"} color="yellow" disabled={slot.taken} onClick={() => setForm({...form, time: slot.time})} 
                                                styles={{root: { 
                                                    borderColor: slot.taken ? '#333' : '#444', 
                                                    backgroundColor: form.time === slot.time ? 'var(--primary-gold)' : 'transparent',
                                                    color: slot.taken ? '#444' : 'white', 
                                                    textDecoration: slot.taken ? 'line-through' : 'none'
                                                }}}>
                                                {slot.time}
                                            </Button>
                                        ))}
                                    </div>
                                ) : <Text c="dimmed" size="sm">Agenda llena para hoy.</Text>}
                            </Box>
                        )}

                        <Button fullWidth size="xl" radius="md" color="yellow" mt="xl" onClick={handleSubmit} loading={loading} disabled={!form.time} style={{boxShadow: '0 10px 20px rgba(196, 155, 99, 0.2)'}}>
                            CONFIRMAR CITA
                        </Button>
                    </Stack>
                </Card>
            </Grid.Col>

            {/* DERECHA: MIS CITAS */}
            <Grid.Col span={{ base: 12, md: 5 }}>
                <Group mb="xl"><IconSearch size={32} color="var(--primary-gold)"/><Title order={2} c="white">MIS RESERVAS</Title></Group>
                
                <Card padding="xl" radius="xl" style={{background: '#151515', border: '1px solid #333', minHeight:'500px'}}>
                    <Text c="dimmed" mb="lg">Ingresa tu DNI para gestionar tus citas.</Text>
                    <Group mb="xl">
                        <TextInput placeholder="DNI (8 dígitos)" value={searchDni} onChange={(e) => setSearchDni(e.target.value.replace(/\D/g, ''))} maxLength={8} style={{flex:1}} 
                            leftSection={<IconId size={18}/>}
                            styles={{input:{background:'#222', color:'white', border:'1px solid #444', height:'50px'}}}
                        />
                        <Button onClick={handleSearch} size="lg" color="gray" loading={loading}>VER</Button>
                    </Group>

                    <Stack gap="md">
                        {myAppointments.length > 0 ? myAppointments.map((appt) => (
                            <Card key={appt.id} padding="lg" radius="lg" style={{background:'#222', borderLeft: `4px solid ${appt.estado==='PENDIENTE'?'var(--primary-gold)':'#444'}`}}>
                                <Group justify="space-between" mb="xs">
                                    <Text fw={700} c="white" size="lg">{appt.service?.nombre}</Text>
                                    <Badge color={appt.estado==='PENDIENTE'?'yellow':'gray'}>{appt.estado}</Badge>
                                </Group>
                                <Text size="sm" c="dimmed" mb="md">Barbero: <span style={{color:'white'}}>{appt.barber?.nombre}</span></Text>
                                
                                <Group gap="xs" mb="md" style={{background:'rgba(255,255,255,0.05)', padding:'10px', borderRadius:'8px'}}>
                                    <IconCalendarEvent size={18} color="var(--primary-gold)"/>
                                    <Text size="sm" c="white" fw={600}>{dayjs(appt.fechaInicio).format('DD [de] MMMM')}</Text>
                                    <div style={{width:'1px', height:'15px', background:'#555', margin:'0 10px'}}></div>
                                    <IconClock size={18} color="var(--primary-gold)"/>
                                    <Text size="sm" c="white" fw={600}>{dayjs(appt.fechaInicio).format('HH:mm')}</Text>
                                </Group>

                                {appt.estado === 'PENDIENTE' && (
                                    <div style={{borderTop:'1px solid #333', paddingTop:'15px'}}>
                                        <DateTimePicker placeholder="Reprogramar fecha" valueFormat="DD/MM HH:mm" minDate={new Date()} 
                                            value={rescheduleDates[appt.id] || null} onChange={(date) => setRescheduleDates({...rescheduleDates, [appt.id]: date})}
                                            styles={{input:{background:'#1a1a1a', border:'1px solid #444', color:'white'}}} mb="sm"
                                        />
                                        <Group grow>
                                            <Button variant="light" color="yellow" disabled={!rescheduleDates[appt.id]} onClick={() => handleRescheduleClient(appt.id)}>Guardar Cambio</Button>
                                            <Button variant="subtle" color="red" onClick={() => handleCancelClient(appt.id)}>Cancelar</Button>
                                        </Group>
                                    </div>
                                )}
                            </Card>
                        )) : (searchDni && !loading && <Text c="dimmed" align="center" mt="xl">No se encontraron citas.</Text>)}
                    </Stack>
                </Card>
            </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}

function App() { return <BrowserRouter><Routes><Route path="/" element={<Home />}/><Route path="/admin" element={<AdminLogin />}/><Route path="/admin/dashboard" element={<AdminDashboard />}/></Routes></BrowserRouter>; }
export default App;