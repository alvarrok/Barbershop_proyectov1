import { useState } from 'react';
import { TextInput, PasswordInput, Button, Card, Title, Text, BackgroundImage, Center, Overlay, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { IconLock, IconScissors } from '@tabler/icons-react';

// Imagen de fondo (puedes cambiar esta URL por una imagen local tuya si prefieres)
const bgImage = "https://images.unsplash.com/photo-1635273051937-93c450a21262?q=80&w=2070&auto=format&fit=crop";

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if(!email || !password) return notifications.show({message: 'Por favor completa los campos', color: 'yellow'});
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3000/api/login', { email, password });
      localStorage.setItem('adminToken', res.data.token); // Guardar token
      localStorage.setItem('adminName', res.data.user);
      notifications.show({ title: `Bienvenido, ${res.data.user}`, message: 'Has iniciado sesión correctamente.', color: 'green', icon: <IconLock/> });
      navigate('/admin/dashboard');
    } catch (error) {
      notifications.show({ title: 'Error de acceso', message: 'Credenciales incorrectas. Inténtalo de nuevo.', color: 'red' });
    }
    setLoading(false);
  };

  return (
    // 1. Contenedor con Imagen de Fondo que cubre toda la pantalla
    <BackgroundImage src={bgImage} h="100vh">
        {/* Overlay oscuro para asegurar que el texto sea legible sobre la imagen */}
        <Overlay color="#000" opacity={0.6} zIndex={1} />
        
        {/* 2. Centramos el contenido vertical y horizontalmente */}
        <Center h="100%" style={{ position: 'relative', zIndex: 2 }}>
            
            {/* 3. Tarjeta de Login "Glassmorphism" Moderna */}
            <Card 
                shadow="xl" 
                p={40} 
                radius="lg" 
                withBorder 
                style={{ 
                    backgroundColor: 'rgba(20, 20, 20, 0.85)', // Fondo oscuro semitransparente
                    backdropFilter: 'blur(15px)',             // Efecto de desenfoque moderno
                    borderColor: 'rgba(196, 155, 99, 0.5)',   // Borde dorado sutil
                    width: '100%',
                    maxWidth: '420px',
                    borderTopWidth: '4px' // Borde superior más grueso para acento
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    {/* Icono de marca */}
                    <Group justify="center" gap={5} mb={10} style={{opacity: 0.8}}>
                         <IconScissors size={28} color="#c49b63" />
                         <Text fw={900} c="#c49b63" size="xl" style={{ letterSpacing: '1px' }}>BARBERSHOP</Text>
                    </Group>
                    <Title order={1} c="white" fw={900} tt="uppercase" style={{ letterSpacing: '1px', fontSize: '1.8rem' }}>
                        Panel Administrativo
                    </Title>
                    <Text c="dimmed" size="sm" mt={5}>
                        Ingresa tus credenciales para gestionar el negocio.
                    </Text>
                </div>

                <TextInput 
                    label="CORREO ELECTRÓNICO" 
                    placeholder="ejemplo@barberia.com" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    size="md"
                    styles={{ 
                        input: { background: 'rgba(255,255,255,0.05)', border: '1px solid #444', color:'white' }, 
                        label: { color:'#c49b63', fontWeight: 700, fontSize: '0.8rem' }
                    }} 
                />
                
                <PasswordInput 
                    label="CONTRASEÑA" 
                    placeholder="••••••" 
                    required 
                    mt="lg" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    size="md"
                    styles={{ 
                        input: { background: 'rgba(255,255,255,0.05)', border: '1px solid #444', color:'white' }, 
                        label: { color:'#c49b63', fontWeight: 700, fontSize: '0.8rem' }
                    }} 
                />

                <Button 
                    fullWidth 
                    mt="xl" 
                    size="lg"
                    color="yellow" 
                    onClick={handleLogin} 
                    loading={loading}
                    styles={{ 
                        root: { 
                            backgroundColor: '#c49b63', 
                            color: 'black', 
                            fontWeight: 800,
                            letterSpacing: '1px',
                            transition: 'all 0.3s ease',
                            '&:hover': { backgroundColor: '#d4ac2b', transform: 'translateY(-2px)' }
                        }
                    }}
                >
                    INGRESAR AL SISTEMA
                </Button>
                
                <Text c="dimmed" size="xs" align="center" mt="xl" style={{opacity: 0.5}}>
                    © {new Date().getFullYear()} BarberShop Premium System. <br/> Acceso restringido solo para personal autorizado.
                </Text>
            </Card>
        </Center>
    </BackgroundImage>
  );
}

export default AdminLogin;