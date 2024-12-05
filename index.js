const express = require('express')
const bcrypt = require('bcryptjs')
const bodyParser = require('body-parser')
const cors = require('cors')
const mysql = require('mysql2')
const multer = require('multer')
const path = require('path')
const nodemailer = require('nodemailer')
const app = express()


app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'clothingstore'
})

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
})

app.use(bodyParser.json())
app.use(cors())



const port = 3001;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const upload = multer({ storage: storage })

app.get('/', (req, res) => {
    res.send('¡Bienvenido a la Api de login y registro!');
})

app.post('/add-product', upload.single('image'), (req, res) => {
    const { nombre, descripcion, precio, categoria } = req.body
    let imagePath = null

    if (req.file) {
        imagePath = req.file.path.replace(/\\/g, '/')
    }

    if (!nombre || !descripcion || !precio || !categoria) {
        return res.status(400).json({ message: 'Faltan datos obligatorios para crear el producto.' })
    }

    const query = `
        INSERT INTO producto (nombre, descripcion, precio, categoria, imagen) 
        VALUES (?, ?, ?, ?, ?)
    `

    db.query(query, [nombre, descripcion, precio, categoria, imagePath], (err, result) => {
        if (err) {
            console.error('Error al agregar el producto:', err)
            return res.status(500).json({ message: 'Error al agregar el producto en la base de datos.' })
        }

        res.status(201).json({ 
            message: 'Producto agregado exitosamente.', 
            productId: result.insertId
        })
    })
})


