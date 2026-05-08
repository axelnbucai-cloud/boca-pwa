import React, { useState, useEffect } from 'react';
import { Calendar, Newspaper, Youtube, Home, Trophy, Users, Bell, Search, ExternalLink, ChevronRight, Plus, Play, Instagram, Facebook, Twitter, Globe, MapPin, Clock, Star } from 'lucide-react';

export default function BocaJuniorsApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [fixtureTab, setFixtureTab] = useState('upcoming'); // 'upcoming' | 'results' | 'standings'
  const [standingsLeague, setStandingsLeague] = useState('liga'); // 'liga' | 'libertadores'
  const [newsSource, setNewsSource] = useState('all');
  const [showNotif, setShowNotif] = useState(false);

  // ============ HELPERS COMPARTIDOS ============
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .trim().substring(0, 200);
  };

  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Hace instantes';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} d`;
    return date.toLocaleDateString('es-AR');
  };

  // Helper: fetch con timeout (para todos los loaders)
  const fetchWithTimeout = async (url, timeout = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  };

  // ============ FIXTURE DATA - Carga dinámica desde TheSportsDB API ============
  // Boca Juniors team ID en TheSportsDB (verificado: thesportsdb.com/team/135156-boca-juniors)
  const BOCA_TEAM_ID = '135156';
  const SPORTSDB_KEY = '3'; // key pública gratuita

  const [fixture, setFixture] = useState([]);
  const [fixtureLoading, setFixtureLoading] = useState(true);
  const [fixtureError, setFixtureError] = useState(null);
  const [fixtureLastUpdate, setFixtureLastUpdate] = useState(null);

  // Mapear nombre de competición a colores
  const getCompetitionStyle = (leagueName) => {
    const name = (leagueName || '').toLowerCase();
    if (name.includes('libertadores')) return { name: 'Copa Libertadores', color: '#0a8c3a' };
    if (name.includes('sudamericana')) return { name: 'Copa Sudamericana', color: '#d97706' };
    if (name.includes('argentina') && name.includes('cup')) return { name: 'Copa Argentina', color: '#8c0d0d' };
    if (name.includes('argentine') || name.includes('liga') || name.includes('primera')) return { name: 'Liga Profesional', color: '#0d4d8c' };
    return { name: leagueName || 'Partido', color: '#0d4d8c' };
  };

  const loadFixture = async () => {
    setFixtureLoading(true);
    setFixtureError(null);
    try {
      // 1) Próximos partidos del equipo (free key: solo local)
      const nextRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventsnext.php?id=${BOCA_TEAM_ID}`);
      const nextData = await nextRes.json();
      const teamEvents = nextData.events || [];

      // 2) Próximos partidos de la liga argentina (para capturar partidos de visitante)
      const ligaRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventsnextleague.php?id=4406`);
      const ligaData = await ligaRes.json();
      const ligaEvents = (ligaData.events || []).filter(ev =>
        ev.strHomeTeam === 'Boca Juniors' || ev.strAwayTeam === 'Boca Juniors'
      );

      // 3) Próximos partidos de la Copa Libertadores
      let liberEvents = [];
      try {
        const liberRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventsnextleague.php?id=4501`);
        const liberData = await liberRes.json();
        liberEvents = (liberData.events || []).filter(ev =>
          ev.strHomeTeam === 'Boca Juniors' || ev.strAwayTeam === 'Boca Juniors'
        );
      } catch (e) { /* ignorar */ }

      // Combinar y deduplicar por idEvent
      const seen = new Set();
      const allEvents = [...teamEvents, ...ligaEvents, ...liberEvents].filter(ev => {
        if (!ev.idEvent || seen.has(ev.idEvent)) return false;
        seen.add(ev.idEvent);
        return true;
      });

      // Ordenar por fecha
      allEvents.sort((a, b) => {
        const dA = new Date(`${a.dateEvent}T${a.strTime || '00:00:00'}`);
        const dB = new Date(`${b.dateEvent}T${b.strTime || '00:00:00'}`);
        return dA - dB;
      });

      const mapped = allEvents.map((ev, idx) => {
        const isHome = ev.strHomeTeam === 'Boca Juniors';
        const compStyle = getCompetitionStyle(ev.strLeague);
        return {
          id: ev.idEvent || `f-${idx}`,
          competition: compStyle.name,
          competitionColor: compStyle.color,
          date: ev.dateEvent,
          time: ev.strTime ? ev.strTime.substring(0, 5) : '00:00',
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          venue: ev.strVenue || (isHome ? 'La Bombonera' : 'A confirmar'),
          city: ev.strCity || '',
          isHome,
          status: 'upcoming',
          matchday: ev.intRound ? `Fecha ${ev.intRound}` : (ev.strSeason || 'Temporada 2026'),
          thumb: ev.strThumb || null
        };
      });

      if (mapped.length > 0) {
        setFixture(mapped);
        setFixtureLastUpdate(new Date());
      } else {
        setFixtureError('No hay partidos próximos disponibles');
      }
    } catch (e) {
      console.error('Error cargando fixture:', e);
      setFixtureError('Error al cargar el fixture');
    } finally {
      setFixtureLoading(false);
    }
  };

  useEffect(() => {
    loadFixture();
    // Auto-refresh cada hora
    const interval = setInterval(loadFixture, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ============ ÚLTIMOS RESULTADOS ============
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState(null);

  const loadResults = async () => {
    setResultsLoading(true);
    setResultsError(null);
    try {
      // 1) Últimos partidos del equipo (free key: solo local)
      const teamRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventslast.php?id=${BOCA_TEAM_ID}`);
      const teamData = await teamRes.json();
      const teamEvents = teamData.results || [];

      // 2) Últimos partidos de la liga argentina (captura visitantes)
      let ligaEvents = [];
      try {
        const ligaRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventspastleague.php?id=4406`);
        const ligaData = await ligaRes.json();
        ligaEvents = (ligaData.events || []).filter(ev =>
          ev.strHomeTeam === 'Boca Juniors' || ev.strAwayTeam === 'Boca Juniors'
        );
      } catch (e) { /* ignorar */ }

      // 3) Últimos partidos de la Copa Libertadores
      let liberEvents = [];
      try {
        const liberRes = await fetchWithTimeout(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventspastleague.php?id=4501`);
        const liberData = await liberRes.json();
        liberEvents = (liberData.events || []).filter(ev =>
          ev.strHomeTeam === 'Boca Juniors' || ev.strAwayTeam === 'Boca Juniors'
        );
      } catch (e) { /* ignorar */ }

      // Combinar y deduplicar
      const seen = new Set();
      const allEvents = [...teamEvents, ...ligaEvents, ...liberEvents].filter(ev => {
        if (!ev.idEvent || seen.has(ev.idEvent)) return false;
        seen.add(ev.idEvent);
        return true;
      });

      // Ordenar por fecha descendente (más reciente primero)
      allEvents.sort((a, b) => new Date(b.dateEvent) - new Date(a.dateEvent));

      const mapped = allEvents.slice(0, 10).map((ev, idx) => {
        const isHome = ev.strHomeTeam === 'Boca Juniors';
        const compStyle = getCompetitionStyle(ev.strLeague);
        const homeScore = parseInt(ev.intHomeScore);
        const awayScore = parseInt(ev.intAwayScore);
        let outcome = 'draw';
        if (!isNaN(homeScore) && !isNaN(awayScore)) {
          if (homeScore === awayScore) outcome = 'draw';
          else if ((isHome && homeScore > awayScore) || (!isHome && awayScore > homeScore)) outcome = 'win';
          else outcome = 'loss';
        }
        return {
          id: ev.idEvent || `r-${idx}`,
          competition: compStyle.name,
          competitionColor: compStyle.color,
          date: ev.dateEvent,
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          homeScore: isNaN(homeScore) ? '-' : homeScore,
          awayScore: isNaN(awayScore) ? '-' : awayScore,
          venue: ev.strVenue || '',
          isHome,
          outcome,
          matchday: ev.intRound ? `Fecha ${ev.intRound}` : (ev.strSeason || '')
        };
      });

      setResults(mapped);
    } catch (e) {
      console.error('Error cargando resultados:', e);
      setResultsError('Error al cargar los resultados');
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    const interval = setInterval(loadResults, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ============ TABLAS DE POSICIONES ============
  // IDs de ligas en TheSportsDB (verificados en thesportsdb.com)
  const LEAGUES = {
    liga: { id: '4406', name: 'Liga Profesional', season: '2026', color: '#0d4d8c' },
    libertadores: { id: '4501', name: 'Copa Libertadores', season: '2026', color: '#0a8c3a' }
  };

  const [standings, setStandings] = useState({});
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState(null);

  const loadStandings = async (leagueKey) => {
    const league = LEAGUES[leagueKey];
    if (!league) return;
    setStandingsLoading(true);
    setStandingsError(null);
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookuptable.php?l=${league.id}&s=${league.season}`;
      const res = await fetch(url);
      const data = await res.json();
      const table = data.table || [];
      setStandings(prev => ({ ...prev, [leagueKey]: table }));
    } catch (e) {
      console.error(`Error cargando tabla ${leagueKey}:`, e);
      setStandingsError('Error al cargar la tabla');
    } finally {
      setStandingsLoading(false);
    }
  };

  // Cargar la tabla activa cuando cambia la liga seleccionada
  useEffect(() => {
    if (!standings[standingsLeague]) {
      loadStandings(standingsLeague);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standingsLeague]);

  // Auto-refresh cada hora la tabla actualmente vista
  useEffect(() => {
    const interval = setInterval(() => {
      loadStandings(standingsLeague);
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standingsLeague]);

  // ============ NEWS DATA - Carga dinámica desde RSS via rss2json.com ============
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Configuración de fuentes RSS
  const NEWS_SOURCES = [
    {
      id: 'planetabj',
      sourceName: 'Planeta Boca',
      sourceColor: '#003366',
      image: '⚽',
      rss: 'https://planetabj.com/feed/',
      siteUrl: 'https://planetabj.com/'
    },
    {
      id: 'ole',
      sourceName: 'Olé',
      sourceColor: '#000000',
      image: '🏆',
      rss: 'https://www.ole.com.ar/rss/boca-juniors/',
      siteUrl: 'https://www.ole.com.ar/boca-juniors'
    },
    {
      id: 'tyc',
      sourceName: 'TyC Sports',
      sourceColor: '#ed1c24',
      image: '📺',
      rss: 'https://www.tycsports.com/rss/boca-juniors.xml',
      siteUrl: 'https://www.tycsports.com/boca-juniors.html'
    }
  ];

  // Función para extraer la imagen del contenido del feed
  const extractImage = (item) => {
    if (item.thumbnail) return item.thumbnail;
    if (item.enclosure && item.enclosure.link) return item.enclosure.link;
    const match = (item.content || item.description || '').match(/<img[^>]+src=["']([^"']+)["']/);
    return match ? match[1] : null;
  };

  // Detectar categoría del título
  const detectCategory = (title) => {
    const t = title.toLowerCase();
    if (t.includes('libertadores') || t.includes('cruzeiro') || t.includes('barcelona')) return 'COPA LIBERTADORES';
    if (t.includes('river') || t.includes('superclásico') || t.includes('superclasico')) return 'SUPERCLÁSICO';
    if (t.includes('riquelme')) return 'DIRIGENCIA';
    if (t.includes('úbeda') || t.includes('ubeda') || t.includes('dt')) return 'CUERPO TÉCNICO';
    if (t.includes('mercado') || t.includes('refuerzo') || t.includes('fichaje')) return 'MERCADO DE PASES';
    if (t.includes('apertura') || t.includes('clausura') || t.includes('liga')) return 'TORNEO LOCAL';
    if (t.includes('reserva') || t.includes('juvenil')) return 'RESERVA';
    return 'NOTICIAS';
  };

  // Cargar noticias desde los feeds RSS (con fallback a proxy CORS)
  const loadNews = async () => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const promises = NEWS_SOURCES.map(async (source) => {
        // Intento 1: rss2json (servicio dedicado)
        try {
          const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.rss)}&count=8`;
          const res = await fetchWithTimeout(apiUrl, 8000);
          const data = await res.json();
          if (data.status === 'ok' && data.items && data.items.length > 0) {
            return data.items.map((item, idx) => ({
              id: `${source.id}-${idx}-${item.pubDate}`,
              source: source.id,
              sourceName: source.sourceName,
              sourceColor: source.sourceColor,
              image: source.image,
              category: detectCategory(item.title),
              title: stripHtml(item.title).substring(0, 120),
              excerpt: stripHtml(item.description).substring(0, 160),
              time: timeAgo(item.pubDate),
              pubDate: item.pubDate,
              thumbnail: extractImage(item),
              url: item.link
            }));
          }
        } catch (e) {
          console.warn(`rss2json falló para ${source.id}, intentando con AllOrigins...`);
        }

        // Intento 2: AllOrigins como proxy CORS + parser XML manual
        try {
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(source.rss)}`;
          const res = await fetchWithTimeout(proxyUrl, 10000);
          const data = await res.json();
          if (data.contents) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
            const items = Array.from(xmlDoc.querySelectorAll('item')).slice(0, 8);
            return items.map((item, idx) => {
              const title = item.querySelector('title')?.textContent || '';
              const description = item.querySelector('description')?.textContent || '';
              const link = item.querySelector('link')?.textContent || '';
              const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
              const enclosure = item.querySelector('enclosure');
              const mediaContent = item.querySelector('media\\:content, content');
              const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/);
              let thumbnail = null;
              if (enclosure) thumbnail = enclosure.getAttribute('url');
              else if (mediaContent) thumbnail = mediaContent.getAttribute('url');
              else if (imgMatch) thumbnail = imgMatch[1];
              return {
                id: `${source.id}-${idx}-${pubDate}`,
                source: source.id,
                sourceName: source.sourceName,
                sourceColor: source.sourceColor,
                image: source.image,
                category: detectCategory(title),
                title: stripHtml(title).substring(0, 120),
                excerpt: stripHtml(description).substring(0, 160),
                time: timeAgo(pubDate),
                pubDate,
                thumbnail,
                url: link
              };
            });
          }
        } catch (e) {
          console.warn(`AllOrigins también falló para ${source.id}:`, e.message);
        }

        return [];
      });

      const results = await Promise.all(promises);
      const allNews = results.flat().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      if (allNews.length === 0) {
        setNewsError('No se pudieron cargar las noticias. Intentá de nuevo en unos minutos.');
      } else {
        setNews(allNews);
        setLastUpdate(new Date());
      }
    } catch (e) {
      setNewsError('Error al cargar las noticias');
      console.error(e);
    } finally {
      setNewsLoading(false);
    }
  };

  // Cargar al montar y refrescar cada 30 minutos automáticamente
  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ============ YOUTUBE VIDEOS - Carga dinámica desde RSS oficial ============
  // Channel ID del canal oficial de Boca Juniors en YouTube
  const BOCA_YT_CHANNEL_ID = 'UCe8m4P3OxL_aHWQbA3FbsHA';

  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState(null);

  const loadVideos = async () => {
    setVideosLoading(true);
    setVideosError(null);
    try {
      const ytRss = `https://www.youtube.com/feeds/videos.xml?channel_id=${BOCA_YT_CHANNEL_ID}`;
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(ytRss)}&count=12`;
      const res = await fetchWithTimeout(apiUrl, 8000);
      const data = await res.json();

      if (data.status === 'ok' && data.items && data.items.length > 0) {
        const gradients = [
          'linear-gradient(135deg, #003366 0%, #ffd700 100%)',
          'linear-gradient(135deg, #1a1a2e 0%, #003366 100%)',
          'linear-gradient(135deg, #0a8c3a 0%, #ffd700 100%)',
          'linear-gradient(135deg, #ed1c24 0%, #1a1a2e 100%)',
          'linear-gradient(135deg, #003366 0%, #1a1a2e 100%)',
          'linear-gradient(135deg, #ffd700 0%, #003366 100%)'
        ];

        const mapped = data.items.map((item, idx) => {
          // Extraer videoID del link de YouTube
          const videoIdMatch = item.link.match(/v=([^&]+)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : null;
          const thumbnail = videoId
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : null;

          return {
            id: item.guid || `v-${idx}`,
            title: stripHtml(item.title).substring(0, 100),
            channel: 'Boca Juniors Oficial',
            views: timeAgo(item.pubDate),
            duration: '▶',
            thumb: '⚽',
            thumbnail,
            bgColor: gradients[idx % gradients.length],
            url: item.link
          };
        });

        setVideos(mapped);
      } else {
        setVideosError('No se pudieron cargar los videos');
      }
    } catch (e) {
      console.error('Error cargando videos:', e);
      setVideosError('Error al cargar los videos');
    } finally {
      setVideosLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
    // Auto-refresh cada 2 horas
    const interval = setInterval(loadVideos, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ============ HELPERS ============
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return {
      day: days[date.getDay()],
      num: date.getDate(),
      month: months[date.getMonth()]
    };
  };

  const addToCalendar = (match) => {
    const startDate = new Date(`${match.date}T${match.time}:00-03:00`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const formatICS = (d) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const title = `${match.home} vs ${match.away}`;
    const desc = `${match.competition} - ${match.matchday}`;
    const location = `${match.venue}, ${match.city}`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BocaApp//ES',
      'BEGIN:VEVENT',
      `UID:${match.id}-boca@bocajuniors.app`,
      `DTSTAMP:${formatICS(new Date())}`,
      `DTSTART:${formatICS(startDate)}`,
      `DTEND:${formatICS(endDate)}`,
      `SUMMARY:⚽ ${title}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${location}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio: ${title}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boca-vs-${match.isHome ? match.away : match.home}.ics`.replace(/\s+/g, '-').toLowerCase();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowNotif(true);
    setTimeout(() => setShowNotif(false), 3000);
  };

  const filteredNews = newsSource === 'all' ? news : news.filter(n => n.source === newsSource);

  // ============ STYLES ============
  const colors = {
    azul: '#003366',
    azulOscuro: '#001a33',
    azulProfundo: '#000d1f',
    oro: '#ffd700',
    oroOscuro: '#d4a017',
    blanco: '#ffffff',
    grisOscuro: '#1a1a2e',
    grisMedio: '#2a2a3e'
  };

  // ============ COMPONENTS ============
  const Header = () => (
    <div style={{
      background: `linear-gradient(180deg, ${colors.azul} 0%, ${colors.azulOscuro} 100%)`,
      padding: '20px 20px 24px',
      position: 'relative',
      overflow: 'hidden',
      borderBottom: `3px solid ${colors.oro}`
    }}>
      <div style={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${colors.oro}22 0%, transparent 70%)`
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 52,
            height: 36,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: `0 4px 12px rgba(0,0,0,0.4), 0 0 0 2px ${colors.blanco}`,
          }}>
            <div style={{ flex: 1, background: '#0d4d8c' }} />
            <div style={{ flex: 1, background: colors.oro }} />
            <div style={{ flex: 1, background: '#0d4d8c' }} />
          </div>
          <div>
            <div style={{
              fontFamily: '"Bebas Neue", "Anton", Impact, sans-serif',
              fontSize: 22,
              fontWeight: 900,
              color: colors.blanco,
              letterSpacing: 1.5,
              lineHeight: 1
            }}>
              BOCA JUNIORS
            </div>
            <div style={{
              fontSize: 10,
              color: colors.oro,
              fontWeight: 700,
              letterSpacing: 2,
              marginTop: 2
            }}>
              · LA MITAD MÁS UNO ·
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={iconBtnStyle}><Search size={18} color={colors.blanco} /></button>
          <button style={iconBtnStyle}>
            <Bell size={18} color={colors.blanco} />
            <span style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: colors.oro,
              border: `1.5px solid ${colors.azul}`
            }} />
          </button>
        </div>
      </div>
    </div>
  );

  const iconBtnStyle = {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    backdropFilter: 'blur(10px)'
  };

  const HomeView = () => {
    const next = fixture[0];

    // Estado: cargando o sin partidos
    if (!next) {
      return (
        <div style={{ padding: '20px 16px 100px' }}>
          <div style={{
            fontFamily: '"Bebas Neue", "Anton", Impact, sans-serif',
            fontSize: 11,
            color: colors.oro,
            fontWeight: 700,
            letterSpacing: 3,
            marginBottom: 10
          }}>
            PRÓXIMO PARTIDO
          </div>
          <div style={{
            background: colors.grisOscuro,
            borderRadius: 20,
            padding: 40,
            textAlign: 'center',
            border: `1px solid ${colors.oro}30`
          }}>
            {fixtureLoading ? (
              <>
                <div style={{
                  display: 'inline-block',
                  width: 40,
                  height: 40,
                  border: `3px solid ${colors.grisMedio}`,
                  borderTop: `3px solid ${colors.oro}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: 16
                }} />
                <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700 }}>
                  Cargando fixture...
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  No hay partidos próximos
                </div>
                <button onClick={loadFixture} style={{
                  marginTop: 8, padding: '8px 18px', borderRadius: 20,
                  background: colors.oro, color: colors.azul, border: 'none',
                  fontSize: 11, fontWeight: 800, cursor: 'pointer'
                }}>
                  REINTENTAR
                </button>
              </>
            )}
          </div>

          {/* Igual mostrar noticias y videos aunque no haya partido */}
          <div style={{ marginTop: 24 }}>
            <h2 style={{
              fontFamily: '"Bebas Neue", Impact, sans-serif',
              fontSize: 22, color: colors.blanco, fontWeight: 900,
              letterSpacing: 1.5, margin: '0 0 12px'
            }}>
              ÚLTIMAS NOTICIAS
            </h2>
            {newsLoading && news.length === 0 ? (
              <div style={{
                background: colors.grisOscuro, borderRadius: 14, padding: 20,
                textAlign: 'center', color: colors.blanco + 'aa', fontSize: 12
              }}>
                Cargando noticias...
              </div>
            ) : (
              news.slice(0, 3).map(n => <NewsCard key={n.id} item={n} compact />)
            )}
          </div>
        </div>
      );
    }

    const dateInfo = formatDate(next.date);
    return (
      <div style={{ padding: '20px 16px 100px' }}>
        {/* Hero Card - Próximo partido */}
        <div style={{
          fontFamily: '"Bebas Neue", "Anton", Impact, sans-serif',
          fontSize: 11,
          color: colors.oro,
          fontWeight: 700,
          letterSpacing: 3,
          marginBottom: 10
        }}>
          PRÓXIMO PARTIDO
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${colors.azul} 0%, ${colors.azulOscuro} 60%, ${colors.grisOscuro} 100%)`,
          borderRadius: 20,
          padding: 22,
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid ${colors.oro}40`,
          boxShadow: `0 12px 32px rgba(0,51,102,0.4)`
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 180,
            height: 180,
            background: `radial-gradient(circle, ${colors.oro}15 0%, transparent 65%)`
          }} />
          <div style={{
            display: 'inline-block',
            padding: '5px 12px',
            borderRadius: 20,
            background: next.competitionColor,
            color: colors.blanco,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            marginBottom: 18,
            position: 'relative'
          }}>
            {next.competition.toUpperCase()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, position: 'relative' }}>
            {/* Local */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {next.home === 'Boca Juniors' ? (
                <div style={{
                  width: 56,
                  height: 38,
                  margin: '0 auto 8px',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: `0 0 0 2px ${colors.blanco}40, 0 4px 8px rgba(0,0,0,0.3)`
                }}>
                  <div style={{ flex: 1, background: '#0d4d8c' }} />
                  <div style={{ flex: 1, background: colors.oro }} />
                  <div style={{ flex: 1, background: '#0d4d8c' }} />
                </div>
              ) : (
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  margin: '0 auto 8px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                  color: colors.blanco,
                  border: `2px solid ${colors.blanco}30`
                }}>
                  {next.home.substring(0, 3).toUpperCase()}
                </div>
              )}
              <div style={{
                fontSize: 12,
                color: colors.blanco,
                fontWeight: 700,
                lineHeight: 1.2
              }}>
                {next.home}
              </div>
            </div>

            {/* VS */}
            <div style={{ padding: '0 10px', textAlign: 'center' }}>
              <div style={{
                fontFamily: '"Bebas Neue", Impact, sans-serif',
                fontSize: 28,
                color: colors.oro,
                fontWeight: 900,
                lineHeight: 1
              }}>
                VS
              </div>
              <div style={{ fontSize: 9, color: colors.blanco + '99', fontWeight: 600, marginTop: 4 }}>
                {next.matchday}
              </div>
            </div>

            {/* Visitante */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {next.away === 'Boca Juniors' ? (
                <div style={{
                  width: 56,
                  height: 38,
                  margin: '0 auto 8px',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: `0 0 0 2px ${colors.blanco}40, 0 4px 8px rgba(0,0,0,0.3)`
                }}>
                  <div style={{ flex: 1, background: '#0d4d8c' }} />
                  <div style={{ flex: 1, background: colors.oro }} />
                  <div style={{ flex: 1, background: '#0d4d8c' }} />
                </div>
              ) : (
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  margin: '0 auto 8px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                  color: colors.blanco,
                  border: `2px solid ${colors.blanco}30`
                }}>
                  {next.away.substring(0, 3).toUpperCase()}
                </div>
              )}
              <div style={{
                fontSize: 12,
                color: colors.blanco,
                fontWeight: 700,
                lineHeight: 1.2
              }}>
                {next.away}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '14px 0',
            borderTop: `1px solid ${colors.blanco}15`,
            borderBottom: `1px solid ${colors.blanco}15`,
            marginBottom: 14,
            position: 'relative'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: colors.blanco + '88', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>FECHA</div>
              <div style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', fontSize: 18, color: colors.oro, fontWeight: 900, lineHeight: 1 }}>
                {dateInfo.num} {dateInfo.month}
              </div>
            </div>
            <div style={{ width: 1, background: colors.blanco + '15' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: colors.blanco + '88', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>HORA</div>
              <div style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', fontSize: 18, color: colors.oro, fontWeight: 900, lineHeight: 1 }}>
                {next.time}
              </div>
            </div>
            <div style={{ width: 1, background: colors.blanco + '15' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: colors.blanco + '88', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>ESTADIO</div>
              <div style={{ fontSize: 12, color: colors.blanco, fontWeight: 700, lineHeight: 1.1 }}>
                {next.venue}
              </div>
            </div>
          </div>

          <button
            onClick={() => addToCalendar(next)}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${colors.oro} 0%, ${colors.oroOscuro} 100%)`,
              color: colors.azul,
              border: 'none',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 0.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: `0 6px 16px rgba(255,215,0,0.3)`,
              position: 'relative'
            }}
          >
            <Calendar size={16} />
            AGREGAR A MI CALENDARIO
          </button>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
          {[
            { label: 'PARTIDOS', value: '13', sub: 'sin perder' },
            { label: 'POSICIÓN', value: '3°', sub: 'Grupo A' },
            { label: 'COPAS', value: '74', sub: 'oficiales' }
          ].map((s, i) => (
            <div key={i} style={{
              background: colors.grisOscuro,
              borderRadius: 14,
              padding: '14px 10px',
              textAlign: 'center',
              border: `1px solid ${colors.oro}20`
            }}>
              <div style={{ fontSize: 9, color: colors.oro, fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', fontSize: 26, color: colors.blanco, fontWeight: 900, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, color: colors.blanco + '99', fontWeight: 500, marginTop: 4 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Últimas noticias preview */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{
              fontFamily: '"Bebas Neue", Impact, sans-serif',
              fontSize: 22,
              color: colors.blanco,
              fontWeight: 900,
              letterSpacing: 1.5,
              margin: 0
            }}>
              ÚLTIMAS NOTICIAS
            </h2>
            <button
              onClick={() => setActiveTab('news')}
              style={{ background: 'none', border: 'none', color: colors.oro, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
            >
              VER TODAS <ChevronRight size={14} />
            </button>
          </div>
          {newsLoading && news.length === 0 ? (
            <div style={{
              background: colors.grisOscuro,
              borderRadius: 14,
              padding: 30,
              textAlign: 'center',
              border: `1px solid ${colors.blanco}10`
            }}>
              <div style={{
                display: 'inline-block',
                width: 28,
                height: 28,
                border: `3px solid ${colors.grisMedio}`,
                borderTop: `3px solid ${colors.oro}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: 10
              }} />
              <div style={{ color: colors.blanco + 'aa', fontSize: 11, fontWeight: 600 }}>
                Cargando últimas noticias...
              </div>
            </div>
          ) : news.length > 0 ? (
            news.slice(0, 3).map(n => <NewsCard key={n.id} item={n} compact />)
          ) : (
            <div style={{
              background: colors.grisOscuro,
              borderRadius: 14,
              padding: 20,
              textAlign: 'center',
              color: colors.blanco + '88',
              fontSize: 12
            }}>
              Toca "Noticias" para reintentar la carga.
            </div>
          )}
        </div>

        {/* Videos preview */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{
              fontFamily: '"Bebas Neue", Impact, sans-serif',
              fontSize: 22,
              color: colors.blanco,
              fontWeight: 900,
              letterSpacing: 1.5,
              margin: 0
            }}>
              VIDEOS DESTACADOS
            </h2>
            <button
              onClick={() => setActiveTab('videos')}
              style={{ background: 'none', border: 'none', color: colors.oro, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
            >
              VER TODOS <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
            {videosLoading && videos.length === 0 ? (
              <div style={{
                minWidth: '100%', padding: 20, textAlign: 'center',
                color: colors.blanco + 'aa', fontSize: 12
              }}>
                Cargando videos...
              </div>
            ) : videos.slice(0, 4).map(v => (
              <div key={v.id} style={{
                minWidth: 200,
                background: colors.grisOscuro,
                borderRadius: 14,
                overflow: 'hidden',
                cursor: 'pointer'
              }}
                onClick={() => window.open(v.url, '_blank')}
              >
                <div style={{
                  height: 110,
                  background: v.thumbnail
                    ? `url(${v.thumbnail}) center/cover`
                    : v.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  position: 'relative'
                }}>
                  {!v.thumbnail && v.thumb}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.7) 100%)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'rgba(255,215,0,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Play size={18} fill={colors.azul} color={colors.azul} style={{ marginLeft: 2 }} />
                  </div>
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 11, color: colors.blanco, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {v.title}
                  </div>
                  <div style={{ fontSize: 10, color: colors.blanco + '88', fontWeight: 500 }}>
                    {v.channel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const FixtureView = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <h1 style={{
        fontFamily: '"Bebas Neue", Impact, sans-serif',
        fontSize: 36,
        color: colors.blanco,
        fontWeight: 900,
        letterSpacing: 2,
        margin: '0 0 4px',
        lineHeight: 1
      }}>
        FIXTURE
      </h1>
      <div style={{ fontSize: 12, color: colors.oro, fontWeight: 600, letterSpacing: 1, marginBottom: 16 }}>
        TEMPORADA 2026 · DATOS EN VIVO
      </div>

      {/* Sub-tabs: Próximos / Resultados / Tabla */}
      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: 18,
        background: colors.grisOscuro,
        borderRadius: 12,
        padding: 4,
        border: `1px solid ${colors.blanco}10`
      }}>
        {[
          { id: 'upcoming', label: 'Próximos' },
          { id: 'results', label: 'Resultados' },
          { id: 'standings', label: 'Tabla' }
        ].map(t => {
          const isActive = fixtureTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFixtureTab(t.id)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 9,
                background: isActive
                  ? `linear-gradient(135deg, ${colors.oro} 0%, ${colors.oroOscuro} 100%)`
                  : 'transparent',
                color: isActive ? colors.azul : colors.blanco + 'aa',
                border: 'none',
                fontSize: 12,
                fontWeight: isActive ? 800 : 600,
                letterSpacing: 0.5,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {fixtureTab === 'upcoming' && <UpcomingMatches />}
      {fixtureTab === 'results' && <ResultsView />}
      {fixtureTab === 'standings' && <StandingsView />}
    </div>
  );

  // ============ SUB-COMPONENTE: PRÓXIMOS PARTIDOS ============
  const UpcomingMatches = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: colors.blanco + '66', fontWeight: 500 }}>
          {fixtureLastUpdate
            ? `Actualizado: ${fixtureLastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}h`
            : ''}
        </div>
        <button
          onClick={loadFixture}
          disabled={fixtureLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 16,
            background: fixtureLoading ? colors.grisMedio : colors.oro,
            color: fixtureLoading ? colors.blanco + '88' : colors.azul,
            border: 'none', fontSize: 10, fontWeight: 800,
            cursor: fixtureLoading ? 'wait' : 'pointer'
          }}
        >
          <span style={{ animation: fixtureLoading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {fixtureLoading ? 'CARGANDO' : 'ACTUALIZAR'}
        </button>
      </div>

      {fixtureLoading && fixture.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            display: 'inline-block', width: 40, height: 40,
            border: `3px solid ${colors.grisMedio}`,
            borderTop: `3px solid ${colors.oro}`,
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            marginBottom: 16
          }} />
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 600 }}>
            Cargando próximos partidos...
          </div>
        </div>
      )}

      {fixtureError && fixture.length === 0 && (
        <div style={{
          background: colors.grisOscuro, border: `1px solid ${colors.oro}40`,
          borderRadius: 14, padding: 20, textAlign: 'center'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            {fixtureError}
          </div>
          <button onClick={loadFixture} style={{
            padding: '8px 18px', borderRadius: 20, background: colors.oro,
            color: colors.azul, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer'
          }}>
            REINTENTAR
          </button>
        </div>
      )}

      {fixture.map(match => {
        const dateInfo = formatDate(match.date);
        return (
          <div key={match.id} style={{
            background: colors.grisOscuro,
            borderRadius: 16,
            marginBottom: 12,
            overflow: 'hidden',
            border: `1px solid ${colors.blanco}10`
          }}>
            <div style={{
              padding: '8px 14px',
              background: match.competitionColor,
              fontSize: 10,
              fontWeight: 700,
              color: colors.blanco,
              letterSpacing: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{match.competition.toUpperCase()}</span>
              <span style={{ opacity: 0.85 }}>{match.matchday}</span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Date Block */}
                <div style={{
                  textAlign: 'center',
                  padding: '8px 12px',
                  background: colors.azulOscuro,
                  borderRadius: 10,
                  minWidth: 60,
                  border: `1px solid ${colors.oro}30`
                }}>
                  <div style={{ fontSize: 9, color: colors.oro, fontWeight: 700, letterSpacing: 1 }}>
                    {dateInfo.day}
                  </div>
                  <div style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', fontSize: 24, color: colors.blanco, fontWeight: 900, lineHeight: 1 }}>
                    {dateInfo.num}
                  </div>
                  <div style={{ fontSize: 9, color: colors.blanco + '99', fontWeight: 600 }}>
                    {dateInfo.month}
                  </div>
                </div>

                {/* Teams */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {match.home === 'Boca Juniors' ? (
                      <div style={{
                        width: 26,
                        height: 18,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: `0 0 0 1px ${colors.blanco}30`
                      }}>
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                        <div style={{ flex: 1, background: colors.oro }} />
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                      </div>
                    ) : (
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: colors.blanco + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        fontWeight: 900,
                        color: colors.blanco
                      }}>
                        {match.home[0]}
                      </div>
                    )}
                    <span style={{
                      fontSize: 13,
                      color: colors.blanco,
                      fontWeight: match.home === 'Boca Juniors' ? 800 : 600
                    }}>
                      {match.home}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {match.away === 'Boca Juniors' ? (
                      <div style={{
                        width: 26,
                        height: 18,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: `0 0 0 1px ${colors.blanco}30`
                      }}>
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                        <div style={{ flex: 1, background: colors.oro }} />
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                      </div>
                    ) : (
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: colors.blanco + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        fontWeight: 900,
                        color: colors.blanco
                      }}>
                        {match.away[0]}
                      </div>
                    )}
                    <span style={{
                      fontSize: 13,
                      color: colors.blanco,
                      fontWeight: match.away === 'Boca Juniors' ? 800 : 600
                    }}>
                      {match.away}
                    </span>
                  </div>
                </div>

                {/* Time */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: '"Bebas Neue", Impact, sans-serif',
                    fontSize: 18,
                    color: colors.oro,
                    fontWeight: 900,
                    lineHeight: 1
                  }}>
                    <Clock size={12} />
                    {match.time}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: match.isHome ? '#4ade80' : '#fbbf24',
                    fontWeight: 700,
                    marginTop: 4,
                    letterSpacing: 0.5
                  }}>
                    {match.isHome ? '🏠 LOCAL' : '✈️ VISITA'}
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: `1px solid ${colors.blanco}10`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: colors.blanco + '99', fontWeight: 500 }}>
                  <MapPin size={12} />
                  {match.venue}, {match.city}
                </div>
                <button
                  onClick={() => addToCalendar(match)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 20,
                    background: `linear-gradient(135deg, ${colors.oro} 0%, ${colors.oroOscuro} 100%)`,
                    color: colors.azul,
                    border: 'none',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    letterSpacing: 0.3
                  }}
                >
                  <Plus size={12} strokeWidth={3} />
                  CALENDARIO
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ============ SUB-COMPONENTE: ÚLTIMOS RESULTADOS ============
  const ResultsView = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: colors.blanco + 'aa', fontWeight: 600 }}>
          Últimos {results.length} partidos
        </div>
        <button
          onClick={loadResults}
          disabled={resultsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 16,
            background: resultsLoading ? colors.grisMedio : colors.oro,
            color: resultsLoading ? colors.blanco + '88' : colors.azul,
            border: 'none', fontSize: 10, fontWeight: 800,
            cursor: resultsLoading ? 'wait' : 'pointer'
          }}
        >
          <span style={{ animation: resultsLoading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {resultsLoading ? 'CARGANDO' : 'ACTUALIZAR'}
        </button>
      </div>

      {resultsLoading && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            display: 'inline-block', width: 40, height: 40,
            border: `3px solid ${colors.grisMedio}`,
            borderTop: `3px solid ${colors.oro}`,
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            marginBottom: 16
          }} />
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 600 }}>
            Cargando últimos resultados...
          </div>
        </div>
      )}

      {resultsError && results.length === 0 && (
        <div style={{
          background: colors.grisOscuro, border: `1px solid ${colors.oro}40`,
          borderRadius: 14, padding: 20, textAlign: 'center'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            {resultsError}
          </div>
          <button onClick={loadResults} style={{
            padding: '8px 18px', borderRadius: 20, background: colors.oro,
            color: colors.azul, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer'
          }}>
            REINTENTAR
          </button>
        </div>
      )}

      {results.map(match => {
        const dateInfo = formatDate(match.date);
        const outcomeConfig = {
          win: { color: '#22c55e', label: 'G', bg: 'rgba(34,197,94,0.15)' },
          draw: { color: '#facc15', label: 'E', bg: 'rgba(250,204,21,0.15)' },
          loss: { color: '#ef4444', label: 'P', bg: 'rgba(239,68,68,0.15)' }
        };
        const oc = outcomeConfig[match.outcome];

        return (
          <div key={match.id} style={{
            background: colors.grisOscuro,
            borderRadius: 16,
            marginBottom: 12,
            overflow: 'hidden',
            border: `1px solid ${colors.blanco}10`
          }}>
            <div style={{
              padding: '8px 14px',
              background: match.competitionColor,
              fontSize: 10,
              fontWeight: 700,
              color: colors.blanco,
              letterSpacing: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{match.competition.toUpperCase()}</span>
              <span style={{ opacity: 0.85 }}>{dateInfo.day} {dateInfo.num} {dateInfo.month}</span>
            </div>
            <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Indicador G/E/P */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: oc.bg,
                color: oc.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Bebas Neue", Impact, sans-serif',
                fontSize: 18,
                fontWeight: 900,
                border: `1px solid ${oc.color}40`
              }}>
                {oc.label}
              </div>

              {/* Equipos + Score */}
              <div style={{ flex: 1 }}>
                {/* Local */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    {match.home === 'Boca Juniors' ? (
                      <div style={{
                        width: 26, height: 18, borderRadius: 2,
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: `0 0 0 1px ${colors.blanco}30`
                      }}>
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                        <div style={{ flex: 1, background: colors.oro }} />
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                      </div>
                    ) : (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: colors.blanco + '20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 900, color: colors.blanco
                      }}>
                        {match.home[0]}
                      </div>
                    )}
                    <span style={{
                      fontSize: 13,
                      color: colors.blanco,
                      fontWeight: match.home === 'Boca Juniors' ? 800 : 600
                    }}>
                      {match.home}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: '"Bebas Neue", Impact, sans-serif',
                    fontSize: 22,
                    color: colors.blanco,
                    fontWeight: 900,
                    minWidth: 24,
                    textAlign: 'right'
                  }}>
                    {match.homeScore}
                  </span>
                </div>
                {/* Visitante */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    {match.away === 'Boca Juniors' ? (
                      <div style={{
                        width: 26, height: 18, borderRadius: 2,
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: `0 0 0 1px ${colors.blanco}30`
                      }}>
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                        <div style={{ flex: 1, background: colors.oro }} />
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                      </div>
                    ) : (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: colors.blanco + '20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 900, color: colors.blanco
                      }}>
                        {match.away[0]}
                      </div>
                    )}
                    <span style={{
                      fontSize: 13,
                      color: colors.blanco,
                      fontWeight: match.away === 'Boca Juniors' ? 800 : 600
                    }}>
                      {match.away}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: '"Bebas Neue", Impact, sans-serif',
                    fontSize: 22,
                    color: colors.blanco,
                    fontWeight: 900,
                    minWidth: 24,
                    textAlign: 'right'
                  }}>
                    {match.awayScore}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ============ SUB-COMPONENTE: TABLA DE POSICIONES ============
  const StandingsView = () => {
    const currentTable = standings[standingsLeague] || [];
    const league = LEAGUES[standingsLeague];

    return (
      <div>
        {/* Selector de competición */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
          {Object.entries(LEAGUES).map(([key, lg]) => (
            <button
              key={key}
              onClick={() => setStandingsLeague(key)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                background: standingsLeague === key ? lg.color : colors.grisOscuro,
                color: colors.blanco,
                border: standingsLeague === key ? 'none' : `1px solid ${colors.blanco}20`,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {lg.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colors.blanco + 'aa', fontWeight: 600 }}>
            {league.name} · Temporada {league.season}
          </div>
          <button
            onClick={() => loadStandings(standingsLeague)}
            disabled={standingsLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 16,
              background: standingsLoading ? colors.grisMedio : colors.oro,
              color: standingsLoading ? colors.blanco + '88' : colors.azul,
              border: 'none', fontSize: 10, fontWeight: 800,
              cursor: standingsLoading ? 'wait' : 'pointer'
            }}
          >
            <span style={{ animation: standingsLoading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {standingsLoading ? 'CARGANDO' : 'ACTUALIZAR'}
          </button>
        </div>

        {standingsLoading && currentTable.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              display: 'inline-block', width: 40, height: 40,
              border: `3px solid ${colors.grisMedio}`,
              borderTop: `3px solid ${colors.oro}`,
              borderRadius: '50%', animation: 'spin 1s linear infinite',
              marginBottom: 16
            }} />
            <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 600 }}>
              Cargando tabla...
            </div>
          </div>
        )}

        {!standingsLoading && currentTable.length === 0 && (
          <div style={{
            background: colors.grisOscuro, border: `1px solid ${colors.oro}40`,
            borderRadius: 14, padding: 20, textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Tabla no disponible
            </div>
            <div style={{ color: colors.blanco + '88', fontSize: 11, marginBottom: 14, lineHeight: 1.5 }}>
              La tabla de {league.name} aún no está publicada o el formato del torneo no usa tabla simple (en Argentina hay zonas y formatos de copa).
            </div>
            <button onClick={() => loadStandings(standingsLeague)} style={{
              padding: '8px 18px', borderRadius: 20, background: colors.oro,
              color: colors.azul, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer'
            }}>
              REINTENTAR
            </button>
          </div>
        )}

        {currentTable.length > 0 && (
          <div style={{
            background: colors.grisOscuro,
            borderRadius: 14,
            overflow: 'hidden',
            border: `1px solid ${colors.blanco}10`
          }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 28px 28px 28px 28px 36px',
              gap: 6,
              padding: '10px 12px',
              background: colors.azulOscuro,
              borderBottom: `2px solid ${colors.oro}`,
              fontSize: 9,
              fontWeight: 800,
              color: colors.oro,
              letterSpacing: 1
            }}>
              <div>#</div>
              <div>EQUIPO</div>
              <div style={{ textAlign: 'center' }}>PJ</div>
              <div style={{ textAlign: 'center' }}>G</div>
              <div style={{ textAlign: 'center' }}>E</div>
              <div style={{ textAlign: 'center' }}>P</div>
              <div style={{ textAlign: 'center' }}>PTS</div>
            </div>

            {/* Rows */}
            {currentTable.map((row, idx) => {
              const isBoca = (row.strTeam || '').toLowerCase().includes('boca');
              const pos = parseInt(row.intRank) || idx + 1;
              return (
                <div
                  key={row.idStanding || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 28px 28px 28px 28px 36px',
                    gap: 6,
                    padding: '11px 12px',
                    background: isBoca ? `${colors.oro}15` : 'transparent',
                    borderBottom: `1px solid ${colors.blanco}08`,
                    alignItems: 'center',
                    borderLeft: isBoca ? `3px solid ${colors.oro}` : '3px solid transparent'
                  }}
                >
                  <div style={{
                    fontFamily: '"Bebas Neue", Impact, sans-serif',
                    fontSize: 16,
                    color: isBoca ? colors.oro : colors.blanco,
                    fontWeight: 900,
                    lineHeight: 1
                  }}>
                    {pos}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isBoca ? (
                      <div style={{
                        width: 22, height: 15, borderRadius: 2,
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: `0 0 0 1px ${colors.blanco}30`,
                        flexShrink: 0
                      }}>
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                        <div style={{ flex: 1, background: colors.oro }} />
                        <div style={{ flex: 1, background: '#0d4d8c' }} />
                      </div>
                    ) : row.strTeamBadge ? (
                      <img src={row.strTeamBadge} alt="" style={{
                        width: 18, height: 18, objectFit: 'contain', flexShrink: 0
                      }} />
                    ) : (
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: colors.blanco + '15',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 900, color: colors.blanco,
                        flexShrink: 0
                      }}>
                        {(row.strTeam || '?')[0]}
                      </div>
                    )}
                    <span style={{
                      fontSize: 12,
                      color: colors.blanco,
                      fontWeight: isBoca ? 800 : 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {row.strTeam}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: colors.blanco + 'cc', fontWeight: 600 }}>
                    {row.intPlayed || 0}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#22c55e', fontWeight: 700 }}>
                    {row.intWin || 0}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#facc15', fontWeight: 700 }}>
                    {row.intDraw || 0}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                    {row.intLoss || 0}
                  </div>
                  <div style={{
                    textAlign: 'center',
                    fontFamily: '"Bebas Neue", Impact, sans-serif',
                    fontSize: 16,
                    color: isBoca ? colors.oro : colors.blanco,
                    fontWeight: 900,
                    lineHeight: 1
                  }}>
                    {row.intPoints || 0}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Leyenda */}
        {currentTable.length > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: colors.grisOscuro, borderRadius: 10,
            fontSize: 10, color: colors.blanco + '88',
            display: 'flex', gap: 14, flexWrap: 'wrap'
          }}>
            <span><b style={{ color: colors.blanco }}>PJ</b> Jugados</span>
            <span><b style={{ color: '#22c55e' }}>G</b> Ganados</span>
            <span><b style={{ color: '#facc15' }}>E</b> Empatados</span>
            <span><b style={{ color: '#ef4444' }}>P</b> Perdidos</span>
            <span><b style={{ color: colors.oro }}>PTS</b> Puntos</span>
          </div>
        )}
      </div>
    );
  };

  const NewsCard = ({ item, compact }) => (
    <div
      onClick={() => window.open(item.url, '_blank')}
      style={{
        background: colors.grisOscuro,
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        border: `1px solid ${colors.blanco}10`,
        transition: 'transform 0.2s'
      }}
    >
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{
          width: compact ? 90 : 110,
          minWidth: compact ? 90 : 110,
          background: item.thumbnail
            ? `url(${item.thumbnail}) center/cover`
            : `linear-gradient(135deg, ${item.sourceColor} 0%, ${colors.azulOscuro} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 32 : 40,
          position: 'relative'
        }}>
          {!item.thumbnail && item.image}
          {item.thumbnail && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(135deg, ${item.sourceColor}40 0%, transparent 60%)`
            }} />
          )}
        </div>
        <div style={{ padding: 12, flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <span style={{
              fontSize: 8,
              fontWeight: 800,
              color: colors.blanco,
              background: item.sourceColor,
              padding: '2px 6px',
              borderRadius: 4,
              letterSpacing: 0.5
            }}>
              {item.sourceName.toUpperCase()}
            </span>
            <span style={{ fontSize: 9, color: colors.oro, fontWeight: 700, letterSpacing: 0.5 }}>
              {item.category}
            </span>
          </div>
          <div style={{
            fontSize: compact ? 12 : 13,
            color: colors.blanco,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: compact ? 4 : 6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {item.title}
          </div>
          {!compact && item.excerpt && (
            <div style={{
              fontSize: 11,
              color: colors.blanco + '99',
              lineHeight: 1.4,
              marginBottom: 6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {item.excerpt}
            </div>
          )}
          <div style={{ fontSize: 10, color: colors.blanco + '66', fontWeight: 500 }}>
            {item.time}
          </div>
        </div>
      </div>
    </div>
  );

  const NewsView = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
        <h1 style={{
          fontFamily: '"Bebas Neue", Impact, sans-serif',
          fontSize: 36,
          color: colors.blanco,
          fontWeight: 900,
          letterSpacing: 2,
          margin: 0,
          lineHeight: 1
        }}>
          NOTICIAS
        </h1>
        <button
          onClick={loadNews}
          disabled={newsLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 12px',
            borderRadius: 20,
            background: newsLoading ? colors.grisMedio : colors.oro,
            color: newsLoading ? colors.blanco + '88' : colors.azul,
            border: 'none',
            fontSize: 11,
            fontWeight: 800,
            cursor: newsLoading ? 'wait' : 'pointer',
            letterSpacing: 0.3
          }}
        >
          <span style={{
            display: 'inline-block',
            animation: newsLoading ? 'spin 1s linear infinite' : 'none',
            fontSize: 13
          }}>↻</span>
          {newsLoading ? 'CARGANDO' : 'ACTUALIZAR'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: colors.oro, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
        ACTUALIZADAS EN VIVO
      </div>
      {lastUpdate && (
        <div style={{ fontSize: 10, color: colors.blanco + '66', fontWeight: 500, marginBottom: 16 }}>
          Última actualización: {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}h · Auto-refresh cada 30 min
        </div>
      )}

      {/* Filtros de fuente */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {[
          { id: 'all', label: 'Todas', color: colors.oro },
          { id: 'planetabj', label: 'Planeta Boca', color: '#003366' },
          { id: 'ole', label: 'Olé', color: '#000000' },
          { id: 'tyc', label: 'TyC Sports', color: '#ed1c24' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setNewsSource(f.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              background: newsSource === f.id ? f.color : colors.grisOscuro,
              color: newsSource === f.id ? (f.id === 'all' ? colors.azul : colors.blanco) : colors.blanco,
              border: newsSource === f.id ? 'none' : `1px solid ${colors.blanco}20`,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Estados */}
      {newsLoading && news.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            display: 'inline-block',
            width: 40,
            height: 40,
            border: `3px solid ${colors.grisMedio}`,
            borderTop: `3px solid ${colors.oro}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 16
          }} />
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 600 }}>
            Buscando últimas noticias...
          </div>
          <div style={{ color: colors.blanco + '66', fontSize: 11, marginTop: 6 }}>
            Conectando con Planeta Boca, Olé y TyC Sports
          </div>
        </div>
      )}

      {newsError && news.length === 0 && (
        <div style={{
          background: colors.grisOscuro,
          border: `1px solid ${colors.oro}40`,
          borderRadius: 14,
          padding: 20,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            {newsError}
          </div>
          <div style={{ color: colors.blanco + '88', fontSize: 11, marginBottom: 14, lineHeight: 1.5 }}>
            Algunos feeds RSS pueden estar caídos o bloqueados temporalmente.
          </div>
          <button
            onClick={loadNews}
            style={{
              padding: '8px 18px',
              borderRadius: 20,
              background: colors.oro,
              color: colors.azul,
              border: 'none',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            REINTENTAR
          </button>
        </div>
      )}

      {filteredNews.map(n => <NewsCard key={n.id} item={n} />)}

      {!newsLoading && filteredNews.length === 0 && news.length > 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: colors.blanco + '66', fontSize: 13 }}>
          No hay noticias de esta fuente por ahora.
        </div>
      )}
    </div>
  );

  const VideosView = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
        <h1 style={{
          fontFamily: '"Bebas Neue", Impact, sans-serif',
          fontSize: 36,
          color: colors.blanco,
          fontWeight: 900,
          letterSpacing: 2,
          margin: 0,
          lineHeight: 1
        }}>
          VIDEOS
        </h1>
        <button
          onClick={() => window.open('https://www.youtube.com/@bocajuniorsoficial', '_blank')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 12px',
            borderRadius: 20,
            background: '#ff0000',
            color: colors.blanco,
            border: 'none',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <Youtube size={14} />
          YOUTUBE
        </button>
      </div>
      <div style={{ fontSize: 12, color: colors.oro, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
        CANAL OFICIAL · ACTUALIZADO EN VIVO
      </div>
      <button onClick={loadVideos} disabled={videosLoading} style={{
        background: 'none', border: 'none', color: colors.blanco + '99',
        fontSize: 10, fontWeight: 600, cursor: videosLoading ? 'wait' : 'pointer',
        marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4
      }}>
        <span style={{
          display: 'inline-block',
          animation: videosLoading ? 'spin 1s linear infinite' : 'none'
        }}>↻</span>
        {videosLoading ? 'Actualizando...' : 'Actualizar videos'}
      </button>

      {/* Estados */}
      {videosLoading && videos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            display: 'inline-block', width: 40, height: 40,
            border: `3px solid ${colors.grisMedio}`,
            borderTop: `3px solid ${colors.oro}`,
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            marginBottom: 16
          }} />
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 600 }}>
            Cargando videos...
          </div>
        </div>
      )}

      {videosError && videos.length === 0 && (
        <div style={{
          background: colors.grisOscuro, border: `1px solid ${colors.oro}40`,
          borderRadius: 14, padding: 20, textAlign: 'center'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📺</div>
          <div style={{ color: colors.blanco, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            {videosError}
          </div>
          <button onClick={loadVideos} style={{
            padding: '8px 18px', borderRadius: 20, background: colors.oro,
            color: colors.azul, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer'
          }}>
            REINTENTAR
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {videos.map(v => (
          <div
            key={v.id}
            onClick={() => window.open(v.url, '_blank')}
            style={{
              background: colors.grisOscuro,
              borderRadius: 16,
              overflow: 'hidden',
              cursor: 'pointer',
              border: `1px solid ${colors.blanco}10`
            }}
          >
            <div style={{
              height: 200,
              background: v.thumbnail
                ? `url(${v.thumbnail}) center/cover`
                : v.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 60,
              position: 'relative'
            }}>
              {!v.thumbnail && v.thumb}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(255,215,0,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 6px 24px rgba(0,0,0,0.5)`
              }}>
                <Play size={26} fill={colors.azul} color={colors.azul} style={{ marginLeft: 4 }} />
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{
                fontSize: 14,
                color: colors.blanco,
                fontWeight: 700,
                lineHeight: 1.3,
                marginBottom: 6
              }}>
                {v.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: colors.oro, fontWeight: 600 }}>
                  {v.channel}
                </div>
                <div style={{ fontSize: 10, color: colors.blanco + '88', fontWeight: 500 }}>
                  {v.views}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const SocialView = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <h1 style={{
        fontFamily: '"Bebas Neue", Impact, sans-serif',
        fontSize: 36,
        color: colors.blanco,
        fontWeight: 900,
        letterSpacing: 2,
        margin: '0 0 4px',
        lineHeight: 1
      }}>
        EL CLUB
      </h1>
      <div style={{ fontSize: 12, color: colors.oro, fontWeight: 600, letterSpacing: 1, marginBottom: 20 }}>
        REDES OFICIALES Y MÁS
      </div>

      {/* Sitio oficial */}
      <div
        onClick={() => window.open('https://www.bocajuniors.com.ar/', '_blank')}
        style={{
          background: `linear-gradient(135deg, ${colors.azul} 0%, ${colors.azulOscuro} 100%)`,
          borderRadius: 16,
          padding: 18,
          marginBottom: 14,
          cursor: 'pointer',
          border: `2px solid ${colors.oro}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.oro}30 0%, transparent 70%)`
        }} />
        <div style={{
          width: 50,
          height: 50,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${colors.oro} 0%, ${colors.oroOscuro} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <Globe size={24} color={colors.azul} strokeWidth={2.5} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ fontSize: 14, color: colors.blanco, fontWeight: 800 }}>
            Sitio Oficial
          </div>
          <div style={{ fontSize: 11, color: colors.oro, fontWeight: 600 }}>
            bocajuniors.com.ar
          </div>
        </div>
        <ExternalLink size={18} color={colors.blanco} style={{ position: 'relative' }} />
      </div>

      <div style={{
        fontFamily: '"Bebas Neue", Impact, sans-serif',
        fontSize: 13,
        color: colors.blanco + 'aa',
        fontWeight: 700,
        letterSpacing: 2,
        marginBottom: 12,
        marginTop: 8
      }}>
        REDES OFICIALES
      </div>

      {[
        { name: 'Instagram', handle: '@bocajrsoficial', icon: Instagram, gradient: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', url: 'https://www.instagram.com/bocajrsoficial/' },
        { name: 'Twitter / X', handle: '@BocaJrsOficial', icon: Twitter, gradient: 'linear-gradient(135deg, #000 0%, #1a1a2e 100%)', url: 'https://twitter.com/BocaJrsOficial' },
        { name: 'Facebook', handle: 'BocaJrsOficial', icon: Facebook, gradient: 'linear-gradient(135deg, #1877f2 0%, #0c5dc7 100%)', url: 'https://www.facebook.com/BocaJrsOficial' },
        { name: 'YouTube', handle: '@bocajuniorsoficial', icon: Youtube, gradient: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)', url: 'https://www.youtube.com/@bocajuniorsoficial' }
      ].map((s, i) => (
        <div
          key={i}
          onClick={() => window.open(s.url, '_blank')}
          style={{
            background: colors.grisOscuro,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            cursor: 'pointer',
            border: `1px solid ${colors.blanco}10`,
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: s.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <s.icon size={22} color={colors.blanco} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: colors.blanco, fontWeight: 700 }}>
              {s.name}
            </div>
            <div style={{ fontSize: 11, color: colors.blanco + '88', fontWeight: 500 }}>
              {s.handle}
            </div>
          </div>
          <ExternalLink size={16} color={colors.blanco + '66'} />
        </div>
      ))}

      <div style={{
        fontFamily: '"Bebas Neue", Impact, sans-serif',
        fontSize: 13,
        color: colors.blanco + 'aa',
        fontWeight: 700,
        letterSpacing: 2,
        marginBottom: 12,
        marginTop: 24
      }}>
        FUENTES DE NOTICIAS
      </div>

      {[
        { name: 'Planeta Boca', handle: 'planetabj.com', color: '#003366', url: 'https://planetabj.com/' },
        { name: 'Olé · Boca Juniors', handle: 'ole.com.ar/boca-juniors', color: '#000000', url: 'https://www.ole.com.ar/boca-juniors' },
        { name: 'TyC Sports · Boca', handle: 'tycsports.com/boca-juniors', color: '#ed1c24', url: 'https://www.tycsports.com/boca-juniors.html' }
      ].map((s, i) => (
        <div
          key={i}
          onClick={() => window.open(s.url, '_blank')}
          style={{
            background: colors.grisOscuro,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            cursor: 'pointer',
            border: `1px solid ${colors.blanco}10`,
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: s.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Newspaper size={22} color={colors.blanco} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: colors.blanco, fontWeight: 700 }}>
              {s.name}
            </div>
            <div style={{ fontSize: 11, color: colors.blanco + '88', fontWeight: 500 }}>
              {s.handle}
            </div>
          </div>
          <ExternalLink size={16} color={colors.blanco + '66'} />
        </div>
      ))}

      {/* Footer */}
      <div style={{
        marginTop: 30,
        padding: 20,
        background: `linear-gradient(135deg, ${colors.azulOscuro} 0%, ${colors.grisOscuro} 100%)`,
        borderRadius: 16,
        textAlign: 'center',
        border: `1px solid ${colors.oro}30`
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💛💙</div>
        <div style={{
          fontFamily: '"Bebas Neue", Impact, sans-serif',
          fontSize: 18,
          color: colors.oro,
          fontWeight: 900,
          letterSpacing: 2,
          marginBottom: 4
        }}>
          DESDE 1905
        </div>
        <div style={{ fontSize: 11, color: colors.blanco + '99', fontWeight: 500, lineHeight: 1.5 }}>
          121 años de historia, pasión y pueblo<br />
          La mitad más uno
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'fixture', icon: Trophy, label: 'Fixture' },
    { id: 'news', icon: Newspaper, label: 'Noticias' },
    { id: 'videos', icon: Youtube, label: 'Videos' },
    { id: 'social', icon: Users, label: 'Club' }
  ];

  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      margin: '0 auto',
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${colors.azulProfundo} 0%, ${colors.grisOscuro} 100%)`,
      fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        ::-webkit-scrollbar { width: 0; height: 0; }

        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .view-container { animation: fadeIn 0.4s ease-out; }
        .notif { animation: slideUp 0.3s ease-out; }
      `}</style>

      <Header />

      <div className="view-container" key={activeTab}>
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'fixture' && <FixtureView />}
        {activeTab === 'news' && <NewsView />}
        {activeTab === 'videos' && <VideosView />}
        {activeTab === 'social' && <SocialView />}
      </div>

      {/* Notification */}
      {showNotif && (
        <div className="notif" style={{
          position: 'fixed',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${colors.oro} 0%, ${colors.oroOscuro} 100%)`,
          color: colors.azul,
          padding: '12px 20px',
          borderRadius: 30,
          fontWeight: 800,
          fontSize: 12,
          boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          letterSpacing: 0.5
        }}>
          <Calendar size={16} />
          ¡EVENTO DESCARGADO!
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 420,
        background: `linear-gradient(180deg, ${colors.azulOscuro}f0 0%, ${colors.azulProfundo} 100%)`,
        backdropFilter: 'blur(20px)',
        borderTop: `2px solid ${colors.oro}`,
        padding: '8px 0 12px',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 100
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '6px 10px',
                position: 'relative',
                flex: 1
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: -10,
                  width: 28,
                  height: 3,
                  background: colors.oro,
                  borderRadius: 4,
                  boxShadow: `0 0 12px ${colors.oro}`
                }} />
              )}
              <tab.icon
                size={20}
                color={isActive ? colors.oro : colors.blanco + '66'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span style={{
                fontSize: 9,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? colors.oro : colors.blanco + '66',
                letterSpacing: 0.5,
                textTransform: 'uppercase'
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
