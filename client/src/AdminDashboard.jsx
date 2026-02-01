import { useState, useEffect } from 'react';
import axios from 'axios';
// CORRECCIÓN CRÍTICA: Eliminado 'Tooltip' de Mantine para evitar conflicto con Recharts
import { 
  AppShell, Text, Group, Button, Table, Tabs, Modal, Badge, Indicator, ActionIcon, 
  TextInput, NumberInput, Card, Grid, ScrollArea, Box, Avatar, Center, Loader, Image, 
  SimpleGrid, Select 
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { DatePickerInput } from '@mantine/dates';
import { 
  IconCalendar, IconScissors, IconTrash, IconUser, IconBrandWhatsapp, IconCurrencyDollar, 
  IconCheck, IconPencil, IconMessage, IconClock, IconPhone, IconId, IconPhoto, 
  IconUsers, IconUserOff, IconUserCheck, IconGenderMale, IconGenderFemale 
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
// IMPORTAMOS RECHARTS SOLO (Sin alias, para que no haya dudas)
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// Configuración inicial
dayjs.locale('es');
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

// Constante fuera del componente
const initialBarberForm = { id: null, nombre: '', dni: '', telefono: '', sexo: 'Masculino', imagenUrl: '' };

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // --- DATOS GLOBALES ---
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  
  // --- UI STATES ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  
  // ESTADOS FORMULARIOS
  const [formService, setFormService] = useState({ id: null, nombre: '', minutos: 30, precio: 0 });
  const [isEditingService, setIsEditingService] = useState(false);
  
  // ESTADO BARBEROS
  const [formBarber, setFormBarber] = useState(initialBarberForm);
  const [isEditingBarber, setIsEditingBarber] = useState(false);

  // MODALES
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState({ id: null, type: null }); 
  const [showQRModal, setShowQRModal] = useState(false);

  const [finStartDate, setFinStartDate] = useState(dayjs().startOf('month').toDate());
  const [finEndDate, setFinEndDate] = useState(dayjs().endOf('month').toDate());
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [waQR, setWaQR] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) navigate('/admin');
    fetchData();
    checkWhatsAppStatus();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // BLINDAJE: Si falla una petición, no rompe la página
      const results = await Promise.allSettled([
          api.get('/appointments'), 
          api.get('/services'),
          api.get('/barbers?todos=true') 
      ]);

      const resAppts = results[0].status === 'fulfilled' ? results[0].value.data : [];
      const resServices = results[1].status === 'fulfilled' ? results[1].value.data : [];
      const resBarbers = results[2].status === 'fulfilled' ? results[2].value.data : [];

      setAppointments(Array.isArray(resAppts) ? resAppts.sort((a,b)=>new Date(b.fechaInicio)-new Date(a.fechaInicio)) : []);
      setServices(Array.isArray(resServices) ? resServices : []);
      setBarbers(Array.isArray(resBarbers) ? resBarbers : []);

    } catch (e) { console.error("Error cargando datos:", e); }
  };

  const checkWhatsAppStatus = async () => { try { const res = await api.get('/whatsapp/status'); setWaStatus(res.data.status); setWaQR(res.data.qr); } catch (e) {} };

  // --- LOGICA BARBEROS ---
  const handleSaveBarber = async () => {
      if(!formBarber.nombre || !formBarber.dni) return notifications.show({message:'Nombre y DNI obligatorios', color:'red'});
      setLoadingAction(true);
      try {
          if(isEditingBarber) {
              await api.put(`/barbers/${formBarber.id}`, formBarber);
              notifications.show({ message: 'Barbero actualizado', color: 'green' });
          } else {
              await api.post('/barbers', formBarber);
              notifications.show({ message: 'Barbero registrado', color: 'green' });
          }
          setFormBarber(initialBarberForm);
          setIsEditingBarber(false);
          fetchData();
      } catch (e) { notifications.show({ message: e.response?.data?.error || 'Error al guardar', color: 'red' }); }
      setLoadingAction(false);
  };

  const handleEditBarberClick = (b) => { setFormBarber(b); setIsEditingBarber(true); };

  const toggleBarberStatus = async (b) => {
      try {
          await api.put(`/barbers/${b.id}`, { activo: !b.activo });
          notifications.show({ message: `Estado actualizado`, color: 'green' });
          fetchData();
      } catch(e) { notifications.show({ message: 'Error al cambiar estado', color: 'red' }); }
  };

  // --- LOGICA SERVICIOS ---
  const handleSaveService = async () => {
    if(!formService.nombre) return notifications.show({message:'Falta nombre', color:'red'});
    setLoadingAction(true);
    try {
        const payload = { ...formService, duracion: formService.minutos };
        if(isEditingService) await api.put(`/services/${formService.id}`, payload);
        else await api.post('/services', payload);
        notifications.show({ message: 'Guardado', color: 'green' });
        setFormService({ id: null, nombre: '', minutos: 30, precio: 0 }); setIsEditingService(false); fetchData();
    } catch(e) { notifications.show({ message: 'Error', color: 'red' }); }
    setLoadingAction(false);
  };

  // --- MODAL ELIMINAR ---
  const openDeleteModal = (id, type) => { setItemToDelete({ id, type }); setDeleteModalOpen(true); };
  const confirmDelete = async () => {
      setLoadingAction(true);
      try {
        if(itemToDelete.type === 'service') await api.delete(`/services/${itemToDelete.id}`);
        if(itemToDelete.type === 'barber') await api.delete(`/barbers/${itemToDelete.id}`);
        fetchData(); notifications.show({ message: 'Eliminado', color: 'green' });
      } catch(e) { notifications.show({ message: 'Error (Puede tener citas asociadas)', color: 'red' }); }
      setLoadingAction(false);
      setDeleteModalOpen(false);
  };

  // --- WHATSAPP & COBROS ---
  const sendWhatsAppInternal = async (appt, type) => {
      if (waStatus !== 'READY') { setShowQRModal(true); return notifications.show({ message: 'Conecta WhatsApp', color: 'red' }); }
      const phone = appt.clientePhone.replace(/\D/g, '');
      const name = appt.clienteNombre.split(' ')[0];
      const time = dayjs(appt.fechaInicio).format('HH:mm');
      let msg = '';
      if(type==='avisar') msg = `Hola ${name}, recordatorio de tu cita hoy a las ${time}.`;
      if(type==='cancel') msg = `Hola ${name}, tu cita ha sido cancelada.`;
      
      notifications.show({ id: 'wa', loading: true, message: 'Enviando...' });
      try { await api.post('/send-whatsapp', { phone, message: msg }); notifications.update({ id: 'wa', color: 'green', message: 'Enviado', loading: false }); } 
      catch (e) { notifications.update({ id: 'wa', color: 'red', message: 'Error', loading: false }); }
  };

  const handleConfirmCut = async () => {
      try { await api.put(`/appointments/${selectedAppt.id}`, { estado: 'COMPLETADO' }); notifications.show({ message: 'Cobrado', color: 'blue', icon: <IconCheck/> }); fetchData(); setSelectedAppt(null); } catch(e){}
  };

  // --- RENDERERS ---
  const renderSchedule = () => {
      const hours = Array.from({length: 13}, (_, i) => i + 9);
      return ( <ScrollArea h={600} type="always" offsetScrollbars> {hours.map(h => { const hourAppts = appointments.filter(a => dayjs(a.fechaInicio).isSame(selectedDate, 'day') && dayjs(a.fechaInicio).hour() === h && a.estado !== 'CANCELADO'); return ( <div key={h} style={{display:'flex', borderBottom:'1px solid #333', minHeight:'80px'}}> <div style={{width:'70px', borderRight:'1px solid #333', padding:'15px 5px', color:'#777', fontWeight:'bold'}}>{h}:00</div> <div style={{flex:1, padding:'5px'}}> {hourAppts.map(appt => ( <Card key={appt.id} shadow="sm" padding="xs" radius="sm" onClick={() => setSelectedAppt(appt)} style={{marginBottom:'5px', background:'#25262b', borderLeft:`4px solid ${appt.estado==='COMPLETADO'?'#228be6':'#c49b63'}`, cursor:'pointer'}}> <Group justify="space-between"><Text size="sm" fw={700} c="white">{appt.clienteNombre}</Text><Badge size="xs" color="gray">{dayjs(appt.fechaInicio).format('HH:mm')}</Badge></Group> <Text size="xs" c="dimmed">{appt.service?.nombre} {appt.barber ? `- ${appt.barber.nombre}` : ''}</Text> </Card> ))} </div> </div> ) })} </ScrollArea> )
  };

  const { finTotal, finGraph, finTrans } = (() => {
      const start = dayjs(finStartDate).startOf('day'); const end = dayjs(finEndDate).endOf('day');
      const filtered = appointments.filter(a => dayjs(a.fechaInicio).isAfter(start) && dayjs(a.fechaInicio).isBefore(end) && a.estado === 'COMPLETADO');
      const total = filtered.reduce((acc, curr) => acc + Number(curr.service?.precio || 0), 0);
      const graphMap = {}; filtered.forEach(a => { const d = dayjs(a.fechaInicio).format('YYYY-MM-DD'); graphMap[d] = (graphMap[d] || 0) + Number(a.service?.precio || 0); });
      return { finTotal, finGraph: Object.keys(graphMap).sort().map(k => ({ name: dayjs(k).format('DD/MM'), Ingresos: graphMap[k] })), finTrans: filtered };
  })();

  return (
    <AppShell header={{ height: 70 }} padding="md" styles={{ main: { background: '#0a0a0a', color: 'white' } }}>
      <AppShell.Header style={{background: '#111', borderBottom: '1px solid #c49b63', padding: '0 20px', display:'flex', alignItems:'center'}}>
         <Group justify="space-between" w="100%">
             <Group><IconScissors size={28} color="#c49b63" /><Text fw={900} c="#c49b63" size="lg">ADMIN PANEL</Text></Group>
             <Group>
                 <Indicator color={waStatus === 'READY' ? 'green' : 'red'} processing={waStatus==='QR_READY'} size={12}><Button variant="subtle" color="gray" leftSection={<IconBrandWhatsapp/>} onClick={() => setShowQRModal(true)}>{waStatus === 'READY' ? 'Conectado' : 'Conectar'}</Button></Indicator>
                 <Button variant="subtle" color="yellow" onClick={() => {localStorage.removeItem('adminToken'); navigate('/');}}>Salir</Button>
             </Group>
         </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Tabs defaultValue="agenda" variant="pills" color="yellow" radius="md">
            <Tabs.List mb="lg" style={{background:'#111', padding:'10px'}}>
                <Tabs.Tab value="agenda" leftSection={<IconCalendar size={18}/>} c="white">Agenda</Tabs.Tab>
                <Tabs.Tab value="finance" leftSection={<IconCurrencyDollar size={18}/>} c="white">Finanzas</Tabs.Tab>
                <Tabs.Tab value="services" leftSection={<IconScissors size={18}/>} c="white">Servicios</Tabs.Tab>
                <Tabs.Tab value="team" leftSection={<IconUsers size={18}/>} c="white">Equipo</Tabs.Tab>
            </Tabs.List>

            {/* --- AGENDA --- */}
            <Tabs.Panel value="agenda">
                <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}><Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333'}}><Center><DatePicker value={selectedDate} onChange={setSelectedDate} styles={{ calendarHeader: {color:'white'}, day: {color:'white'}, dayLevel:{color:'white'} }} /></Center></Card></Grid.Col>
                    <Grid.Col span={{ base: 12, md: 8 }}><Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333'}}><div style={{padding:'20px', background:'#1a1a1a', borderBottom:'1px solid #333'}}><Text fw={700} size="xl" c="#c49b63">{dayjs(selectedDate).format('dddd D [de] MMMM')}</Text></div>{renderSchedule()}</Card></Grid.Col>
                </Grid>
            </Tabs.Panel>

            {/* --- FINANZAS --- */}
            <Tabs.Panel value="finance">
                <Grid>
                    <Grid.Col span={12}><Card withBorder radius="md" p="lg" style={{background:'#111', borderColor:'#333'}}><Group><DatePickerInput label="Desde" value={finStartDate} onChange={setFinStartDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} /><IconArrowRight color="gray" style={{marginTop:'25px'}} /><DatePickerInput label="Hasta" value={finEndDate} onChange={setFinEndDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} /><Card p="xs" radius="sm" style={{background:'#1a472a', marginLeft:'auto', minWidth:'200px'}}><Text size="xs" c="white">GANANCIA REALIZADA</Text><Text size="xl" fw={900} c="white">S/. {finTotal.toFixed(2)}</Text></Card></Group></Card></Grid.Col>
                    <Grid.Col span={{base:12, md:6}}><Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333', height:'300px'}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={finGraph}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="name" stroke="#888" /><YAxis stroke="#888" /><Tooltip contentStyle={{backgroundColor:'#222'}} /><Area type="monotone" dataKey="Ingresos" stroke="#8884d8" fill="#8884d8" /></AreaChart></ResponsiveContainer></Card></Grid.Col>
                    <Grid.Col span={{base:12, md:6}}><Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333', height:'300px'}}><ScrollArea><Table><Table.Tbody>{finTrans.map(t=><Table.Tr key={t.id}><Table.Td style={{color:'#c49b63'}}>{dayjs(t.fechaInicio).format('DD/MM')}</Table.Td><Table.Td><Text size="sm" c="white">{t.clienteNombre}</Text><Text size="xs" c="dimmed">{t.service?.nombre}</Text></Table.Td><Table.Td c="white">+S/.{t.service?.precio}</Table.Td></Table.Tr>)}</Table.Tbody></Table></ScrollArea></Card></Grid.Col>
                </Grid>
            </Tabs.Panel>
            
            {/* --- SERVICIOS --- */}
            <Tabs.Panel value="services">
                 <Card withBorder radius="md" p="lg" style={{background:'#111', borderColor:'#333'}}>
                    <Group align="flex-end" mb="lg">
                        <TextInput label="Nombre" value={formService.nombre} onChange={(e)=>setFormService({...formService, nombre: e.target.value})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <NumberInput label="Minutos" value={formService.minutos} onChange={(val)=>setFormService({...formService, minutos: val})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <NumberInput label="Precio" value={formService.precio} onChange={(val)=>setFormService({...formService, precio: val})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <Button color={isEditingService?"blue":"yellow"} loading={loadingAction} onClick={handleSaveService} styles={{root:{color:'black'}}}>{isEditingService?"GUARDAR":"AGREGAR"}</Button>
                        {isEditingService && <Button variant="default" onClick={()=>{setIsEditingService(false);setFormService({id:null,nombre:'',minutos:30,precio:0})}}>Cancelar</Button>}
                    </Group>
                    <Table>
                        <Table.Thead><Table.Tr><Table.Th c="dimmed">Nombre</Table.Th><Table.Th c="dimmed">Duración</Table.Th><Table.Th c="dimmed">Precio</Table.Th><Table.Th>Acciones</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>{services.map(s => (<Table.Tr key={s.id}><Table.Td style={{color:'white'}}>{s.nombre}</Table.Td><Table.Td style={{color:'white'}}>{s.duracion || s.duracionMinutos} min</Table.Td><Table.Td style={{color:'#c49b63'}}>S/.{s.precio}</Table.Td><Table.Td><Group gap="xs"><ActionIcon color="blue" variant="subtle" onClick={() => {setFormService({id:s.id, nombre:s.nombre, minutos:s.duracion, precio:s.precio}); setIsEditingService(true)}}><IconPencil size={16}/></ActionIcon><ActionIcon color="red" variant="subtle" onClick={() => openDeleteModal(s.id, 'service')}><IconTrash size={16}/></ActionIcon></Group></Table.Td></Table.Tr>))}</Table.Tbody>
                    </Table>
                </Card>
            </Tabs.Panel>

            {/* --- EQUIPO (BARBEROS) --- */}
            <Tabs.Panel value="team">
                <Grid>
                    {/* FORMULARIO STICKY */}
                    <Grid.Col span={{base:12, md:4}}>
                        <Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333', position:'sticky', top:'20px'}}>
                            <Text fw={700} c="white" mb="md" tt="uppercase" style={{borderBottom:'2px solid #c49b63', display:'inline-block'}}>
                                {isEditingBarber ? 'Editar Barbero' : 'Nuevo Barbero'}
                            </Text>
                            
                            <Center mb="md" style={{flexDirection:'column'}}>
                                <Avatar src={formBarber.imagenUrl} size={120} radius="100%" style={{border:'4px solid var(--primary-gold)'}}>
                                    {formBarber.nombre ? formBarber.nombre.charAt(0) : <IconUser size={40}/>}
                                </Avatar>
                                <Text size="xs" c="dimmed" mt="xs">Vista Previa</Text>
                            </Center>
                            
                            <TextInput label="Nombre Completo *" placeholder="Ej. Juan Pérez" mb="xs" value={formBarber.nombre} onChange={(e) => setFormBarber({...formBarber, nombre: e.target.value})} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} leftSection={<IconUser size={16}/>} />
                            
                            <Grid gutter="xs">
                                <Grid.Col span={6}>
                                    <TextInput label="DNI (8 dígitos) *" placeholder="Ej. 12345678" mb="xs" value={formBarber.dni} onChange={(e) => setFormBarber({...formBarber, dni: e.target.value.replace(/\D/g, '').slice(0,8)})} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} leftSection={<IconId size={16}/>}/>
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <TextInput label="Teléfono" placeholder="Ej. 999..." mb="xs" value={formBarber.telefono} onChange={(e) => setFormBarber({...formBarber, telefono: e.target.value})} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} leftSection={<IconPhone size={16}/>}/>
                                </Grid.Col>
                            </Grid>

                            <Select label="Sexo" mb="xs" data={['Masculino', 'Femenino', 'Otro']} value={formBarber.sexo} onChange={(val) => setFormBarber({...formBarber, sexo: val})} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}, dropdown:{background:'#222', color:'white'}}} leftSection={formBarber.sexo === 'Femenino' ? <IconGenderFemale size={16}/> : <IconGenderMale size={16}/>}/>

                            <TextInput label="URL Foto de Perfil" placeholder="https://..." mb="lg" value={formBarber.imagenUrl} onChange={(e) => setFormBarber({...formBarber, imagenUrl: e.target.value})} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} rightSection={<IconPhoto size={16} color="gray"/>} />
                            
                            <Group grow>
                                <Button color={isEditingBarber?"blue":"yellow"} loading={loadingAction} onClick={handleSaveBarber} styles={{root:{color: isEditingBarber?'white':'black'}}}>
                                    {isEditingBarber ? "GUARDAR CAMBIOS" : "REGISTRAR BARBERO"}
                                </Button>
                                {isEditingBarber && <Button variant="default" onClick={()=>{setFormBarber(initialBarberForm); setIsEditingBarber(false)}}>Cancelar</Button>}
                            </Group>
                        </Card>
                    </Grid.Col>

                    {/* GRILLA DE TARJETAS */}
                    <Grid.Col span={{base:12, md:8}}>
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 2 }} spacing="lg">
                            {barbers.map(b => (
                                <Card key={b.id} withBorder radius="lg" p="0" style={{background:'#1a1a1a', borderColor: b.activo ? '#333' : '#500000', opacity: b.activo ? 1 : 0.7, transition:'all 0.3s'}}>
                                    <Card.Section>
                                        <Image src="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-7.png" h={100} alt="bg" style={{filter: b.activo ? 'none' : 'grayscale(100%)'}} />
                                    </Card.Section>
                                    <Avatar src={b.imagenUrl} size={100} radius={100} mx="auto" mt={-50} style={{border:`4px solid ${b.activo ? '#c49b63' : '#333'}`, backgroundColor:'#111'}}>
                                        {b.nombre.charAt(0)}
                                    </Avatar>
                                    
                                    <Box p="md" ta="center">
                                        <Text fw={900} c="white" size="lg" tt="uppercase">{b.nombre}</Text>
                                        <Badge variant={b.activo ? "filled" : "outline"} color={b.activo ? "green" : "gray"} mb="md">{b.activo ? 'ACTIVO' : 'DE BAJA'}</Badge>
                                        
                                        <Group justify="center" gap="xs" mb="sm">
                                            <Badge leftSection={<IconId size={12}/>} color="gray" variant="outline">{b.dni}</Badge>
                                            <Badge leftSection={b.sexo === 'Femenino' ? <IconGenderFemale size={12}/> : <IconGenderMale size={12}/>} color="gray" variant="outline">{b.sexo}</Badge>
                                        </Group>
                                        {b.telefono && <Group justify="center" gap={5} c="dimmed" size="sm" mb="md"><IconPhone size={16}/><Text>{b.telefono}</Text></Group>}

                                        <Group grow>
                                            <ActionIcon variant="light" color="blue" size="lg" radius="md" onClick={() => handleEditBarberClick(b)}><IconPencil size={20}/></ActionIcon>
                                            <ActionIcon variant="light" color={b.activo ? "orange" : "green"} size="lg" radius="md" loading={loadingAction} onClick={() => toggleBarberStatus(b)}>
                                                {b.activo ? <IconUserOff size={20}/> : <IconUserCheck size={20}/>}
                                            </ActionIcon>
                                            <ActionIcon variant="light" color="red" size="lg" radius="md" onClick={() => openDeleteModal(b.id, 'barber')}><IconTrash size={20}/></ActionIcon>
                                        </Group>
                                    </Box>
                                </Card>
                            ))}
                        </SimpleGrid>
                    </Grid.Col>
                </Grid>
            </Tabs.Panel>

        </Tabs>

        {/* MODALES COMPARTIDOS */}
        <Modal opened={showQRModal} onClose={() => setShowQRModal(false)} title="WhatsApp" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}> <Center style={{flexDirection:'column'}}>{waStatus==='READY'?<IconBrandWhatsapp size={80} color="#40c057"/>:waQR?<Image src={waQR} w={250}/>:<Loader color="yellow"/>}</Center> </Modal>
        <Modal opened={!!selectedAppt} onClose={() => setSelectedAppt(null)} title="Gestión de Cita" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}> {selectedAppt && ( <div style={{display:'flex', flexDirection:'column', gap:'15px'}}> <Group justify="space-between"> <div><Text size="lg" fw={700} c="white">{selectedAppt.clienteNombre}</Text><Text size="sm" c="yellow">{selectedAppt.service?.nombre}</Text><Text size="xs" c="dimmed">Barbero: {selectedAppt.barber?.nombre || 'Cualquiera'}</Text></div> <Badge color={selectedAppt.estado==='COMPLETADO'?'blue':'yellow'}>{selectedAppt.estado}</Badge> </Group> <Card withBorder style={{background:'#1a1a1a', borderColor:'#333', padding:'10px'}}> <Group mb={5}><IconId size={16} color="gray"/><Text size="sm" c="dimmed">DNI: <span style={{color:'white'}}>{selectedAppt.clienteDni}</span></Text></Group> <Group mb={5}><IconPhone size={16} color="gray"/><Text size="sm" c="dimmed">Tel: <span style={{color:'white'}}>{selectedAppt.clientePhone}</span></Text></Group> <Group><IconClock size={16} color="gray"/><Text size="sm" c="dimmed">Fecha: <span style={{color:'white'}}>{dayjs(selectedAppt.fechaInicio).format('DD/MM/YYYY hh:mm A')}</span></Text></Group> </Card> {selectedAppt.estado !== 'COMPLETADO' && selectedAppt.estado !== 'CANCELADO' && ( <Button leftSection={<IconCheck size={20}/>} color="blue" fullWidth onClick={handleConfirmCut}>Confirmar y Cobrar (S/.{selectedAppt.service?.precio})</Button> )} <Button leftSection={<IconMessage size={18}/>} color="green" variant="light" fullWidth onClick={() => sendWhatsAppInternal(selectedAppt, 'avisar')}>Avisar Cliente</Button> <Button color="red" variant="subtle" fullWidth onClick={async () => { if(window.confirm('¿Cancelar?')) { await api.put(`/appointments/${selectedAppt.id}/cancel`); sendWhatsAppInternal(selectedAppt, 'cancel'); fetchData(); setSelectedAppt(null); } }}>Cancelar Cita</Button> </div> )} </Modal>
        <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="¿Borrar?" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}> <Text c="dimmed" size="sm" mb="lg">Esta acción es irreversible.</Text> <Group justify="flex-end"><Button variant="default" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button><Button color="red" loading={loadingAction} onClick={confirmDelete}>Eliminar</Button></Group> </Modal>
      </AppShell.Main>
    </AppShell>
  );
}