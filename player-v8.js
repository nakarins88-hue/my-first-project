/* ==========================================================================
   Cozy Jeff Bernat Music Lounge - Resilient Engine (Cache-Busted Player Edition)
   ========================================================================== */

// --- 0. YouTube API Script Loader ---
if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }
  console.log("Dynamically injected YouTube Iframe API script.");
}

// --- 1. Global State Variables ---
let ytPlayer = null;
let isYtReady = false;
let useFallbackAudio = false; // Automatically set to true if YouTube fails/is blocked
let currentTrackIndex = 0;
let isPlaying = false;
let tracks = []; // Dynamically populated
let allBaseTracks = []; // Original API/Built-in songs list
let favorites = [];
let currentFilter = 'all'; // 'all' | 'favorites'
let isShuffle = false;
let isRepeat = false;
let theme = 'rain'; // 'rain' | 'cafe' | 'study'
let progressPollInterval = null;
let waveOffset = 0;
let visualizerAnimId = null;
let activeLyricTimestamps = [];

// Audio Engine Caches & Settings
let elEngineYoutube = null;
let elEngineLocal = null;
let elEngineItunes = null;
let elLocalFileInput = null;
let elImportBtnTrigger = null;
let elLocalImportZone = null;
let currentEngine = 'local'; // 'youtube' | 'local' | 'itunes'

// Premium Local Library Listing
const LOCAL_FILE_NAMES = [
  "Be The One (inst).m4a",
  "Be The One.m4a",
  "Better With You.m4a",
  "Birthday Suit.m4a",
  "Bonjour (Intro).m4a",
  "Boogie Down.m4a",
  "Bored.m4a",
  "Call You Mine (Sped Up).m4a",
  "Call You Mine (feat. Geologic Of The Blue Scholars).m4a",
  "Casual (Acoustic).m4a",
  "Casual (feat. Jeff Bernat & Johnny Stimson).m4a",
  "Chamomile.m4a",
  "Changes (Sped Up).m4a",
  "Changes.m4a",
  "Come On Over (inst.).m4a",
  "Come On Over.m4a",
  "Come Thru (Feat. Asher Roth).m4a",
  "Cool Girls.m4a",
  "Cruel (Sped Up).m4a",
  "Cruel.m4a",
  "DA RA DA.m4a",
  "Daydream.m4a",
  "Distant Lover.m4a",
  "Doesn't Matter.m4a",
  "Dream Team.m4a",
  "FOND.m4a",
  "First Class.m4a",
  "Girl At The Coffee Shop.m4a",
  "Groovin'.m4a",
  "Growing Old With You (Intimate).m4a",
  "Have Yourself a Merry Little Christmas.m4a",
  "Heaven Sent.m4a",
  "Higher.m4a",
  "Hypnotized (Feat. Blu).m4a",
  "If It Hadn't Been For You (Feat. Substantial).m4a",
  "If You Wonder.m4a",
  "In the Mood.m4a",
  "Intro.m4a",
  "Just Vibe.m4a",
  "Lavish.m4a",
  "Luvn On U.m4a",
  "Make It Official (Accapella).m4a",
  "Make It Official (feat. Crucial Star).m4a",
  "Make It Official (inst.).m4a",
  "Make a Move.m4a",
  "Make up Your Mind.m4a",
  "Miles in Between (Feat. Joyce Wrice).m4a",
  "Mind Vs Heart.m4a",
  "Moonlight Chemistry.m4a",
  "Ms. Seductive.m4a",
  "My Dear.m4a",
  "Once Upon a Time.m4a",
  "Other Half.m4a",
  "Paces.m4a",
  "Pillow Talk.m4a",
  "Plenty of Reasons.m4a",
  "Queen.m4a",
  "Reassurance.m4a",
  "Romance (Inst.).m4a",
  "Romance.m4a",
  "Situations.m4a",
  "Slow Jam Hour (Interlude).m4a",
  "Still (Sped Up).m4a",
  "Still.m4a",
  "Summer Dresses.m4a",
  "Sweet Nothing.m4a",
  "The Christmas Song.m4a",
  "This Time (Sped Up).m4a",
  "This Time.m4a",
  "Various Places.m4a",
  "Waste No Time.m4a",
  "West Coast Getaway (Feat. The Cool Kids).m4a",
  "Whatever Goes.m4a",
  "White Christmas.m4a",
  "Wish You Well.m4a",
  "With Love (feat. Mosaek).m4a",
  "Workflow (Feat. Dumbfoundead).m4a",
  "Worth the Wait.m4a",
  "Wrong About Forever (Sped Up).m4a",
  "Wrong About Forever.m4a",
  "You Could Be (Interlude).m4a"
];

// Try-Catch parse favorites from LocalStorage safely
try {
  favorites = JSON.parse(localStorage.getItem('jeff_bernat_favorites')) || [];
} catch(e) {
  favorites = [];
}

// Pre-populate tracks with all local files by default to ensure 100% offline & mobile reliability
function initLocalTracks() {
  tracks = LOCAL_FILE_NAMES.map((fileName, index) => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const cleanFile = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    let collection = "The Gentleman Approach";
    let artwork = "default_cover.png";
    let year = "2012-12-07T08:00:00Z";
    
    if (cleanFile.includes("pillowtalk") || cleanFile.includes("coolgirls") || cleanFile.includes("modernrenaissance")) {
      collection = "Modern Renaissance";
      artwork = "cover_renaissance.png";
      year = "2013-12-15T08:00:00Z";
    } else if (cleanFile.includes("changes") || cleanFile.includes("shelovesmenot")) {
      collection = "She Loves Me Not";
      artwork = "cover_shelovesmenot.png";
      year = "2019-05-10T08:00:00Z";
    } else if (cleanFile.includes("still") || cleanFile.includes("cruisin") || cleanFile.includes("meantime")) {
      collection = "In the Meantime";
      artwork = "cover_meantime.png";
      year = "2016-01-16T08:00:00Z";
    }
    
    return {
      trackId: 'local_' + cleanFile,
      trackName: nameWithoutExt,
      collectionName: collection,
      artworkUrl100: artwork,
      previewUrl: `music/${encodeURIComponent(fileName)}`,
      localUrl: `music/${encodeURIComponent(fileName)}`,
      releaseDate: year,
      primaryGenreName: "R&B/Soul",
      trackViewUrl: "https://music.apple.com/us/artist/jeff-bernat/487317660"
    };
  }).filter(t => {
    const clean = t.trackName.toLowerCase();
    return !clean.includes('sped up') &&
           !clean.includes('acoustic') &&
           !clean.includes('inst.') &&
           !clean.includes('inst)') &&
           !clean.includes('instrumental') &&
           !clean.includes('intro') &&
           !clean.includes('interlude') &&
           !clean.includes('accapella') &&
           !clean.includes('remix') &&
           !clean.includes('mix');
  });
}
initLocalTracks();

// Dynamic local cover matcher & string-hash rotator
function getLocalCoverUrl(trackName, albumName) {
  const cleanTrack = (trackName || "").toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanAlbum = (albumName || "").toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (cleanAlbum.includes("renaissance") || cleanTrack.includes("pillowtalk") || cleanTrack.includes("coolgirls")) {
    return 'cover_renaissance.png';
  } else if (cleanAlbum.includes("meantime") || cleanTrack.includes("still") || cleanTrack.includes("cruisin")) {
    return 'cover_meantime.png';
  } else if (cleanAlbum.includes("shelovesmenot") || cleanTrack.includes("changes") || cleanTrack.includes("shelovesme")) {
    return 'cover_shelovesmenot.png';
  } else if (cleanAlbum.includes("gentleman") || cleanTrack.includes("callyoumine") || cleanTrack.includes("groovin")) {
    return 'default_cover.png';
  } else {
    // String hash rotational mapping to dynamically distribute the 5 premium covers
    const hash = cleanTrack.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const options = ['default_cover.png', 'cover_renaissance.png', 'cover_meantime.png', 'cover_shelovesmenot.png', 'cover_singles.png'];
    return options[hash % options.length];
  }
}

// --- 2. Cached DOM Elements (Assigned on DOMContentLoaded) ---
let elBody = null;
let elSongSearch = null;
let elLibraryList = null;
let elAlbumShelf = null;
let elVinylRecord = null;
let elVinylLabel = null;
let elTonearm = null;
let elPlayBtn = null;
let elPrevBtn = null;
let elNextBtn = null;
let elShuffleBtn = null;
let elRepeatBtn = null;
let elHeartCurrentBtn = null;
let elItunesLink = null;
let elTrackTitleMain = null;
let elTrackAlbumMain = null;
let elTrackYear = null;
let elTrackGenre = null;
let elCurrentTimeDisplay = null;
let elTotalDurationDisplay = null;
let elProgressContainer = null;
let elProgressFill = null;
let elPlayerVolume = null;
let elPlayerVolumeIcon = null;
let elLyricsContainer = null;
let elLibTabs = [];
let elMoodBtns = [];
let elAmbientCanvas = null;
let elVisualizerCanvas = null;
let elFloatingNotesContainer = null;
let elCozyToast = null;
let elAmbientMasterBtn = null;
let elMainAudio = null; // Standard HTML5 Audio element fallback

// --- 3. Cozy Ambient Synthesizer State (Web Audio API) ---
let ambientAudioCtx = null;
let isAmbientOn = false;
let ambientNodes = {
  rain: { gainNode: null, source: null },
  cafe: { gainNode: null, source: null },
  fireplace: { gainNode: null, source: null }
};
let channelVolumes = { rain: 0.3, cafe: 0.0, fireplace: 0.0 };
let channelMutes = { rain: false, cafe: true, fireplace: true };

// --- 4. Premium Offline Playlist (Instant Load & Safe Fallback) ---
const BACKUP_TRACKS = [
  {
    trackId: 588826011,
    trackName: "Call You Mine (feat. Geeks)",
    collectionName: "The Gentleman Approach",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/91/97/81/91978189-9130-10db-ee83-7d848ce1c9e8/m4a.letterbox.dl.m4a",
    releaseDate: "2012-12-07T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/call-you-mine-feat-geeks/588825838?i=588826011"
  },
  {
    trackId: 588826013,
    trackName: "Groovin",
    collectionName: "The Gentleman Approach",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/80/42/cb/8042cb3a-59df-cae4-08fb-463d1e1f7481/m4a.letterbox.dl.m4a",
    releaseDate: "2012-12-07T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/groovin/588825838?i=588826013"
  },
  {
    trackId: 783935298,
    trackName: "Pillow Talk",
    collectionName: "Modern Renaissance",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/db/45/ad/db45ad7d-c07a-251c-4395-9ff2d973715c/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/21/df/b4/21dfb4c7-1a48-6a56-b7ff-27c9d924f0c4/m4a.letterbox.dl.m4a",
    releaseDate: "2013-12-15T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/pillow-talk/783935293?i=783935298"
  },
  {
    trackId: 1071989040,
    trackName: "Cruisin",
    collectionName: "In the Meantime",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/bf/16/f4bf168e-9080-60b6-11fc-db439563f458/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/fa/1c/9a/fa1c9a63-fb6a-72ef-4cc6-e630cc6784d7/m4a.letterbox.dl.m4a",
    releaseDate: "2016-01-16T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/cruisin/1071988882?i=1071989040"
  },
  {
    trackId: 783935294,
    trackName: "Cool Girls",
    collectionName: "Modern Renaissance",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/db/45/ad/db45ad7d-c07a-251c-4395-9ff2d973715c/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/91/9a/02/919a022f-d893-6c84-93ad-db05c755255f/m4a.letterbox.dl.m4a",
    releaseDate: "2013-12-15T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/cool-girls/783935293?i=783935294"
  },
  {
    trackId: 588826017,
    trackName: "Just Vibe",
    collectionName: "The Gentleman Approach",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/96/cc/21/96cc21bf-de7e-a0e2-6ad0-cf227917d23d/m4a.letterbox.dl.m4a",
    releaseDate: "2012-12-07T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/just-vibe/588825838?i=588826017"
  },
  {
    trackId: 1460593005,
    trackName: "Changes",
    collectionName: "She Loves Me Not",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/99/bd/27/99bd27df-6bf9-e30b-0447-38e55e09f583/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/7f/7d/53/7f7d5351-4e78-9e5c-cb3a-7db195156a65/m4a.letterbox.dl.m4a",
    releaseDate: "2019-05-10T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/changes/1460592813?i=1460593005"
  },
  {
    trackId: 1071989043,
    trackName: "Still",
    collectionName: "In the Meantime",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/bf/16/f4bf168e-9080-60b6-11fc-db439563f458/artwork.jpg/400x400bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/b9/e7/70/b9e77035-7762-b9b5-4b10-09315d026be1/m4a.letterbox.dl.m4a",
    releaseDate: "2016-01-16T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/still/1071988882?i=1071989043"
  }
];

