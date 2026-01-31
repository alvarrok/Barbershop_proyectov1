import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Title, TextInput, Select, Button, Card, Text, Badge, Group, Container, Grid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconClock, IconSearch, IconUser, IconX, IconDeviceMobile, IconId, IconCheck, IconUserCircle } from '@tabler/icons-react'; // IconUserCircle nuevo
import '@mantine/dates/styles.css'; 
import './App.css'; 

import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

const heroImage = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1000&auto=format&fit=crop";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

function Home() {
  const navigate = useNavigate(); 
  const [loading, setLoading] = useState(false);
  
  // AÑADIMOS barberId AL ESTADO
  const [form, setForm] = useState({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: '', date: null, time: null });
  
  const [searchDni, setSearchDni] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [servicios, setServicios] = useState([]); 
  const [barberos, setBarberos] = useState([]); // NUEVO ESTADO
  
  const [availableSlots, setAvailableSlots] = useState([]);

  // 1. CARGAR DATOS INICIALES (SERVICIOS Y BARBEROS)
  useEffect(() => {
    // Cargar Servicios
    api.get('/services').then(res => {
        const serviciosMapeados = res.data.map(s => ({
          value: s.id.toString(),
          label: `${s.nombre} (${s.duracion} min) - S/.${s.precio}`,
          duracion: s.duracion
        }));
        setServicios(serviciosMapeados);
    }).catch(console.error);

    // Cargar Barberos (NUEVO)
    api.get('/barbers').then(res => {
        const barberosMapeados = res.data.map(b => ({
            value: b.id.toString(),
            label: b.nombre
        }));
        setBarberos(barberosMapeados);
    }).catch(console.error);
  }, []);

  // 2. GENERAR HORARIOS (Ahora depende de FECHA Y BARBERO)
  useEffect(() => {
    // Solo calculamos si hay fecha Y barbero seleccionado
    if (form.date && form.barberId) {
        setForm(f => ({...f, time: null})); 
        calculateSlots(form.date, form.barberId);
    } else {
        setAvailableSlots([]);
    }
  }, [form.date, form.barberId]); // Se ejecuta si cambia la fecha O el barbero

  const calculateSlots = async (dateInput, selectedBarberId) => {
      try {
          if (!dateInput) return;
          const selectedDate = new Date(dateInput); 

          const res = await api.get('/appointments');
          
          // FILTRO INTELIGENTE:
          // 1. Coincide la fecha
          // 2. No está cancelada
          // 3. ¡ES DEL BARBERO SELECCIONADO!
          const takenTimes = res.data
            .filter(a => {
                const citaDate = new Date(a.fechaInicio);
                return citaDate.toDateString() === selectedDate.toDateString() 
                    && a.estado !== 'CANCELADO'
                    && a.barberId === parseInt(selectedBarberId); // <-- LA CLAVE
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
    // VALIDACIONES (Incluimos Barbero)
    if (!form.clientName || !form.serviceId || !form.barberId || !form.date || !form.time) return notifications.show({ message: 'Completa todos los datos', color: 'red' });
    if (form.clientDni.length !== 8) return notifications.show({ message: 'DNI debe tener 8 dígitos', color: 'red' });
    if (form.clientPhone.length !== 9) return notifications.show({ message: 'Celular debe tener 9 dígitos', color: 'red' });

    const [hh, mm] = form.time.split(':');
    const finalDate = new Date(form.date);
    finalDate.setHours(parseInt(hh), parseInt(mm), 0);

    setLoading(true);
    try {
        await api.post('/appointments', {
            ...form,
            dateISO: finalDate,
            barberId: parseInt(form.barberId) // Aseguramos que vaya como número
        });
        notifications.show({ title: '¡Reserva Exitosa!', message: 'Tu barbero te espera.', color: 'green', icon: <IconCheck/> });
        
        // Limpiamos todo
        setForm({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', barberId: '', date: null, time: null });
        setAvailableSlots([]);
    } catch (error) {
        notifications.show({ message: 'Error al reservar.', color: 'red' });
    }
    setLoading(false);
  };

  const handleSearch = async () => {
     if(!searchDni) return;
     try {
       const res = await api.get(`/appointments/dni/${searchDni}`); 
       setMyAppointments(res.data);
       if(res.data.length === 0) notifications.show({message: 'No hay citas para este DNI', color: 'yellow'});
     } catch (error) { notifications.show({message: 'Error de conexión', color: 'red'}); }
  };

  return (
    <div className="app-container">
      <header className="header-container">
          <div className="nav-container" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px'}}>
            <div className="logo" style={{fontSize:'1.5rem', fontWeight:'bold', color:'white'}}>Barber<span style={{color:'#c49b63'}}>Shop</span></div>
            <Button variant="subtle" color="yellow" onClick={() => navigate('/admin')} leftSection={<IconUser size={18}/>}>Admin</Button>
          </div>
      </header>

      <section className="hero-section" style={{textAlign:'center', padding:'40px 20px', background:`linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${heroImage})`, backgroundSize:'cover'}}>
            <Title style={{color:'white', fontSize:'2.5rem', marginBottom:'10px'}}>Tu Estilo, Nuestra Pasión</Title>
            <Button size="lg" color="yellow" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})} styles={{root:{background:'#c49b63', color:'black'}}}>
                RESERVAR AHORA
            </Button>
      </section>

      <Container size="xl" id="booking-area" py="xl">
        <Grid gutter="xl">
            {/* IZQUIERDA: FORMULARIO */}
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder style={{background:'#1a1a1a', borderColor:'#333'}}>
                    <Title order={3} c="white" mb="lg" style={{borderBottom:'2px solid #c49b63', display:'inline-block'}}>RESERVAR CITA</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <TextInput label="NOMBRE" placeholder="Tu nombre" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}/>
                        <Grid>
                            <Grid.Col span={6}><TextInput label="DNI" maxLength={8} value={form.clientDni} onChange={(e) => setForm({...form, clientDni: e.target.value.replace(/\D/g, '')})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}/></Grid.Col>
                            <Grid.Col span={6}><TextInput label="CELULAR" maxLength={9} value={form.clientPhone} onChange={(e) => setForm({...form, clientPhone: e.target.value.replace(/\D/g, '')})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}/></Grid.Col>
                        </Grid>
                        
                        {/* SELECTOR DE SERVICIO */}
                        <Select label="SERVICIO" placeholder="Elige corte" data={servicios} value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}, dropdown:{background:'#25262b', color:'white'}}}/>
                        
                        {/* NUEVO: SELECTOR DE BARBERO */}
                        <Select 
                            label="BARBERO PREFERIDO" 
                            placeholder="Selecciona barbero" 
                            data={barberos} 
                            value={form.barberId} 
                            onChange={(val) => setForm({...form, barberId: val})} 
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}, dropdown:{background:'#25262b', color:'white'}}}
                            leftSection={<IconUserCircle size={16} />}
                        />

                        {/* FECHA (Deshabilitada si no elige barbero para evitar confusión) */}
                        <DatePickerInput 
                            label="SELECCIONA FECHA" 
                            placeholder={form.barberId ? "Elige un día" : "Primero elige un barbero"} 
                            minDate={new Date()} 
                            disabled={!form.barberId}
                            value={form.date} onChange={(d) => setForm({...form, date: d})}
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}
                        />

                        {/* HORAS DISPONIBLES */}
                        {form.date && form.barberId && (
                            <div>
                                <Text size="sm" c="#ccc" mb="xs">HORARIOS DE {barberos.find(b => b.value === form.barberId)?.label.toUpperCase()}:</Text>
                                {availableSlots.length > 0 ? (
                                    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px'}}>
                                        {availableSlots.map((slot) => (
                                            <Button 
                                                key={slot.time} compact 
                                                variant={form.time === slot.time ? "filled" : "outline"} 
                                                color={form.time === slot.time ? "yellow" : "gray"}
                                                disabled={slot.taken}
                                                onClick={() => setForm({...form, time: slot.time})}
                                                styles={{root: { borderColor: slot.taken ? '#333' : '#c49b63', color: slot.taken ? '#555' : 'white', textDecoration: slot.taken ? 'line-through' : 'none'}}}
                                            >
                                                {slot.time}
                                            </Button>
                                        ))}
                                    </div>
                                ) : <Text c="dimmed" size="sm">Cargando horarios...</Text>}
                            </div>
                        )}

                        <Button fullWidth size="md" mt="md" onClick={handleSubmit} loading={loading} styles={{root:{background:'#c49b63', color:'black'}}}>CONFIRMAR RESERVA</Button>
                    </div>
                </Card>
            </Grid.Col>

            {/* DERECHA: MIS CITAS */}
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder style={{background:'#1a1a1a', borderColor:'#333', height:'100%'}}>
                    <Title order={3} c="white" mb="lg">MIS CITAS</Title>
                    <Group mb="lg">
                        <TextInput placeholder="Buscar por DNI" value={searchDni} onChange={(e) => setSearchDni(e.target.value)} style={{flex:1}} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}}}/>
                        <Button onClick={handleSearch} color="gray">BUSCAR</Button>
                    </Group>
                    <div>
                        {myAppointments.map((appt) => (
                        <Card key={appt.id} mb="sm" padding="md" radius="sm" style={{background:'#25262b', borderLeft:`4px solid ${appt.estado === 'PENDIENTE'?'#c49b63': appt.estado==='COMPLETADO'?'#228be6':'green'}`}}>
                            <Group justify="space-between">
                                <div>
                                    <Text fw={700} c="white">{appt.service?.nombre}</Text>
                                    <Text size="xs" c="yellow">Barbero: {appt.barber?.nombre || 'No asignado'}</Text>
                                </div>
                                <Badge color={appt.estado==='PENDIENTE'?'yellow': appt.estado==='COMPLETADO'?'blue':'green'}>{appt.estado}</Badge>
                            </Group>
                            <Group mt="xs">
                                <IconCalendarEvent size={16} color="gray"/>
                                <Text size="sm" c="dimmed">{new Date(appt.fechaInicio).toLocaleDateString()} - {new Date(appt.fechaInicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                            </Group>
                        </Card>
                        ))}
                    </div>
                </Card>
            </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
}

function App() { return <BrowserRouter><Routes><Route path="/" element={<Home />}/><Route path="/admin" element={<AdminLogin />}/><Route path="/admin/dashboard" element={<AdminDashboard />}/></Routes></BrowserRouter>; }
export default App;