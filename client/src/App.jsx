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
  IconArrowRight, IconUserCircle, IconPhone, IconScissors, IconMapPin, IconBrandWhatsapp 
} from '@tabler/icons-react';
import '@mantine/dates/styles.css'; 
import './App.css'; 

import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

// Imagen de fondo de alta calidad
const heroImage = "https://images.unsplash.com/photo-1503951914875-452162b7f30a?q=80&w=2070&auto=format&fit=crop";

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

// Estilos personalizados para inputs modernos (Solución al error visual)
const inputStyles = {
    input: {
        background: '#222', 
        border: '1px solid #444', 
        color: 'white', 
        height: '50px',
        paddingLeft: '50px', // <--- ESTO ARREGLA QUE EL ICONO SE MONTE EN EL TEXTO
        fontSize: '1rem'
    },
    label: {
        color: '#888', 
        marginBottom: '8px', 
        fontSize: '0.85rem', 
        letterSpacing: '1px',
        fontWeight: 600
    }
};

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
                // Ajuste de fecha para comparación correcta
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
          for (let h = 9; h < 20; h++) { // Horario 9am a 8pm
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
    if (form.clientDni.length !== 8) return notifications.show({ message: 'DNI inválido (8 dígitos).', color: 'red' });

    setLoading(true);
    try {
        // --- CORRECCIÓN DE FECHA ---
        // Construimos la fecha manualmente para evitar el cambio de día por zona horaria
        const [hh, mm] = form.time.split(':');
        const year = form.date.getFullYear();
        const month = form.date.getMonth();
        const day = form.date.getDate();
        
        // Creamos la fecha exacta en hora local
        const finalDate = new Date(year, month, day, parseInt(hh), parseInt(mm));

        await api.post('/appointments', { 
            ...form, 
            dateISO: finalDate, // Axios enviará esto y el backend lo procesará
            barberId: parseInt(form.barberId) 
        });

        notifications.show({ title: '¡Reserva Exitosa!', message: 'Te esperamos en la barbería.', color: 'green', icon: <IconCheck/> });
        setForm({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: null, date: null, time: null });
        setAvailableSlots([]);
        
        // Scroll arriba suavemente
        window.scrollTo({top: 0, behavior: 'smooth'});

    } catch (error) {
        notifications.show({ title: 'Error', message: error.response?.data?.error || 'Error técnico.', color: 'red' });
    }
    setLoading(false);
  };

  const handleSearch = async () => {
     if(!searchDni || searchDni.length !== 8) return notifications.show({message:'Ingresa un DNI válido.', color:'yellow'});
     setLoading(true);
     try {
       const res = await api.get(`/appointments/dni/${searchDni}`); 
       setMyAppointments(res.data);
       if(res.data.length === 0) notifications.show({message: 'No tienes citas registradas.', color: 'blue'});
     } catch (error) { notifications.show({message: 'Error al buscar.', color: 'red'}); }
     setLoading(false);
  };

  const handleCancelClient = async (apptId) => {
      if(!window.confirm("¿Seguro que deseas cancelar tu cita?")) return;
      try { await api.put(`/appointments/${apptId}/cancel`); notifications.show({ message: 'Cita cancelada correctamente.', color: 'orange', icon: <IconX/> }); handleSearch(); } catch (error) { notifications.show({ message: 'Error al cancelar.', color: 'red' }); }
  };

  const handleRescheduleClient = async (apptId) => {
      const newDate = rescheduleDates[apptId];
      if(!newDate) return notifications.show({ message: 'Selecciona una nueva fecha y hora.', color: 'red' });
      try { await api.put(`/appointments/${apptId}`, { newDateISO: newDate }); notifications.show({ title: '¡Listo!', message:'Tu cita ha sido reprogramada.', color: 'green' }); setRescheduleDates(prev => { const n = { ...prev }; delete n[apptId]; return n; }); handleSearch(); } catch (error) { notifications.show({ message: 'Error al reprogramar.', color: 'red' }); }
  };

  return (
    <div className="app-container" style={{backgroundColor: '#0a0a0a', minHeight: '100vh', color: 'white'}}>
      
      {/* --- HEADER MODERNO GLASSMORPHISM --- */}
      <header style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '80px', 
          background: 'rgba(10, 10, 10, 0.7)', backdropFilter: 'blur(15px)', 
          borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', transition: 'all 0.3s ease'
      }}>
          <Container size="xl" style={{width: '100%'}}>
            <Group justify="space-between" h="100%">
                <Group gap={8} style={{cursor:'pointer'}} onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <div style={{background: 'var(--primary-gold)', borderRadius: '8px', padding: '6px'}}>
                        <IconScissors size={24} color="black" stroke={2.5}/>
                    </div>
                    <Text size="xl" fw={900} c="white" style={{letterSpacing:'-0.5px', fontFamily: 'Montserrat, sans-serif'}}>
                        BARBER<span style={{color:'var(--primary-gold)'}}>PRO</span>
                    </Text>
                </Group>
                <Group gap="md" visibleFrom="sm">
                    <Button variant="subtle" color="gray" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})}>Reservar</Button>
                    <Button variant="subtle" color="gray" onClick={() => document.getElementById('my-appointments').scrollIntoView({behavior:'smooth'})}>Mis Citas</Button>
                    <Button variant="outline" color="yellow" radius="xl" onClick={() => navigate('/admin')} leftSection={<IconUserCircle size={18}/>} styles={{root:{borderColor: 'var(--primary-gold)', color: 'var(--primary-gold)', '&:hover': {backgroundColor: 'rgba(196, 155, 99, 0.1)'}}}}>Soy Admin</Button>
                </Group>
            </Group>
          </Container>
      </header>

      {/* --- HERO SECTION --- */}
      <section style={{
          position: 'relative', height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(to bottom, rgba(0,0,0,0.3), #0a0a0a), url(${heroImage}) center/cover no-repeat`
      }}>
          <Container size="md" style={{textAlign: 'center', zIndex: 2, position: 'relative', top: '20px'}}>
              <Badge variant="filled" color="yellow" size="lg" mb="xl" style={{color: 'black', fontWeight: 'bold'}}>MEJOR BARBERÍA 2026</Badge>
              <Title order={1} style={{fontSize: '3.5rem', lineHeight: 1.1, color: 'white', marginBottom: '24px', textShadow: '0 4px 30px rgba(0,0,0,0.5)', fontFamily: 'Montserrat, sans-serif'}}>
                  Tu estilo define <br/> <span style={{color: 'var(--primary-gold)', fontStyle: 'italic'}}>tu legado.</span>
              </Title>
              <Text size="xl" c="gray" mb="xl" maw={600} mx="auto">Agenda tu cita en segundos. Los mejores barberos, los mejores cortes.</Text>
              <Button size="xl" radius="xl" className="btn-glow" color="yellow" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})} rightSection={<IconArrowRight/>} styles={{root: {background: 'var(--primary-gold)', color: 'black', fontWeight: 700}}}>RESERVAR AHORA</Button>
          </Container>
      </section>

      {/* --- ÁREA PRINCIPAL --- */}
      <Container size="xl" id="booking-area" py={80}>
        <Grid gutter={50}>
            
            {/* IZQUIERDA: FORMULARIO DE RESERVA */}
            <Grid.Col span={{ base: 12, md: 7 }}>
                <Group mb="xl" align="center">
                    <IconCalendarEvent size={32} color="var(--primary-gold)"/>
                    <Title order={2} c="white" style={{fontFamily: 'Montserrat, sans-serif'}}>NUEVA RESERVA</Title>
                </Group>
                
                <Card padding={30} radius="xl" style={{background: '#141414', border: '1px solid #222', boxShadow: '0 20px 40px rgba(0,0,0,0.4)'}}>
                    <Stack gap="lg">
                        {/* DATOS CLIENTE */}
                        <Grid>
                            <Grid.Col span={12}>
                                <TextInput label="NOMBRE COMPLETO" placeholder="Ej. Carlos Rivera" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} 
                                    leftSection={<IconUser size={18} color="var(--primary-gold)"/>}
                                    styles={inputStyles}
                                />
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <TextInput label="DNI (8 DÍGITOS)" placeholder="12345678" maxLength={8} value={form.clientDni} onChange={(e) => setForm({...form, clientDni: e.target.value.replace(/\D/g, '')})} 
                                    leftSection={<IconId size={18} color="gray"/>}
                                    styles={inputStyles}
                                />
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <TextInput label="CELULAR" placeholder="999..." maxLength={9} value={form.clientPhone} onChange={(e) => setForm({...form, clientPhone: e.target.value.replace(/\D/g, '')})} 
                                    leftSection={<IconPhone size={18} color="gray"/>}
                                    styles={inputStyles}
                                />
                            </Grid.Col>
                        </Grid>

                        {/* SELECTOR SERVICIO */}
                        <Select label="SERVICIO" placeholder="Selecciona un servicio" data={servicios} value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})} 
                            leftSection={<IconScissors size={18} color="var(--primary-gold)"/>}
                            styles={{...inputStyles, dropdown:{background:'#222', color:'white', border:'1px solid #444'}}}
                        />
                        
                        {/* SELECTOR BARBEROS (Grid Visual) */}
                        <Box>
                            <Text size="sm" c="#888" fw={700} mb="sm" style={{letterSpacing:'1px', textTransform:'uppercase'}}>Elige tu Barbero</Text>
                            {barberos.length > 0 ? (
                            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                                {barberos.map(barber => {
                                    const isSelected = form.barberId === barber.id;
                                    return (
                                    <UnstyledButton key={barber.id} onClick={() => setForm({...form, barberId: barber.id})}
                                        style={{
                                            padding: '15px', borderRadius: '12px',
                                            background: isSelected ? 'rgba(196, 155, 99, 0.15)' : '#1a1a1a',
                                            border: `1px solid ${isSelected ? 'var(--primary-gold)' : '#333'}`,
                                            transition: 'all 0.2s ease', textAlign: 'center',
                                            transform: isSelected ? 'translateY(-2px)' : 'none'
                                        }}>
                                        <Avatar src={barber.imagenUrl} size={50} radius={50} mx="auto" mb="xs" style={{border: isSelected ? '2px solid var(--primary-gold)' : '2px solid transparent'}}>{barber.nombre.charAt(0)}</Avatar>
                                        <Text size="sm" fw={700} c={isSelected ? 'var(--primary-gold)' : 'white'} lineClamp={1}>{barber.nombre}</Text>
                                    </UnstyledButton>
                                    )
                                })}
                            </SimpleGrid>
                            ) : <Text c="dimmed" size="sm">Cargando barberos...</Text>}
                        </Box>

                        {/* FECHA Y HORARIOS */}
                        <DatePickerInput label="FECHA DE CITA" placeholder={form.barberId ? "Elige un día" : "Primero selecciona un barbero"} minDate={new Date()} disabled={!form.barberId} value={form.date} onChange={(d) => setForm({...form, date: d})} 
                            leftSection={<IconCalendarEvent size={18} color={form.barberId ? "var(--primary-gold)" : "gray"}/>}
                            styles={inputStyles}
                        />

                        {form.date && form.barberId && (
                            <Box style={{background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border:'1px solid #333'}}>
                                <Text size="sm" c="#bbb" fw={700} mb="md" align="center">HORARIOS DISPONIBLES</Text>
                                {availableSlots.length > 0 ? (
                                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(70px, 1fr))', gap:'10px'}}>
                                        {availableSlots.map((slot) => (
                                            <Button key={slot.time} radius="md" size="xs" variant={form.time === slot.time ? "filled" : "outline"} color="yellow" disabled={slot.taken} onClick={() => setForm({...form, time: slot.time})} 
                                                styles={{root: { 
                                                    borderColor: slot.taken ? 'transparent' : '#444', 
                                                    backgroundColor: form.time === slot.time ? 'var(--primary-gold)' : 'transparent',
                                                    color: slot.taken ? '#444' : (form.time === slot.time ? 'black' : 'white'), 
                                                    textDecoration: slot.taken ? 'line-through' : 'none'
                                                }}}>
                                                {slot.time}
                                            </Button>
                                        ))}
                                    </div>
                                ) : <Text c="dimmed" size="sm" align="center">Agenda llena para hoy.</Text>}
                            </Box>
                        )}

                        <Button fullWidth size="xl" radius="md" color="yellow" mt="md" onClick={handleSubmit} loading={loading} disabled={!form.time} styles={{root: {background: 'var(--primary-gold)', color: 'black', fontWeight: 800}}}>
                            CONFIRMAR CITA
                        </Button>
                    </Stack>
                </Card>
            </Grid.Col>

            {/* DERECHA: GESTIONAR CITAS */}
            <Grid.Col span={{ base: 12, md: 5 }} id="my-appointments">
                <Group mb="xl" align="center">
                    <IconSearch size={32} color="var(--primary-gold)"/>
                    <Title order={2} c="white" style={{fontFamily: 'Montserrat, sans-serif'}}>MIS RESERVAS</Title>
                </Group>
                
                <Card padding={30} radius="xl" style={{background: '#141414', border: '1px solid #222', minHeight:'500px'}}>
                    <Text c="dimmed" mb="lg">Ingresa tu DNI para ver el estado de tu cita, reprogramar o cancelar.</Text>
                    
                    <Group mb="xl" align="flex-start">
                        <TextInput placeholder="DNI (8 dígitos)" value={searchDni} onChange={(e) => setSearchDni(e.target.value.replace(/\D/g, ''))} maxLength={8} style={{flex:1}} 
                            leftSection={<IconId size={18} color="gray"/>}
                            styles={inputStyles}
                        />
                        <Button onClick={handleSearch} size="lg" color="gray" loading={loading} style={{height: '50px'}}>VER</Button>
                    </Group>

                    <Stack gap="md">
                        {myAppointments.length > 0 ? myAppointments.map((appt) => (
                            <Card key={appt.id} padding="lg" radius="lg" style={{background:'#1f1f1f', borderLeft: `4px solid ${appt.estado==='PENDIENTE'?'var(--primary-gold)':'#333'}`, transition: 'transform 0.2s', '&:hover': {transform: 'translateY(-2px)'}}}>
                                <Group justify="space-between" mb="xs">
                                    <div>
                                        <Text fw={800} c="white" size="lg">{appt.service?.nombre}</Text>
                                        <Text size="xs" c="dimmed">Barbero: <span style={{color:'var(--primary-gold)'}}>{appt.barber?.nombre}</span></Text>
                                    </div>
                                    <Badge size="md" radius="sm" color={appt.estado==='PENDIENTE'?'yellow':'gray'} variant="light">{appt.estado}</Badge>
                                </Group>
                                
                                <Group gap="xs" mb="md" style={{background:'rgba(0,0,0,0.2)', padding:'8px', borderRadius:'6px', border: '1px solid #333'}}>
                                    <IconCalendarEvent size={16} color="gray"/>
                                    <Text size="sm" c="white" fw={500}>{new Date(appt.fechaInicio).toLocaleDateString()}</Text>
                                    <div style={{width:'1px', height:'12px', background:'#444', margin:'0 5px'}}></div>
                                    <IconClock size={16} color="gray"/>
                                    <Text size="sm" c="white" fw={500}>{new Date(appt.fechaInicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                                </Group>

                                {appt.estado === 'PENDIENTE' && (
                                    <div style={{borderTop:'1px solid #333', paddingTop:'15px', marginTop: '5px'}}>
                                        <Text size="xs" c="dimmed" mb={5}>¿Necesitas cambiar la fecha?</Text>
                                        <DateTimePicker placeholder="Elige nueva fecha" valueFormat="DD/MM HH:mm" minDate={new Date()} 
                                            value={rescheduleDates[appt.id] || null} onChange={(date) => setRescheduleDates({...rescheduleDates, [appt.id]: date})}
                                            styles={{input:{background:'#252525', border:'1px solid #444', color:'white', fontSize:'0.8rem'}}} mb="sm"
                                        />
                                        <Group grow>
                                            <Button variant="light" size="xs" color="yellow" disabled={!rescheduleDates[appt.id]} onClick={() => handleRescheduleClient(appt.id)}>Guardar Cambio</Button>
                                            <Button variant="subtle" size="xs" color="red" onClick={() => handleCancelClient(appt.id)}>Cancelar Cita</Button>
                                        </Group>
                                    </div>
                                )}
                            </Card>
                        )) : (searchDni && !loading && <Text c="dimmed" align="center" mt="xl" fs="italic">No se encontraron citas con este DNI.</Text>)}
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