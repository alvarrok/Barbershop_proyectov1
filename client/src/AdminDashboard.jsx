import { useState, useEffect } from 'react';
import axios from 'axios';
import { AppShell, Text, Group, Button, Table, Tabs, Modal, Badge, Indicator, ActionIcon, TextInput, NumberInput, Card, Grid, Menu, ScrollArea, Box, Collapse, Avatar, Center, Loader, Image, RingProgress } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { DatePickerInput } from '@mantine/dates';
import { IconLogout, IconCalendar, IconScissors, IconBell, IconTrash, IconUser, IconBrandWhatsapp, IconClock, IconCurrencyDollar, IconArrowRight, IconTrophy, IconStar } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// Configuración regional
dayjs.locale('es');
const api = axios.create({ baseURL: 'http://localhost:3000/api' });
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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
      
      // Ordenar citas por fecha (Más reciente primero) para asegurar consistencia
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

      notifications.show({ id: 'sending-wa', loading: true, title: 'Enviando...', message: 'Procesando mensaje', autoClose: false, withCloseButton: false });

      try {
          await api.post('/send-whatsapp', { phone, message: msg });
          notifications.update({ id: 'sending-wa', color: 'green', title: 'Enviado', message: 'Mensaje entregado.', loading: false, autoClose: 3000 });
      } catch (error) {
          notifications.update({ id: 'sending-wa', color: 'red', title: 'Error', message: 'Fallo al enviar.', loading: false, autoClose: 4000 });
      }
  };

  // --- SERVICIOS ---
  const handleAddService = async () => {
    if(!newService.nombre) return notifications.show({message:'Nombre requerido', color:'red'});
    try {
        await api.post('/services', newService);
        fetchData();
        setNewService({ nombre: '', duracion: 30, precio: 0 });
        notifications.show({ message: 'Servicio creado', color: 'green' });
    } catch(e) { notifications.show({ message: 'Error', color: 'red' }); }
  };
  
  const handleDeleteService = async (id) => {
      if(!window.confirm("¿Eliminar servicio?")) return;
      try {
          await api.delete(`/services/${id}`);
          fetchData();
          notifications.show({ message: 'Eliminado', color: 'green' });
      } catch (e) { notifications.show({ message: 'No se puede eliminar', color: 'red' }); }
  };

  // --- RENDER AGENDA (CORREGIDO) ---
  const renderSchedule = () => {
      // Ampliamos horario de 8am a 10pm (22:00) para cubrir todo el día
      const hours = Array.from({length: 15}, (_, i) => i + 8); 
      
      return (
          <ScrollArea h={600} type="always" offsetScrollbars>
              {hours.map(h => {
                  const hourAppts = appointments.filter(a => {
                      if(!a.fechaInicio) return false;
                      const d = dayjs(a.fechaInicio);
                      // Comparación estricta de hora y día
                      return d.isSame(selectedDate, 'day') && d.hour() === h && a.estado !== 'CANCELADO';
                  });

                  return (
                      <div key={h} style={{display:'flex', borderBottom:'1px solid #333', minHeight:'90px'}}>
                          <div style={{width:'80px', borderRight:'1px solid #333', padding:'20px 10px', color:'#777', fontWeight:'bold', fontSize:'0.9rem'}}>{h}:00</div>
                          <div style={{flex:1, padding:'5px', background: hourAppts.length > 0 ? 'rgba(196, 155, 99, 0.05)' : 'transparent'}}>
                              {hourAppts.map(appt => (
                                  <Card key={appt.id} shadow="sm" padding="xs" radius="sm" onClick={() => setSelectedAppt(appt)}
                                    style={{marginBottom:'5px', background:'#25262b', borderLeft:`4px solid ${appt.estado==='PENDIENTE'?'#c49b63':'#40c057'}`, cursor:'pointer', border:'1px solid #333'}}>
                                      <Group justify="space-between">
                                          <Text size="sm" fw={700} c="white">{appt.clienteNombre}</Text>
                                          <Badge size="xs" color="gray" variant="outline">{dayjs(appt.fechaInicio).format('HH:mm')}</Badge>
                                      </Group>
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

  // --- LÓGICA FINANCIERA Y RANKING (VALOR AGREGADO) ---
  const getFinancialData = () => {
      const start = dayjs(finStartDate).startOf('day');
      const end = dayjs(finEndDate).endOf('day');
      
      // Filtrar por rango
      const filtered = appointments.filter(a => {
          const d = dayjs(a.fechaInicio);
          return d.isAfter(start) && d.isBefore(end) && a.estado !== 'CANCELADO';
      });

      // Ordenar por fecha DESCENDENTE (Lo más nuevo arriba) - SOLUCIÓN A TU PEDIDO
      filtered.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

      const total = filtered.reduce((acc, curr) => acc + Number(curr.service?.precio || 0), 0);
      
      // Datos Gráfico
      const graphDataMap = {};
      filtered.forEach(a => {
           // Invertimos el orden para el gráfico (Cronológico)
           const d = dayjs(a.fechaInicio).format('DD/MM');
           graphDataMap[d] = (graphDataMap[d] || 0) + Number(a.service?.precio || 0);
      });
      const graphData = Object.keys(graphDataMap).reverse().map(k => ({ name: k, Ingresos: graphDataMap[k] }));

      // --- VALOR AGREGADO: RANKING DE CLIENTES ---
      const clientStats = {};
      appointments.forEach(a => {
          if(a.estado === 'CANCELADO') return;
          if(!clientStats[a.clienteDni]) clientStats[a.clienteDni] = { name: a.clienteNombre, visits: 0, total: 0 };
          clientStats[a.clienteDni].visits += 1;
          clientStats[a.clienteDni].total += Number(a.service?.precio || 0);
      });
      const topClients = Object.values(clientStats).sort((a,b) => b.total - a.total).slice(0, 3); // Top 3

      return { filtered, total, graphData, topClients };
  };
  const { filtered: finTrans, total: finTotal, graphData: finGraph, topClients } = getFinancialData();

  // Contador "Citas Hoy" corregido
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
                <Tabs.Tab value="finance" leftSection={<IconCurrencyDollar size={18}/>} c="white">Finanzas & VIP</Tabs.Tab>
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
                            <Text fw={700} c="white" mb="sm">FILTRAR POR FECHAS</Text>
                            <Group>
                                <DatePickerInput label="Desde" value={finStartDate} onChange={setFinStartDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} />
                                <IconArrowRight color="gray" style={{marginTop:'25px'}} />
                                <DatePickerInput label="Hasta" value={finEndDate} onChange={setFinEndDate} styles={{input:{background:'#222', color:'white'}, label:{color:'white'}}} />
                                <Card p="xs" radius="sm" style={{background:'#1a472a', marginLeft:'auto', minWidth:'200px'}}>
                                    <Text size="xs" c="white">TOTAL INGRESOS</Text>
                                    <Text size="xl" fw={900} c="white">S/. {finTotal.toFixed(2)}</Text>
                                </Card>
                            </Group>
                        </Card>
                    </Grid.Col>
                    
                    {/* VALOR AGREGADO: TOP CLIENTES */}
                    <Grid.Col span={{base:12, md:4}}>
                        <Card withBorder radius="md" p="md" style={{background:'#111', borderColor:'#333', height:'100%'}}>
                            <Group mb="md"><IconTrophy color="gold" /><Text fw={700} c="white">TOP 3 CLIENTES VIP</Text></Group>
                            {topClients.map((client, idx) => (
                                <Card key={idx} mb="sm" padding="xs" radius="md" style={{background: 'linear-gradient(45deg, #25262b, #1a1a1a)', border:'1px solid #333'}}>
                                    <Group>
                                        <Avatar color="yellow" radius="xl">{idx+1}</Avatar>
                                        <div>
                                            <Text fw={700} c="white" size="sm">{client.name}</Text>
                                            <Text size="xs" c="dimmed">{client.visits} visitas | Total: S/.{client.total}</Text>
                                        </div>
                                        {idx===0 && <IconStar size={16} color="gold" style={{marginLeft:'auto'}}/>}
                                    </Group>
                                </Card>
                            ))}
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{base:12, md:8}}>
                        <Card withBorder radius="md" p="0" style={{background:'#111', borderColor:'#333', height:'400px', display:'flex', flexDirection:'column'}}>
                            <Box p="md" style={{borderBottom:'1px solid #333'}}><Text fw={700} c="white">DETALLE VENTAS (Ordenado por Fecha)</Text></Box>
                            <ScrollArea style={{flex:1}}>
                                <Table>
                                    <Table.Thead><Table.Tr><Table.Th c="dimmed">Fecha</Table.Th><Table.Th c="dimmed">Cliente / Servicio</Table.Th><Table.Th c="dimmed">Monto</Table.Th></Table.Tr></Table.Thead>
                                    <Table.Tbody>
                                        {finTrans.map(t => (
                                            <Table.Tr key={t.id}>
                                                <Table.Td style={{color:'#c49b63'}}>{dayjs(t.fechaInicio).format('DD/MM/YY')}</Table.Td>
                                                <Table.Td>
                                                    <Text size="sm" c="white" fw={500}>{t.clienteNombre}</Text>
                                                    <Text size="xs" c="dimmed">{t.service?.nombre}</Text>
                                                </Table.Td>
                                                <Table.Td c="white" fw={700}>+S/.{t.service?.precio}</Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Card>
                    </Grid.Col>
                </Grid>
            </Tabs.Panel>
            
            {/* SERVICIOS */}
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
                                    <Table.Td><ActionIcon color="red" variant="subtle" onClick={() => handleDeleteService(s.id)}><IconTrash size={16}/></ActionIcon></Table.Td>
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
                        <Badge color={selectedAppt.estado === 'PENDIENTE' ? 'yellow' : 'red'}>{selectedAppt.estado}</Badge>
                    </Group>
                    <Card withBorder style={{background:'#111', borderColor:'#333'}}>
                        <Group><IconUser size={16} color="gray"/><Text size="sm" c="dimmed">DNI: {selectedAppt.clienteDni}</Text></Group>
                        <Group><IconBrandWhatsapp size={16} color="gray"/><Text size="sm" c="dimmed">Tel: {selectedAppt.clientePhone}</Text></Group>
                    </Card>
                    
                    <Button leftSection={<IconBrandWhatsapp size={18}/>} color="green" variant="light" fullWidth onClick={() => sendWhatsAppInternal(selectedAppt, 'confirm')}>Confirmar (WhatsApp)</Button>
                    
                    <Button variant="outline" color="yellow" onClick={() => setIsRescheduling(!isRescheduling)}>{isRescheduling ? 'Cancelar' : 'Reprogramar'}</Button>
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
                </div>
            )}
        </Modal>
      </AppShell.Main>
    </AppShell>
  );
}