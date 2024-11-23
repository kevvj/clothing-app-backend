const express = require('express')
const bcrypt = require('bcryptjs')
const bodyParser = require('body-parser')
const cors = require('cors')
const mysql = require('mysql2')
const multer = require('multer')
const path = require('path')
const app = express()


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

app.post('/user/upload/password/:id', async (req, res) => {
    const id = req.params.id
    const { newPassword, password } = req.body

    if (!password) {
        return res.status(400).json({ message: 'Es necesario proporcionar la contraseña actual' })
    }

    if (!newPassword) {
        return res.status(400).json({ message: 'Es necesario proporcionar la nueva contraseña' })
    }

    const query = 'SELECT * FROM cliente WHERE id_cliente = ?'

    db.query(query, [id], async (err, result) => {
        if (err) {
            console.error('Error al ejecutar la consulta de selección:', err.message)
            return res.status(500).json({ message: 'Error en la consulta de la base de datos' })
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' })
        }

        const user = result[0]
        const isMatch = await bcrypt.compare(password, user.contraseña)

        if (!isMatch) {
            return res.status(401).json({ message: 'La contraseña actual es incorrecta' })
        }

        const updateQuery = 'UPDATE cliente SET contraseña = ? WHERE id_cliente = ?'
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        db.query(updateQuery, [hashedPassword, id], (err) => {
            if (err) {
                console.error('Error al actualizar la contraseña:', err)
                return res.status(500).json({ message: 'Error al intentar cambiar la contraseña' })
            }

            return res.status(200).json({ message: 'Contraseña cambiada con éxito' })
        })
    })
})


app.post('/register', async (req, res) => {
    const { username, password, firstName, lastName, email } = req.body
    if (!username || !password || !firstName || !lastName || !email) {
        return res.status(400).json({ message: 'Faltan datos en el registro.' })
    }

    const query = 'SELECT * FROM cliente WHERE nombre_usuario = ?'

    db.query(query, [username], async (err, result) => {
        if (err) {
            console.error('Error al ejecutar la consulta de selección:', err.message)
            return res.status(500).json({ message: 'Error en la consulta de la base de datos.' })
        }

        if (result.length > 0) {
            return res.status(400).json({ message: 'El usuario ya existe.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const FullName = firstName + " " + lastName
        const DateToday = new Date().toISOString().split('T')[0]

        const insertQuery = 'INSERT INTO cliente (nombre_usuario, contraseña, nombre, email, direccion, fecha_registro, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)'

        db.query(insertQuery, [username, hashedPassword, FullName, email, null, DateToday, "comun"], (err, result) => {
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
                    registration_date: user.fecha_registro,
                    porfilepic: user.foto_perfil
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

app.post('/update', (req, res) => {
    const { clientId, field, newValue } = req.body

    if (!clientId || !field || !newValue) {
        return res.status(400).json({ message: 'Missing required parameters.' })
    }

    const validFields = ['nombre', 'nombre_usuario', 'email']
    if (!validFields.includes(field)) {
        return res.status(400).json({ message: 'Invalid field.' })
    }

    const updateQuery = `UPDATE cliente SET ?? = ? WHERE id_cliente = ?`

    db.query(updateQuery, [field, newValue, clientId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating the database', error: err })
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Client not found.' })
        }

        res.status(200).json({ message: 'Information updated successfully.', field })
    })
})

app.get('/products', (req, res) => {

    const query = 'SELECT * FROM producto'

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los productos:', err);
            return res.status(500).json({ message: 'Error al obtener los productos de la base de datos.' })
        }
        res.json(results)
    })
})


app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})

let products = [

    { id: 1, name: "Straps", price: 4.99, image: "https://suplementosolimpicos.com/wp-content/uploads/2022/08/STRAPS-3.png", description: "", category: "" },
    { id: 2, name: "Zapatos deportivos", price: 49.99, image: "https://ae01.alicdn.com/kf/S43619d07a6204d7dba3bb3d4be5c7c76T/Zapatillas-de-deporte-de-moda-para-hombre-zapatos-casuales-para-gimnasio-trotar-tenis-entrenador-planos-suaves.jpg", description: "", category: "" },
    { id: 3, name: "Camiseta de compresion", price: 30.99, image: "https://s7d7.scene7.com/is/image/GTMSportswear/2611TU?qlt=80,0&resMode=sharp2&fmt=png-alpha&hei=500&wid=500&layer=1&op_colorize=181818", description: "", category: "" },
    { id: 4, name: "Cinturon", price: 70.99, image: "https://gravityec.com/wp-content/uploads/2024/01/CPN.webp", description: "", category: "" },
    { id: 5, name: "Camiseta Blanca Poison", price: 999.99, image: "https://images-na.ssl-images-amazon.com/images/I/51dRXn4pwdS._AC_UL600_SR600,600_.jpg", description: "", category: "" },
]