function populateAllLocalTracks() {
  // Filter out any mixes, sped ups, instrumentals, acoustics, intros/interludes, or alternate versions
  const filteredFileNames = LOCAL_FILE_NAMES.filter(fileName => {
    const clean = fileName.toLowerCase();
    return !clean.includes('sped up') &&
           !clean.includes('acoustic') &&
           !clean.includes('inst.') &&
           !clean.includes('inst)') &&
           !clean.includes('instrumental') &&
           !clean.includes('intro') &&
           !clean.includes('interlude') &&
           !clean.includes('accapella') &&
           !clean.includes('remix') &&
           !clean.includes('mix');
  });

  const localTracks = filteredFileNames.map((fileName, idx) => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const cleanFile = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Assign correct album and artwork for classics
    let collection = "The Gentleman Approach";
    let year = "2012-12-07T08:00:00Z";
    
    if (cleanFile.includes("pillowtalk") || cleanFile.includes("coolgirls") || cleanFile.includes("modernrenaissance")) {
      collection = "Modern Renaissance";
      year = "2013-12-15T08:00:00Z";
    } else if (cleanFile.includes("changes") || cleanFile.includes("shelovesmenot")) {
      collection = "She Loves Me Not";
      year = "2019-05-10T08:00:00Z";
    } else if (cleanFile.includes("still") || cleanFile.includes("cruisin") || cleanFile.includes("meantime")) {
      collection = "In the Meantime";
      year = "2016-01-16T08:00:00Z";
    }
    
    const localCover = getLocalCoverUrl(nameWithoutExt, collection);
    
    return {
      trackId: 'local_' + cleanFile + '_' + idx,
      trackName: nameWithoutExt,
      collectionName: collection,
      artworkUrl100: localCover, // Set local cover directly so it loads offline immediately!
      previewUrl: `music/${encodeURIComponent(fileName)}`,
      localUrl: `music/${encodeURIComponent(fileName)}`,
      releaseDate: year,
      primaryGenreName: "R&B/Soul",
      trackViewUrl: "https://music.apple.com/us/artist/jeff-bernat/487317660"
    };
  });
    allBaseTracks = localTracks;
    if (typeof resolveTracksList === 'function') {
      resolveTracksList();
    } else {
      tracks = localTracks;
    }
  }

// Instantly preload the backup tracks list so the page has tracks before API loads
populateAllLocalTracks();

// --- 5. YouTube Video Mapping Dictionary ---
const YOUTUBE_IDS = {
  callyoumine: "82g0sF-5-lI",
  groovin: "wY2QpeM1Z_U",
  pillowtalk: "L6iH3QeT4aU",
  cruisin: "oP3g5hR1oG8",
  coolgirls: "WkSw626X_6A",
  justvibe: "x6_ZlY_Ym1E",
  changes: "9P5vV-w6P1I",
  still: "38a7oX_F8qE",
  ifyouwonder: "lR6e3W7IqXI",
  mssincerity: "Z1FmE8y8P3w",
  mydear: "s3B8lYqF8zM",
  wrongaboutforever: "N9m8v8X8z8A",
  onceuponatime: "_W8vP9y8w8A",
  beige: "z80pMntqTug",
  workflow: "vP1e4ycrF-k",
  dreamy: "kQ8gN-0qg9A",
  sober: "w51tWpU7f5I",
  withlove: "oP3g5hR1oG8"
};

function getYouTubeVideoId(trackName) {
  const clean = trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let key in YOUTUBE_IDS) {
    if (clean.includes(key) || key.includes(clean)) {
      return YOUTUBE_IDS[key];
    }
  }
  return "82g0sF-5-lI"; // Standard fallback
}

// Synced Lyrics Presets
const PRESET_LYRICS = {
  callyoumine: [
    { time: 0, text: "♫ Smooth R&B Jazz Piano Intro ♫" },
    { time: 8, text: "Yeah, I'm thinking 'bout you, girl..." },
    { time: 13, text: "You've got that smile that makes me warm inside..." },
    { time: 21, text: "You've got that vibe that keeps me satisfied..." },
    { time: 29, text: "And I just wanna hold you through the night," },
    { time: 37, text: "Girl, can I call you mine?" },
    { time: 41, text: "Yeah, can I call you mine?" },
    { time: 45, text: "You make me forget about all my stress" },
    { time: 53, text: "The way you dress, girl, you're the best!" },
    { time: 61, text: "And when I look at you, my heart just stops" },
    { time: 69, text: "From the very bottom to the very top..." },
    { time: 77, text: "♫ Keyboard Solo playing smoothly ♫" },
    { time: 90, text: "So let's just make it official tonight" },
    { time: 98, text: "No need to hesitate, everything's right" },
    { time: 106, text: "Just say the word and I'll be by your side" },
    { time: 114, text: "Can I call you mine? Can I call you mine?" },
    { time: 122, text: "♫ Instrumental Interlude ♫" },
    { time: 140, text: "Girl, you're the one I need in my life" },
    { time: 148, text: "Hope that one day you'll be my wife..." },
    { time: 156, text: "Under the stars, everything feels so fine" },
    { time: 164, text: "I'm so incredibly happy you're mine..." },
    { time: 172, text: "♫ Outro R&B groove fades out ♫" }
  ],
  groovin: [
    { time: 0, text: "♫ Soft Rhodes Piano Intro ♫" },
    { time: 7, text: "Yeah, let's take a stroll down the avenue..." },
    { time: 15, text: "Nothing in this world competes with you." },
    { time: 23, text: "We're groovin', under the golden moon," },
    { time: 31, text: "Hoping that the night won't end too soon." },
    { time: 39, text: "Oh baby, the way you move is so fine," },
    { time: 47, text: "I'm so incredibly glad you're mine..." },
    { time: 55, text: "♫ Saxophone solo vibes playing ♫" },
    { time: 70, text: "No matter where we go, or what we do" },
    { time: 78, text: "My heart will always beat for you" },
    { time: 86, text: "Under the golden neon light" },
    { time: 94, text: "Everything will be just right..." }
  ],
  pillowtalk: [
    { time: 0, text: "♫ Dreamy electric guitar chords ♫" },
    { time: 6, text: "Late night conversation under the sheets," },
    { time: 14, text: "Whispering secrets, making my heart skip beats..." },
    { time: 22, text: "It's the little pillow talk we do at night," },
    { time: 30, text: "That makes everything feel completely right." },
    { time: 38, text: "Just hearing your voice, so soft and low," },
    { time: 46, text: "Girl, I'm never gonna let you go." }
  ]
};

// --- 6. Global YouTube Iframe API Initialization Callback ---
window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('yt-player', {
    height: '120',
    width: '200',
    videoId: '82g0sF-5-lI', // Default is "Call You Mine"
    playerVars: {
      'playsinline': 1,
      'controls': 0,
      'disablekb': 1,
      'fs': 0,
      'rel': 0,
      'showinfo': 0,
      'modestbranding': 1,
      'autoplay': 0,
      'mute': 0,
      'origin': window.location.origin
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
};

function onPlayerReady(event) {
  isYtReady = true;
  useFallbackAudio = false; // YouTube is working fine!
  
  // Set volume matching UI slider if loaded
  const volumeSlider = document.getElementById('player-volume');
  if (volumeSlider && ytPlayer) {
    ytPlayer.setVolume(parseInt(volumeSlider.value));
  }
  if (ytPlayer) {
    ytPlayer.unMute();
  }
  console.log("YouTube API Player is loaded.");
}

function onPlayerStateChange(event) {
  const playBtn = document.getElementById('play-btn');
  const vinylRecord = document.getElementById('vinyl-record');
  const tonearm = document.getElementById('tonearm');
  const libraryList = document.getElementById('library-list');
  
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    if (vinylRecord) vinylRecord.classList.add('playing');
    if (tonearm) tonearm.classList.add('active');
    
    triggerFloatingNotes();
    startProgressPolling();
    
    if (ytPlayer) ytPlayer.unMute();
    
    if (libraryList) {
      const activeCover = libraryList.querySelector('.song-item.active .song-item-cover');
      if (activeCover) activeCover.innerHTML = '<i class="fa-solid fa-volume-high text-accent"></i>';
    }
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
    isPlaying = false;
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    if (vinylRecord) vinylRecord.classList.remove('playing');
    if (tonearm) tonearm.classList.remove('active');
    
    if (libraryList) {
      const activeCover = libraryList.querySelector('.song-item.active .song-item-cover');
      if (activeCover) activeCover.innerHTML = '';
    }
  } else if (event.data === YT.PlayerState.ENDED) {
    isPlaying = false;
    if (vinylRecord) vinylRecord.classList.remove('playing');
    if (tonearm) tonearm.classList.remove('active');
    stopProgressPolling();
    
    if (libraryList) {
      const activeCover = libraryList.querySelector('.song-item.active .song-item-cover');
      if (activeCover) activeCover.innerHTML = '';
    }
    
    if (isRepeat && ytPlayer) {
      ytPlayer.playVideo();
    } else {
      nextTrack();
    }
  }
}

// --- 7. Playback & Engine API Functions (Global scope for safety) ---
function getLocalAudioUrl(trackName) {
  if (!trackName) return null;
  const cleanTrack = trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let fileName of LOCAL_FILE_NAMES) {
    const cleanFile = fileName.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/g, '');
    if (cleanTrack.includes(cleanFile) || cleanFile.includes(cleanTrack) ||
        (cleanTrack.includes("callyoumine") && cleanFile.includes("callyoumine")) ||
        (cleanTrack.includes("groovin") && cleanFile.includes("groovin"))) {
      return `music/${encodeURIComponent(fileName)}`;
    }
  }
  return null;
}

function updateEngineSelectorUI() {
  const currentTrack = tracks[currentTrackIndex];
  
  if (elEngineYoutube) {
    elEngineYoutube.classList.toggle('active', currentEngine === 'youtube');
    if (!isYtReady) elEngineYoutube.classList.add('disabled');
    else elEngineYoutube.classList.remove('disabled');
  }
  
  if (elEngineLocal) {
    const hasLocal = currentTrack && (currentTrack.localUrl || getLocalAudioUrl(currentTrack.trackName));
    elEngineLocal.classList.toggle('active', currentEngine === 'local');
    if (hasLocal) {
      elEngineLocal.classList.remove('disabled');
      elEngineLocal.querySelector('span').textContent = 'Local File (เพลงเต็ม)';
    } else {
      elEngineLocal.classList.add('disabled');
      elEngineLocal.querySelector('span').textContent = 'Local File (ไม่มีไฟล์)';
    }
  }
  
  if (elEngineItunes) {
    elEngineItunes.classList.toggle('active', currentEngine === 'itunes');
  }
}

function updatePlayerUIPlaying(playing) {
  if (elPlayBtn) elPlayBtn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  if (elVinylRecord) {
    if (playing) elVinylRecord.classList.add('playing');
    else elVinylRecord.classList.remove('playing');
  }
  if (elTonearm) {
    if (playing) elTonearm.classList.add('active');
    else elTonearm.classList.remove('active');
  }
}

function importLocalTracks(files) {
  let hasAsyncPath = false;
  
  Array.from(files).forEach(file => {
    const objectURL = URL.createObjectURL(file);
    const fileNameClean = file.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check if it matches any existing tracks in our list
    let matchedIdx = tracks.findIndex(t => {
      const tNameClean = t.trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return fileNameClean.includes(tNameClean) || tNameClean.includes(fileNameClean);
    });
    
    if (matchedIdx !== -1) {
      tracks[matchedIdx].localUrl = objectURL;
      tracks[matchedIdx].previewUrl = objectURL; // support preview fallback using the local file!
      showToast("นำเข้าเพลงสำเร็จ! 🎵", `เชื่อมโยงไฟล์กับเพลง "${tracks[matchedIdx].trackName}" แล้วค่ะ`);
      loadTrack(matchedIdx);
    } else {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const newTrackId = 'custom_' + Date.now() + Math.round(Math.random() * 100);
      
      const customTrack = {
        trackId: newTrackId,
        trackName: nameWithoutExt,
        collectionName: "อิมพอร์ตจากเครื่อง (Local Custom)",
        artworkUrl100: "default_cover.png",
        audioBlob: file, // Store the binary file Blob!
        releaseDate: new Date().toISOString(),
        primaryGenreName: "Local Audio",
        trackViewUrl: "#",
        isCustom: true
      };
      
      if (typeof saveCustomTrackToDB === 'function' && typeof loadCustomTracksFromDB === 'function') {
        hasAsyncPath = true;
        saveCustomTrackToDB(customTrack)
          .then(() => loadCustomTracksFromDB())
          .then(() => {
            resolveTracksList();
            renderLibrary();
            renderAlbumShelf();
            
            // Find active index of newly created track
            const activeIdx = tracks.findIndex(t => t.trackId === newTrackId);
            if (activeIdx !== -1) {
              loadTrack(activeIdx);
              playAudio();
            }
            showToast("เพิ่มเพลงสำเร็จ! 🎵", `จัดเก็บเพลง "${nameWithoutExt}" เข้าคลังแบบออฟไลน์เรียบร้อยแล้วค่ะ`);
          })
          .catch(err => {
            console.error("Auto import save failed:", err);
            // Fallback to temporary session track if IndexedDB fails
            const fallbackTrack = {
              trackId: newTrackId,
              trackName: nameWithoutExt,
              collectionName: "อิมพอร์ตชั่วคราว (Session Custom)",
              artworkUrl100: "default_cover.png",
              previewUrl: objectURL,
              localUrl: objectURL,
              releaseDate: new Date().toISOString(),
              primaryGenreName: "Local Audio",
              trackViewUrl: "#",
              isCustom: true
            };
            tracks.push(fallbackTrack);
            renderLibrary();
            renderAlbumShelf();
            loadTrack(tracks.length - 1);
            playAudio();
          });
      } else {
        // Fallback
        const fallbackTrack = {
          trackId: newTrackId,
          trackName: nameWithoutExt,
          collectionName: "อิมพอร์ตชั่วคราว (Session Custom)",
          artworkUrl100: "default_cover.png",
          previewUrl: objectURL,
          localUrl: objectURL,
          releaseDate: new Date().toISOString(),
          primaryGenreName: "Local Audio",
          trackViewUrl: "#",
          isCustom: true
        };
        tracks.push(fallbackTrack);
        loadTrack(tracks.length - 1);
      }
    }
  });
  
  if (!hasAsyncPath) {
    renderLibrary();
    renderAlbumShelf();
    playAudio();
  }
}

function loadTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  
  currentTrackIndex = index;
  const track = tracks[currentTrackIndex];
  
  if (elTrackTitleMain) elTrackTitleMain.textContent = track.trackName;
  if (elTrackAlbumMain) elTrackAlbumMain.textContent = track.collectionName;
  
  const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : 'Unknown';
  if (elTrackYear) elTrackYear.textContent = year;
  if (elTrackGenre) elTrackGenre.textContent = track.primaryGenreName || 'R&B/Soul';
  
  const localCover = getLocalCoverUrl(track.trackName, track.collectionName);
  if (elVinylLabel) elVinylLabel.style.backgroundImage = `url('${track.artworkUrl100}'), url('${localCover}')`;
  
  if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = "0:00";
  
  // Set default local url if present in directory
  const localUrl = getLocalAudioUrl(track.trackName);
  if (localUrl) {
    track.localUrl = localUrl;
  }
  
  // Select best audio engine available
  if (track.localUrl) {
    currentEngine = 'local';
  } else if (isYtReady && !useFallbackAudio) {
    currentEngine = 'youtube';
  } else {
    currentEngine = 'itunes';
  }
  
  if (elTotalDurationDisplay) {
    if (currentEngine === 'local') {
      elTotalDurationDisplay.textContent = "Loading...";
    } else if (currentEngine === 'itunes') {
      elTotalDurationDisplay.textContent = "0:30";
    } else {
      elTotalDurationDisplay.textContent = "Loading...";
    }
  }
  
  if (elProgressFill) elProgressFill.style.width = "0%";
  if (elItunesLink) elItunesLink.href = track.trackViewUrl;
  
  // Heart favoriting
  const isFav = favorites.includes(track.trackId);
  if (elHeartCurrentBtn) {
    if (isFav) {
      elHeartCurrentBtn.className = 'sub-btn active';
      elHeartCurrentBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
      elHeartCurrentBtn.className = 'sub-btn';
      elHeartCurrentBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
  }
  
  loadLyrics(track.trackName);
  updateEngineSelectorUI();
  
  // Update lock screen media session details
  if (typeof updateMediaSessionMetadata === 'function') {
    updateMediaSessionMetadata(track);
  }
  
  // Update UI list items
  if (elLibraryList) {
    const songItems = elLibraryList.querySelectorAll('.song-item');
    songItems.forEach((item, idx) => {
      if (idx === index) {
        item.classList.add('active');
        const cover = item.querySelector('.song-item-cover');
        if (cover && isPlaying) cover.innerHTML = '<i class="fa-solid fa-volume-high text-accent"></i>';
      } else {
        item.classList.remove('active');
        const cover = item.querySelector('.song-item-cover');
        if (cover) cover.innerHTML = '';
      }
    });
  }

  // Pre-load track sources
  if (currentEngine === 'local' && track.localUrl) {
    if (elMainAudio) {
      elMainAudio.src = track.localUrl;
      elMainAudio.load();
    }
  } else if (currentEngine === 'itunes') {
    if (elMainAudio) {
      elMainAudio.src = track.previewUrl;
      elMainAudio.load();
    }
  } else if (currentEngine === 'youtube' && isYtReady && ytPlayer) {
    const ytId = getYouTubeVideoId(track.trackName);
    ytPlayer.cueVideoById(ytId);
    ytPlayer.unMute();
  }
}

function playAudio() {
  const currentTrack = tracks[currentTrackIndex];
  
  // Pause any conflicting audio elements first
  if (elMainAudio) elMainAudio.pause();
  if (isYtReady && ytPlayer) ytPlayer.pauseVideo();
  
  if (currentEngine === 'local' && (currentTrack.localUrl || getLocalAudioUrl(currentTrack.trackName))) {
    const activeUrl = currentTrack.localUrl || getLocalAudioUrl(currentTrack.trackName);
    console.log("Playing via Local High-Quality Audio Engine:", activeUrl);
    
    if (elMainAudio) {
      const absActiveUrl = new URL(activeUrl, window.location.href).href;
      if (elMainAudio.src !== absActiveUrl && !elMainAudio.src.startsWith('blob:')) {
        elMainAudio.src = activeUrl;
        elMainAudio.load();
      }
      
      isPlaying = true;
      elMainAudio.play().then(() => {
        updatePlayerUIPlaying(true);
        triggerFloatingNotes();
        startProgressPolling();
        if (typeof updateMediaSessionMetadata === 'function') {
          updateMediaSessionMetadata(currentTrack);
        }
      }).catch(e => {
        console.warn("Local audio playback failed, falling back to iTunes/YouTube:", e);
        // Autoplay policies or other failures fallback
        currentEngine = 'youtube';
        updateEngineSelectorUI();
        playAudio();
      });
    }
  } else if (currentEngine === 'youtube' && isYtReady && ytPlayer && !useFallbackAudio) {
    console.log("Playing via YouTube Background Engine.");
    isPlaying = true;
    const ytId = getYouTubeVideoId(currentTrack.trackName);
    const currentVideoUrl = ytPlayer.getVideoUrl();
    
    if (currentVideoUrl && currentVideoUrl.includes(ytId)) {
      ytPlayer.playVideo();
    } else {
      ytPlayer.loadVideoById(ytId);
    }
    
    ytPlayer.unMute();
    updatePlayerUIPlaying(true);
    triggerFloatingNotes();
    startProgressPolling();
    if (typeof updateMediaSessionMetadata === 'function') {
      updateMediaSessionMetadata(currentTrack);
    }
  } else {
    console.log("Playing via HTML5 Audio Fallback Engine.");
    currentEngine = 'itunes';
    updateEngineSelectorUI();
    
    if (elMainAudio) {
      const targetSrc = currentTrack.previewUrl;
      if (elMainAudio.src !== targetSrc) {
        elMainAudio.src = targetSrc;
        elMainAudio.load();
      }
      
      isPlaying = true;
      elMainAudio.play().then(() => {
        updatePlayerUIPlaying(true);
        triggerFloatingNotes();
        startProgressPolling();
        if (typeof updateMediaSessionMetadata === 'function') {
          updateMediaSessionMetadata(currentTrack);
        }
      }).catch(e => {
        console.error("HTML5 Audio fallback failed to play:", e);
      });
    }
  }

  // Update native lock screen state
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
}

function pauseAudio() {
  isPlaying = false;
  updatePlayerUIPlaying(false);
  stopProgressPolling();
  
  if (currentEngine === 'youtube') {
    if (isYtReady && ytPlayer) ytPlayer.pauseVideo();
  } else {
    if (elMainAudio) elMainAudio.pause();
  }

  // Update native lock screen state
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
}

function nextTrack() {
  if (isShuffle) {
    let randIdx;
    do {
      randIdx = Math.floor(Math.random() * tracks.length);
    } while (randIdx === currentTrackIndex && tracks.length > 1);
    loadTrack(randIdx);
  } else {
    let nextIdx = currentTrackIndex + 1;
    if (nextIdx >= tracks.length) nextIdx = 0;
    loadTrack(nextIdx);
  }
  if (isPlaying) {
    setTimeout(playAudio, 300);
  }
}

function prevTrack() {
  let prevIdx = currentTrackIndex - 1;
  if (prevIdx < 0) prevIdx = tracks.length - 1;
  loadTrack(prevIdx);
  if (isPlaying) {
    setTimeout(playAudio, 300);
  }
}

// --- 8. Timeline, Progress Polling & Seek Functions ---
function startProgressPolling() {
  stopProgressPolling();
  
  progressPollInterval = setInterval(() => {
    let currentTime = 0;
    let duration = 0;
    
    if (useFallbackAudio) {
      if (elMainAudio) {
        currentTime = elMainAudio.currentTime;
        duration = elMainAudio.duration || 30;
      }
    } else {
      if (isYtReady && ytPlayer && isPlaying) {
        currentTime = ytPlayer.getCurrentTime();
        duration = ytPlayer.getDuration();
      }
    }
    
    if (duration > 0) {
      const progressPercent = (currentTime / duration) * 100;
      if (elProgressFill) elProgressFill.style.width = `${progressPercent}%`;
      
      if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = formatTime(currentTime);
      if (elTotalDurationDisplay) elTotalDurationDisplay.textContent = formatTime(duration);
      
      syncLyricsHighlight(currentTime);
    }
  }, 300);
}

function stopProgressPolling() {
  if (progressPollInterval) {
    clearInterval(progressPollInterval);
    progressPollInterval = null;
  }
}

