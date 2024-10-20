// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const cors = require('cors');
app.use(cors());

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para parsear JSON
app.use(express.json());

// Almacén de pedidos (temporal en memoria)
let pedidos = [];

// Ruta para recibir pedidos desde el cliente
app.post('/pedido', (req, res) => {
  const nuevoPedido = req.body;

  // Validar que el pedido tenga los campos necesarios
  if (!nuevoPedido.mesa || !nuevoPedido.platos || !Array.isArray(nuevoPedido.platos)) {
    return res.status(400).send({ mensaje: 'Datos de pedido inválidos' });
  }

  nuevoPedido.id = Date.now(); // Asignar un ID único
  nuevoPedido.estado = 'Pendiente';
  nuevoPedido.platos = nuevoPedido.platos.map(plato => ({
    ...plato,
    estado: 'Pendiente'
  }));
  pedidos.push(nuevoPedido);

  // Emitir evento de nuevo pedido
  io.emit('nuevoPedido', nuevoPedido);

  res.status(200).send({ mensaje: 'Pedido recibido' });
});

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log('Nueva conexión');

  // Enviar lista de pedidos actuales al conectarse
  socket.emit('pedidosActuales', pedidos);

  // Escuchar eventos de actualización de estado de platos
  socket.on('actualizarEstadoPlato', (data) => {
    const { idPedido, idPlato } = data;
    const pedido = pedidos.find((p) => p.id === idPedido);
    if (pedido) {
      const plato = pedido.platos.find((pl) => parseInt(pl.id) === idPlato);
      if (plato) {
        plato.estado = 'Completado';
        // Emitir actualización a todos los clientes
        io.emit('estadoPlatoActualizado', { idPedido, idPlato });
      }
    }
  });  

  // Escuchar eventos de actualización de estado de pedido
  socket.on('actualizarEstadoPedido', (data) => {
    const { idPedido, nuevoEstado } = data;
    const pedido = pedidos.find((p) => p.id === idPedido);
    if (pedido) {
      pedido.estado = nuevoEstado;
      // Marcar todos los platos como completados
      pedido.platos.forEach(plato => plato.estado = 'Completado');
      // Emitir actualización a todos los clientes
      io.emit('estadoPedidoActualizado', pedido);
    }
  });
  

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
