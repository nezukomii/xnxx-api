// Estructura del proyecto:
// 1. wrangler.toml
// 2. src/index.js (este archivo)
// 3. package.json

// API para buscar videos en XNXX.com
// Desplegable en Cloudflare Workers

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Configurar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Manejar preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  const url = new URL(request.url)
  const path = url.pathname

  try {
    if (path === '/search' && request.method === 'GET') {
      return await handleSearch(request, corsHeaders)
    } else if (path === '/video' && request.method === 'GET') {
      return await handleVideoDetails(request, corsHeaders)
    } else if (path === '/' && request.method === 'GET') {
      return new Response(getApiDocs(), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    } else {
      return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleSearch(request, corsHeaders) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')
  const page = url.searchParams.get('page') || '0'

  if (!query) {
    return new Response(JSON.stringify({ 
      error: 'Parámetro "q" requerido para la búsqueda' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const searchUrl = `https://www.xnxx.com/search/${encodeURIComponent(query)}/${page}`
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.xnxx.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })

    if (!response.ok) {
      throw new Error(`Error al acceder a XNXX: ${response.status}`)
    }

    const html = await response.text()
    const videos = extractVideoData(html)

    return new Response(JSON.stringify({
      success: true,
      query: query,
      page: parseInt(page),
      total_results: videos.length,
      videos: videos
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Error al buscar videos',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleVideoDetails(request, corsHeaders) {
  const url = new URL(request.url)
  const videoUrl = url.searchParams.get('url')

  if (!videoUrl) {
    return new Response(JSON.stringify({ 
      error: 'Parámetro "url" requerido' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Referer': 'https://www.xnxx.com/'
      }
    })

    if (!response.ok) {
      throw new Error(`Error al acceder al video: ${response.status}`)
    }

    const html = await response.text()
    const videoDetails = extractVideoDetails(html)

    return new Response(JSON.stringify({
      success: true,
      url: videoUrl,
      ...videoDetails
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Error al obtener detalles del video',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

function extractVideoData(html) {
  const videos = []
  
  try {
    // Buscar divs con clase mozaique
    const mozaiqueRegex = /<div\s+class="mozaique"[^>]*>([\s\S]*?)<\/div>/gi
    let match

    while ((match = mozaiqueRegex.exec(html)) !== null) {
      const mozaiqueContent = match[1]
      
      // Extraer información del video
      const titleMatch = mozaiqueContent.match(/title="([^"]+)"/i)
      const linkMatch = mozaiqueContent.match(/href="([^"]+)"/i)
      const thumbMatch = mozaiqueContent.match(/data-src="([^"]+)"/i)
      const durationMatch = mozaiqueContent.match(/<span[^>]*class="duration"[^>]*>([^<]+)<\/span>/i)

      if (titleMatch && linkMatch) {
        const video = {
          title: titleMatch[1].trim(),
          url: linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www.xnxx.com${linkMatch[1]}`,
          thumbnail: thumbMatch ? thumbMatch[1] : null,
          duration: durationMatch ? durationMatch[1].trim() : null
        }

        videos.push(video)
      }
    }

    // Método alternativo si no encuentra videos
    if (videos.length === 0) {
      const altRegex = /<a[^>]*href="([^"]*\/video[^"]*)"[^>]*title="([^"]+)"[^>]*>/gi
      while ((match = altRegex.exec(html)) !== null) {
        videos.push({
          title: match[2].trim(),
          url: match[1].startsWith('http') ? match[1] : `https://www.xnxx.com${match[1]}`,
          thumbnail: null,
          duration: null
        })
      }
    }

  } catch (error) {
    console.error('Error extrayendo datos de video:', error)
  }

  return videos
}

function extractVideoDetails(html) {
  const details = {
    title: null,
    description: null,
    mp4_url: null,
    thumbnail: null,
    duration: null,
    views: null,
    tags: []
  }

  try {
    // Extraer título
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) || 
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (titleMatch) {
      details.title = titleMatch[1].replace(' - XNXX.COM', '').trim()
    }

    // Extraer URL del MP4
    const mp4Matches = [
      /html5player\.setVideoUrlHigh\('([^']+)'/i,
      /html5player\.setVideoUrl\('([^']+)'/i,
      /"url_high":"([^"]+)"/i,
      /"url_low":"([^"]+)"/i,
      /setVideoHLS\('([^']+)'/i,
      /"video_url":"([^"]+)"/i
    ]

    for (const regex of mp4Matches) {
      const match = html.match(regex)
      if (match) {
        details.mp4_url = match[1].replace(/\\/g, '')
        break
      }
    }

    // Extraer descripción
    const descMatches = [
      /<meta\s+name="description"\s+content="([^"]+)"/i,
      /<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/p>/i
    ]

    for (const regex of descMatches) {
      const match = html.match(regex)
      if (match) {
        details.description = match[1].trim()
        break
      }
    }

    // Extraer thumbnail
    const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                      html.match(/setThumbUrl\('([^']+)'/i)
    if (thumbMatch) {
      details.thumbnail = thumbMatch[1]
    }

    // Extraer duración
    const durationMatch = html.match(/<span[^>]*class="[^"]*duration[^"]*"[^>]*>([^<]+)<\/span>/i)
    if (durationMatch) {
      details.duration = durationMatch[1].trim()
    }

    // Extraer vistas
    const viewsMatch = html.match(/(\d+(?:,\d+)*)\s*views/i)
    if (viewsMatch) {
      details.views = viewsMatch[1]
    }

    // Extraer tags
    const tagMatches = html.matchAll(/<a[^>]*href="[^"]*\/tags\/[^"]*"[^>]*>([^<]+)<\/a>/gi)
    for (const match of tagMatches) {
      const tag = match[1].trim()
      if (tag && !details.tags.includes(tag)) {
        details.tags.push(tag)
      }
    }

  } catch (error) {
    console.error('Error extrayendo detalles del video:', error)
  }

  return details
}