function setProgress(e) {
  if (!elProgressContainer) return;
  const width = elProgressContainer.clientWidth;
  const clickX = e.offsetX;
  
  if (useFallbackAudio) {
    if (elMainAudio && elMainAudio.duration > 0) {
      const newTime = (clickX / width) * elMainAudio.duration;
      elMainAudio.currentTime = newTime;
      if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = formatTime(newTime);
      if (elProgressFill) elProgressFill.style.width = `${(clickX / width) * 100}%`;
    }
  } else {
    if (isYtReady && ytPlayer) {
      const duration = ytPlayer.getDuration();
      if (duration > 0) {
        const newTime = (clickX / width) * duration;
        ytPlayer.seekTo(newTime, true);
        if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = formatTime(newTime);
        if (elProgressFill) elProgressFill.style.width = `${(clickX / width) * 100}%`;
      }
    }
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- 9. Synced Lyrics System ---
function loadLyrics(trackName) {
  if (!elLyricsContainer) return;
  elLyricsContainer.innerHTML = '';
  activeLyricTimestamps = [];
  
  const cleanKey = trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let foundLyrics = null;
  
  for (let presetKey in PRESET_LYRICS) {
    if (cleanKey.includes(presetKey)) {
      foundLyrics = PRESET_LYRICS[presetKey];
      break;
    }
  }
  
  if (foundLyrics) {
    activeLyricTimestamps = foundLyrics;
    
    foundLyrics.forEach((lyric, idx) => {
      const line = document.createElement('div');
      line.className = `lyric-line ${idx === 0 ? 'active' : ''}`;
      line.textContent = lyric.text;
      line.setAttribute('data-time', lyric.time);
      
      line.addEventListener('click', () => {
        if (useFallbackAudio) {
          if (elMainAudio) {
            elMainAudio.currentTime = lyric.time;
            if (!isPlaying) playAudio();
          }
        } else if (isYtReady && ytPlayer) {
          ytPlayer.seekTo(lyric.time, true);
          if (!isPlaying) playAudio();
        }
      });
      
      elLyricsContainer.appendChild(line);
    });
  } else {
    elLyricsContainer.innerHTML = `
      <div class="lyric-line active" style="text-align: center; margin-top: 30px;">♫ Listening Jeff's Cozy Soul ♫</div>
      <div class="lyric-line" style="text-align: center;">"Relax your mind, let the grooves flow..."</div>
      <div class="lyric-line" style="text-align: center; opacity: 0.3; font-style: italic; margin-top: 25px; font-size: 0.8rem;">
        (รับชมเนื้อเพลงเต็มรูปแบบได้ที่ Apple Music โดยกดไอคอนแอปเปิ้ลใต้เครื่องเล่นค่ะ)
      </div>
    `;
  }
  elLyricsContainer.scrollTop = 0;
}

function syncLyricsHighlight(currentTime) {
  if (activeLyricTimestamps.length === 0 || !elLyricsContainer) return;
  
  let activeIndex = 0;
  for (let i = 0; i < activeLyricTimestamps.length; i++) {
    if (currentTime >= activeLyricTimestamps[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }
  
  const lyricLines = elLyricsContainer.querySelectorAll('.lyric-line');
  lyricLines.forEach((line, idx) => {
    if (idx === activeIndex) {
      if (!line.classList.contains('active')) {
        line.classList.add('active');
        const offsetTop = line.offsetTop - (elLyricsContainer.clientHeight / 2) + (line.clientHeight / 2);
        elLyricsContainer.scrollTo({
          top: Math.max(0, offsetTop),
          behavior: 'smooth'
        });
      }
    } else {
      line.classList.remove('active');
    }
  });
}

// --- 10. Cozy Toast Banner ---
function showToast(title = "Welcome to Cozy Lounge", desc = "คลิกปรับแต่งมู้ดที่ต้องการได้เลยค่ะ 🌙") {
  if (!elCozyToast) return;
  const titleEl = elCozyToast.querySelector('.toast-title');
  const descEl = elCozyToast.querySelector('.toast-desc');
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  elCozyToast.classList.add('active');
  
  setTimeout(() => {
    if (elCozyToast) elCozyToast.classList.remove('active');
  }, 6000);
}

// --- 11. floating notes particle system ---
function triggerFloatingNotes() {
  if (!elFloatingNotesContainer) return;
  elFloatingNotesContainer.innerHTML = '';
  
  if (!isPlaying) return;
  
  const icons = ['fa-music', 'fa-note-sticky', 'fa-heart', 'fa-face-smile'];
  
  const genInterval = setInterval(() => {
    if (!isPlaying || !elFloatingNotesContainer) {
      clearInterval(genInterval);
      return;
    }
    
    const note = document.createElement('div');
    note.className = 'floating-note';
    
    const randIcon = icons[Math.floor(Math.random() * icons.length)];
    note.innerHTML = `<i class="fa-solid ${randIcon}"></i>`;
    
    note.style.left = `${10 + Math.random() * 80}vw`;
    note.style.animationDuration = `${5 + Math.random() * 4}s`;
    
    elFloatingNotesContainer.appendChild(note);
    
    setTimeout(() => {
      note.remove();
    }, 9000);
    
  }, 2500);
}

// --- 12. DOMContentLoaded Callback (App bootstrapping) ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded. Binding caches defensively.");
  
  try {
    // Cache DOM element references defensively
    elBody = document.body;
    elSongSearch = document.getElementById('song-search');
    elLibraryList = document.getElementById('library-list');
    elAlbumShelf = document.getElementById('album-shelf');
    elVinylRecord = document.getElementById('vinyl-record');
    elVinylLabel = document.getElementById('vinyl-label');
    elTonearm = document.getElementById('tonearm');
    elPlayBtn = document.getElementById('play-btn');
    elPrevBtn = document.getElementById('prev-btn');
    elNextBtn = document.getElementById('next-btn');
    elShuffleBtn = document.getElementById('shuffle-btn');
    elRepeatBtn = document.getElementById('repeat-btn');
    elHeartCurrentBtn = document.getElementById('heart-current-btn');
    elItunesLink = document.getElementById('itunes-link');
    elTrackTitleMain = document.getElementById('player-track-title');
    elTrackAlbumMain = document.getElementById('player-track-album');
    elTrackYear = document.getElementById('player-track-year');
    elTrackGenre = document.getElementById('player-track-genre');
    elCurrentTimeDisplay = document.getElementById('current-time');
    elTotalDurationDisplay = document.getElementById('total-duration');
    elProgressContainer = document.getElementById('progress-container');
    elProgressFill = document.getElementById('progress-fill');
    elPlayerVolume = document.getElementById('player-volume');
    elPlayerVolumeIcon = document.getElementById('player-volume-icon');
    elLyricsContainer = document.getElementById('lyrics-container');
    elLibTabs = document.querySelectorAll('.lib-tab');
    elMoodBtns = document.querySelectorAll('.mood-btn');
    elAmbientCanvas = document.getElementById('ambient-canvas');
    elVisualizerCanvas = document.getElementById('player-visualizer');
    elFloatingNotesContainer = document.getElementById('floating-notes');
    elCozyToast = document.getElementById('cozy-toast');
    elAmbientMasterBtn = document.getElementById('ambient-master-btn');
    elMainAudio = document.getElementById('main-audio');
    
    // Engine selector caching
    elEngineYoutube = document.getElementById('engine-btn-youtube');
    elEngineLocal = document.getElementById('engine-btn-local');
    elEngineItunes = document.getElementById('engine-btn-itunes');
    elLocalFileInput = document.getElementById('local-file-input');
    elImportBtnTrigger = document.getElementById('import-btn-trigger');
    elLocalImportZone = document.getElementById('local-import-zone');

    // --- Initialize Cozy Music Manager Dashboard & Catalog ---
    if (typeof initCozyDashboard === 'function') {
      initCozyDashboard();
    } else {
      renderLibrary();
      renderAlbumShelf();
      loadTrack(0);
    }

    // --- Dynamic Particle/Weather Canvas System ---
    setupCanvasVisuals();
    
    // --- Bind Event Listeners defensively ---
    setupDOMEventListeners();

    // --- Initialize Ambient Canvas, Lockscreen, and Mobile Navigation ---
    if (typeof killServiceWorkersAndCaches === 'function') killServiceWorkersAndCaches();
    if (typeof setupMediaSessionActions === 'function') setupMediaSessionActions();
    if (typeof initMobileNavigation === 'function') initMobileNavigation();

    // --- Resilient Auto-fallback timer ---
    // If YouTube doesn't load/fails within 2.5 seconds, lock HTML5 preview player.
    // This guarantees sound and playability even with active adblockers!
    setTimeout(() => {
      if (!isYtReady) {
        console.warn("YouTube blocked or slow. Activating reliable HTML5 Audio fallback engine.");
        useFallbackAudio = true;
        
        // Update duration text to reflect 30 seconds
        if (elTotalDurationDisplay) elTotalDurationDisplay.textContent = "0:30";
        
        showToast("Cozy Lounge Backup Mode 🌙", "ระบบเปิดสตรีมเสียงสำรองให้แล้วค่ะ เล่นได้ลื่นไหลไร้รอยต่อ 🎧");
        
        // Reload track details for fallback
        loadTrack(currentTrackIndex);
      }
    }, 2500);
    
    // --- Welcome notification toast ---
    setTimeout(() => {
      showToast("Jeff Bernat Cozy Lounge 🌙", "ยินดีต้อนรับเข้าสู่ช่วงเวลากรูฟนุ่ม ๆ สไตล์ R&B ค่ะ");
    }, 1000);

    // --- Perform Asynchronous iTunes API fetch in the background ---
    fetchSongsFromiTunes();
  } catch (err) {
    console.error("Cozy Lounge Initialization crashed defensively: ", err);
  }
});

// --- 13. UI Event Bindings with Null Safety ---
function setupDOMEventListeners() {
  // HTML5 Audio Event Listeners for smooth cross-device playback and seek bar sync
  if (elMainAudio) {
    elMainAudio.addEventListener('loadedmetadata', () => {
      console.log("Audio metadata loaded. Duration:", elMainAudio.duration);
      if ((currentEngine === 'local' || currentEngine === 'itunes') && elMainAudio.duration) {
        if (elTotalDurationDisplay) {
          elTotalDurationDisplay.textContent = formatTime(elMainAudio.duration);
        }
      }
    });

    elMainAudio.addEventListener('durationchange', () => {
      console.log("Audio duration change. Duration:", elMainAudio.duration);
      if ((currentEngine === 'local' || currentEngine === 'itunes') && elMainAudio.duration) {
        if (elTotalDurationDisplay) {
          elTotalDurationDisplay.textContent = formatTime(elMainAudio.duration);
        }
      }
    });

    elMainAudio.addEventListener('timeupdate', () => {
      if (currentEngine === 'local' || currentEngine === 'itunes') {
        const currentTime = elMainAudio.currentTime;
        const duration = elMainAudio.duration || 30;
        
        if (duration > 0) {
          const progressPercent = (currentTime / duration) * 100;
          if (elProgressFill) elProgressFill.style.width = `${progressPercent}%`;
          if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = formatTime(currentTime);
          if (elTotalDurationDisplay && elMainAudio.duration) {
            elTotalDurationDisplay.textContent = formatTime(duration);
          }
          syncLyricsHighlight(currentTime);
        }
      }
    });

    elMainAudio.addEventListener('ended', () => {
      console.log("Audio track ended. Advancing to next track.");
      nextTrack();
      if (isPlaying) {
        setTimeout(playAudio, 300);
      }
    });
  }

  if (elPlayBtn) {
    elPlayBtn.addEventListener('click', () => {
      if (isPlaying) pauseAudio();
      else playAudio();
    });
  }

  if (elNextBtn) elNextBtn.addEventListener('click', nextTrack);
  if (elPrevBtn) elPrevBtn.addEventListener('click', prevTrack);
  
  if (elShuffleBtn) {
    elShuffleBtn.addEventListener('click', () => {
      isShuffle = !isShuffle;
      elShuffleBtn.classList.toggle('active', isShuffle);
      showToast("Shuffle Mode", isShuffle ? "เพลงถัดไปจะถูกสุ่มเล่นแบบไม่มีขีดจำกัด 🔀" : "ยกเลิกการเล่นสุ่มเพลง");
    });
  }

  if (elRepeatBtn) {
    elRepeatBtn.addEventListener('click', () => {
      isRepeat = !isRepeat;
      elRepeatBtn.classList.toggle('active', isRepeat);
      showToast("Repeat Mode", isRepeat ? "วนซ้ำเพลงปัจจุบันของคุณเรื่อย ๆ 🔁" : "ยกเลิกการวนซ้ำเพลง");
    });
  }

  if (elHeartCurrentBtn) {
    elHeartCurrentBtn.addEventListener('click', () => {
      const currentTrack = tracks[currentTrackIndex];
      if (currentTrack) {
        toggleFavorite(currentTrack.trackId);
        renderLibrary();
      }
    });
  }

  if (elProgressContainer) elProgressContainer.addEventListener('click', setProgress);
  if (elPlayerVolume) elPlayerVolume.addEventListener('input', handleVolumeChange);

  if (elPlayerVolumeIcon && elPlayerVolume) {
    elPlayerVolumeIcon.addEventListener('click', () => {
      if (elPlayerVolume.value > 0) {
        elPlayerVolume.setAttribute('data-prev-vol', elPlayerVolume.value);
        elPlayerVolume.value = 0;
      } else {
        const prev = elPlayerVolume.getAttribute('data-prev-vol') || 80;
        elPlayerVolume.value = prev;
      }
      handleVolumeChange();
    });
  }

  if (elSongSearch) elSongSearch.addEventListener('input', renderLibrary);
  
  if (elLibTabs) {
    elLibTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elLibTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-filter');
        renderLibrary();
      });
    });
  }

  if (elMoodBtns) {
    elMoodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTheme = btn.getAttribute('data-theme');
        changeMoodTheme(targetTheme);
        const span = btn.querySelector('span');
        showToast(
          `Mood: ${span ? span.textContent : targetTheme}`,
          targetTheme === 'rain' ? 'เปลี่ยนบรรยากาศฝนตกรอบคาเฟ่ 🌧️' : 
          targetTheme === 'cafe' ? 'เปลี่ยนบรรยากาศเสียงกระซิบเบา ๆ ในร้านกาแฟ ☕' : 
          'เปลี่ยนบรรยากาศเตาผิงอุ่น ๆ ในห้องทำงานย้อนยุค 🔥'
        );
      });
    });
  }

  // Ambient sound mixers
  document.querySelectorAll('.ambient-channel').forEach(channel => {
    const soundKey = channel.getAttribute('data-sound');
    const slider = channel.querySelector('.volume-slider');
    const muteBtn = channel.querySelector('.channel-mute-btn');
    
    if (slider) {
      slider.addEventListener('input', (e) => {
        updateAmbientChannelVolume(soundKey, e.target.value);
        if (!isAmbientOn) toggleMasterAmbient();
      });
    }
    
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        toggleMuteAmbientChannel(soundKey);
        if (!isAmbientOn) toggleMasterAmbient();
      });
    }
  });

  if (elAmbientMasterBtn) elAmbientMasterBtn.addEventListener('click', toggleMasterAmbient);

  if (elVinylRecord) {
    elVinylRecord.addEventListener('click', () => {
      if (isPlaying) pauseAudio();
      else playAudio();
    });
  }

  // Engine switcher event bindings
  if (elEngineYoutube) {
    elEngineYoutube.addEventListener('click', () => {
      if (!isYtReady) {
        showToast("YouTube Not Ready ⚠️", "ระบบยังโหลดเครื่องเล่น YouTube ไม่เสร็จ หรือโดน Adblocker บล็อกค่ะ");
        return;
      }
      currentEngine = 'youtube';
      useFallbackAudio = false;
      updateEngineSelectorUI();
      showToast("Engine: YouTube 📺", "สลับไปเล่นสตรีมมิ่งจาก YouTube แล้วค่ะ");
      if (isPlaying) playAudio();
    });
  }
  
  if (elEngineLocal) {
    elEngineLocal.addEventListener('click', () => {
      const currentTrack = tracks[currentTrackIndex];
      const hasLocal = currentTrack && (currentTrack.localUrl || getLocalAudioUrl(currentTrack.trackName));
      if (hasLocal) {
        currentEngine = 'local';
        useFallbackAudio = true;
        updateEngineSelectorUI();
        showToast("Engine: Local File 🎵", "สลับมาเล่นไฟล์คุณภาพสูงในเครื่องเรียบร้อยค่ะ");
        if (isPlaying) playAudio();
      } else {
        showToast("No Local File ⚠️", "เพลงนี้ยังไม่มีไฟล์ในเครื่อง ดาวน์โหลดมาใส่ในโฟลเดอร์ music ได้เลยค่ะ!");
      }
    });
  }
  
  if (elEngineItunes) {
    elEngineItunes.addEventListener('click', () => {
      currentEngine = 'itunes';
      useFallbackAudio = true;
      updateEngineSelectorUI();
      showToast("Engine: iTunes 30s 🍎", "สลับมาเล่นพรีวิวจากเซิร์ฟเวอร์ iTunes แล้วค่ะ");
      if (isPlaying) playAudio();
    });
  }
  
  // Local File Import events
  if (elImportBtnTrigger && elLocalFileInput) {
    elImportBtnTrigger.addEventListener('click', () => {
      elLocalFileInput.click();
    });
  }
  
  if (elLocalFileInput) {
    elLocalFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importLocalTracks(e.target.files);
      }
    });
  }
  
  if (elLocalImportZone) {
    elLocalImportZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elLocalImportZone.classList.add('dragover');
    });
    
    elLocalImportZone.addEventListener('dragleave', () => {
      elLocalImportZone.classList.remove('dragover');
    });
    
    elLocalImportZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elLocalImportZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        importLocalTracks(e.dataTransfer.files);
      }
    });
  }

  // Draw Simulated spectrum wave loop
  drawPlayerVisualizer();
}

