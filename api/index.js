const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST'] }));
app.use(express.json());

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28'
};

// GET notas
app.get('/', async (_, res) => {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    const notes = data.results.map(page => ({
      id: page.id,
      text: page.properties['Contenido']?.rich_text?.[0]?.plain_text || '',
      color: page.properties['Color de nota']?.select?.name || 'yellow',
      likes: page.properties['Like']?.number || 0,
      date: page.created_time.split('T')[0]
    }));

    res.json(notes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST crear nota
app.post('/', async (req, res) => {
  const { text, color } = req.body;
  if (!text || text.length < 3) return res.status(400).json({ error: 'Texto inválido' });

  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          'Contenido': { rich_text: [{ text: { content: text } }] },
          'Color de nota': { select: { name: color } },
          'Like': { number: 0 }
        }
      })
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LIKE
app.get('/like/:id', async (req, res) => {
  try {
    const pageId = req.params.id;

    const getPage = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers });
    const page = await getPage.json();
    const likes = page.properties['Like']?.number || 0;

    await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        properties: { 'Like': { number: likes + 1 } }
      })
    });

    res.json({ success: true, newLikes: likes + 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;