function getApiDocs() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>XNXX Video Search API</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .method { background: #007cba; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
        code { background: #eee; padding: 2px 4px; border-radius: 2px; }
    </style>
</head>
<body>
    <h1>XNXX Video Search API</h1>
    
    <h2>Endpoints disponibles:</h2>
    
    <div class="endpoint">
        <p><span class="method">GET</span> <code>/search?q={query}&page={page}</code></p>
        <p><strong>Descripción:</strong> Busca videos por término de búsqueda</p>
        <p><strong>Parámetros:</strong></p>
        <ul>
            <li><code>q</code> (requerido): Término de búsqueda</li>
            <li><code>page</code> (opcional): Página de resultados (por defecto: 0)</li>
        </ul>
        <p><strong>Ejemplo:</strong> <code>/search?q=amateur&page=1</code></p>
    </div>
    
    <div class="endpoint">
        <p><span class="method">GET</span> <code>/video?url={video_url}</code></p>
        <p><strong>Descripción:</strong> Obtiene detalles específicos de un video incluyendo el enlace MP4 directo</p>
        <p><strong>Parámetros:</strong></p>
        <ul>
            <li><code>url</code> (requerido): URL completa del video en XNXX</li>
        </ul>
        <p><strong>Ejemplo:</strong> <code>/video?url=https://www.xnxx.com/video-xxxxx/title</code></p>
    </div>
    
    <h2>Respuesta de ejemplo:</h2>
    
    <h3>Búsqueda:</h3>
    <pre>{
  "success": true,
  "query": "amateur",
  "page": 0,
  "total_results": 20,
  "videos": [
    {
      "title": "Título del video",
      "url": "https://www.xnxx.com/video-xxxxx/title",
      "thumbnail": "https://...",
      "duration": "10:30"
    }
  ]
}</pre>
    
    <h3>Detalles del video:</h3>
    <pre>{
  "success": true,
  "url": "https://www.xnxx.com/video-xxxxx/title",
  "title": "Título del video",
  "description": "Descripción del video",
  "mp4_url": "https://video-link.mp4",
  "thumbnail": "https://thumbnail.jpg",
  "duration": "10:30",
  "views": "1,234,567",
  "tags": ["tag1", "tag2"]
}</pre>

    <p><strong>Nota:</strong> Esta API funciona como proxy para acceder a XNXX.com y extraer información de videos.</p>
</body>
</html>
  `
}