// --- 14. Library & Discography UI Renderer Functions ---
function renderLibrary() {
  if (!elLibraryList) return;
  elLibraryList.innerHTML = '';
  
  const searchQuery = elSongSearch ? elSongSearch.value.toLowerCase().trim() : '';
  let filteredTracks = tracks;
  
  if (currentFilter === 'favorites') {
    filteredTracks = filteredTracks.filter(t => favorites.includes(t.trackId));
  }
  
  if (searchQuery) {
    filteredTracks = filteredTracks.filter(t => 
      t.trackName.toLowerCase().includes(searchQuery) ||
      t.collectionName.toLowerCase().includes(searchQuery)
    );
  }
  
  if (filteredTracks.length === 0) {
    elLibraryList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open" style="font-size: 1.8rem; opacity: 0.3;"></i>
        <p>${currentFilter === 'favorites' ? 'ยังไม่มีเพลงโปรดที่คุณบันทึกไว้' : 'ไม่พบเพลงที่กำลังค้นหา'}</p>
      </div>
    `;
    return;
  }
  
  filteredTracks.forEach(track => {
    const idx = tracks.findIndex(t => t.trackId === track.trackId);
    const isFavorite = favorites.includes(track.trackId);
    
    const item = document.createElement('div');
    item.className = `song-item ${idx === currentTrackIndex ? 'active' : ''}`;
    item.innerHTML = `
      <div class="song-item-cover" style="background-image: url('${track.artworkUrl100}'), url('${getLocalCoverUrl(track.trackName, track.collectionName)}')">
        ${idx === currentTrackIndex && isPlaying ? '<i class="fa-solid fa-volume-high text-accent"></i>' : ''}
      </div>
      <div class="song-item-details">
        <div class="song-item-title">${track.trackName}</div>
        <div class="song-item-album">${track.collectionName}</div>
      </div>
      <div class="song-item-duration">${useFallbackAudio ? '0:30' : 'Full'}</div>
      <button class="song-item-heart ${isFavorite ? 'active' : ''}" data-id="${track.trackId}">
        <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
      </button>
    `;
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.song-item-heart')) return;
      loadTrack(idx);
      playAudio();
    });
    
    const heartBtn = item.querySelector('.song-item-heart');
    if (heartBtn) {
      heartBtn.addEventListener('click', () => {
        toggleFavorite(track.trackId, heartBtn);
      });
    }
    
    elLibraryList.appendChild(item);
  });
}

function renderAlbumShelf() {
  if (!elAlbumShelf) return;
  elAlbumShelf.innerHTML = '';
  
  const uniqueAlbums = [];
  const albumTitles = new Set();
  
  tracks.forEach(t => {
    if (!albumTitles.has(t.collectionName)) {
      albumTitles.add(t.collectionName);
      uniqueAlbums.push(t);
    }
  });
  
  uniqueAlbums.slice(0, 10).forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.innerHTML = `
      <div class="album-card-art" style="background-image: url('${album.artworkUrl100}'), url('${getLocalCoverUrl(album.trackName, album.collectionName)}')">
        <div class="album-card-play-btn"><i class="fa-solid fa-play"></i></div>
      </div>
      <div class="album-card-info">
        <div class="album-card-title">${album.collectionName}</div>
        <div class="album-card-artist">Jeff Bernat</div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      const firstTrackIdx = tracks.findIndex(t => t.collectionName === album.collectionName);
      if (firstTrackIdx !== -1) {
        loadTrack(firstTrackIdx);
        playAudio();
      }
    });
    
    elAlbumShelf.appendChild(card);
  });
}

// --- 15. Fetch Data from iTunes Store ---
async function fetchSongsFromiTunes() {
  try {
    const response = await fetch('https://itunes.apple.com/search?term=jeff+bernat&limit=150&entity=song');
    if (!response.ok) throw new Error('API fetch error');
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Map iTunes tracks
      const apiTracks = data.results.map(track => {
        const localUrl = getLocalAudioUrl(track.trackName);
        return {
          trackId: track.trackId,
          trackName: track.trackName,
          collectionName: track.collectionName || "Single",
          artworkUrl100: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb.jpg', '500x500bb.jpg') : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
          previewUrl: track.previewUrl,
          localUrl: localUrl,
          releaseDate: track.releaseDate,
          primaryGenreName: track.primaryGenreName || "R&B/Soul",
          trackViewUrl: track.trackViewUrl || "https://music.apple.com/us/artist/jeff-bernat/487317660"
        };
      });
      
      // Filter out duplicate IDs and any mix/alternate versions
      const uniqueIds = new Set();
      let mergedTracks = apiTracks.filter(t => {
        if (!t.trackName || uniqueIds.has(t.trackId)) return false;
        
        const clean = t.trackName.toLowerCase();
        if (clean.includes('sped up') ||
            clean.includes('acoustic') ||
            clean.includes('inst.') ||
            clean.includes('inst)') ||
            clean.includes('instrumental') ||
            clean.includes('intro') ||
            clean.includes('interlude') ||
            clean.includes('accapella') ||
            clean.includes('remix') ||
            clean.includes('mix')) {
          return false;
        }
        
        uniqueIds.add(t.trackId);
        return true;
      });

      // Two-way merge: Find local files that didn't get matched in iTunes results (filtering out mixes)
      const filteredLocalMerge = LOCAL_FILE_NAMES.filter(fileName => {
        const clean = fileName.toLowerCase();
        return !clean.includes('sped up') &&
               !clean.includes('acoustic') &&
               !clean.includes('inst.') &&
               !clean.includes('inst)') &&
               !clean.includes('instrumental') &&
               !clean.includes('intro') &&
               !clean.includes('interlude') &&
               !clean.includes('accapella') &&
               !clean.includes('remix') &&
               !clean.includes('mix');
      });

      filteredLocalMerge.forEach(fileName => {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        const cleanFile = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Check if this file is already matched in mergedTracks
        const isMatched = mergedTracks.some(t => {
          if (!t.trackName) return false;
          const cleanTName = t.trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanFile.includes(cleanTName) || cleanTName.includes(cleanFile);
        });
        
        if (!isMatched) {
          // Add as a local-first track!
          let collection = "The Gentleman Approach";
          let artwork = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/500x500bb.jpg";
          let year = "2012-12-07T08:00:00Z";
          
          if (cleanFile.includes("pillowtalk") || cleanFile.includes("coolgirls") || cleanFile.includes("modernrenaissance")) {
            collection = "Modern Renaissance";
            artwork = "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/db/45/ad/db45ad7d-c07a-251c-4395-9ff2d973715c/artwork.jpg/500x500bb.jpg";
            year = "2013-12-15T08:00:00Z";
          } else if (cleanFile.includes("changes") || cleanFile.includes("shelovesmenot")) {
            collection = "She Loves Me Not";
            artwork = "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/99/bd/27/99bd27df-6bf9-e30b-0447-38e55e09f583/artwork.jpg/500x500bb.jpg";
            year = "2019-05-10T08:00:00Z";
          } else if (cleanFile.includes("still") || cleanFile.includes("cruisin") || cleanFile.includes("meantime")) {
            collection = "In the Meantime";
            artwork = "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/bf/16/f4bf168e-9080-60b6-11fc-db439563f458/artwork.jpg/500x500bb.jpg";
            year = "2016-01-16T08:00:00Z";
          }

          const localTrack = {
            trackId: 'local_' + cleanFile,
            trackName: nameWithoutExt,
            collectionName: collection,
            artworkUrl100: artwork,
            previewUrl: `music/${encodeURIComponent(fileName)}`,
            localUrl: `music/${encodeURIComponent(fileName)}`,
            releaseDate: year,
            primaryGenreName: "R&B/Soul",
            trackViewUrl: "https://music.apple.com/us/artist/jeff-bernat/487317660"
          };
          
          mergedTracks.push(localTrack);
        }
      });

      if (mergedTracks.length > 0) {
        // Sort tracks so that ones with localUrl (downloaded) appear at the top!
        mergedTracks.sort((a, b) => {
          const hasA = (a.localUrl || getLocalAudioUrl(a.trackName)) ? 1 : 0;
          const hasB = (b.localUrl || getLocalAudioUrl(b.trackName)) ? 1 : 0;
          return hasB - hasA; // descending order (has local files first)
        });
        
        allBaseTracks = mergedTracks;
        if (typeof resolveTracksList === 'function') {
          resolveTracksList();
        } else {
          tracks = mergedTracks;
        }
        renderLibrary();
        renderAlbumShelf();
        loadTrack(currentTrackIndex);
      }
    }
  } catch (e) {
    console.warn("iTunes API Fetch blocked or failed. Cozy player operating in local playlist fallback.", e);
  }
}

// --- 16. Volume System ---
function handleVolumeChange() {
  if (!elPlayerVolume) return;
  const vol = elPlayerVolume.value;
  
  // Update HTML5 audio volume (0.0 to 1.0)
  if (elMainAudio) {
    elMainAudio.volume = vol / 100;
  }
  
  // Update YouTube volume (0 to 100)
  if (isYtReady && ytPlayer) {
    ytPlayer.setVolume(vol);
    if (vol == 0) ytPlayer.mute();
    else ytPlayer.unMute();
  }
  
  if (elPlayerVolumeIcon) {
    if (vol == 0) {
      elPlayerVolumeIcon.className = 'fa-solid fa-volume-xmark volume-icon';
    } else if (vol < 40) {
      elPlayerVolumeIcon.className = 'fa-solid fa-volume-low volume-icon';
    } else {
      elPlayerVolumeIcon.className = 'fa-solid fa-volume-high volume-icon';
    }
  }
}

// --- 17. Favorites Manager ---
function toggleFavorite(id, heartBtnElement) {
  const index = favorites.indexOf(id);
  if (index === -1) {
    favorites.push(id);
    if (heartBtnElement) {
      heartBtnElement.classList.add('active');
      heartBtnElement.querySelector('i').className = 'fa-solid fa-heart';
    }
  } else {
    favorites.splice(index, 1);
    if (heartBtnElement) {
      heartBtnElement.classList.remove('active');
      heartBtnElement.querySelector('i').className = 'fa-regular fa-heart';
    }
  }
  
  localStorage.setItem('jeff_bernat_favorites', JSON.stringify(favorites));
  
  const currentPlayingTrack = tracks[currentTrackIndex];
  if (currentPlayingTrack && currentPlayingTrack.trackId === id) {
    if (elHeartCurrentBtn) {
      if (favorites.includes(id)) {
        elHeartCurrentBtn.className = 'sub-btn active';
        elHeartCurrentBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      } else {
        elHeartCurrentBtn.className = 'sub-btn';
        elHeartCurrentBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      }
    }
  }
  
  if (currentFilter === 'favorites') {
    renderLibrary();
  }
}

// --- 18. Environment Theme & Weather Particles Engine ---
function changeMoodTheme(targetTheme) {
  theme = targetTheme;
  if (elBody) elBody.className = `theme-${targetTheme}`;
  
  elMoodBtns.forEach(btn => {
    if (btn.getAttribute('data-theme') === targetTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (targetTheme === 'rain') {
    updateAmbientChannelVolume('rain', 35);
    updateAmbientChannelVolume('cafe', 0);
    updateAmbientChannelVolume('fireplace', 0);
  } else if (targetTheme === 'cafe') {
    updateAmbientChannelVolume('rain', 0);
    updateAmbientChannelVolume('cafe', 35);
    updateAmbientChannelVolume('fireplace', 0);
  } else if (targetTheme === 'study') {
    updateAmbientChannelVolume('rain', 0);
    updateAmbientChannelVolume('cafe', 0);
    updateAmbientChannelVolume('fireplace', 45);
  }

  resetAmbientCanvas();
}

let canvasCtx = null;
let particles = [];
let animationFrameId = null;

function setupCanvasVisuals() {
  if (!elAmbientCanvas) return;
  canvasCtx = elAmbientCanvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  resetAmbientCanvas();
}

function resizeCanvas() {
  if (!elAmbientCanvas) return;
  elAmbientCanvas.width = window.innerWidth;
  elAmbientCanvas.height = window.innerHeight;
}

function resetAmbientCanvas() {
  particles = [];
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (!elAmbientCanvas) return;
  
  const count = theme === 'rain' ? 80 : theme === 'cafe' ? 25 : 35;
  for (let i = 0; i < count; i++) {
    particles.push(createParticle(true));
  }
  
  drawAmbientLoop();
}

function createParticle(randomY = false) {
  const w = elAmbientCanvas ? elAmbientCanvas.width : window.innerWidth;
  const h = elAmbientCanvas ? elAmbientCanvas.height : window.innerHeight;
  
  if (theme === 'rain') {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20,
      length: 15 + Math.random() * 25,
      speed: 10 + Math.random() * 8,
      opacity: 0.1 + Math.random() * 0.25,
      angle: 4 + Math.random() * 2
    };
  } else if (theme === 'cafe') {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      radius: 2 + Math.random() * 5,
      speed: 0.4 + Math.random() * 0.6,
      opacity: 0.05 + Math.random() * 0.15,
      wobble: Math.random() * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02
    };
  } else {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      radius: 1 + Math.random() * 3,
      speed: 0.8 + Math.random() * 1.2,
      opacity: 0.1 + Math.random() * 0.3,
      flicker: Math.random() * Math.PI,
      color: `hsl(${15 + Math.random() * 20}, 95%, ${50 + Math.random() * 20}%)`
    };
  }
}

