const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

let usuarios = [];

const port = 3001;

app.get('/', (req, res) => {
    res.send('¡Bienvenido a la Api de login y registro!');
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Faltan datos en el registro.' });
    }
    const usuarioExistente = usuarios.find(user => user.username === username);

    if (usuarioExistente) {
        return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    usuarios.push({ username, password: hashedPassword });
    res.status(201).json({ message: 'Usuario registrado exitosamente' });
});

// Ruta para login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;  
    if (!username || !password) {
        return res.status(400).json({ message: 'Faltan datos en el login' });
    }

    const usuario = usuarios.find(user => user.username === username);
    if (!usuario) {
        return res.status(400).json({ message: 'Usuario no encontrado.' });
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
        return res.status(401).json({ message: 'Contraseña incorrecta' });
    }
    res.status(200).json({ message: 'Login exitoso.' });
});


app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
