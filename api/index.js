const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = (process.env.NOTION_DATABASE_ID || '').trim();

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28'
};

// --- RUTA PRINCIPAL ---
// Al usar solo '/', responderá directamente en '.../api'
app.get('/', async (req, res) => {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error en Notion');

    const notes = data.results.map(page => ({
      id: page.id,
      asunto: page.properties['ID/Asunto']?.title?.[0]?.plain_text || 'Sin título',
      text: page.properties['Contenido']?.rich_text?.[0]?.plain_text || 'Sin contenido',
      color: page.properties['Color de nota']?.select?.name || 'yellow',
      likes: page.properties['Like']?.number || 0,
      date: page.created_time ? page.created_time.split('T')[0] : ''
    }));

    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RUTA DE LIKES ---
app.get('/like/:id', async (req, res) => {
  try {
    const pageId = req.params.id;
    const getRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers });
    const pageData = await getRes.json();
    const currentLikes = pageData.properties['Like']?.number || 0;

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        properties: { 'Like': { number: currentLikes + 1 } }
      })
    });

    if (updateRes.ok) res.json({ success: true, newLikes: currentLikes + 1 });
    else throw new Error('Error al actualizar like');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RUTA DE CREAR ---
app.post('/', async (req, res) => {
  try {
    const { asunto, text, color } = req.body;
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          'ID/Asunto': { title: [{ text: { content: asunto || 'Nota' } }] },
          'Contenido': { rich_text: [{ text: { content: text || '' } }] },
          'Color de nota': { select: { name: color || 'yellow' } },
          'Like': { number: 0 }
        }
      })
    });
    if (response.ok) res.json({ success: true });
    else throw new Error('Error al crear nota');
  } catch (err) {
    res.status(500).json({ error: err.message }); 
  }
});

module.exports = app;