function drawAmbientLoop() {
  if (!elAmbientCanvas || !canvasCtx) return;
  const w = elAmbientCanvas.width;
  const h = elAmbientCanvas.height;
  
  canvasCtx.clearRect(0, 0, w, h);
  
  particles.forEach((p, idx) => {
    if (theme === 'rain') {
      canvasCtx.strokeStyle = `rgba(56, 189, 248, ${p.opacity})`;
      canvasCtx.lineWidth = 1.2;
      canvasCtx.beginPath();
      canvasCtx.moveTo(p.x, p.y);
      canvasCtx.lineTo(p.x - p.angle, p.y + p.length);
      canvasCtx.stroke();
      
      p.y += p.speed;
      p.x -= p.angle / 2;
      
      if (p.y > h) {
        particles[idx] = createParticle(false);
      }
    } else if (theme === 'cafe') {
      canvasCtx.fillStyle = `rgba(234, 179, 8, ${p.opacity})`;
      canvasCtx.beginPath();
      canvasCtx.arc(p.x + Math.sin(p.wobble) * 15, p.y, p.radius, 0, Math.PI * 2);
      canvasCtx.fill();
      
      p.y -= p.speed;
      p.wobble += p.wobbleSpeed;
      
      if (p.y < -20) {
        particles[idx] = createParticle(false);
      }
    } else {
      const flickerOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.flicker));
      canvasCtx.fillStyle = p.color;
      canvasCtx.shadowColor = p.color;
      canvasCtx.shadowBlur = 10;
      canvasCtx.globalAlpha = flickerOpacity;
      
      canvasCtx.beginPath();
      canvasCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      canvasCtx.fill();
      
      canvasCtx.globalAlpha = 1;
      canvasCtx.shadowBlur = 0;
      
      p.y -= p.speed;
      p.flicker += 0.05;
      p.x += Math.sin(p.flicker) * 0.2;
      
      if (p.y < -20) {
        particles[idx] = createParticle(false);
      }
    }
  });
  
  animationFrameId = requestAnimationFrame(drawAmbientLoop);
}

// --- 19. Web Audio API Ambient Synthesizer Node Logic ---
function initAmbientAudioContext() {
  if (ambientAudioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  ambientAudioCtx = new AudioContext();
  setupRainSynthNode();
  setupFireplaceSynthNode();
  setupCafeSynthNode();
}

function resumeAmbientContext() {
  if (ambientAudioCtx && ambientAudioCtx.state === 'suspended') {
    ambientAudioCtx.resume();
  }
}

function setupRainSynthNode() {
  const bufferSize = 2 * ambientAudioCtx.sampleRate;
  const noiseBuffer = ambientAudioCtx.createBuffer(1, bufferSize, ambientAudioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  
  let b0, b1, b2, b3, b4, b5, b6;
  b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
  
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    output[i] *= 0.11;
    b6 = white * 0.115926;
  }
  
  const noiseSource = ambientAudioCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;
  
  const filter = ambientAudioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, ambientAudioCtx.currentTime);
  
  const rainGain = ambientAudioCtx.createGain();
  const targetVol = channelMutes.rain ? 0 : channelVolumes.rain;
  rainGain.gain.setValueAtTime(targetVol * 0.25, ambientAudioCtx.currentTime);
  
  setInterval(() => {
    if (ambientAudioCtx && isAmbientOn && !channelMutes.rain) {
      const sweepVol = (channelVolumes.rain * 0.18) + (Math.random() * channelVolumes.rain * 0.15);
      rainGain.gain.exponentialRampToValueAtTime(sweepVol, ambientAudioCtx.currentTime + 3);
    }
  }, 4000);

  noiseSource.connect(filter);
  filter.connect(rainGain);
  rainGain.connect(ambientAudioCtx.destination);
  noiseSource.start();
  
  ambientNodes.rain.gainNode = rainGain;
  ambientNodes.rain.source = noiseSource;
}

function setupFireplaceSynthNode() {
  const bufferSize = 2 * ambientAudioCtx.sampleRate;
  const noiseBuffer = ambientAudioCtx.createBuffer(1, bufferSize, ambientAudioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  
  const rumbleSource = ambientAudioCtx.createBufferSource();
  rumbleSource.buffer = noiseBuffer;
  rumbleSource.loop = true;
  
  const lowpass = ambientAudioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(180, ambientAudioCtx.currentTime);
  
  const fireGain = ambientAudioCtx.createGain();
  const targetVol = channelMutes.fireplace ? 0 : channelVolumes.fireplace;
  fireGain.gain.setValueAtTime(targetVol * 0.35, ambientAudioCtx.currentTime);
  
  rumbleSource.connect(lowpass);
  lowpass.connect(fireGain);
  fireGain.connect(ambientAudioCtx.destination);
  rumbleSource.start();
  
  setInterval(() => {
    if (ambientAudioCtx && isAmbientOn && !channelMutes.fireplace) {
      if (Math.random() > 0.4) {
        triggerWoodCracklePop(fireGain);
      }
    }
  }, 280);

  ambientNodes.fireplace.gainNode = fireGain;
  ambientNodes.fireplace.source = rumbleSource;
}

function triggerWoodCracklePop(outputNode) {
  const popOsc = ambientAudioCtx.createOscillator();
  const popGain = ambientAudioCtx.createGain();
  
  popOsc.type = 'triangle';
  popOsc.frequency.setValueAtTime(2000 + Math.random() * 5000, ambientAudioCtx.currentTime);
  popOsc.frequency.exponentialRampToValueAtTime(80, ambientAudioCtx.currentTime + 0.008);
  
  popGain.gain.setValueAtTime(0.001 + Math.random() * 0.015 * channelVolumes.fireplace, ambientAudioCtx.currentTime);
  popGain.gain.exponentialRampToValueAtTime(0.00001, ambientAudioCtx.currentTime + 0.008);
  
  popOsc.connect(popGain);
  popGain.connect(ambientAudioCtx.destination);
  
  popOsc.start();
  popOsc.stop(ambientAudioCtx.currentTime + 0.01);
}

function setupCafeSynthNode() {
  const osc = ambientAudioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(82, ambientAudioCtx.currentTime);
  
  const filter = ambientAudioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(100, ambientAudioCtx.currentTime);
  
  const cafeGain = ambientAudioCtx.createGain();
  const targetVol = channelMutes.cafe ? 0 : channelVolumes.cafe;
  cafeGain.gain.setValueAtTime(targetVol * 0.1, ambientAudioCtx.currentTime);
  
  osc.connect(filter);
  filter.connect(cafeGain);
  cafeGain.connect(ambientAudioCtx.destination);
  osc.start();
  
  setInterval(() => {
    if (ambientAudioCtx && isAmbientOn && !channelMutes.cafe) {
      if (Math.random() > 0.7) {
        triggerCafeChime();
      }
    }
  }, 2500);

  ambientNodes.cafe.gainNode = cafeGain;
  ambientNodes.cafe.source = osc;
}

function triggerCafeChime() {
  const osc = ambientAudioCtx.createOscillator();
  const filter = ambientAudioCtx.createBiquadFilter();
  const chimeGain = ambientAudioCtx.createGain();
  
  osc.type = 'sine';
  const freqs = [1864.66, 2093.00, 2489.02, 2793.83, 3135.96];
  const targetFreq = freqs[Math.floor(Math.random() * freqs.length)];
  
  osc.frequency.setValueAtTime(targetFreq, ambientAudioCtx.currentTime);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(targetFreq, ambientAudioCtx.currentTime);
  filter.Q.setValueAtTime(8, ambientAudioCtx.currentTime);
  
  chimeGain.gain.setValueAtTime(0.0, ambientAudioCtx.currentTime);
  chimeGain.gain.linearRampToValueAtTime(0.002 * channelVolumes.cafe, ambientAudioCtx.currentTime + 0.005);
  chimeGain.gain.exponentialRampToValueAtTime(0.00001, ambientAudioCtx.currentTime + 0.18);
  
  osc.connect(filter);
  filter.connect(chimeGain);
  chimeGain.connect(ambientAudioCtx.destination);
  
  osc.start();
  osc.stop(ambientAudioCtx.currentTime + 0.2);
}

function updateAmbientChannelVolume(soundKey, sliderValue) {
  const vol = sliderValue / 100;
  channelVolumes[soundKey] = vol;
  
  const channelDiv = document.querySelector(`.ambient-channel[data-sound="${soundKey}"]`);
  if (!channelDiv) return;
  
  const display = channelDiv.querySelector('.channel-vol-display');
  if (display) display.textContent = `${sliderValue}%`;
  
  const muteBtn = channelDiv.querySelector('.channel-mute-btn');
  const slider = channelDiv.querySelector('.volume-slider');
  if (slider) slider.value = sliderValue;
  
  if (sliderValue == 0) {
    channelMutes[soundKey] = true;
    if (muteBtn) {
      muteBtn.classList.add('muted');
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
  } else {
    channelMutes[soundKey] = false;
    if (muteBtn) {
      muteBtn.classList.remove('muted');
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  }
  
  if (ambientAudioCtx && isAmbientOn && ambientNodes[soundKey].gainNode) {
    const scaleMultiplier = soundKey === 'rain' ? 0.25 : soundKey === 'cafe' ? 0.1 : 0.35;
    ambientNodes[soundKey].gainNode.gain.linearRampToValueAtTime(vol * scaleMultiplier, ambientAudioCtx.currentTime + 0.1);
  }
}

function toggleMuteAmbientChannel(soundKey) {
  const currentMute = channelMutes[soundKey];
  const channelDiv = document.querySelector(`.ambient-channel[data-sound="${soundKey}"]`);
  if (!channelDiv) return;
  
  const muteBtn = channelDiv.querySelector('.channel-mute-btn');
  const slider = channelDiv.querySelector('.volume-slider');
  
  if (!currentMute) {
    channelMutes[soundKey] = true;
    if (muteBtn) {
      muteBtn.classList.add('muted');
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
    if (ambientAudioCtx && isAmbientOn && ambientNodes[soundKey].gainNode) {
      ambientNodes[soundKey].gainNode.gain.linearRampToValueAtTime(0, ambientAudioCtx.currentTime + 0.1);
    }
  } else {
    channelMutes[soundKey] = false;
    if (muteBtn) {
      muteBtn.classList.remove('muted');
      muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
    
    if (channelVolumes[soundKey] === 0) {
      channelVolumes[soundKey] = 0.3;
      if (slider) slider.value = 30;
      const display = channelDiv.querySelector('.channel-vol-display');
      if (display) display.textContent = '30%';
    }
    
    const vol = channelVolumes[soundKey];
    if (ambientAudioCtx && isAmbientOn && ambientNodes[soundKey].gainNode) {
      const scaleMultiplier = soundKey === 'rain' ? 0.25 : soundKey === 'cafe' ? 0.1 : 0.35;
      ambientNodes[soundKey].gainNode.gain.linearRampToValueAtTime(vol * scaleMultiplier, ambientAudioCtx.currentTime + 0.1);
    }
  }
}

function toggleMasterAmbient() {
  if (!isAmbientOn) {
    isAmbientOn = true;
    initAmbientAudioContext();
    resumeAmbientContext();
    
    if (elAmbientMasterBtn) {
      elAmbientMasterBtn.classList.add('active');
      elAmbientMasterBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>ปิดบรรยากาศมู้ด</span>';
    }
    
    for (let key in channelVolumes) {
      if (!channelMutes[key] && ambientNodes[key].gainNode) {
        const vol = channelVolumes[key];
        const scaleMultiplier = key === 'rain' ? 0.25 : key === 'cafe' ? 0.1 : 0.35;
        ambientNodes[key].gainNode.gain.linearRampToValueAtTime(vol * scaleMultiplier, ambientAudioCtx.currentTime + 0.2);
      }
    }
    
    showToast("Ambient Audio Active", "กำลังผสานเสียงสังเคราะห์อย่างลงตัว 🎧");
  } else {
    isAmbientOn = false;
    if (elAmbientMasterBtn) {
      elAmbientMasterBtn.classList.remove('active');
      elAmbientMasterBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>เปิดมู้ดฟิน ๆ (Ambient ON)</span>';
    }
    
    for (let key in ambientNodes) {
      if (ambientNodes[key].gainNode) {
        ambientNodes[key].gainNode.gain.linearRampToValueAtTime(0, ambientAudioCtx.currentTime + 0.3);
      }
    }
  }
}

// --- 20. Premium Simulated Sound Wave Visualizer Loop ---
function drawPlayerVisualizer() {
  visualizerAnimId = requestAnimationFrame(drawPlayerVisualizer);
  if (!elVisualizerCanvas) return;
  
  const width = elVisualizerCanvas.width = elVisualizerCanvas.parentElement.clientWidth;
  const height = elVisualizerCanvas.height = 180;
  const canvasCtx = elVisualizerCanvas.getContext('2d');
  
  canvasCtx.clearRect(0, 0, width, height);
  
  const bandsCount = 28;
  const barWidth = width / bandsCount;
  
  for (let i = 0; i < bandsCount; i++) {
    let baseHeight = 15;
    
    if (isPlaying) {
      baseHeight = 20 + Math.sin(i * 0.4 + waveOffset) * 20 + Math.cos(i * 0.7 - waveOffset * 0.5) * 25;
      baseHeight += Math.random() * 10;
      baseHeight = Math.max(10, Math.min(height - 20, baseHeight));
    }
    
    const grad = canvasCtx.createLinearGradient(0, height, 0, height - baseHeight);
    grad.addColorStop(0, `rgba(var(--accent-rgb), 0.04)`);
    grad.addColorStop(0.5, `rgba(var(--accent-rgb), 0.22)`);
    grad.addColorStop(1, `rgba(var(--accent-rgb), 0.48)`);
    
    canvasCtx.fillStyle = grad;
    canvasCtx.fillRect(i * barWidth, height - baseHeight, barWidth - 4, baseHeight);
    canvasCtx.fillRect(width - (i * barWidth) - barWidth, height - baseHeight, barWidth - 4, baseHeight);
  }
  
  if (isPlaying) {
    waveOffset += 0.085;
  }
}

// ==========================================================================
// PWA, Media Session, Mobile Navigation, and Cozy Pixel Parallax Engine
// ==========================================================================

// --- 21. Progressive Web App (PWA) Self-Destruct Routine (Clears mobile cached standalone states) ---
function killServiceWorkersAndCaches() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister().then(success => {
          if (success) {
            console.log("Cozy Player: Unregistered active service worker successfully.");
          }
        });
      }
    }).catch(err => {
      console.warn("Error unregistering service workers:", err);
    });
  }
  
  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => {
        caches.delete(key).then(() => {
          console.log("Cozy Player: Deleted stale client cache:", key);
        });
      });
    }).catch(err => {
      console.warn("Error clearing caches:", err);
    });
  }
}

