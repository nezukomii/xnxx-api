// API inspirada en el código Python de XNXX
// Cloudflare Workers - ES Module format

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request)
  }
}

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const path = url.pathname

  try {
    if (path === '/search' && request.method === 'GET') {
      return await handleSearch(request, corsHeaders)
    } else if (path === '/video' && request.method === 'GET') {
      return await handleVideo(request, corsHeaders)
    } else if (path === '/user' && request.method === 'GET') {
      return await handleUser(request, corsHeaders)
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

// Headers similares al código Python
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.xnxx.com/',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin'
}

// Regex patterns inspirados en el código Python
const REGEX_PATTERNS = {
  VIDEO_TITLE: /html5player\.setVideoTitle\('([^']+)'/i,
  VIDEO_M3U8: /html5player\.setVideoHLS\('([^']+)'/i,
  VIDEO_MP4_HIGH: /html5player\.setVideoUrlHigh\('([^']+)'/i,
  VIDEO_MP4_LOW: /html5player\.setVideoUrlLow\('([^']+)'/i,
  VIDEO_UPLOADER: /html5player\.setUploaderName\('([^']+)'/i,
  VIDEO_VIEWS: /(\d+(?:,\d+)*)\s*views/i,
  VIDEO_DURATION: /(\d+)min/i,
  VIDEO_LIKES: /"nb_likes":(\d+)/i,
  VIDEO_DISLIKES: /"nb_dislikes":(\d+)/i,
  VIDEO_COMMENTS: /"nb_comments":(\d+)/i,
  SEARCH_VIDEOS: /\/video-([a-zA-Z0-9]+)\//g,
  SEARCH_TOTAL_PAGES: /"nb_pages":(\d+)/i,
  METADATA_SPAN: /<span[^>]*class="metadata"[^>]*>([^<]+)<\/span>/i
}

