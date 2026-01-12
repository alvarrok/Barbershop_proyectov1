import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Title, TextInput, Select, Button, Card, Text, Badge, Group, Modal } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconClock, IconSearch, IconUser, IconX } from '@tabler/icons-react';
import '@mantine/dates/styles.css'; 
import './App.css'; 

// Importamos las vistas del Administrador
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

// URL de imagen
const heroImage = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1000&auto=format&fit=crop";

// --- CORRECCIÓN VITAL AQUÍ ---
// Usa la variable de entorno si existe (Nube), si no, usa localhost (Tu PC)
const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

// --- COMPONENTE HOME (Tu Landing Page Refactorizada) ---
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
          label: `${s.nombre} (${s.duracionMinutos || s.duracion} min) - S/.${s.precio}`
        }));
        setServicios(serviciosMapeados);
      })
      .catch(err => console.error("Error cargando servicios", err));
  }, []);

  const handleSubmit = async () => {
    if (!form.clientDni || !form.dateISO || !form.serviceId) return notifications.show({message: 'Complete los campos obligatorios', color: 'red'});
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
        handleSearch(); // Recargar la lista
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
      
      {/* HEADER */}
      <header className="header-container">
          <div className="top-bar">
            <span>HORARIO: Lunes - Sábado 9:00 am - 8:00 pm</span>
            <span>📞 +51 999 999 999 | 📍 Av. Principal #123</span>
          </div>
          <nav className="navbar">
            <div className="logo">Barber<span>Shop</span></div>
            <div className="nav-links">
              <a href="#" className="active">Inicio</a>
              <a href="#servicios">Servicios</a>
              <a href="#nosotros">Nosotros</a>
              <a href="#contacto">Contacto</a>
            </div>
            <Button className="btn-admin-header" leftIcon={<IconUser size={18}/>} onClick={() => navigate('/admin')}>
                Ingresa Administrador
            </Button>
          </nav>
      </header>

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-image-container">
            <img src={heroImage} alt="Modelo Barbería" />
        </div>
        <div className="hero-content">
            <h1 className="hero-title">Tu Estilo,<br/>Nuestra Pasión.</h1>
            <p className="hero-subtitle">Expertos en cortes clásicos, modernos y cuidado de barba. Reserva tu cita hoy y vive la experiencia BarberShop Premium.</p>
            <Button className="btn-gold-pro" size="lg" onClick={() => document.getElementById('booking-area').scrollIntoView({behavior:'smooth'})}>
                RESERVAR AHORA
            </Button>
        </div>
      </section>

      {/* ÁREA PRINCIPAL */}
      <div id="booking-area" className="main-content-grid">
        
        {/* IZQUIERDA: Formulario */}
        <section className="booking-container" style={{ flex: 1, minWidth: '400px' }}>
          <Title order={2} className="form-section-title">RESERVAR TU CITA</Title>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <TextInput label="NOMBRE COMPLETO" placeholder="Ingresa tu nombre" value={form.clientName} onChange={(e) => setForm({...form, clientName: e.target.value})} />
              <div style={{ display: 'flex', gap: '20px' }}>
                <TextInput label="DNI" placeholder="Documento" style={{flex:1}} value={form.clientDni} onChange={(e) => setForm({...form, clientDni: e.target.value})} />
                <TextInput label="TELÉFONO" placeholder="+51..." style={{flex:1}} value={form.clientPhone} onChange={(e) => setForm({...form, clientPhone: e.target.value})} />
              </div>

              {/* SERVICIOS DINÁMICOS */}
              <Select label="SELECCIONA SERVICIO" placeholder="Cargando servicios..." data={servicios} value={form.serviceId} onChange={(val) => setForm({...form, serviceId: val})}
                rightSection={<IconSearch size="1rem" color="var(--primary-gold)" />}
              />

              <DateTimePicker
                label="FECHA Y HORA DESEADA" placeholder="Selecciona en el calendario"
                value={form.dateISO} onChange={(date) => setForm({...form, dateISO: date})}
                minDate={new Date()}
                rightSection={<IconCalendarEvent size="1rem" color="var(--primary-gold)" />}
              />

              <Button className="btn-gold-pro" fullWidth onClick={handleSubmit} loading={loading} mt="lg">
                CONFIRMAR RESERVA
              </Button>
          </div>
        </section>

        {/* DERECHA: Mis Reservas */}
        <section className="manage-container" style={{ flex: 0.8, minWidth: '350px' }}>
          <Title order={3} className="form-section-title" style={{fontSize:'1.3rem'}}>GESTIONAR MIS RESERVAS</Title>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <TextInput placeholder="Ingresa tu DNI para buscar" value={searchDni} onChange={(e) => setSearchDni(e.target.value)} style={{ flex: 1 }} rightSection={<IconSearch size={16}/>} />
            <Button onClick={handleSearch} className="btn-gold-pro" style={{width:'auto', padding:'0 20px'}}>BUSCAR</Button>
          </div>

          <div className="appointments-list">
            {myAppointments.map((appt) => (
              <Card key={appt.id} padding="lg" radius="sm" className="appt-card-pro">
                <Group justify="space-between">
                  <Text className="appt-service-title">
                    {/* Buscamos el nombre en el array de servicios dinámicos */}
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
        </section>
      </div>
    </div>
  );
}

// --- APP PRINCIPAL (SISTEMA DE RUTAS) ---
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