// --- 22. System Lock Screen Integration (Media Session API) ---
function updateMediaSessionMetadata(track) {
  if ('mediaSession' in navigator && window.MediaMetadata) {
    try {
      const localCover = getLocalCoverUrl(track.trackName, track.collectionName);
      // Construct full absolute URL for local cover to prevent CORS errors on Safari/Chrome
      const absoluteCoverUrl = new URL(localCover, window.location.href).href;
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.trackName,
        artist: 'Jeff Bernat',
        album: track.collectionName,
        artwork: [
          { src: absoluteCoverUrl, sizes: '512x512', type: 'image/png' }
        ]
      });
      console.log("Media Session Metadata loaded:", track.trackName);
    } catch (e) {
      console.warn("Failed to set Media Session Metadata:", e);
    }
  }
}

function setupMediaSessionActions() {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        playAudio();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        pauseAudio();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });
      console.log("Media Session lock screen actions registered.");
    } catch (e) {
      console.warn("Failed to setup Media Session actions:", e);
    }
  }
}

// --- 23. Mobile View App Nav Switcher ---
function initMobileNavigation() {
  const elLoungeGrid = document.querySelector('.lounge-grid');
  const elNavTabs = document.querySelectorAll('.nav-tab');
  
  if (elLoungeGrid && elNavTabs.length > 0) {
    // Set default view on start
    elLoungeGrid.classList.add('view-lounge');
    
    elNavTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elNavTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetTab = tab.getAttribute('data-tab'); // 'lounge' | 'playlist'
        
        elLoungeGrid.classList.remove('view-lounge', 'view-playlist');
        
        if (targetTab === 'lounge') {
          elLoungeGrid.classList.add('view-lounge');
        } else if (targetTab === 'playlist') {
          elLoungeGrid.classList.add('view-playlist');
        }
        
        const tabTitle = tab.querySelector('span') ? tab.querySelector('span').textContent : targetTab;
        showToast("Switched Screen", `สลับไปหน้าจอ ${tabTitle} แล้วค่ะ 📱`);
      });
    });
  }
}


// --- 24. Cozy Music Manager Dashboard & IndexedDB Storage System ---
let cozyDB = null;
let customTracks = [];
let hiddenTrackIds = [];

// LocalStorage key for hidden/deleted tracks
const STORAGE_KEY_HIDDEN = 'jeff_bernat_hidden_tracks';

// Central tracks state resolver (incorporates built-in, custom, and excludes hidden)
function resolveTracksList() {
  console.log("Resolving tracks list... Base count:", allBaseTracks.length);
  
  // 1. Filter out hidden/deleted built-in tracks
  let resolved = allBaseTracks.filter(t => !hiddenTrackIds.includes(t.trackId));
  
  // 2. Append custom uploaded tracks
  customTracks.forEach(custom => {
    // Avoid duplicates, override if already exists
    const idx = resolved.findIndex(t => t.trackId === custom.trackId);
    if (idx !== -1) {
      resolved[idx] = custom;
    } else {
      resolved.push(custom);
    }
  });
  
  // 3. Keep local audio tracks sorted first for immediate playability
  resolved.sort((a, b) => {
    const hasA = (a.localUrl || a.isCustom) ? 1 : 0;
    const hasB = (b.localUrl || b.isCustom) ? 1 : 0;
    return hasB - hasA;
  });
  
  tracks = resolved;
  console.log("Tracks list resolved. Active count:", tracks.length);
}

// 1. Initialize IndexedDB
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CozyPlayerDB', 1);
    
    request.onerror = (e) => {
      console.error("IndexedDB open error:", e.target.error);
      reject(e.target.error);
    };
    
    request.onsuccess = (e) => {
      cozyDB = e.target.result;
      console.log("CozyPlayerDB Opened Successfully.");
      resolve(cozyDB);
    };
    
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains('custom_tracks')) {
        dbInstance.createObjectStore('custom_tracks', { keyPath: 'trackId' });
      }
      console.log("CozyPlayerDB Upgrade/Setup Completed.");
    };
  });
}

// 2. Load custom tracks from IndexedDB and resolve Blob URLs
async function loadCustomTracksFromDB() {
  if (!cozyDB) return;
  
  return new Promise((resolve, reject) => {
    const transaction = cozyDB.transaction(['custom_tracks'], 'readonly');
    const store = transaction.objectStore('custom_tracks');
    const request = store.getAll();
    
    request.onerror = (e) => {
      console.error("Load custom tracks error:", e.target.error);
      reject(e.target.error);
    };
    
    request.onsuccess = (e) => {
      // Clear previously active base64 / blob URLs to prevent memory leak
      customTracks.forEach(t => {
        if (t.localUrl && t.localUrl.startsWith('blob:')) {
          URL.revokeObjectURL(t.localUrl);
        }
        if (t.artworkUrl100 && t.artworkUrl100.startsWith('blob:')) {
          URL.revokeObjectURL(t.artworkUrl100);
        }
      });
      
      const results = request.result || [];
      customTracks = results.map(track => {
        // Hydrate Blob references to browser-playable Blob URLs!
        if (track.audioBlob) {
          const url = URL.createObjectURL(track.audioBlob);
          track.previewUrl = url;
          track.localUrl = url;
        }
        if (track.artworkBlob) {
          track.artworkUrl100 = URL.createObjectURL(track.artworkBlob);
        }
        track.isCustom = true;
        return track;
      });
      
      console.log("Loaded custom tracks from DB:", customTracks.length);
      resolve(customTracks);
    };
  });
}

// 3. Save a custom track into IndexedDB
function saveCustomTrackToDB(track) {
  return new Promise((resolve, reject) => {
    if (!cozyDB) return reject("Database not initialized");
    
    const transaction = cozyDB.transaction(['custom_tracks'], 'readwrite');
    const store = transaction.objectStore('custom_tracks');
    const request = store.put(track);
    
    request.onerror = (e) => reject(e.target.error);
    request.onsuccess = (e) => {
      console.log("Successfully saved custom track:", track.trackName);
      resolve();
    };
  });
}

// 4. Delete a custom track from IndexedDB
function deleteCustomTrackFromDB(trackId) {
  return new Promise((resolve, reject) => {
    if (!cozyDB) return reject("Database not initialized");
    
    const transaction = cozyDB.transaction(['custom_tracks'], 'readwrite');
    const store = transaction.objectStore('custom_tracks');
    const request = store.delete(trackId);
    
    request.onerror = (e) => reject(e.target.error);
    request.onsuccess = (e) => {
      console.log("Successfully deleted custom track ID:", trackId);
      resolve();
    };
  });
}

// --- 25. Cozy Dashboard UI Controllers & Events Setup ---
function initCozyDashboard() {
  console.log("Bootstrapping Cozy Music Manager Dashboard Engine...");
  
  // A. Load hidden track IDs from LocalStorage safely
  try {
    hiddenTrackIds = JSON.parse(localStorage.getItem(STORAGE_KEY_HIDDEN)) || [];
  } catch (err) {
    hiddenTrackIds = [];
  }
  
  // B. Initialize database, load tracks, and hook up UI
  initIndexedDB()
    .then(() => loadCustomTracksFromDB())
    .then(() => {
      // Resolve the initial list
      resolveTracksList();
      
      // Update UI elements
      renderLibrary();
      renderAlbumShelf();
      
      // Ensure player initializes with the correct track safely
      if (tracks.length > 0) {
        loadTrack(0);
      }
      
      // C. Set up UI event listeners
      setupDashboardEventListeners();
    })
    .catch(err => {
      console.error("Dashboard engine boot failure:", err);
      // Fail-safe default render
      resolveTracksList();
      renderLibrary();
      renderAlbumShelf();
      if (tracks.length > 0) loadTrack(0);
    });
}

// Open dashboard overlay modal
function openDashboard() {
  const overlay = document.getElementById('cozy-dashboard');
  if (overlay) {
    overlay.classList.add('active');
    updateDashboardStats();
    renderDashboardCatalog();
  }
}

// Close dashboard overlay modal
function closeDashboard() {
  const overlay = document.getElementById('cozy-dashboard');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// Open inline edit modal for custom tracks
let currentEditingTrackId = null;
function openEditModal(trackId) {
  const track = tracks.find(t => t.trackId === trackId);
  if (!track) return;
  
  currentEditingTrackId = trackId;
  
  const editTitle = document.getElementById('edit-track-title');
  const editAlbum = document.getElementById('edit-track-album');
  const editYear = document.getElementById('edit-track-year');
  const editGenre = document.getElementById('edit-track-genre');
  
  if (editTitle) editTitle.value = track.trackName || '';
  if (editAlbum) editAlbum.value = track.collectionName || '';
  if (editYear) editYear.value = track.releaseDate ? new Date(track.releaseDate).getFullYear() : 2026;
  if (editGenre) editGenre.value = track.primaryGenreName || 'R&B/Soul';
  
  const modal = document.getElementById('cozy-edit-modal');
  if (modal) modal.classList.add('active');
}

function closeEditModal() {
  const modal = document.getElementById('cozy-edit-modal');
  if (modal) modal.classList.remove('active');
  currentEditingTrackId = null;
}

// Update dashboard header stats
function updateDashboardStats() {
  const elTotal = document.getElementById('db-stat-total');
  const elCustom = document.getElementById('db-stat-custom');
  const elHidden = document.getElementById('db-stat-hidden');
  
  if (elTotal) elTotal.textContent = tracks.length;
  if (elCustom) elCustom.textContent = customTracks.length;
  if (elHidden) elHidden.textContent = hiddenTrackIds.length;
}

// Render dynamic table list inside the dashboard modal
function renderDashboardCatalog() {
  const tbody = document.getElementById('db-catalog-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const searchInput = document.getElementById('db-catalog-search');
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  const activeTab = document.querySelector('.catalog-tab.active');
  const filterType = activeTab ? activeTab.getAttribute('data-filter') : 'all'; // 'all'|'builtin'|'custom'|'hidden'
  
  // Gather base list
  let list = [];
  if (filterType === 'all') {
    // Show active tracks AND hidden ones to allow easy restore!
    list = [...tracks];
    hiddenTrackIds.forEach(id => {
      const match = allBaseTracks.find(t => t.trackId === id);
      if (match && !list.some(t => t.trackId === id)) {
        list.push(match);
      }
    });
  } else if (filterType === 'builtin') {
    list = tracks.filter(t => !t.isCustom);
  } else if (filterType === 'custom') {
    list = tracks.filter(t => t.isCustom);
  } else if (filterType === 'hidden') {
    // Gather all hidden track objects
    list = allBaseTracks.filter(t => hiddenTrackIds.includes(t.trackId));
  }
  
  // Apply Search query filter
  if (searchQuery) {
    list = list.filter(t => 
      t.trackName.toLowerCase().includes(searchQuery) ||
      t.collectionName.toLowerCase().includes(searchQuery)
    );
  }
  
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; opacity: 0.5;">
          <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>
          ไม่มีเพลงที่ตรงตามเงื่อนไขการค้นหา
        </td>
      </tr>
    `;
    return;
  }
  
  list.forEach((track, index) => {
    const isHidden = hiddenTrackIds.includes(track.trackId);
    const isCustom = !!track.isCustom;
    
    let typeBadge = '';
    if (isHidden) {
      typeBadge = '<span class="badge badge-hidden">Hidden</span>';
    } else if (isCustom) {
      typeBadge = '<span class="badge badge-custom">Custom</span>';
    } else {
      typeBadge = '<span class="badge badge-builtin">Built-in</span>';
    }
    
    const yearDisplay = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '2026';
    
    // Map covers safely
    const artwork = track.artworkUrl100 || getLocalCoverUrl(track.trackName, track.collectionName);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="db-cover-thumb" style="background-image: url('${artwork}')"></div></td>
      <td style="font-weight: 600; color: #fff;">${track.trackName}</td>
      <td style="color: var(--text-sub);">${track.collectionName}</td>
      <td>${typeBadge}</td>
      <td>${yearDisplay}</td>
      <td>
        <div class="db-actions">
          ${!isHidden ? `
            <button class="db-action-btn play-btn" data-id="${track.trackId}" title="เล่นเพลงนี้"><i class="fa-solid fa-play"></i></button>
            <button class="db-action-btn edit-btn" data-id="${track.trackId}" title="แก้ไขข้อมูลเพลง"><i class="fa-solid fa-pen-to-square"></i></button>
          ` : ''}
          ${isCustom ? `
            <button class="db-action-btn delete-btn" data-id="${track.trackId}" title="ลบเพลงออกถาวร"><i class="fa-solid fa-trash-can"></i></button>
          ` : `
            ${isHidden ? `
              <button class="db-action-btn restore-btn" data-id="${track.trackId}" title="กู้คืนเพลงเข้าคลัง"><i class="fa-solid fa-trash-arrow-up"></i></button>
            ` : `
              <button class="db-action-btn delete-btn" data-id="${track.trackId}" title="ซ่อนเพลงนี้"><i class="fa-solid fa-eye-slash"></i></button>
            `}
          `}
        </div>
      </td>
    `;
    
    // Bind action listeners
    const btnPlay = tr.querySelector('.play-btn');
    const btnEdit = tr.querySelector('.edit-btn');
    const btnDel = tr.querySelector('.delete-btn');
    const btnRestore = tr.querySelector('.restore-btn');
    
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        closeDashboard();
        const activeIdx = tracks.findIndex(t => t.trackId === track.trackId);
        if (activeIdx !== -1) {
          loadTrack(activeIdx);
          playAudio();
        }
      });
    }
    
    if (btnEdit) {
      btnEdit.addEventListener('click', () => openEditModal(track.trackId));
    }
    
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        if (isCustom) {
          if (confirm(`คุณต้องการลบเพลง "${track.trackName}" ออกถาวรใช่หรือไม่?`)) {
            deleteCustomTrackFromDB(track.trackId)
              .then(() => loadCustomTracksFromDB())
              .then(() => {
                resolveTracksList();
                renderLibrary();
                updateDashboardStats();
                renderDashboardCatalog();
                showToast("ลบเพลงสำเร็จ! 🗑️", `ลบเพลง "${track.trackName}" เรียบร้อยแล้วค่ะ`);
              });
          }
        } else {
          // Hide built-in track
          hiddenTrackIds.push(track.trackId);
          localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(hiddenTrackIds));
          resolveTracksList();
          renderLibrary();
          updateDashboardStats();
          renderDashboardCatalog();
          showToast("ซ่อนเพลงเรียบร้อย! 👁️‍🗨️", `ซ่อนเพลง "${track.trackName}" จากเครื่องเล่นแล้วค่ะ`);
        }
      });
    }
    
    if (btnRestore) {
      btnRestore.addEventListener('click', () => {
        hiddenTrackIds = hiddenTrackIds.filter(id => id !== track.trackId);
        localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(hiddenTrackIds));
        resolveTracksList();
        renderLibrary();
        updateDashboardStats();
        renderDashboardCatalog();
        showToast("กู้คืนเพลงสำเร็จ! ✨", `นำเพลง "${track.trackName}" กลับเข้าคลังเล่นแล้วค่ะ`);
      });
    }
    
    tbody.appendChild(tr);
  });
}

