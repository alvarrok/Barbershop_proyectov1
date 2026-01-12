import { useState, useEffect } from 'react';
import axios from 'axios';
import { AppShell, Text, Group, Button, Table, Tabs, Modal, Badge, Indicator, ActionIcon, TextInput, NumberInput, Card, Grid, Menu, ScrollArea, Box, Collapse, Avatar, Center, Loader, Image } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { DatePickerInput } from '@mantine/dates';
import { IconLogout, IconCalendar, IconScissors, IconBell, IconTrash, IconUser, IconBrandWhatsapp, IconCurrencyDollar, IconArrowRight, IconChartArea, IconCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// Configuración regional
dayjs.locale('es');

const api = axios.create({ 
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' 
});

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // --- DATOS ---
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  
  // --- UI STATES ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [newService, setNewService] = useState({ nombre: '', duracion: 30, precio: 0 });
  const [pendingAppts, setPendingAppts] = useState([]);

  // --- MODAL ELIMINAR SERVICIO (NUEVO) ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  
  // --- WHATSAPP STATES ---
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [waQR, setWaQR] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // --- REPROGRAMACIÓN ---
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);

  // --- FINANZAS ---
  const [finStartDate, setFinStartDate] = useState(dayjs().startOf('month').toDate());
  const [finEndDate, setFinEndDate] = useState(dayjs().endOf('month').toDate());

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) navigate('/admin');
    
    fetchData();
    checkWhatsAppStatus();
    
    // Actualización automática
    const dataInterval = setInterval(fetchData, 15000);
    const waInterval = setInterval(checkWhatsAppStatus, 5000);
    
    return () => { clearInterval(dataInterval); clearInterval(waInterval); };
  }, []);

  const fetchData = async () => {
    try {
      const [resAppts, resServices] = await Promise.all([api.get('/appointments'), api.get('/services')]);
      
      const sortedAppts = (Array.isArray(resAppts.data) ? resAppts.data : [])
        .sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

      setAppointments(sortedAppts);
      setServices(resServices.data);
      setPendingAppts(sortedAppts.filter(a => a.estado === 'PENDIENTE'));
    } catch (error) { console.error(error); }
  };

  const checkWhatsAppStatus = async () => {
      try {
          const res = await api.get('/whatsapp/status');
          setWaStatus(res.data.status);
          setWaQR(res.data.qr);
      } catch (e) { console.error("Error WA status", e); }
  };

  const handleLogout = () => { localStorage.removeItem('adminToken'); navigate('/'); };

  // --- LÓGICA WHATSAPP ---
  const sendWhatsAppInternal = async (appt, type) => {
      if (waStatus !== 'READY') {
          setShowQRModal(true);
          return notifications.show({ title: 'WhatsApp Desconectado', message: 'Escanea el QR primero.', color: 'red' });
      }

      const phone = appt.clientePhone.replace(/\D/g, '');
      const name = appt.clienteNombre.split(' ')[0];
      const dateStr = dayjs(appt.fechaInicio).format('DD/MM HH:mm');
      
      let msg = '';
      if (type === 'confirm') msg = `Hola ${name}, confirmamos tu cita en BarberShop para el ${dateStr}. ¡Te esperamos! 💈`;
      if (type === 'cancel') msg = `Hola ${name}, lamentamos informarte que tu cita del ${dateStr} ha sido cancelada.`;
      if (type === 'reschedule') msg = `Hola ${name}, tu cita ha sido reprogramada para el ${dayjs(rescheduleDate || appt.fechaInicio).format('DD/MM HH:mm')}.`;
      if (type === 'completed') msg = `Hola ${name}, ¡gracias por tu visita! Esperamos que te haya gustado el corte.`;

      notifications.show({ id: 'sending-wa', loading: true, title: 'Enviando...', message: 'Procesando mensaje', autoClose: false, withCloseButton: false });

      try {
          await api.post('/send-whatsapp', { phone, message: msg });
          notifications.update({ id: 'sending-wa', color: 'green', title: 'Enviado', message: 'Mensaje entregado.', loading: false, autoClose: 3000 });
      } catch (error) {
          notifications.update({ id: 'sending-wa', color: 'red', title: 'Error', message: 'Fallo al enviar.', loading: false, autoClose: 4000 });
      }
  };

  // --- ACCIONES CITA ---
  const handleConfirmCut = async () => {
    if(!selectedAppt) return;
    try {
        await api.put(`/appointments/${selectedAppt.id}`, { estado: 'COMPLETADO' });
        notifications.show({ message: 'Corte completado y sumado a caja 💰', color: 'blue', icon: <IconCheck/> });
        fetchData();
        setSelectedAppt(null);
    } catch (error) {
        notifications.show({ message: 'Error al confirmar', color: 'red' });
    }
  };

  const handleAddService = async () => {
    if(!newService.nombre) return notifications.show({message:'Nombre requerido', color:'red'});
    try {
        await api.post('/services', newService);
        fetchData();
        setNewService({ nombre: '', duracion: 30, precio: 0 });
        notifications.show({ message: 'Servicio creado', color: 'green' });
    } catch(e) { notifications.show({ message: 'Error', color: 'red' }); }
  };
  
  // --- LÓGICA MODAL ELIMINAR (NUEVO) ---
  const openDeleteModal = (id) => {
      setServiceToDelete(id);
      setDeleteModalOpen(true);
  };

  const confirmDeleteService = async () => {
      try {
          await api.delete(`/services/${serviceToDelete}`);
          fetchData();
          notifications.show({ message: 'Servicio eliminado correctamente', color: 'green' });
      } catch (e) { 
          notifications.show({ message: 'No se puede eliminar el servicio', color: 'red' }); 
      }
      setDeleteModalOpen(false);
      setServiceToDelete(null);
  };

  // --- RENDER AGENDA ---
  const renderSchedule = () => {
      const hours = Array.from({length: 15}, (_, i) => i + 8); 
      
      return (
          <ScrollArea h={600} type="always" offsetScrollbars>
              {hours.map(h => {
                  const hourAppts = appointments.filter(a => {
                      if(!a.fechaInicio) return false;
                      const d = dayjs(a.fechaInicio);
                      return d.isSame(selectedDate, 'day') && d.hour() === h && a.estado !== 'CANCELADO';
                  });

                  return (
                      <div key={h} style={{display:'flex', borderBottom:'1px solid #333', minHeight:'90px'}}>
                          <div style={{width:'80px', borderRight:'1px solid #333', padding:'20px 10px', color:'#777', fontWeight:'bold', fontSize:'0.9rem'}}>{h}:00</div>
                          <div style={{flex:1, padding:'5px', background: hourAppts.length > 0 ? 'rgba(196, 155, 99, 0.05)' : 'transparent'}}>
                              {hourAppts.map(appt => {
                                  let statusColor = '#c49b63'; 
                                  if (appt.estado === 'COMPLETADO') statusColor = '#228be6'; 

                                  return (
                                    <Card key={appt.id} shadow="sm" padding="xs" radius="sm" onClick={() => setSelectedAppt(appt)}
                                      style={{marginBottom:'5px', background:'#25262b', borderLeft:`4px solid ${statusColor}`, cursor:'pointer', border:'1px solid #333'}}>
                                      <Group justify="space-between">
                                          <Text size="sm" fw={700} c="white">{appt.clienteNombre}</Text>
                                          <Badge size="xs" color="gray" variant="outline">{dayjs(appt.fechaInicio).format('HH:mm')}</Badge>
                                      </Group>
                                      <Text size="xs" c="dimmed">{appt.service?.nombre}</Text>
                                      {appt.estado === 'COMPLETADO' && <Badge size="xs" color="blue" mt={5}>COBRADO</Badge>}
                                    </Card>
                                  )
                              })}
                          </div>
                      </div>
                  )
              })}
          </ScrollArea>
      )
  };

  // --- LÓGICA FINANCIERA ---
  const getFinancialData = () => {
      const start = dayjs(finStartDate).startOf('day');
      const end = dayjs(finEndDate).endOf('day');
      
      const filtered = appointments.filter(a => {
          const d = dayjs(a.fechaInicio);
          return d.isAfter(start) && d.isBefore(end) && a.estado === 'COMPLETADO';
      });

      filtered.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

      const total = filtered.reduce((acc, curr) => acc + Number(curr.service?.precio || 0), 0);
      
      const graphDataMap = {};
      filtered.forEach(a => {
           const d = dayjs(a.fechaInicio).format('YYYY-MM-DD');
           graphDataMap[d] = (graphDataMap[d] || 0) + Number(a.service?.precio || 0);
      });
      
      const graphData = Object.keys(graphDataMap).sort().map(k => ({ 
          name: dayjs(k).format('DD/MM'), 
          Ingresos: graphDataMap[k] 
      }));

      return { filtered, total, graphData };
  };
  const { filtered: finTrans, total: finTotal, graphData: finGraph } = getFinancialData();

  const citasHoyCount = appointments.filter(a => 
    dayjs(a.fechaInicio).format('DD/MM/YYYY') === dayjs().format('DD/MM/YYYY') && a.estado !== 'CANCELADO'
  ).length;

  return (
    <AppShell header={{ height: 70 }} padding="md" styles={{ main: { background: '#0a0a0a', color: 'white' } }}>
      <AppShell.Header style={{background: '#111', borderBottom: '1px solid #c49b63', padding: '0 20px', display:'flex', alignItems:'center'}}>
         <Group justify="space-between" w="100%">
             <Group>
                <IconScissors size={28} color="#c49b63" />
                <Text fw={900} c="#c49b63" size="lg" visibleFrom="xs">ADMIN PANEL</Text>
             </Group>
             <Group>
                 <Indicator color={waStatus === 'READY' ? 'green' : 'red'} processing={waStatus==='QR_READY'} size={12} offset={4}>
                    <Button variant="subtle" color="gray" leftSection={<IconBrandWhatsapp size={20}/>} onClick={() => setShowQRModal(true)}>
                        {waStatus === 'READY' ? 'WhatsApp ON' : 'Conectar'}
                    </Button>
                 </Indicator>

                 <Menu shadow="md" width={300}>
                    <Menu.Target>
                        <Indicator label={pendingAppts.length} color="red" size={16} disabled={pendingAppts.length === 0}>
                            <ActionIcon variant="transparent" size="lg"><IconBell color="white" /></ActionIcon>
                        </Indicator>
                    </Menu.Target>
                    <Menu.Dropdown style={{background:'#222', borderColor:'#444'}}>
                        <Menu.Label>Pendientes ({pendingAppts.length})</Menu.Label>
                        <ScrollArea.Autosize maxHeight={300}>
                             {pendingAppts.map(a => (
                                <Menu.Item key={a.id} leftSection={<Avatar color="yellow" radius="xl">{a.clienteNombre.charAt(0)}</Avatar>} onClick={() => setSelectedAppt(a)} style={{borderBottom:'1px solid #333'}}>
                                    <Text size="sm" c="white" fw={700}>{a.clienteNombre}</Text>
                                    <Text size="xs" c="dimmed">{dayjs(a.fechaInicio).format('DD/MM HH:mm')}</Text>
                                </Menu.Item>
                             ))}
                        </ScrollArea.Autosize>
                    </Menu.Dropdown>
                 </Menu>
                 <Button variant="subtle" color="yellow" leftSection={<IconLogout size={18}/>} onClick={handleLogout}>Salir</Button>
             </Group>
         </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Tabs defaultValue="agenda" variant="pills" color="yellow" radius="md">
            <Tabs.List mb="lg" style={{background:'#111', padding:'10px', borderRadius:'8px'}}>
                <Tabs.Tab value="agenda" leftSection={<IconCalendar size={18}/>} c="white">Agenda</Tabs.Tab>
                <Tabs.Tab value="finance" leftSection={<IconCurrencyDollar size={18}/>} c="white">Finanzas</Tabs.Tab>
                <Tabs.Tab value="services" leftSection={<IconScissors size={18}/>} c="white">Servicios</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="agenda">
                <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                          <Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333'}}>
                            <Text size="xs" c="dimmed" mb="sm" fw={700}>SELECCIONAR FECHA</Text>
                            <Center>
                                <DatePicker value={selectedDate} onChange={setSelectedDate} styles={{ calendarHeader: {color:'white'}, day: {color:'white'}, dayLevel:{color:'white'} }} />
                            </Center>
                          </Card>
                          <Card mt="md" withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333'}}>
                             <Text size="xs" c="dimmed" mb="sm" fw={700}>RESUMEN DEL DÍA REAL</Text>
                             <Group justify="space-between" mb="xs">
                                <Text c="white">Citas Hoy ({dayjs().format('DD/MM')}):</Text>
                                <Text fw={900} c="#c49b63" size="xl">{citasHoyCount}</Text>
                             </Group>
                          </Card>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333'}}>
                             <div style={{padding:'20px', background:'#1a1a1a', borderBottom:'1px solid #333', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <Text fw={700} size="xl" c="#c49b63">{dayjs(selectedDate).format('dddd D [de] MMMM')}</Text>
                                <Badge size="lg" color="yellow">{appointments.filter(a => dayjs(a.fechaInicio).isSame(selectedDate, 'day') && a.estado !== 'CANCELADO').length} CITAS</Badge>
                             </div>
                             {renderSchedule()}
                        </Card>
                    </Grid.Col>
                </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="finance">
                <Grid>
                    <Grid.Col span={12}>
                        <Card withBorder radius="md" p="lg" style={{background:'#111', borderColor:'#333'}}>
                            <Text fw={700} c="white" mb="sm">FILTRAR CAJA (Solo Completados)</Text>
                            <Group>
                                <DatePickerInput label="Desde" value={finStartDate} onChange={setFinStartDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} />
                                <IconArrowRight color="gray" style={{marginTop:'25px'}} />
                                <DatePickerInput label="Hasta" value={finEndDate} onChange={setFinEndDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} />
                                <Card p="xs" radius="sm" style={{background:'#1a472a', marginLeft:'auto', minWidth:'200px'}}>
                                    <Text size="xs" c="white">GANANCIA REALIZADA</Text>
                                    <Text size="xl" fw={900} c="white">S/. {finTotal.toFixed(2)}</Text>
                                </Card>
                            </Group>
                        </Card>
                    </Grid.Col>
                    
                    <Grid.Col span={{base:12, md:6}}>
                        <Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333', height:'100%', minHeight:'300px'}}>
                            <Group mb="md"><IconChartArea color="cyan" /><Text fw={700} c="white">EVOLUCIÓN DE INGRESOS</Text></Group>
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={finGraph}>
                                    <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="name" stroke="#888" />
                                    <YAxis stroke="#888" />
                                    <Tooltip contentStyle={{backgroundColor:'#222', border:'1px solid #555', color:'white'}} />
                                    <Area type="monotone" dataKey="Ingresos" stroke="#8884d8" fillOpacity={1} fill="url(#colorIngresos)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{base:12, md:6}}>
                        <Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333', height:'100%', display:'flex', flexDirection:'column'}}>
                            <Box p="md" style={{borderBottom:'1px solid #333'}}><Text fw={700} c="white">DETALLE INGRESOS (Confirmados)</Text></Box>
                            <ScrollArea style={{flex:1}}>
                                <Table>
                                    <Table.Thead><Table.Tr><Table.Th c="dimmed">Fecha</Table.Th><Table.Th c="dimmed">Cliente / Servicio</Table.Th><Table.Th c="dimmed">Monto</Table.Th></Table.Tr></Table.Thead>
                                    <Table.Tbody>
                                        {finTrans.length > 0 ? finTrans.map(t => (
                                            <Table.Tr key={t.id}>
                                                <Table.Td style={{color:'#c49b63'}}>{dayjs(t.fechaInicio).format('DD/MM/YY')}</Table.Td>
                                                <Table.Td>
                                                    <Text size="sm" c="white" fw={500}>{t.clienteNombre}</Text>
                                                    <Text size="xs" c="dimmed">{t.service?.nombre}</Text>
                                                </Table.Td>
                                                <Table.Td c="white" fw={700}>+S/.{t.service?.precio}</Table.Td>
                                            </Table.Tr>
                                        )) : (
                                            <Table.Tr><Table.Td colSpan={3} align="center" c="dimmed">No hay ingresos confirmados en este rango</Table.Td></Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Card>
                    </Grid.Col>
                </Grid>
            </Tabs.Panel>
            
            <Tabs.Panel value="services">
                 <Card withBorder radius="md" p="lg" style={{background:'#111', borderColor:'#333'}}>
                    <Group align="flex-end" mb="lg">
                        <TextInput label="Nombre" placeholder="Ej. Corte" value={newService.nombre} onChange={(e)=>setNewService({...newService, nombre: e.target.value})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <NumberInput label="Minutos" value={newService.duracion} onChange={(val)=>setNewService({...newService, duracion: val})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <NumberInput label="Precio" value={newService.precio} onChange={(val)=>setNewService({...newService, precio: val})} styles={{input:{background:'#333', color:'white'}, label:{color:'white'}}}/>
                        <Button color="yellow" onClick={handleAddService} styles={{root:{background:'#c49b63', color:'black'}}}>AGREGAR</Button>
                    </Group>
                    <Table>
                        <Table.Tbody>
                            {services.map(s => (
                                <Table.Tr key={s.id}>
                                    <Table.Td style={{color:'white'}}>{s.nombre}</Table.Td>
                                    <Table.Td style={{color:'#c49b63'}}>S/.{s.precio}</Table.Td>
                                    {/* AQUI ESTA EL CAMBIO: LLAMA A LA FUNCION QUE ABRE EL MODAL */}
                                    <Table.Td><ActionIcon color="red" variant="subtle" onClick={() => openDeleteModal(s.id)}><IconTrash size={16}/></ActionIcon></Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Card>
            </Tabs.Panel>
        </Tabs>

        {/* MODAL QR */}
        <Modal opened={showQRModal} onClose={() => setShowQRModal(false)} title="Conectar WhatsApp" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}>
            <Center style={{flexDirection:'column'}}>
                {waStatus === 'READY' ? (
                    <>
                        <IconBrandWhatsapp size={80} color="#40c057" />
                        <Text c="white" mt="md" fw={700}>¡Sistema Conectado!</Text>
                    </>
                ) : waStatus === 'QR_READY' && waQR ? (
                    <>
                        <Text c="yellow" mb="md">Escanea este código:</Text>
                        <Image src={waQR} w={250} h={250} style={{border:'5px solid white', borderRadius:'8px'}} />
                    </>
                ) : (
                    <Loader color="yellow" />
                )}
            </Center>
        </Modal>

        {/* MODAL DETALLE CITA */}
        <Modal opened={!!selectedAppt} onClose={() => {setSelectedAppt(null); setIsRescheduling(false);}} title="Gestión de Cita" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}>
            {selectedAppt && (
                <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    <Group justify="space-between">
                        <Text size="lg" fw={700}>{selectedAppt.clienteNombre}</Text>
                        <Badge color={selectedAppt.estado === 'COMPLETADO' ? 'blue' : selectedAppt.estado === 'PENDIENTE' ? 'yellow' : 'red'}>{selectedAppt.estado}</Badge>
                    </Group>
                    <Card withBorder style={{background:'#111', borderColor:'#333'}}>
                        <Group><IconUser size={16} color="gray"/><Text size="sm" c="dimmed">DNI: {selectedAppt.clienteDni}</Text></Group>
                        <Group><IconBrandWhatsapp size={16} color="gray"/><Text size="sm" c="dimmed">Tel: {selectedAppt.clientePhone}</Text></Group>
                    </Card>
                    
                    {selectedAppt.estado !== 'COMPLETADO' && selectedAppt.estado !== 'CANCELADO' && (
                        <Button 
                            leftSection={<IconCheck size={20}/>} 
                            color="blue" 
                            fullWidth 
                            size="md"
                            onClick={handleConfirmCut}
                            styles={{root:{boxShadow:'0 0 10px rgba(34, 139, 230, 0.3)'}}}
                        >
                            Confirmar y Cobrar (S/.{selectedAppt.service?.precio})
                        </Button>
                    )}

                    <Button leftSection={<IconBrandWhatsapp size={18}/>} color="green" variant="light" fullWidth onClick={() => sendWhatsAppInternal(selectedAppt, 'confirm')}>Confirmar (WhatsApp)</Button>
                    
                    {selectedAppt.estado !== 'COMPLETADO' && (
                        <>
                            <Button variant="outline" color="yellow" onClick={() => setIsRescheduling(!isRescheduling)}>{isRescheduling ? 'Cancelar Edición' : 'Reprogramar'}</Button>
                            <Collapse in={isRescheduling}>
                                <Card withBorder style={{borderColor:'#c49b63', background:'#111'}} mt="xs">
                                    <DatePickerInput placeholder="Nueva Fecha" value={rescheduleDate} onChange={setRescheduleDate} styles={{input:{background:'#222', color:'white'}}} />
                                    <Button fullWidth mt="xs" color="yellow" onClick={async () => {
                                        await api.put(`/appointments/${selectedAppt.id}`, { newDateISO: rescheduleDate });
                                        sendWhatsAppInternal({...selectedAppt, fechaInicio: rescheduleDate}, 'reschedule');
                                        fetchData(); setSelectedAppt(null);
                                    }}>Guardar</Button>
                                </Card>
                            </Collapse>

                            <Button color="red" variant="subtle" fullWidth onClick={async () => {
                                if(window.confirm('¿Cancelar cita?')) {
                                     await api.put(`/appointments/${selectedAppt.id}/cancel`);
                                     sendWhatsAppInternal(selectedAppt, 'cancel');
                                     fetchData(); setSelectedAppt(null);
                                }
                            }}>Cancelar Cita</Button>
                        </>
                    )}
                </div>
            )}
        </Modal>

        {/* MODAL DE CONFIRMACIÓN DE ELIMINAR (NUEVO) */}
        <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="¿Estás seguro?" centered styles={{header:{background:'#222', color:'white'}, body:{background:'#222', color:'white'}}}>
            <Text c="dimmed" size="sm" mb="lg">
                Estás a punto de eliminar un servicio. Esta acción no se puede deshacer.
            </Text>
            <Group justify="flex-end">
                <Button variant="default" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
                <Button color="red" onClick={confirmDeleteService}>Eliminar Servicio</Button>
            </Group>
        </Modal>
      </AppShell.Main>
    </AppShell>
  );
}