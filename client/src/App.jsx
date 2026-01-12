import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Title, TextInput, Select, Button, Card, Text, Badge, Group, Container, Grid, ActionIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates'; // USAMOS ESTE AHORA
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconClock, IconSearch, IconUser, IconX, IconDeviceMobile, IconId } from '@tabler/icons-react';
import '@mantine/dates/styles.css'; 
import './App.css'; 

import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

const heroImage = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1000&auto=format&fit=crop";

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

function Home() {
  const navigate = useNavigate(); 
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', date: null, time: null });
  const [searchDni, setSearchDni] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [servicios, setServicios] = useState([]); 
  
  // ESTADOS PARA HORARIOS
  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);

  // 1. CARGAR SERVICIOS
  useEffect(() => {
    api.get('/services').then(res => {
        const serviciosMapeados = res.data.map(s => ({
          value: s.id.toString(),
          label: `${s.nombre} (${s.duracion || 30} min) - S/.${s.precio}`,
          duration: s.duracion || 30
        }));
        setServicios(serviciosMapeados);
    }).catch(console.error);
  }, []);

  // 2. CUANDO CAMBIA LA FECHA, BUSCAMOS CITAS OCUPADAS
  useEffect(() => {
    if (form.date) {
        setForm(f => ({...f, time: null})); // Resetear hora si cambia dia
        fetchOccupiedSlots(form.date);
    }
  }, [form.date]);

  const fetchOccupiedSlots = async (date) => {
      try {
          // Pedimos todas las citas para filtrar en el front (o idealmente el backend filtra por dia)
          const res = await api.get('/appointments'); 
          // Filtramos solo las de este día
          const dayAppointments = res.data.filter(a => {
              const apptDate = new Date(a.fechaInicio);
              return apptDate.toDateString() === date.toDateString() && a.estado !== 'CANCELADO';
          });
          
          // Guardamos las horas ocupadas (ej: "14:30")
          const times = dayAppointments.map(a => {
              const d = new Date(a.fechaInicio);
              return d.getHours() + ':' + (d.getMinutes() === 0 ? '00' : d.getMinutes());
          });
          setOccupiedSlots(times);
          generateSlots(times);
      } catch (error) { console.error(error); }
  };

  const generateSlots = (occupied) => {
      // HORARIO DE TRABAJO: 9:00 AM a 8:00 PM (20:00)
      const slots = [];
      for (let hour = 9; hour < 20; hour++) {
          const time1 = `${hour}:00`;
          const time2 = `${hour}:30`;
          
          // Verificamos si está ocupado
          // NOTA: Esto es validación simple. Para validación perfecta se necesita chequear duración.
          slots.push({ time: time1, taken: occupied.includes(time1) || occupied.includes(`${hour}:0`)});
          slots.push({ time: time2, taken: occupied.includes(time2) });
      }
      setAvailableSlots(slots);
  };

  const handleSubmit = async () => {
    if (!form.clientName || !form.clientDni || !form.clientPhone || !form.serviceId || !form.date || !form.time) {
        return notifications.show({ message: 'Completa todos los campos y selecciona hora', color: 'red' });
    }

    // Unir fecha y hora
    const [hours, minutes] = form.time.split(':');
    const finalDate = new Date(form.date);
    finalDate.setHours(parseInt(hours), parseInt(minutes), 0);

    setLoading(true);
    try {
        await api.post('/appointments', {
            ...form,
            dateISO: finalDate // Enviamos el formato que el backend espera
        });
        notifications.show({ title: '¡Reserva Exitosa!', message: 'Te esperamos.', color: 'green', icon: <IconCalendarEvent/> });
        setForm({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', date: null, time: null });
        setAvailableSlots([]);
    } catch (error) {
        notifications.show({ message: 'Error o horario no disponible', color: 'red' });
    }
    setLoading(false);
  };

  const handleSearch = async () => {
     if(!searchDni) return;
     try {
       const res = await api.get(`/appointments/${searchDni}`);
       setMyAppointments(res.data);
       if(res.data.length === 0) notifications.show({message: 'No se encontraron citas', color: 'yellow'});
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
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder style={{background:'#1a1a1a', borderColor:'#333'}}>
                    <Title order={3} c="white" mb="lg" style={{borderBottom:'2px solid #c49b63', display:'inline-block'}}>RESERVAR CITA</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <TextInput label="NOMBRE" placeholder="Tu nombre" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}/>
                        <Grid>
                            <Grid.Col span={6}><TextInput label="DNI" maxLength={8} value={form.clientDni} onChange={(e) => setForm({...form, clientDni: e.target.value.replace(/\D/g, '')})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}/></Grid.Col>
                            <Grid.Col span={6}><TextInput label="CELULAR" maxLength={9} value={form.clientPhone} onChange={(e) => setForm({...form, clientPhone: e.target.value.replace(/\D/g, '')})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}/></Grid.Col>
                        </Grid>
                        <Select label="SERVICIO" placeholder="Elige corte" data={servicios} value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}, dropdown:{background:'#25262b', color:'white'}}}/>
                        
                        {/* SELECCIÓN DE FECHA */}
                        <DatePickerInput 
                            label="SELECCIONA FECHA" 
                            placeholder="¿Qué día vienes?" 
                            minDate={new Date()} 
                            value={form.date} 
                            onChange={(d) => setForm({...form, date: d})}
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}
                        />

                        {/* GRILLA DE HORARIOS */}
                        {form.date && (
                            <div>
                                <Text size="sm" c="#ccc" mb="xs">HORARIOS DISPONIBLES:</Text>
                                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'10px'}}>
                                    {availableSlots.map((slot) => (
                                        <Button 
                                            key={slot.time} 
                                            variant={form.time === slot.time ? "filled" : "outline"} 
                                            color={form.time === slot.time ? "yellow" : "gray"}
                                            disabled={slot.taken}
                                            onClick={() => setForm({...form, time: slot.time})}
                                            styles={{root: { borderColor: slot.taken ? '#333' : '#c49b63', color: slot.taken ? '#555' : 'white'}}}
                                        >
                                            {slot.taken ? <Text td="line-through" c="dimmed" size="xs">{slot.time}</Text> : slot.time}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button fullWidth size="md" mt="md" onClick={handleSubmit} loading={loading} styles={{root:{background:'#c49b63', color:'black'}}}>CONFIRMAR RESERVA</Button>
                    </div>
                </Card>
            </Grid.Col>

            {/* MIS RESERVAS (Igual que antes pero responsive) */}
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder style={{background:'#1a1a1a', borderColor:'#333', height:'100%'}}>
                    <Title order={3} c="white" mb="lg">MIS CITAS</Title>
                    <Group mb="lg">
                        <TextInput placeholder="Buscar por DNI" value={searchDni} onChange={(e) => setSearchDni(e.target.value)} style={{flex:1}} styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}}}/>
                        <Button onClick={handleSearch} color="gray">BUSCAR</Button>
                    </Group>
                    <div>
                        {myAppointments.map((appt) => (
                        <Card key={appt.id} mb="sm" padding="md" radius="sm" style={{background:'#25262b', borderLeft:`4px solid ${appt.estado === 'PENDIENTE'?'#c49b63':'green'}`}}>
                            <Group justify="space-between">
                                <Text fw={700} c="white">{appt.service?.nombre}</Text>
                                <Badge color={appt.estado==='PENDIENTE'?'yellow':'green'}>{appt.estado}</Badge>
                            </Group>
                            <Text size="sm" c="dimmed">{new Date(appt.fechaInicio).toLocaleString()}</Text>
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