// 5. Setup event bindings for forms, dropzones, tabs
function setupDashboardEventListeners() {
  const openBtn = document.getElementById('open-dashboard-btn');
  const closeBtn = document.getElementById('close-dashboard-btn');
  const overlay = document.getElementById('cozy-dashboard');
  
  // Modal toggle
  if (openBtn) openBtn.addEventListener('click', openDashboard);
  if (closeBtn) closeBtn.addEventListener('click', closeDashboard);
  
  // Close modal when clicking outside content area
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDashboard();
    });
  }
  
  // Keyboard Escape key bind
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDashboard();
      closeEditModal();
    }
  });
  
  // Accordion Expand/Collapse Form
  const accordionBtn = document.getElementById('add-song-toggle-btn');
  const accordionSection = document.getElementById('add-song-accordion');
  if (accordionBtn && accordionSection) {
    accordionBtn.addEventListener('click', () => {
      accordionSection.classList.toggle('active');
    });
  }
  
  // Track Form elements pre-population when dropping audio file
  const audioInput = document.getElementById('db-audio-input');
  const audioFilename = document.getElementById('db-audio-filename');
  const trackTitleInput = document.getElementById('track-title');
  
  if (audioInput) {
    audioInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (audioFilename) audioFilename.textContent = file.name;
        
        // Auto-extract track title from clean file name (e.g. "Jeff Bernat - dist.mp3" -> "Jeff Bernat - dist")
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        if (trackTitleInput && !trackTitleInput.value) {
          trackTitleInput.value = nameWithoutExt;
        }
      }
    });
  }
  
  // Drag & drop handlers for audio file dropzone
  const audioDropzone = document.getElementById('db-audio-dropzone');
  if (audioDropzone && audioInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      audioDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        audioDropzone.classList.add('dragover');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      audioDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        audioDropzone.classList.remove('dragover');
      }, false);
    });
    
    audioDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file && file.type.startsWith('audio/')) {
        audioInput.files = dt.files;
        if (audioFilename) audioFilename.textContent = file.name;
        
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        if (trackTitleInput && !trackTitleInput.value) {
          trackTitleInput.value = nameWithoutExt;
        }
      }
    }, false);
  }
  
  // Radio buttons switcher for cover artwork sources
  const coverRadios = document.querySelectorAll('input[name="cover-source"]');
  const dropzoneArtwork = document.getElementById('db-artwork-dropzone');
  const gridOfficial = document.getElementById('official-covers-grid');
  const inputUrl = document.getElementById('track-cover-url');
  
  coverRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const source = e.target.value;
      
      // Hide all options
      if (dropzoneArtwork) dropzoneArtwork.style.display = 'none';
      if (gridOfficial) gridOfficial.style.display = 'none';
      if (inputUrl) inputUrl.style.display = 'none';
      
      // Show selected source input
      if (source === 'upload' && dropzoneArtwork) {
        dropzoneArtwork.style.display = 'flex';
      } else if (source === 'official' && gridOfficial) {
        gridOfficial.style.display = 'grid';
      } else if (source === 'url' && inputUrl) {
        inputUrl.style.display = 'block';
      }
    });
  });
  
  // Official covers item toggle
  const coverItems = document.querySelectorAll('.off-cover-item');
  coverItems.forEach(item => {
    item.addEventListener('click', () => {
      coverItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  // Image dropzone name display
  const artworkInput = document.getElementById('db-artwork-input');
  const artworkFilename = document.getElementById('db-artwork-filename');
  if (artworkInput) {
    artworkInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && artworkFilename) {
        artworkFilename.textContent = file.name;
      }
    });
  }
  
  const artworkDropzone = document.getElementById('db-artwork-dropzone');
  if (artworkDropzone && artworkInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      artworkDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        artworkDropzone.classList.add('dragover');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      artworkDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        artworkDropzone.classList.remove('dragover');
      }, false);
    });
    
    artworkDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file && file.type.startsWith('image/')) {
        artworkInput.files = dt.files;
        if (artworkFilename) artworkFilename.textContent = file.name;
      }
    }, false);
  }
  
  // Form submission - Add song
  const addForm = document.getElementById('add-track-form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const audioFile = audioInput.files[0];
      if (!audioFile) {
        alert("กรุณาเลือกไฟล์เพลงด้วยค่ะ!");
        return;
      }
      
      const title = trackTitleInput.value.trim();
      const album = document.getElementById('track-album').value.trim();
      const year = document.getElementById('track-year').value.trim();
      const genre = document.getElementById('track-genre').value.trim();
      
      const artworkSource = document.querySelector('input[name="cover-source"]:checked').value;
      
      let artworkBlob = null;
      let artworkUrl100 = 'default_cover.png';
      
      if (artworkSource === 'upload') {
        const artFile = artworkInput.files[0];
        if (artFile) {
          artworkBlob = artFile;
        }
      } else if (artworkSource === 'official') {
        const activeOffItem = document.querySelector('.off-cover-item.active');
        if (activeOffItem) {
          artworkUrl100 = activeOffItem.getAttribute('data-cover');
        }
      } else if (artworkSource === 'url') {
        const urlVal = inputUrl.value.trim();
        if (urlVal) {
          artworkUrl100 = urlVal;
        }
      }
      
      // Compose custom track object
      const trackId = 'custom_' + Date.now();
      const customTrack = {
        trackId: trackId,
        trackName: title,
        collectionName: album,
        artworkUrl100: artworkUrl100,
        artworkBlob: artworkBlob,
        audioBlob: audioFile,
        releaseDate: new Date(year, 0, 1).toISOString(),
        primaryGenreName: genre,
        trackViewUrl: '#',
        isCustom: true
      };
      
      showToast("กำลังประมวลผล... ⏳", "บันทึกเพลงระดับสตูดิโอเข้าหน่วยความจำบราวเซอร์...");
      
      try {
        await saveCustomTrackToDB(customTrack);
        await loadCustomTracksFromDB();
        
        // Re-resolve
        resolveTracksList();
        renderLibrary();
        updateDashboardStats();
        renderDashboardCatalog();
        
        // Reset form & accordion collapse
        addForm.reset();
        if (audioFilename) audioFilename.textContent = "ยังไม่ได้เลือกไฟล์";
        if (artworkFilename) artworkFilename.textContent = "ยังไม่ได้เลือกไฟล์";
        if (accordionSection) accordionSection.classList.remove('active');
        
        showToast("เพิ่มเพลงสำเร็จ! 🎉", `เพลง "${title}" ถูกจัดเก็บเข้าคลังพร้อมเล่นออฟไลน์แล้วค่ะ`);
      } catch (err) {
        console.error("Save custom track failed:", err);
        alert("เกิดข้อผิดพลาดในการบันทึกเพลง: " + err);
      }
    });
  }
  
  // Form clear button
  const formClearBtn = document.getElementById('db-form-clear-btn');
  if (formClearBtn && addForm) {
    formClearBtn.addEventListener('click', () => {
      addForm.reset();
      if (audioFilename) audioFilename.textContent = "ยังไม่ได้เลือกไฟล์";
      if (artworkFilename) artworkFilename.textContent = "ยังไม่ได้เลือกไฟล์";
    });
  }
  
  // Catalog tabs filter binds
  const catTabs = document.querySelectorAll('.catalog-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderDashboardCatalog();
    });
  });
  
  // Search bar binder
  const catSearch = document.getElementById('db-catalog-search');
  if (catSearch) {
    catSearch.addEventListener('input', renderDashboardCatalog);
  }
  
  // Edit form modal close buttons
  const closeEditBtn = document.getElementById('close-edit-modal-btn');
  const closeEditBtn2 = document.getElementById('close-edit-modal-btn-2');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
  if (closeEditBtn2) closeEditBtn2.addEventListener('click', closeEditModal);
  
  const editModalOverlay = document.getElementById('cozy-edit-modal');
  if (editModalOverlay) {
    editModalOverlay.addEventListener('click', (e) => {
      if (e.target === editModalOverlay) closeEditModal();
    });
  }
  
  // Edit form submit handler
  const editForm = document.getElementById('edit-track-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentEditingTrackId) return;
      
      const title = document.getElementById('edit-track-title').value.trim();
      const album = document.getElementById('edit-track-album').value.trim();
      const year = document.getElementById('edit-track-year').value.trim();
      const genre = document.getElementById('edit-track-genre').value.trim();
      
      // Check if it is custom or built-in track
      const track = tracks.find(t => t.trackId === currentEditingTrackId);
      if (!track) return;
      
      if (track.isCustom) {
        // Fetch full custom track from DB to preserve binary blobs
        const transaction = cozyDB.transaction(['custom_tracks'], 'readwrite');
        const store = transaction.objectStore('custom_tracks');
        
        store.get(currentEditingTrackId).onsuccess = async (event) => {
          const customTrack = event.target.result;
          if (customTrack) {
            customTrack.trackName = title;
            customTrack.collectionName = album;
            customTrack.releaseDate = new Date(year, 0, 1).toISOString();
            customTrack.primaryGenreName = genre;
            
            await saveCustomTrackToDB(customTrack);
            await loadCustomTracksFromDB();
            
            resolveTracksList();
            renderLibrary();
            renderDashboardCatalog();
            closeEditModal();
            showToast("แก้ไขข้อมูลเพลงสำเร็จ! ✏️", `อัปเดตเพลง "${title}" เรียบร้อยแล้วค่ะ`);
          }
        };
      } else {
        // Edit is only supported for custom tracks, but to be extremely helpful, we can:
        // Exclude the built-in track and clone it as a new custom track with modified metadata!
        // Wait, for built-in track, we can display alert that metadata is write-protected or clone it.
        // Let's just alert the user that built-in track info is write-protected for copyright authenticity.
        alert("เพลงหลักของระบบมีลิขสิทธิ์รับรอง ข้อมูลจึงถูกล็อกไว้เพื่อป้องกันข้อผิดพลาดค่ะ (แก้ไขได้เฉพาะเพลงที่คุณอัพโหลดขึ้นมาเองนะคะ) 🌸");
        closeEditModal();
      }
    });
  }
}

