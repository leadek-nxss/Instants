const express = require('express');
const cloudinary = require('cloudinary').v2;
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

let publicaciones = [];

// Ruta pública para el muro escolar
app.get('/api/fotos', (req, res) => {
  res.json(publicaciones);
});

// Ruta PRIVADA solo para el panel de administración
app.get('/api/admin/fotos', (req, res) => {
  const adminPassword = req.headers['x-admin-password'];
  const passValida = process.env.ADMIN_PASSWORD || 'admin123';

  if (adminPassword !== passValida) {
    return res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
  }

  res.json(publicaciones);
});

// Subir foto
app.post('/api/fotos', async (req, res) => {
  try {
    const { imagenBase64, comentario } = req.body;

    if (!imagenBase64) {
      return res.status(400).json({ error: 'No se envió ninguna imagen.' });
    }

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

// Eliminar foto (Protegido)
app.delete('/api/fotos', async (req, res) => {
  const adminPassword = req.headers['x-admin-password'];
  const publicId = req.query.id;
  const passValida = process.env.ADMIN_PASSWORD || 'admin123';

  if (adminPassword !== passValida) {
    return res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
  }

  if (!publicId) {
    return res.status(400).json({ error: 'Falta el ID de la imagen.' });
  }

  try {
    await cloudinary.uploader.destroy(publicId);
    publicaciones = publicaciones.filter(p => p.id !== publicId);
    res.json({ success: true, message: 'Imagen eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al eliminar la imagen del servidor.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
