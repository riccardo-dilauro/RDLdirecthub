const MUSIC_DATA = {
  youtubeChannel: "https://www.youtube.com/@ALANLYMusic",
  syncNotes: {
    youtube: "Fallback locale attivo: eseguire npm.cmd run sync:data per dati live"
  },
  albums: [
    {
      id: "fallback-alb-1",
      kind: "album",
      source: "youtube",
      title: "Singoli YouTube",
      artist: "ALAN.LY",
      year: 2026,
      genre: ["youtube", "album"],
      cover: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      description: "Album placeholder locale generato come fallback.",
      youtube: "https://www.youtube.com/@ALANLYMusic",
      tracks: ["Aggiorna il dataset con sync:data"],
      featured: true,
      releasedAt: "2026-01-01"
    }
  ],
  singles: [
    {
      id: "fallback-yt-1",
      kind: "single",
      source: "youtube",
      title: "Aggiorna il dataset con sync:data",
      trackName: "Aggiorna il dataset con sync:data",
      albumName: "Singoli YouTube",
      artist: "ALAN.LY",
      year: 2026,
      genre: ["youtube", "single"],
      cover: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      description: "Questo e un placeholder locale.",
      youtube: "https://www.youtube.com/@ALANLYMusic",
      hashtags: ["youtube", "single"],
      featured: false,
      releasedAt: "2026-01-01"
    }
  ],
  playlists: [
    {
      id: "fallback-playlist-1",
      title: "YouTube - Ultime Uscite",
      mood: "novita",
      energy: "media",
      genre: ["youtube", "release"],
      cover: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      description: "Playlist placeholder locale.",
      tracks: ["Aggiorna il dataset con sync:data"]
    }
  ]
};
