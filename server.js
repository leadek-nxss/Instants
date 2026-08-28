const express = require('express');
const cloudinary = require('cloudinary').v2;
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Configuración de Cloudinary usando variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// Arreglo en memoria para guardar publicaciones mientras el servidor esté activo
let publicaciones = [];

// Ruta para obtener todas las fotos públicas (Optimizadas)
app.get('/api/fotos', (req, res) => {
  res.json(publicaciones);
});

// Ruta para recibir y procesar una foto anónima
app.post('/api/fotos', async (req, res) => {
  try {
    const { imagenBase64, comentario } = req.body;

    if (!imagenBase64) {
      return res.status(400).json({ error: 'No se envió ninguna imagen.' });
    }

    // Subir a Cloudinary con compresión webp y resolución ajustada para ahorrar datos
    const resultado = await cloudinary.uploader.upload(imagenBase64, {
      folder: 'muro_escuela',
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'webp' }
      ]
    });

    const nuevaFoto = {
      id: resultado.public_id,
      url: resultado.secure_url,
      comentario: comentario ? comentario.substring(0, 100) : '',
      fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    publicaciones.unshift(nuevaFoto);
    res.json({ success: true, foto: nuevaFoto });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error al procesar la imagen en el servidor.' });
  }
});

// Ruta de Administración para eliminar imágenes no aptas
app.delete('/api/fotos/:id', async (req, res) => {
  const adminPassword = req.headers['x-admin-password'];
  const passValida = process.env.ADMIN_PASSWORD || 'admin123';

  if (adminPassword !== passValida) {
    return res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
  }

  // Se decodifica el ID de Cloudinary (por si tiene barras /)
  const publicId = decodeURIComponent(req.params.id);

  try {
    // Borrar de Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Borrar de la lista local
    publicaciones = publicaciones.filter(p => p.id !== publicId);

    res.json({ success: true, message: 'Imagen eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al eliminar la imagen del servidor.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));

