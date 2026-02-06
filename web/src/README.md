# Frontend - React Web Interface

Interfaz web para WhatsApp Bot usando React + Vite + TypeScript.

## Estructura

```
web/src/
├── api/              # Cliente HTTP para API REST
├── components/       # Componentes React
│   ├── auth/         # QRLogin, autenticacion
│   ├── chat/         # ChatList, ChatView, MessageBubble
│   ├── common/       # LoadingSpinner, ConnectionStatus
│   └── settings/     # Configuracion de IA
├── hooks/            # useSocket (WebSocket)
├── pages/            # ChatPage
├── store/            # Zustand state management
└── types/            # TypeScript interfaces
```

## Tecnologias

- **React 18** - Framework UI
- **Vite** - Build tool
- **TypeScript** - Tipado estatico
- **Zustand** - State management
- **Tailwind CSS** - Estilos
- **Socket.io** - Comunicacion en tiempo real
- **Axios** - HTTP client
- **Lucide React** - Iconos

## Inicio Rapido

```bash
cd web
npm install
npm run dev
```

## Componentes Principales

### ChatList
Lista de chats con:
- Foto de perfil
- Nombre del contacto
- Ultimo mensaje
- Indicador de grupo

### ChatView
Vista de chat con:
- Header con foto y nombre
- Toggle de bot activo
- Lista de mensajes
- Input de mensaje

### MessageBubble
Burbuja de mensaje con:
- Foto del sender (en grupos)
- Nombre del sender (colores unicos)
- Contenido del mensaje
- Hora y estado

### QRLogin
Pantalla de login:
- Muestra QR para escanear
- Estado de conexion
- Boton de logout

## Estado Global (Zustand)

```typescript
interface AppState {
    connectionStatus: ConnectionStatus;
    qrCode: string | null;
    chats: Chat[];
    activeChat: string | null;
    messages: Record<string, Message[]>;
    // ... actions
}
```

## Socket Events

### Escuchados
- `qr` - Nuevo QR
- `connection:status` - Cambio de estado
- `message:new` - Nuevo mensaje
- `bot:response` - Respuesta del bot

## Variables de Entorno

```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```