app.post('/delete-product', (req, res) => {
    const { id_producto } = req.body

    if (!id_producto) {
        return res.status(400).json({ message: 'Se requiere el ID del producto.' })
    }

    const deleteQuery = 'DELETE FROM producto WHERE id_producto = ?'

    db.query(deleteQuery, [id_producto], (err, result) => {
        if (err) {
            console.error('Error al eliminar el producto:', err);
            return res.status(500).json({ message: 'Error al eliminar el producto de la base de datos.' })
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado.' })
        }

        res.status(200).json({ message: 'Producto eliminado con éxito.' })
    })
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
                    porfilepic: user.foto_perfil,
                    user_type: user.tipo_usuario
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





app.post('/upload-img-client', upload.single('file-upload'), (req, res) => {
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

app.post('/upload-img-product', upload.single('file-upload'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ninguna imagen.' })
    }

    const filePath = req.file.path.replace(/\\/g, '/')

    const { productId } = req.body

    if (!productId) {
        return res.status(400).json({ message: 'Falta el ID del producto.' })
    }

    
    const updateQuery = 'UPDATE producto SET imagen = ? WHERE id_producto = ?'

    db.query(updateQuery, [filePath, productId], (err, result) => {
        if (err) {
            console.error('Error al actualizar la imagen del producto:', err)
            return res.status(500).json({ message: 'Error al guardar la imagen del producto en la base de datos.' })
        }

        res.status(200).json({ message: 'Imagen del producto subida y guardada con éxito.', filePath: filePath })
    })
})

app.post('/update-product', (req, res) => {
    const { productId, field, newValue } = req.body

    if (!productId || !field || !newValue) {
        return res.status(400).json({ message: 'Faltan parámetros requeridos' })
    }

    const validFields = ['nombre', 'descripcion', 'precio', 'stock', 'categoria']
    if (!validFields.includes(field)) {
        return res.status(400).json({ message: 'Campo no válido' })
    }

    const updateQuery = `UPDATE producto SET ?? = ? WHERE id_producto = ?`

    db.query(updateQuery, [field, newValue, productId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error al actualizar el producto', error: err })
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' })
        }

        res.status(200).json({ message: 'Producto actualizado con éxito', field })
    })
})





app.post('/update-client', (req, res) => {
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

app.post('/cart', (req, res) => {
    const { id_cliente } = req.body

    if (!id_cliente) {
        return res.status(400).json({ message: 'Se requiere el ID del cliente' })
    }

    const query = `
        SELECT 
            carrito.id_carrito,
            producto.id_producto,
            producto.nombre AS nombre_producto,
            producto.descripcion,
            producto.precio,
            carrito.cantidad,
            producto.imagen,
            carrito.fecha_agregado
        FROM 
            carrito
        INNER JOIN 
            producto 
        ON 
            carrito.id_producto = producto.id_producto
        WHERE 
            carrito.id_cliente = ?`

    db.query(query, [id_cliente], (err, results) => {
        if (err) {
            console.error('Error al consultar el carrito:', err)
            return res.status(500).json({ message: 'Error al consultar el carrito' })
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'El carrito está vacío o el cliente no existe' })
        }

        res.status(200).json({
            message: 'Carrito obtenido con éxito',
            cart: results
        })
    })
})

app.post('/add-to-cart', (req, res) => {
    const { id_cliente, id_producto, cantidad } = req.body;

    if (!id_cliente || !id_producto || !cantidad) {
        return res.status(400).json({ message: 'Faltan parámetros obligatorios: id_cliente, id_producto o cantidad' });
    }

    const checkQuery = `
        SELECT * FROM carrito 
        WHERE id_cliente = ? AND id_producto = ?`;

    db.query(checkQuery, [id_cliente, id_producto], (err, result) => {
        if (err) {
            console.error('Error al consultar el carrito:', err)
            return res.status(500).json({ message: 'Error al consultar el carrito' })
        }

        if (result.length > 0) {
            
            const newCantidad = result[0].cantidad + cantidad
            const updateQuery = `
                UPDATE carrito 
                SET cantidad = ?, fecha_agregado = NOW() 
                WHERE id_cliente = ? AND id_producto = ?`

            db.query(updateQuery, [newCantidad, id_cliente, id_producto], (err) => {
                if (err) {
                    console.error('Error al actualizar el carrito:', err);
                    return res.status(500).json({ message: 'Error al actualizar el carrito' })
                }
                return res.status(200).json({ message: 'Cantidad actualizada en el carrito' })
            });
        } else {
           
            const insertQuery = `
                INSERT INTO carrito (id_cliente, id_producto, cantidad, fecha_agregado)
                VALUES (?, ?, ?, NOW())`

            db.query(insertQuery, [id_cliente, id_producto, cantidad], (err) => {
                if (err) {
                    console.error('Error al agregar producto al carrito:', err)
                    return res.status(500).json({ message: 'Error al agregar producto al carrito' })
                }
                return res.status(201).json({ message: 'Producto agregado al carrito' })
            })
        }
    })
})

app.delete('/remove-from-cart', (req, res) => {
    const { id_cliente, id_producto } = req.body;

    if (!id_cliente || !id_producto) {
        return res.status(400).json({ message: 'Faltan parámetros obligatorios: id_cliente o id_producto' })
    }

    const deleteQuery = `
        DELETE FROM carrito 
        WHERE id_cliente = ? AND id_producto = ?`;

    db.query(deleteQuery, [id_cliente, id_producto], (err, result) => {
        if (err) {
            console.error('Error al eliminar el producto del carrito:', err)
            return res.status(500).json({ message: 'Error al eliminar el producto del carrito' })
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado en el carrito para este cliente' })
        }

        return res.status(200).json({ message: 'Producto eliminado del carrito con éxito' })
    })
})

app.post('/add-order', (req, res) => {
    const { id_cliente, id_producto, cantidad, precio_unitario } = req.body

    if (!id_cliente || !id_producto || !cantidad || !precio_unitario) {
        return res.status(400).json({ message: 'Faltan parámetros obligatorios: id_cliente, id_producto, cantidad o precio_unitario' })
    }

    const insertQuery = `
        INSERT INTO pedido (id_cliente, id_producto, cantidad, precio_unitario, fecha_pedido) 
        VALUES (?, ?, ?, ?, NOW())
    `

    db.query(insertQuery, [id_cliente, id_producto, cantidad, precio_unitario], (err, result) => {
        if (err) {
            console.error('Error al agregar el pedido:', err)
            return res.status(500).json({ message: 'Error al agregar el pedido en la base de datos', error: err.message })
        }

        return res.status(201).json({ 
            message: 'Pedido agregado exitosamente', 
            orderId: result.insertId 
        })
    })
})

app.post('/get-orders', (req, res) => {
    const { id_cliente } = req.body

    if (!id_cliente) {
        return res.status(400).json({ message: 'Se requiere el ID del cliente.' })
    }

    const query = `
        SELECT 
            pedido.id_pedido,
            pedido.id_producto,
            producto.nombre AS nombre_producto,
            pedido.cantidad,
            pedido.precio_unitario,
            pedido.fecha_pedido
        FROM 
            pedido
        INNER JOIN 
            producto 
        ON 
            pedido.id_producto = producto.id_producto
        WHERE 
            pedido.id_cliente = ?
        ORDER BY 
            pedido.fecha_pedido DESC
    `;

    db.query(query, [id_cliente], (err, results) => {
        if (err) {
            console.error('Error al obtener los pedidos:', err);
            return res.status(500).json({ message: 'Error al obtener los pedidos de la base de datos.' })
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No se encontraron pedidos para este cliente.' })
        }

        res.status(200).json({
            message: 'Pedidos obtenidos con éxito.',
            orders: results
        })
    })
})

app.get('/product/:id', (req, res) => {
    const { id } = req.params

    const query = 'SELECT * FROM producto WHERE id_producto = ?'

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener el producto:', err);
            return res.status(500).json({ message: 'Error al obtener el producto de la base de datos.' })
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado.' })
        }

        res.status(200).json(results[0])
    })
})

app.post('/products-by-category', (req, res) => {
    const { categoria } = req.body

    if (!categoria) {
        return res.status(400).json({ message: 'Se requiere la categoría.' })
    }

    const query = 'SELECT * FROM producto WHERE categoria = ?'

    db.query(query, [categoria], (err, results) => {
        if (err) {
            console.error('Error al obtener los productos:', err)
            return res.status(500).json({ message: 'Error al obtener los productos de la base de datos.' })
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No se encontraron productos para esta categoría.' })
        }

        res.status(200).json({
            message: 'Productos obtenidos con éxito.',
            products: results
        })
    })
})







app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})
