import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Title, TextInput, Select, Button, Card, Text, Badge, Group, Container, Grid } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconClock, IconSearch, IconUser, IconX, IconDeviceMobile, IconId } from '@tabler/icons-react';
import '@mantine/dates/styles.css'; 
import './App.css'; 

// Importamos las vistas del Administrador
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

// URL de imagen
const heroImage = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1000&auto=format&fit=crop";

// Configuración de API (Nube vs Local)
const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

// --- COMPONENTE HOME ---
function Home() {
  const navigate = useNavigate(); 
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', dateISO: null });
  const [searchDni, setSearchDni] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [rescheduleDates, setRescheduleDates] = useState({});
  const [servicios, setServicios] = useState([]); 

  // Cargar servicios reales al iniciar la página
  useEffect(() => {
    api.get('/services')
      .then(res => {
        const serviciosMapeados = res.data.map(s => ({
          value: s.id.toString(),
          label: `${s.nombre} (${s.duracion || s.duracionMinutos} min) - S/.${s.precio}`
        }));
        setServicios(serviciosMapeados);
      })
      .catch(err => console.error("Error cargando servicios", err));
  }, []);

  // --- VALIDACIONES DE ENTRADA ---
  const validateForm = () => {
      // 1. Validar DNI (8 dígitos exactos)
      if (form.clientDni.length !== 8) {
          notifications.show({ message: 'El DNI debe tener 8 dígitos', color: 'red', icon: <IconId/> });
          return false;
      }
      // 2. Validar Celular (9 dígitos exactos, empieza con 9)
      const phoneRegex = /^9\d{8}$/;
      if (!phoneRegex.test(form.clientPhone)) {
          notifications.show({ message: 'Celular inválido (debe ser 9 dígitos y empezar con 9)', color: 'red', icon: <IconDeviceMobile/> });
          return false;
      }
      // 3. Validar Campos vacíos
      if (!form.clientName || !form.serviceId || !form.dateISO) {
          notifications.show({ message: 'Completa todos los campos', color: 'red' });
          return false;
      }
      return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return; // Si no pasa validación, se detiene aquí

    setLoading(true);
    try {
        await api.post('/appointments', form);
        notifications.show({ title: '¡Reserva Exitosa!', message: 'Te esperamos en BarberShop.', color: 'green', icon: <IconCalendarEvent/> });
        setForm({ clientName: '', clientDni: '', clientPhone: '', serviceId: '', dateISO: null });
    } catch (error) {
        const errorMsg = error.response?.data?.error || 'Error al procesar la reserva';
        notifications.show({ title: 'No disponible', message: errorMsg, color: 'red', autoClose: 6000 });
    }
    setLoading(false);
  };

  const handleSearch = async () => {
     if(!searchDni) return;
     try {
       const res = await api.get(`/appointments/${searchDni}`);
       setMyAppointments(res.data);
       if(res.data.length === 0) notifications.show({message: 'No se encontraron citas para este DNI', color: 'yellow'});
     } catch (error) { notifications.show({message: 'Error de conexión', color: 'red'}); }
  };

  // Lógica para CANCELAR CITA
  const handleCancelClient = async (appointmentId) => {
    if(!window.confirm("¿Seguro que deseas cancelar esta cita?")) return;
    try {
        await api.put(`/appointments/${appointmentId}/cancel`);
        notifications.show({message: 'Cita cancelada correctamente', color: 'orange'});
        handleSearch(); 
    } catch (error) {
        notifications.show({message: 'Error al cancelar', color: 'red'});
    }
  };

  const handleReschedule = async (appointmentId) => {
     const newDate = rescheduleDates[appointmentId];
     if(!newDate) return notifications.show({message: 'Seleccione una nueva fecha y hora', color: 'orange'});
     try {
       await api.put(`/appointments/${appointmentId}`, { newDateISO: newDate });
       notifications.show({ title: 'Actualizado', message: 'Tu cita ha sido reprogramada.', color: 'green', icon: <IconClock/> });
       handleSearch(); 
       setRescheduleDates(prev => { const newState = {...prev}; delete newState[appointmentId]; return newState; });
     } catch (error) {
        const errorMsg = error.response?.data?.error || 'Error al reprogramar';
        notifications.show({ message: errorMsg, color: 'red' });
     }
  };

  return (
    <div className="app-container">
      
      {/* HEADER RESPONSIVE */}
      <header className="header-container">
          <div className="nav-container" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px'}}>
            <div className="logo" style={{fontSize:'1.5rem', fontWeight:'bold', color:'white'}}>Barber<span style={{color:'#c49b63'}}>Shop</span></div>
            <Button variant="subtle" color="yellow" onClick={() => navigate('/admin')} leftSection={<IconUser size={18}/>}>
                Ingresa Administrador
            </Button>
          </div>
      </header>

      {/* HERO */}
      <section className="hero-section" style={{textAlign:'center', padding:'40px 20px', background:`linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${heroImage})`, backgroundSize:'cover', backgroundPosition:'center'}}>
        <div className="hero-content">
            <h1 className="hero-title" style={{color:'white', fontSize:'2.5rem', marginBottom:'10px'}}>Tu Estilo,<br/>Nuestra Pasión.</h1>
            <p className="hero-subtitle" style={{color:'#ccc', fontSize:'1.1rem', marginBottom:'20px'}}>Expertos en cortes clásicos, modernos y cuidado de barba. Reserva tu cita hoy y evita las colas.</p>
            <Button className="btn-gold-pro" size="lg" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})}>
                RESERVAR AHORA
            </Button>
        </div>
      </section>

      {/* ÁREA PRINCIPAL (GRID RESPONSIVE) */}
      <Container size="xl" id="booking-area" py="xl">
        <Grid gutter="xl">
            
            {/* COLUMNA 1: FORMULARIO */}
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder style={{background:'#1a1a1a', borderColor:'#333'}}>
                    <Title order={2} className="form-section-title" style={{borderBottom:'2px solid #c49b63', display:'inline-block', marginBottom:'20px'}}>RESERVAR TU CITA</Title>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <TextInput label="NOMBRE COMPLETO" placeholder="Ingresa tu nombre" 
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}
                            value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} />
                        
                        <Grid>
                            <Grid.Col span={6}>
                                <TextInput label="DNI (8 dígitos)" placeholder="Documento" maxLength={8}
                                    styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}
                                    value={form.clientDni} 
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, ''); // Solo números
                                        setForm({...form, clientDni: val});
                                    }} 
                                />
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <TextInput label="TELÉFONO" placeholder="9..." maxLength={9}
                                    styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}
                                    value={form.clientPhone} 
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, ''); // Solo números
                                        setForm({...form, clientPhone: val});
                                    }} 
                                />
                            </Grid.Col>
                        </Grid>

                        <Select label="SELECCIONA SERVICIO" placeholder="Cargando servicios..." data={servicios} 
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}, dropdown:{background:'#25262b', color:'white'}}}
                            value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})}
                            rightSection={<IconSearch size="1rem" color="var(--primary-gold)" />}
                        />

                        <DateTimePicker
                            label="FECHA Y HORA DESEADA" placeholder="Selecciona en el calendario"
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}, label:{color:'#ccc'}}}
                            value={form.dateISO} onChange={(date) => setForm({...form, dateISO: date})}
                            minDate={new Date()}
                            rightSection={<IconCalendarEvent size="1rem" color="var(--primary-gold)" />}
                        />

                        <Button className="btn-gold-pro" fullWidth onClick={handleSubmit} loading={loading} mt="lg">
                            CONFIRMAR RESERVA
                        </Button>
                    </div>
                </Card>
            </Grid.Col>

            {/* COLUMNA 2: MIS RESERVAS */}
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder style={{background:'#1a1a1a', borderColor:'#333', height:'100%'}}>
                    <Title order={3} className="form-section-title" style={{fontSize:'1.3rem', borderBottom:'2px solid #c49b63', display:'inline-block', marginBottom:'20px'}}>GESTIONAR MIS RESERVAS</Title>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                        <TextInput placeholder="Ingresa tu DNI para buscar" 
                            styles={{input:{background:'#25262b', color:'white', border:'1px solid #444'}}}
                            value={searchDni} onChange={(e) => setSearchDni(e.target.value)} style={{ flex: 1 }} rightSection={<IconSearch size={16}/>} />
                        <Button onClick={handleSearch} className="btn-gold-pro" style={{width:'auto', padding:'0 20px'}}>BUSCAR</Button>
                    </div>

                    <div className="appointments-list">
                        {myAppointments.map((appt) => (
                        <Card key={appt.id} padding="lg" radius="sm" className="appt-card-pro" mb="sm">
                            <Group justify="space-between">
                            <Text className="appt-service-title">
                                {servicios.find(s => s.value === appt.serviceId.toString())?.label.split(' - ')[0] || appt.service?.nombre || 'Servicio'}
                            </Text>
                            <Badge color={appt.estado === 'PENDIENTE' ? 'yellow' : appt.estado === 'CANCELADO' ? 'red' : 'green'} variant="filled" radius="sm">{appt.estado}</Badge>
                            </Group>

                            <div className="appt-date-text">
                            <IconCalendarEvent size={20} color="var(--primary-gold)"/> 
                            <Text weight={700} color="white">{new Date(appt.fechaInicio).toLocaleDateString()}</Text>
                            <IconClock size={20} color="var(--primary-gold)" style={{marginLeft: '10px'}}/>
                            <Text weight={700} color="white">{new Date(appt.fechaInicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                            </div>

                            {/* SOLO MOSTRAMOS OPCIONES SI NO ESTÁ CANCELADO */}
                            {appt.estado === 'PENDIENTE' && (
                            <>
                                <Text size="xs" color="var(--text-muted)" weight={600} style={{ marginBottom: '10px', textTransform:'uppercase' }}>Reprogramar cita:</Text>
                                <Group grow mb="md">
                                <DateTimePicker
                                    placeholder="Nueva fecha y hora" size="sm" minDate={new Date()}
                                    value={rescheduleDates[appt.id] || null} onChange={(date) => setRescheduleDates({ ...rescheduleDates, [appt.id]: date })}
                                />
                                <Button className="btn-gold-pro" style={{height:'42px'}} onClick={() => handleReschedule(appt.id)}>Guardar</Button>
                                </Group>
                                
                                <Button variant="outline" color="red" fullWidth size="xs" onClick={() => handleCancelClient(appt.id)} leftSection={<IconX size={14}/>} 
                                styles={{root: {borderColor: '#ff4d4d', color: '#ff4d4d', '&:hover': { backgroundColor: 'rgba(255, 77, 77, 0.1)' }}}}>
                                Cancelar esta cita
                                </Button>
                            </>
                            )}
                        </Card>
                        ))}
                        {myAppointments.length === 0 && searchDni && <Text color="dimmed" align="center" mt="md">No se encontraron citas.</Text>}
                    </div>
                </Card>
            </Grid.Col>

        </Grid>
      </Container>
    </div>
  );
}

// --- APP PRINCIPAL ---
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;