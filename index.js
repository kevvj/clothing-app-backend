const express = require('express')
const bcrypt = require('bcryptjs')
const bodyParser = require('body-parser')
const cors = require('cors')
const mysql = require('mysql2')
const multer = require('multer')
const path = require('path')

// Crear la instancia de la aplicación de Express
const app = express()

// Configuración de rutas estáticas para subir archivos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'clothingstore'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
})

app.use(bodyParser.json())
app.use(cors())

let usuarios = [
    { id: 1, username: "user", password: bcrypt.hashSync("password", 10) },
    { id: 2, username: "user2", password: bcrypt.hashSync("password2", 10) },
    { id: 3, username: "user3", password: bcrypt.hashSync("password3", 10) },
]

const port = 3001;

app.get('/', (req, res) => {
    res.send('¡Bienvenido a la Api de login y registro!');
})

app.post('/register', async (req, res) => {
    const { username, password, firstName, lastName, email } = req.body;
    if (!username || !password || !firstName || !lastName || !email) {
        return res.status(400).json({ message: 'Faltan datos en el registro.' });
    }

    const query = 'SELECT * FROM cliente WHERE nombre_usuario = ?';

    db.query(query, [username], async (err, result) => {
        if (err) {
            console.error('Error al ejecutar la consulta de selección:', err.message);
            return res.status(500).json({ message: 'Error en la consulta de la base de datos.' });
        }

        if (result.length > 0) {
            return res.status(400).json({ message: 'El usuario ya existe.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const FullName = firstName + " " + lastName;
        const DateToday = new Date().toISOString().split('T')[0];

        const insertQuery = 'INSERT INTO cliente (nombre_usuario, contraseña, nombre, email, direccion, fecha_registro) VALUES (?, ?, ?, ?, ?, ?)'

        db.query(insertQuery, [username, hashedPassword, FullName, email, null, DateToday], (err, result) => {
            if (err) {
                console.error('Error al ejecutar la consulta de inserción:', err.message);
                return res.status(500).json({ message: 'Error al registrar el usuario', error: err.message });
            }
            res.status(201).json({ message: 'Usuario registrado exitosamente' });
        });

    });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Faltan datos en el login' });
    }

    const query = 'SELECT * FROM cliente WHERE nombre_usuario = ?';

    db.query(query, [username], async (err, result) => {
        if (err) {
            console.error('Error al ejecutar la consulta de selección:', err.message);
            return res.status(500).json({ message: 'Error en la consulta de la base de datos.' })
        }

        if (result.length > 0) {

            const user = result[0]
            const isMatch = await bcrypt.compare(password, user.contraseña)

            if (isMatch) {
                const userData = {
                    id: user.id_cliente,
                    username: user.nombre_usuario,
                    name: user.nombre,
                    email: user.email,
                    registration_date: user.fecha_registro
                }
                res.status(200).json({ message: 'Login exitoso.', user: userData })
            } else {
                return res.status(401).json({ message: 'Contraseña incorrecta' })
            }

        } else {
            return res.status(400).json({ message: 'Usuario no encontrado.' })
        }
    })
})

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const upload = multer({ storage: storage })

app.post('/upload', upload.single('file-upload'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo.' })
    }

    const filePath = req.file.path.replace(/\\/g, '/')

    const { clientId } = req.body

    if (!clientId) {
        return res.status(400).json({ message: 'Falta el ID del cliente.' })
    }

    const updateQuery = 'UPDATE cliente SET foto_perfil = ? WHERE id_cliente = ?'

    db.query(updateQuery, [filePath, clientId], (err, result) => {
        if (err) {
            console.error('Error al actualizar la foto del perfil:', err);
            return res.status(500).json({ message: 'Error al guardar la imagen en la base de datos.' })
        }

        res.status(200).json({ message: 'Imagen subida y guardada en la base de datos con éxito', filePath: filePath })
    })
})

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
})
