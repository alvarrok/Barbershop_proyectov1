import { useState, useEffect } from 'react';
import axios from 'axios';
import { AppShell, Text, Group, Button, Table, Tabs, Modal, Badge, Indicator, ActionIcon, TextInput, NumberInput, Card, Grid, Menu, ScrollArea, Box, Collapse, Avatar, Center, Loader, Image } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { DatePickerInput } from '@mantine/dates';
import { IconLogout, IconCalendar, IconScissors, IconBell, IconTrash, IconUser, IconBrandWhatsapp, IconCurrencyDollar, IconArrowRight, IconChartArea, IconCheck, IconPencil, IconMessage, IconClock, IconPhone, IconId } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // --- DATOS ---
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  
  // --- UI STATES ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState(null);
  
  // ESTADO SERVICIOS
  const [formService, setFormService] = useState({ id: null, nombre: '', minutos: 30, precio: 0 });
  const [isEditingService, setIsEditingService] = useState(false);
  
  // ESTADOS MODALES
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const [pendingAppts, setPendingAppts] = useState([]);
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [waQR, setWaQR] = useState(null);
  
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [finStartDate, setFinStartDate] = useState(dayjs().startOf('month').toDate());
  const [finEndDate, setFinEndDate] = useState(dayjs().endOf('month').toDate());

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) navigate('/admin');
    fetchData();
    checkWhatsAppStatus();
    const dataInterval = setInterval(fetchData, 15000);
    return () => clearInterval(dataInterval);
  }, []);

  const fetchData = async () => {
    try {
      const [resAppts, resServices] = await Promise.all([api.get('/appointments'), api.get('/services')]);
      const sortedAppts = (resAppts.data || []).sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
      setAppointments(sortedAppts);
      setServices(resServices.data);
      setPendingAppts(sortedAppts.filter(a => a.estado === 'PENDIENTE'));
    } catch (error) { console.error(error); }
  };

  const checkWhatsAppStatus = async () => {
      try { const res = await api.get('/whatsapp/status'); setWaStatus(res.data.status); setWaQR(res.data.qr); } catch (e) {}
  };

  const sendWhatsAppInternal = async (appt, type) => {
      if (waStatus !== 'READY') { setShowQRModal(true); return notifications.show({ message: 'Conecta WhatsApp primero', color: 'red' }); }
      const phone = appt.clientePhone.replace(/\D/g, '');
      const name = appt.clienteNombre.split(' ')[0];
      const dateStr = dayjs(appt.fechaInicio).format('DD/MM HH:mm');
      let msg = '';
      
      if (type === 'confirm') msg = `Hola ${name}, tu cita en BarberShop para el ${dateStr} está confirmada. ¡Nos vemos! 💈`;
      if (type === 'avisar') msg = `Hola ${name}, recordatorio de tu cita hoy a las ${dayjs(appt.fechaInicio).format('HH:mm')}. ¡Te esperamos!`;
      if (type === 'cancel') msg = `Hola ${name}, tu cita del ${dateStr} ha sido cancelada.`;
      if (type === 'completed') msg = `Hola ${name}, ¡gracias por tu visita!`;

      notifications.show({ id: 'sending', loading: true, message: 'Enviando...' });
      try {
          await api.post('/send-whatsapp', { phone, message: msg });
          notifications.update({ id: 'sending', color: 'green', message: 'Enviado', loading: false });
      } catch (error) { notifications.update({ id: 'sending', color: 'red', message: 'Error', loading: false }); }
  };

  const handleConfirmCut = async () => {
    if(!selectedAppt) return;
    try {
        await api.put(`/appointments/${selectedAppt.id}`, { estado: 'COMPLETADO' });
        notifications.show({ message: 'Cobrado y guardado 💰', color: 'blue', icon: <IconCheck/> });
        fetchData(); setSelectedAppt(null);
    } catch (error) { notifications.show({ message: 'Error (Revisa backend)', color: 'red' }); }
  };

  // --- LOGICA SERVICIOS ---
  const handleSaveService = async () => {
    if(!formService.nombre) return notifications.show({message:'Falta nombre', color:'red'});
    try {
        const payload = { ...formService, duracion: formService.minutos };
        if(isEditingService) {
            await api.put(`/services/${formService.id}`, payload);
            notifications.show({ message: 'Actualizado', color: 'green' });
        } else {
            await api.post('/services', payload);
            notifications.show({ message: 'Creado', color: 'green' });
        }
        setFormService({ id: null, nombre: '', minutos: 30, precio: 0 });
        setIsEditingService(false);
        fetchData();
    } catch(e) { notifications.show({ message: 'Error', color: 'red' }); }
  };

  const handleEditClick = (s) => {
      setFormService({ id: s.id, nombre: s.nombre, minutos: s.duracion || s.duracionMinutos || 30, precio: s.precio });
      setIsEditingService(true);
  };

  // ESTA FUNCION ABRE EL MODAL (Ya no usa window.confirm)
  const handleDeleteClick = (id) => {
      setServiceToDelete(id);
      setDeleteModalOpen(true);
  };

  // ESTA FUNCION EJECUTA EL BORRADO REAL
  const confirmDeleteService = async () => {
      try {
        await api.delete(`/services/${serviceToDelete}`);
        fetchData(); 
        notifications.show({ message: 'Servicio eliminado', color: 'green' });
      } catch(e) {
        notifications.show({ message: 'Error al eliminar', color: 'red' });
      }
      setDeleteModalOpen(false);
  };

  // RENDERIZADO
  const renderSchedule = () => {
      const hours = Array.from({length: 13}, (_, i) => i + 9); // 9am a 9pm
      return (
          <ScrollArea h={600} type="always" offsetScrollbars>
              {hours.map(h => {
                  const hourAppts = appointments.filter(a => dayjs(a.fechaInicio).isSame(selectedDate, 'day') && dayjs(a.fechaInicio).hour() === h && a.estado !== 'CANCELADO');
                  return (
                      <div key={h} style={{display:'flex', borderBottom:'1px solid #333', minHeight:'80px'}}>
                          <div style={{width:'70px', borderRight:'1px solid #333', padding:'15px 5px', color:'#777', fontWeight:'bold'}}>{h}:00</div>
                          <div style={{flex:1, padding:'5px'}}>
                              {hourAppts.map(appt => (
                                <Card key={appt.id} shadow="sm" padding="xs" radius="sm" onClick={() => setSelectedAppt(appt)}
                                  style={{marginBottom:'5px', background:'#25262b', borderLeft:`4px solid ${appt.estado==='COMPLETADO'?'#228be6':'#c49b63'}`, cursor:'pointer'}}>
                                  <Group justify="space-between"><Text size="sm" fw={700} c="white">{appt.clienteNombre}</Text><Badge size="xs" color="gray">{dayjs(appt.fechaInicio).format('HH:mm')}</Badge></Group>
                                  <Text size="xs" c="dimmed">{appt.service?.nombre}</Text>
                                </Card>
                              ))}
                          </div>
                      </div>
                  )
              })}
          </ScrollArea>
      )
  };

  const { filtered: finTrans, total: finTotal, graphData: finGraph } = (() => {
      const start = dayjs(finStartDate).startOf('day');
      const end = dayjs(finEndDate).endOf('day');
      const filtered = appointments.filter(a => dayjs(a.fechaInicio).isAfter(start) && dayjs(a.fechaInicio).isBefore(end) && a.estado === 'COMPLETADO').sort((a,b) => new Date(b.fechaInicio)-new Date(a.fechaInicio));
      const total = filtered.reduce((acc, curr) => acc + Number(curr.service?.precio || 0), 0);
      const graphMap = {};
      filtered.forEach(a => { const d = dayjs(a.fechaInicio).format('YYYY-MM-DD'); graphMap[d] = (graphMap[d] || 0) + Number(a.service?.precio || 0); });
      const graphData = Object.keys(graphMap).sort().map(k => ({ name: dayjs(k).format('DD/MM'), Ingresos: graphMap[k] }));
      return { filtered, total, graphData };
  })();

  return (
    <AppShell header={{ height: 70 }} padding="md" styles={{ main: { background: '#0a0a0a', color: 'white' } }}>
      <AppShell.Header style={{background: '#111', borderBottom: '1px solid #c49b63', padding: '0 20px', display:'flex', alignItems:'center'}}>
         <Group justify="space-between" w="100%">
             <Group><IconScissors size={28} color="#c49b63" /><Text fw={900} c="#c49b63" size="lg">ADMIN PANEL</Text></Group>
             <Group>
                 <Indicator color={waStatus === 'READY' ? 'green' : 'red'} processing={waStatus==='QR_READY'} size={12}>
                    <Button variant="subtle" color="gray" leftSection={<IconBrandWhatsapp/>} onClick={() => setShowQRModal(true)}>{waStatus === 'READY' ? 'Conectado' : 'Conectar'}</Button>
                 </Indicator>
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
            </Tabs.List>

            <Tabs.Panel value="agenda">
                <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                          <Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333'}}>
                            <Center><DatePicker value={selectedDate} onChange={setSelectedDate} styles={{ calendarHeader: {color:'white'}, day: {color:'white'}, dayLevel:{color:'white'} }} /></Center>
                          </Card>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333'}}>
                             <div style={{padding:'20px', background:'#1a1a1a', borderBottom:'1px solid #333'}}><Text fw={700} size="xl" c="#c49b63">{dayjs(selectedDate).format('dddd D [de] MMMM')}</Text></div>
                             {renderSchedule()}
                        </Card>
                    </Grid.Col>
                </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="finance">
                <Grid>
                    <Grid.Col span={12}>
                        <Card withBorder radius="md" p="lg" style={{background:'#111', borderColor:'#333'}}>
                            <Group>
                                <DatePickerInput label="Desde" value={finStartDate} onChange={setFinStartDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} />
                                <IconArrowRight color="gray" style={{marginTop:'25px'}} />
                                <DatePickerInput label="Hasta" value={finEndDate} onChange={setFinEndDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} />
                                <Card p="xs" radius="sm" style={{background:'#1a472a', marginLeft:'auto', minWidth:'200px'}}><Text size="xs" c="white">GANANCIA REALIZADA</Text><Text size="xl" fw={900} c="white">S/. {finTotal.toFixed(2)}</Text></Card>
                            </Group>
                        </Card>
                    </Grid.Col>
                    <Grid.Col span={{base:12, md:6}}>
                        <Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333', height:'300px'}}>
                            <ResponsiveContainer width="100%" height="100%"><AreaChart data={finGraph}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="name" stroke="#888" /><YAxis stroke="#888" /><Tooltip contentStyle={{backgroundColor:'#222'}} /><Area type="monotone" dataKey="Ingresos" stroke="#8884d8" fill="#8884d8" /></AreaChart></ResponsiveContainer>
                        </Card>
                    </Grid.Col>
                    <Grid.Col span={{base:12, md:6}}>
                         <Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333', height:'300px'}}><ScrollArea><Table><Table.Tbody>{finTrans.map(t=><Table.Tr key={t.id}><Table.Td style={{color:'#c49b63'}}>{dayjs(t.fechaInicio).format('DD/MM')}</Table.Td><Table.Td><Text size="sm" c="white">{t.clienteNombre}</Text><Text size="xs" c="dimmed">{t.service?.nombre}</Text></Table.Td><Table.Td c="white">+S/.{t.service?.precio}</Table.Td></Table.Tr>)}</Table.Tbody></Table></ScrollArea></Card>
                    </Grid.Col>
                </Grid>
            </Tabs.Panel>
            
            <Tabs.Panel value="services">
                 <Card withBorder radius="md" p="lg" style={{background:'#111', borderColor:'#333'}}>
                    <Group align="flex-end" mb="lg">
                        <TextInput label="Nombre" value={formService.nombre} onChange={(e)=>setFormService({...formService, nombre: e.target.value})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <NumberInput label="Minutos" value={formService.minutos} onChange={(val)=>setFormService({...formService, minutos: val})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <NumberInput label="Precio" value={formService.precio} onChange={(val)=>setFormService({...formService, precio: val})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <Button color={isEditingService ? "blue" : "yellow"} onClick={handleSaveService} styles={{root:{color:'black'}}}>{isEditingService ? "GUARDAR CAMBIOS" : "AGREGAR"}</Button>
                        {isEditingService && <Button variant="default" onClick={()=>{setIsEditingService(false); setFormService({id:null, nombre:'', minutos:30, precio:0})}}>Cancelar</Button>}
                    </Group>
                    <Table>
                        {/* TABLA CORREGIDA CON COLUMNA DURACION */}
                        <Table.Thead><Table.Tr><Table.Th c="dimmed">Nombre</Table.Th><Table.Th c="dimmed">Duración</Table.Th><Table.Th c="dimmed">Precio</Table.Th><Table.Th>Acciones</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                            {services.map(s => (
                                <Table.Tr key={s.id}>
                                    <Table.Td style={{color:'white'}}>{s.nombre}</Table.Td>
                                    <Table.Td style={{color:'white'}}>{s.duracion || s.duracionMinutos} min</Table.Td>
                                    <Table.Td style={{color:'#c49b63'}}>S/.{s.precio}</Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <ActionIcon color="blue" variant="subtle" onClick={() => handleEditClick(s)}><IconPencil size={16}/></ActionIcon>
                                            <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteClick(s.id)}><IconTrash size={16}/></ActionIcon>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Card>
            </Tabs.Panel>
        </Tabs>

        {/* MODAL QR */}
        <Modal opened={showQRModal} onClose={() => setShowQRModal(false)} title="WhatsApp" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}>
            <Center style={{flexDirection:'column'}}>
                {waStatus === 'READY' ? <IconBrandWhatsapp size={80} color="#40c057"/> : waQR ? <Image src={waQR} w={250} /> : <Loader color="yellow" />}
            </Center>
        </Modal>

        {/* MODAL CITA - CON TODOS LOS DATOS */}
        <Modal opened={!!selectedAppt} onClose={() => setSelectedAppt(null)} title="Gestión de Cita" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}>
            {selectedAppt && (
                <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    <Group justify="space-between">
                        <div>
                            <Text size="lg" fw={700} c="white">{selectedAppt.clienteNombre}</Text>
                            <Text size="sm" c="yellow" fw={700} tt="uppercase">{selectedAppt.service?.nombre}</Text>
                        </div>
                        <Badge color={selectedAppt.estado === 'COMPLETADO' ? 'blue' : selectedAppt.estado === 'PENDIENTE' ? 'yellow' : 'red'}>{selectedAppt.estado}</Badge>
                    </Group>
                    
                    {/* DATOS COMPLETOS DE LA CITA */}
                    <Card withBorder style={{background:'#1a1a1a', borderColor:'#333', padding:'10px'}}>
                        <Group mb={5}><IconId size={16} color="gray"/><Text size="sm" c="dimmed">DNI: <span style={{color:'white'}}>{selectedAppt.clienteDni}</span></Text></Group>
                        <Group mb={5}><IconPhone size={16} color="gray"/><Text size="sm" c="dimmed">Tel: <span style={{color:'white'}}>{selectedAppt.clientePhone}</span></Text></Group>
                        <Group><IconClock size={16} color="gray"/><Text size="sm" c="dimmed">Fecha: <span style={{color:'white'}}>{dayjs(selectedAppt.fechaInicio).format('DD/MM/YYYY hh:mm A')}</span></Text></Group>
                    </Card>

                    {selectedAppt.estado !== 'COMPLETADO' && selectedAppt.estado !== 'CANCELADO' && (
                        <Button leftSection={<IconCheck size={20}/>} color="blue" fullWidth onClick={handleConfirmCut}>Confirmar y Cobrar (S/.{selectedAppt.service?.precio})</Button>
                    )}

                    <Button leftSection={<IconMessage size={18}/>} color="green" variant="light" fullWidth onClick={() => sendWhatsAppInternal(selectedAppt, 'avisar')}>Avisar Cliente (Recordatorio)</Button>
                    
                    <Button color="red" variant="subtle" fullWidth onClick={async () => {
                         if(window.confirm('¿Cancelar?')) { await api.put(`/appointments/${selectedAppt.id}/cancel`); sendWhatsAppInternal(selectedAppt, 'cancel'); fetchData(); setSelectedAppt(null); }
                    }}>Cancelar Cita</Button>
                </div>
            )}
        </Modal>

        {/* MODAL ELIMINAR SERVICIO (Ya no usa alert) */}
        <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="¿Eliminar Servicio?" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}>
            <Text c="dimmed" size="sm" mb="lg">Esta acción borrará el servicio permanentemente.</Text>
            <Group justify="flex-end">
                <Button variant="default" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
                <Button color="red" onClick={confirmDeleteService}>Eliminar</Button>
            </Group>
        </Modal>
      </AppShell.Main>
    </AppShell>
  );
}