async function handleSearch(request, corsHeaders) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') || '0')
  const upload_time = url.searchParams.get('upload_time') || ''
  const length = url.searchParams.get('length') || ''
  const quality = url.searchParams.get('quality') || ''
  const mode = url.searchParams.get('mode') || ''

  if (!query) {
    return new Response(JSON.stringify({ 
      error: 'Parámetro "q" requerido para la búsqueda' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const searchQuery = query.replace(/\s+/g, '+')
    let searchUrl = `https://www.xnxx.com/search${mode}${upload_time}${length}${quality}/${searchQuery}`
    
    if (page > 0) {
      searchUrl += `/${page}`
    }

    const response = await fetch(searchUrl, { headers: HEADERS })
    
    if (!response.ok) {
      throw new Error(`Error al acceder a XNXX: ${response.status}`)
    }

    const html = await response.text()
    const videos = await extractSearchResults(html)
    const totalPages = extractTotalPages(html)

    return new Response(JSON.stringify({
      success: true,
      query: query,
      page: page,
      total_pages: totalPages,
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

async function handleVideo(request, corsHeaders) {
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

  // Validar que sea una URL de video válida
  if (!videoUrl.includes('/video-') || !videoUrl.includes('xnxx.com')) {
    return new Response(JSON.stringify({ 
      error: 'URL de video inválida' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const response = await fetch(videoUrl, { headers: HEADERS })
    
    if (!response.ok) {
      throw new Error(`Error al acceder al video: ${response.status}`)
    }

    const html = await response.text()
    const videoData = await extractVideoDetails(html)

    return new Response(JSON.stringify({
      success: true,
      url: videoUrl,
      ...videoData
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

async function handleUser(request, corsHeaders) {
  const url = new URL(request.url)
  const userUrl = url.searchParams.get('url')
  const page = parseInt(url.searchParams.get('page') || '0')

  if (!userUrl) {
    return new Response(JSON.stringify({ 
      error: 'Parámetro "url" requerido' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Obtener videos del usuario usando el endpoint JSON
    const videosUrl = `${userUrl}/videos/best/${page}?from=goldtab`
    const response = await fetch(videosUrl, { headers: HEADERS })
    
    if (!response.ok) {
      throw new Error(`Error al acceder al perfil: ${response.status}`)
    }

    const jsonData = await response.json()
    const userVideos = []

    if (jsonData.videos && Array.isArray(jsonData.videos)) {
      for (const video of jsonData.videos) {
        userVideos.push({
          title: video.t || 'Sin título',
          url: `https://www.xnxx.com${video.u}`,
          thumbnail: video.i ? `https://img-hw.xnxx-cdn.com${video.i}` : null,
          duration: video.d || null,
          views: video.v || 0
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user_url: userUrl,
      page: page,
      total_videos: jsonData.nb_videos || 0,
      videos: userVideos
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Error al obtener videos del usuario',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function extractSearchResults(html) {
  const videos = []
  
  try {
    // Buscar URLs de videos usando regex
    const videoMatches = [...html.matchAll(REGEX_PATTERNS.SEARCH_VIDEOS)]
    
    for (const match of videoMatches) {
      const videoId = match[1]
      const videoUrl = `https://www.xnxx.com/video-${videoId}/`
      
      // Extraer información adicional del contexto
      const contextStart = html.indexOf(match[0]) - 500
      const contextEnd = html.indexOf(match[0]) + 500
      const context = html.substring(Math.max(0, contextStart), contextEnd)
      
      const titleMatch = context.match(/title="([^"]+)"/i)
      const thumbMatch = context.match(/data-src="([^"]+)"/i) || context.match(/src="([^"]+\.jpg[^"]*)"/i)
      const durationMatch = context.match(/<span[^>]*class="duration"[^>]*>([^<]+)<\/span>/i)
      
      videos.push({
        id: videoId,
        title: titleMatch ? htmlDecode(titleMatch[1]) : 'Sin título',
        url: videoUrl,
        thumbnail: thumbMatch ? thumbMatch[1] : null,
        duration: durationMatch ? durationMatch[1].trim() : null
      })
    }

  } catch (error) {
    console.error('Error extrayendo resultados de búsqueda:', error)
  }

  return videos
}

function extractTotalPages(html) {
  try {
    const match = html.match(REGEX_PATTERNS.SEARCH_TOTAL_PAGES)
    return match ? parseInt(match[1]) : 1
  } catch (error) {
    return 1
  }
}

async function extractVideoDetails(html) {
  const details = {
    title: null,
    description: null,
    mp4_urls: {
      high: null,
      low: null
    },
    m3u8_url: null,
    thumbnail: null,
    duration: null,
    views: null,
    uploader: null,
    likes: null,
    dislikes: null,
    comments: null,
    tags: [],
    pornstars: [],
    publish_date: null
  }

  try {
    // Extraer título
    const titleMatch = html.match(REGEX_PATTERNS.VIDEO_TITLE)
    if (titleMatch) {
      details.title = htmlDecode(titleMatch[1])
    }

    // Extraer URLs de video
    const mp4HighMatch = html.match(REGEX_PATTERNS.VIDEO_MP4_HIGH)
    if (mp4HighMatch) {
      details.mp4_urls.high = mp4HighMatch[1]
    }

    const mp4LowMatch = html.match(REGEX_PATTERNS.VIDEO_MP4_LOW)
    if (mp4LowMatch) {
      details.mp4_urls.low = mp4LowMatch[1]
    }

    const m3u8Match = html.match(REGEX_PATTERNS.VIDEO_M3U8)
    if (m3u8Match) {
      details.m3u8_url = m3u8Match[1]
    }

    // Extraer uploader
    const uploaderMatch = html.match(REGEX_PATTERNS.VIDEO_UPLOADER)
    if (uploaderMatch) {
      details.uploader = uploaderMatch[1]
    }

    // Extraer metadata usando span metadata como en el código Python
    const metadataMatch = html.match(REGEX_PATTERNS.METADATA_SPAN)
    if (metadataMatch) {
      const metadata = metadataMatch[1]
      
      const durationMatch = metadata.match(/(\d+)min/)
      if (durationMatch) {
        details.duration = `${durationMatch[1]}min`
      }

      const viewsMatch = metadata.match(/(\d+(?:,\d+)*)\s*views/)
      if (viewsMatch) {
        details.views = viewsMatch[1]
      }
    }

    // Extraer likes, dislikes, comentarios
    const likesMatch = html.match(REGEX_PATTERNS.VIDEO_LIKES)
    if (likesMatch) {
      details.likes = parseInt(likesMatch[1])
    }

    const dislikesMatch = html.match(REGEX_PATTERNS.VIDEO_DISLIKES)
    if (dislikesMatch) {
      details.dislikes = parseInt(dislikesMatch[1])
    }

    const commentsMatch = html.match(REGEX_PATTERNS.VIDEO_COMMENTS)
    if (commentsMatch) {
      details.comments = parseInt(commentsMatch[1])
    }

    // Extraer JSON-LD para más información
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1])
        details.description = jsonData.description || null
        details.thumbnail = jsonData.thumbnailUrl || null
        details.publish_date = jsonData.uploadDate || null
      } catch (e) {
        // JSON inválido, continuar sin estos datos
      }
    }

    // Extraer tags
    const tagMatches = [...html.matchAll(/<a[^>]*href="[^"]*\/tags\/([^"\/]+)"[^>]*>([^<]+)<\/a>/gi)]
    for (const match of tagMatches) {
      const tag = match[2].trim().replace(/\+/g, ' ')
      if (tag && !details.tags.includes(tag)) {
        details.tags.push(tag)
      }
    }

    // Extraer pornstars
    const pornstarMatches = [...html.matchAll(/<a[^>]*href="[^"]*\/pornstars\/([^"\/]+)"[^>]*>([^<]+)<\/a>/gi)]
    for (const match of pornstarMatches) {
      const pornstar = match[2].trim().replace(/\+/g, ' ')
      if (pornstar && !details.pornstars.includes(pornstar)) {
        details.pornstars.push(pornstar)
      }
    }

  } catch (error) {
    console.error('Error extrayendo detalles del video:', error)
  }

  return details
}

function htmlDecode(input) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '='
  }
  
  return input.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity
  })
}

function getApiDocs() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>XNXX API - Inspirado en código Python</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 40px;
            line-height: 1.6; 
            background: #f8f9fa;
            color: #333;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 10px; 
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .endpoint { 
            background: #f8f9fa; 
            padding: 20px; 
            margin: 20px 0; 
            border-radius: 8px; 
            border-left: 4px solid #007cba;
        }
        .method { 
            background: #007cba; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold;
        }
        code { 
            background: #e9ecef; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: 'Courier New', monospace;
        }
        pre { 
            background: #2d3748; 
            color: #e2e8f0; 
            padding: 20px; 
            border-radius: 8px; 
            overflow-x: auto;
            font-size: 14px;
        }
        h1 { color: #2d3748; border-bottom: 3px solid #007cba; padding-bottom: 10px; }
        h2 { color: #4a5568; margin-top: 30px; }
        h3 { color: #718096; }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
        .feature { 
            background: #e6fffa; 
            border-left: 4px solid #38b2ac; 
            padding: 15px; 
            margin: 15px 0; 
            border-radius: 0 8px 8px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔥 XNXX Video API</h1>
        <p><strong>API inspirada en el código Python original de XNXX.</strong></p>
        
        <div class="feature">
            <h3>✨ Características principales:</h3>
            <ul>
                <li><strong>Búsqueda avanzada</strong> con filtros de tiempo, duración, calidad y modo</li>
                <li><strong>Extracción completa</strong> de metadatos de videos</li>
                <li><strong>Enlaces MP4 directos</strong> en alta y baja calidad + M3U8</li>
                <li><strong>Información de usuarios</strong> y sus videos</li>
                <li><strong>Tags, pornstars, estadísticas</strong> y más</li>
            </ul>
        </div>
        
        <h2>📋 Endpoints disponibles:</h2>
        
        <div class="endpoint">
            <p><span class="method">GET</span> <code>/search</code></p>
            <p><strong>Descripción:</strong> Busca videos con filtros avanzados (inspirado en la clase Search del código Python)</p>
            <p><strong>Parámetros:</strong></p>
            <ul>
                <li><code>q</code> (requerido): Término de búsqueda</li>
                <li><code>page</code> (opcional): Página de resultados (por defecto: 0)</li>
                <li><code>upload_time</code> (opcional): Filtro de tiempo (/week, /month, /3month)</li>
                <li><code>length</code> (opcional): Duración (/short, /medium, /long)</li>
                <li><code>quality</code> (opcional): Calidad (/hd, /4k)</li>
                <li><code>mode</code> (opcional): Modo de búsqueda</li>
            </ul>
            <p><strong>Ejemplo:</strong> <code>/search?q=amateur&page=1&upload_time=/week&quality=/hd</code></p>
        </div>
        
        <div class="endpoint">
            <p><span class="method">GET</span> <code>/video</code></p>
            <p><strong>Descripción:</strong> Obtiene información completa de un video (inspirado en la clase Video del código Python)</p>
            <p><strong>Parámetros:</strong></p>
            <ul>
                <li><code>url</code> (requerido): URL completa del video en XNXX</li>
            </ul>
            <p><strong>Ejemplo:</strong> <code>/video?url=https://www.xnxx.com/video-xxxxx/title</code></p>
        </div>
        
        <div class="endpoint">
            <p><span class="method">GET</span> <code>/user</code></p>
            <p><strong>Descripción:</strong> Obtiene videos de un usuario (inspirado en la clase User del código Python)</p>
            <p><strong>Parámetros:</strong></p>
            <ul>
                <li><code>url</code> (requerido): URL del perfil del usuario</li>
                <li><code>page</code> (opcional): Página de resultados (por defecto: 0)</li>
            </ul>
            <p><strong>Ejemplo:</strong> <code>/user?url=https://www.xnxx.com/pornstar/xxx&page=0</code></p>
        </div>
        
        <h2>📊 Respuestas de ejemplo:</h2>
        
        <h3>Búsqueda:</h3>
        <pre>{
  "success": true,
  "query": "amateur",
  "page": 0,
  "total_pages": 50,
  "total_results": 20,
  "videos": [
    {
      "id": "abc123",
      "title": "Título del video",
      "url": "https://www.xnxx.com/video-abc123/",
      "thumbnail": "https://...",
      "duration": "10min"
    }
  ]
}</pre>
        
        <h3>Detalles del video:</h3>
        <pre>{
  "success": true,
  "url": "https://www.xnxx.com/video-abc123/",
  "title": "Título del video",
  "description": "Descripción completa",
  "mp4_urls": {
    "high": "https://video-high.mp4",
    "low": "https://video-low.mp4"
  },
  "m3u8_url": "https://video.m3u8",
  "thumbnail": "https://thumbnail.jpg",
  "duration": "10min",
  "views": "1,234,567",
  "uploader": "Nombre del uploader",
  "likes": 1500,
  "dislikes": 50,
  "comments": 25,
  "tags": ["tag1", "tag2"],
  "pornstars": ["star1", "star2"],
  "publish_date": "2024-01-01"
}</pre>

        <h3>Videos de usuario:</h3>
        <pre>{
  "success": true,
  "user_url": "https://www.xnxx.com/pornstar/xxx",
  "page": 0,
  "total_videos": 150,
  "videos": [
    {
      "title": "Video del usuario",
      "url": "https://www.xnxx.com/video-xxx/",
      "thumbnail": "https://...",
      "duration": "15min",
      "views": 50000
    }
  ]
}</pre>

        <div class="feature">
            <p><strong>🎯 Esta API replica la funcionalidad del código Python original:</strong></p>
            <ul>
                <li>Usa los mismos patrones regex y métodos de extracción</li>
                <li>Mantiene la estructura de clases Video, Search y User</li>
                <li>Extrae metadatos usando spans con clase "metadata"</li>
                <li>Soporta búsquedas con filtros avanzados</li>
                <li>Obtiene enlaces MP4 directos y M3U8 streams</li>
            </ul>
        </div>
    </div>
</body>
</html>
  `
}
