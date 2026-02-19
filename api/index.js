export default async function handler(req, res) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  try {
    // --- GET NOTAS ---
    if (req.method === "GET") {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Error al obtener notas");

      const notes = data.results.map((page) => ({
        id: page.id,
        text: page.properties["Contenido"]?.rich_text?.[0]?.plain_text || "",
        color: page.properties["Color de nota"]?.select?.name || "yellow",
        likes: page.properties["Like"]?.number || 0,
        date: page.created_time.split("T")[0],
      }));

      return res.status(200).json(notes);
    }

    // --- CREAR NOTA ---
    if (req.method === "POST") {
      const { text, color } = req.body;
      if (!text || text.length < 3) return res.status(400).json({ error: "Texto insuficiente" });

      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: {
            Contenido: { rich_text: [{ text: { content: text } }] },
            "Color de nota": { select: { name: color } },
            Like: { number: 0 },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      return res.status(200).json({ success: true });
    }

    // --- ACTUALIZAR LIKE (PATCH) ---
    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      // 1. Obtener estado actual
      const getPage = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers });
      if (!getPage.ok) return res.status(404).json({ error: "Nota no encontrada" });
      
      const pageData = await getPage.json();
      const currentLikes = pageData.properties["Like"]?.number || 0;

      // 2. Actualizar
      const updateRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          properties: { "Like": { number: currentLikes + 1 } },
        }),
      });

      if (!updateRes.ok) throw new Error("No se pudo actualizar el like");

      return res.status(200).json({
        success: true,
        newLikes: currentLikes + 1,
      });
    }

    // Si no entra en ningún IF
    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}}
