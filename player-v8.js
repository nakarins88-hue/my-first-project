/* ==========================================================================
   Cozy Jeff Bernat Music Lounge - Resilient Engine (Cache-Busted Player Edition)
   ========================================================================== */

// --- 1. Global State Variables ---

// --- Added for Redesign ---
let playlists = [];
let currentPlaylistFilter = 'all';
let currentSort = 'date-desc';
let appSettings = { playbackSpeed: 1.0 };
let elProgressModal, elProgressText;

// Helper: Extract ID3 tags using jsmediatags
function extractMetadata(file) {
  return new Promise((resolve) => {
    if (typeof jsmediatags === 'undefined') {
      resolve({ title: file.name.replace(/\.[^/.]+$/, ""), artist: "Unknown Artist", album: "Unknown Album", coverBlob: null, genre: "Local", year: new Date().getFullYear() });
      return;
    }
    jsmediatags.read(file, {
      onSuccess: function(tag) {
        const tags = tag.tags;
        let coverBlob = null;
        if (tags.picture) {
          const data = tags.picture.data;
          const format = tags.picture.format;
          const uint8Array = new Uint8Array(data);
          coverBlob = new Blob([uint8Array], { type: format });
        }
        resolve({
          title: tags.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: tags.artist || "Unknown Artist",
          album: tags.album || "Unknown Album",
          coverBlob: coverBlob,
          genre: tags.genre || "Local",
          year: tags.year || new Date().getFullYear()
        });
      },
      onError: function(error) {
        resolve({ title: file.name.replace(/\.[^/.]+$/, ""), artist: "Unknown Artist", album: "Unknown Album", coverBlob: null, genre: "Local", year: new Date().getFullYear() });
      }
    });
  });
}

// Convert Blob to Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) { resolve(null); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}





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
let elSessionPresetBtns = [];
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

const SESSION_PRESETS = {
  'rainy-night': {
    label: 'Rainy Night',
    theme: 'rain',
    volumes: { rain: 42, cafe: 0, fireplace: 8 },
    visualIntensity: 1.15,
    ambientOn: true,
    toast: 'ฝนชัดขึ้น มีเตาผิงบาง ๆ ให้บรรยากาศกลางคืนอบอุ่น'
  },
  'cafe-focus': {
    label: 'Cafe Focus',
    theme: 'cafe',
    volumes: { rain: 8, cafe: 34, fireplace: 0 },
    visualIntensity: 1,
    ambientOn: true,
    toast: 'ร้านกาแฟเบา ๆ พร้อมเสียงฝนบางมากสำหรับทำงาน'
  },
  'study-glow': {
    label: 'Study Glow',
    theme: 'study',
    volumes: { rain: 0, cafe: 8, fireplace: 44 },
    visualIntensity: 1.25,
    ambientOn: true,
    toast: 'โหมดอ่านหนังสืออุ่น ๆ พร้อมประกายไฟนุ่มตา'
  },
  'pure-music': {
    label: 'Pure Music',
    theme: 'rain',
    volumes: { rain: 0, cafe: 0, fireplace: 0 },
    visualIntensity: 0.45,
    ambientOn: false,
    toast: 'ปิดเสียงบรรยากาศ เหลือแต่เพลงแบบสะอาด ๆ'
  },
  'sakura-date': {
    label: 'Sakura Date 🌸',
    theme: 'sakura',
    volumes: { rain: 18, cafe: 0, fireplace: 8 },
    visualIntensity: 1.1,
    ambientOn: true,
    toast: 'เดทใต้ดอกซากุระ กลีบดอกไม้ร่วงหล่น ช่วงเวลาที่โรแมนติกที่สุด 🌸'
  },
  'candlelit-night': {
    label: 'Candlelit Night 🕯️',
    theme: 'candle',
    volumes: { rain: 0, cafe: 8, fireplace: 38 },
    visualIntensity: 0.8,
    ambientOn: true,
    toast: 'แสงเทียนอบอุ่น บรรยากาศดินเนอร์สำหรับสองเรา 🕯️'
  }
};

// --- 4. Premium Offline Playlist (Instant Load & Safe Fallback) ---
const BACKUP_TRACKS = [
  {
    trackId: 588826011,
    trackName: "Call You Mine (feat. Geeks)",
    collectionName: "The Gentleman Approach",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/400x400bb.jpg",
    releaseDate: "2012-12-07T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/call-you-mine-feat-geeks/588825838?i=588826011"
  },
  {
    trackId: 588826013,
    trackName: "Groovin",
    collectionName: "The Gentleman Approach",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/400x400bb.jpg",
    releaseDate: "2012-12-07T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/groovin/588825838?i=588826013"
  },
  {
    trackId: 783935298,
    trackName: "Pillow Talk",
    collectionName: "Modern Renaissance",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/db/45/ad/db45ad7d-c07a-251c-4395-9ff2d973715c/artwork.jpg/400x400bb.jpg",
    releaseDate: "2013-12-15T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/pillow-talk/783935293?i=783935298"
  },
  {
    trackId: 1071989040,
    trackName: "Cruisin",
    collectionName: "In the Meantime",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/bf/16/f4bf168e-9080-60b6-11fc-db439563f458/artwork.jpg/400x400bb.jpg",
    releaseDate: "2016-01-16T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/cruisin/1071988882?i=1071989040"
  },
  {
    trackId: 783935294,
    trackName: "Cool Girls",
    collectionName: "Modern Renaissance",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/db/45/ad/db45ad7d-c07a-251c-4395-9ff2d973715c/artwork.jpg/400x400bb.jpg",
    releaseDate: "2013-12-15T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/cool-girls/783935293?i=783935294"
  },
  {
    trackId: 588826017,
    trackName: "Just Vibe",
    collectionName: "The Gentleman Approach",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ce/27/ef/ce27efc6-7a71-6c2e-4b61-9c60e334df58/artwork.jpg/400x400bb.jpg",
    releaseDate: "2012-12-07T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/just-vibe/588825838?i=588826017"
  },
  {
    trackId: 1460593005,
    trackName: "Changes",
    collectionName: "She Loves Me Not",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/99/bd/27/99bd27df-6bf9-e30b-0447-38e55e09f583/artwork.jpg/400x400bb.jpg",
    releaseDate: "2019-05-10T08:00:00Z",
    primaryGenreName: "R&B/Soul",
    trackViewUrl: "https://music.apple.com/us/album/changes/1460592813?i=1460593005"
  },
  {
    trackId: 1071989043,
    trackName: "Still",
    collectionName: "In the Meantime",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/bf/16/f4bf168e-9080-60b6-11fc-db439563f458/artwork.jpg/400x400bb.jpg",
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
    
    if (nameWithoutExt.includes(" - ")) {
      collection = "Cozy Lounge Hits";
      year = "2026-05-29T00:00:00Z";
    } else if (cleanFile.includes("pillowtalk") || cleanFile.includes("coolgirls") || cleanFile.includes("modernrenaissance")) {
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





function getCorrectedDuration(audioElement, track) {
  if (!audioElement) return 30;
  let reportedDuration = audioElement.duration || 30;
  
  // If we have a mathematically precise trackDuration
  if (track && track.trackDuration && track.trackDuration > 0 && reportedDuration > 30) {
    if (Math.abs(reportedDuration - track.trackDuration) > 2) {
      return track.trackDuration;
    }
  }
  
  return reportedDuration;
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
// --- Helper: Decode audio file duration via AudioContext ---
function getDurationFromAudioFile(file) {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        audioContext.decodeAudioData(arrayBuffer, (decodedAudio) => {
          resolve(decodedAudio.duration);
        }, (err) => {
          console.warn("Failed to decode audio data, fallback to 0", err);
          resolve(0);
        });
      };
      reader.onerror = () => resolve(0);
      reader.readAsArrayBuffer(file);
    } catch (e) {
      console.warn("AudioContext error", e);
      resolve(0);
    }
  });
}

async function importLocalTracks(files) {
  if (!files || files.length === 0) return;
  
  showToast("กำลังนำเข้าไฟล์... ⏳", `กำลังเตรียมนำเข้าไฟล์เพลง ${files.length} ไฟล์ค่ะ`);
  
  const filesArray = Array.from(files);
  let matchedCount = 0;
  let addedCount = 0;
  let lastNewTrackId = null;
  
  for (let file of filesArray) {
    const objectURL = URL.createObjectURL(file);
    const fileNameClean = file.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check if audio file. Check file type and file extension fallback for empty MIME types (common on some Windows systems)
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac|wma)$/i.test(file.name);
    if (!isAudio) {
      console.warn("Skipping non-audio file during import:", file.name);
      continue;
    }
    
    // Check if it matches any existing tracks in our list
    let matchedIdx = tracks.findIndex(t => {
      const tNameClean = t.trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return fileNameClean.includes(tNameClean) || tNameClean.includes(fileNameClean);
    });
    
    if (matchedIdx !== -1) {
      tracks[matchedIdx].localUrl = objectURL;
      tracks[matchedIdx].previewUrl = objectURL; // support preview fallback using the local file!
      matchedCount++;
      
      if (filesArray.length === 1) {
        loadTrack(matchedIdx);
      }
    } else {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const newTrackId = 'custom_' + Date.now() + Math.round(Math.random() * 100);
      lastNewTrackId = newTrackId;
      
      const duration = await getDurationFromAudioFile(file);
      
      const customTrack = {
        trackId: newTrackId,
        trackName: nameWithoutExt,
        collectionName: "อิมพอร์ตจากเครื่อง (Local Custom)",
        artworkUrl100: "default_cover.png",
        audioBlob: file, // Store the binary file Blob!
        releaseDate: new Date().toISOString(),
        primaryGenreName: "Local Audio",
        trackViewUrl: "#",
        isCustom: true,
        folder: "Uncategorized",
        trackDuration: duration > 0 ? duration : null
      };
      
      if (typeof saveCustomTrackToDB === 'function') {
        try {
          await saveCustomTrackToDB(customTrack);
          addedCount++;
        } catch (err) {
          console.error("Auto import save failed for file:", file.name, err);
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
          addedCount++;
        }
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
        addedCount++;
      }
    }
  }
  
  // Reload custom tracks from IndexedDB once
  if (typeof loadCustomTracksFromDB === 'function') {
    try {
      await loadCustomTracksFromDB();
    } catch (e) {
      console.error("Failed to load custom tracks after batch import:", e);
    }
  }
  
  // Resolve and render all UI elements once
  resolveTracksList();
  renderLibrary();
  renderAlbumShelf();
  updateDashboardStats();
  if (typeof renderDashboardCatalog === 'function') {
    renderDashboardCatalog();
  }
  
  if (filesArray.length === 1) {
    if (matchedCount > 0) {
      showToast("นำเข้าเพลงสำเร็จ! 🎵", `เชื่อมโยงไฟล์กับเพลงหลักเรียบร้อยแล้วค่ะ`);
    } else if (addedCount > 0 && lastNewTrackId) {
      const activeIdx = tracks.findIndex(t => t.trackId === lastNewTrackId);
      if (activeIdx !== -1) {
        loadTrack(activeIdx);
        playAudio();
      }
      showToast("เพิ่มเพลงสำเร็จ! 🎉", `บันทึกเพลงเข้าคลังพร้อมเล่นออฟไลน์แล้วค่ะ`);
    }
  } else {
    showToast("นำเข้าเสร็จสิ้น! 🎵", `นำเข้าไฟล์เพลงสำเร็จทั้งหมด ${matchedCount + addedCount} เพลงค่ะ`);
    if (addedCount > 0 || matchedCount > 0) {
      playAudio();
    }
  }
}

function loadTrack(index) {
  if (tracks.length === 0) return;
  if (index < 0) index = tracks.length - 1;
  if (index >= tracks.length) index = 0;
  
  currentTrackIndex = index;
  const track = tracks[currentTrackIndex];
  
  // Set UI
  if (elPlayerTrackTitle) elPlayerTrackTitle.textContent = track.trackName;
  if (elPlayerTrackAlbum) elPlayerTrackAlbum.textContent = track.collectionName || 'Unknown Album';
  if (elPlayerTrackYear) elPlayerTrackYear.textContent = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '2026';
  if (elPlayerTrackGenre) elPlayerTrackGenre.textContent = track.primaryGenreName || 'Local Audio';
  
  if (elPlayerTrackCover) {
    elPlayerTrackCover.style.backgroundImage = `url('${track.artworkUrl100}'), url('${getLocalCoverUrl(track.trackName, track.collectionName)}')`;
  }
  
  // Update Background Blur Cover
  const blurCover = document.querySelector('.player-blur-cover');
  if (blurCover) {
    blurCover.style.backgroundImage = `url('${track.artworkUrl100}'), url('${getLocalCoverUrl(track.trackName, track.collectionName)}')`;
  }
  
  // Update media session
  updateMediaSessionMetadata(track);
  
  // Reset Progress
  if (elProgressFill) elProgressFill.style.width = "0%";
  if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = "0:00";
  if (elTotalDurationDisplay) elTotalDurationDisplay.textContent = "Loading...";
  
  // Load local HTML5 audio directly
  if (elMainAudio) {
    elMainAudio.src = track.localUrl;
    elMainAudio.load();
    elMainAudio.oncanplay = () => {
      const displayDuration = getCorrectedDuration(elMainAudio, track);
      if (elTotalDurationDisplay) elTotalDurationDisplay.textContent = formatTime(displayDuration);
    };
  }
  
  renderLibrary();
  loadLyrics(track.trackName);
  
  // Update active accent color based on cover art (simulated)
  const colors = ['56, 189, 248', '244, 114, 182', '167, 139, 250', '251, 146, 60', '52, 211, 153'];
  activeAccentRgb = colors[index % colors.length];
  document.documentElement.style.setProperty('--accent-glow', activeAccentRgb);
}

function playAudio() {
  if (tracks.length === 0) return;
  isPlaying = true;
  updatePlayerUIPlaying(true);
  
  if (elMainAudio) {
    elMainAudio.play().catch(e => {
      console.warn("Auto-play prevented by browser:", e);
      isPlaying = false;
      updatePlayerUIPlaying(false);
    });
  }
  startProgressPolling();
}

function pauseAudio() {
  isPlaying = false;
  updatePlayerUIPlaying(false);
  
  if (elMainAudio) {
    elMainAudio.pause();
  }
  stopProgressPolling();
}

function nextTrack(forcePlay = false) {
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
  if (isPlaying || forcePlay) {
    isPlaying = true;
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
    const currentTrack = tracks[currentTrackIndex];
    
    if (elMainAudio) {
      currentTime = elMainAudio.currentTime;
      duration = getCorrectedDuration(elMainAudio, currentTrack);
      
      // Handle double-duration bug manual advance in polling too
      if (currentTrack && currentTrack.trackDuration && elMainAudio.duration > currentTrack.trackDuration * 1.5) {
        if (currentTime >= currentTrack.trackDuration - 0.5) {
          console.log("Accurate duration limit reached (polling), advancing track.");
          nextTrack(true);
          return;
        }
      }
    }
    
    if (duration > 0) {
      const progressPercent = Math.min((currentTime / duration) * 100, 100);
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
  const currentTrack = tracks[currentTrackIndex];
  
  if (elMainAudio) {
    const duration = getCorrectedDuration(elMainAudio, currentTrack);
    if (duration > 0) {
      const newTime = (clickX / width) * duration;
      elMainAudio.currentTime = newTime;
      if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = formatTime(newTime);
      if (elProgressFill) elProgressFill.style.width = `${(clickX / width) * 100}%`;
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
        if (isHtml5AudioEngine()) {
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

  if (cozyToastTimer) clearTimeout(cozyToastTimer);
  
  cozyToastTimer = setTimeout(() => {
    if (elCozyToast) elCozyToast.classList.remove('active');
    cozyToastTimer = null;
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
    elSessionPresetBtns = document.querySelectorAll('.session-preset-btn');
    elAmbientCanvas = document.getElementById('ambient-canvas');
    elVisualizerCanvas = document.getElementById('player-visualizer');
    elFloatingNotesContainer = document.getElementById('floating-notes');
    elCozyToast = document.getElementById('cozy-toast');
    elAmbientMasterBtn = document.getElementById('ambient-master-btn');
    elMainAudio = document.getElementById('main-audio');
    
    // Engine selector caching
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

    // --- Initialize PWA Service Worker, Lockscreen, and Mobile Navigation ---
    if (typeof registerServiceWorker === 'function') registerServiceWorker();
    if (typeof setupMediaSessionActions === 'function') setupMediaSessionActions();
    if (typeof initMobileNavigation === 'function') initMobileNavigation();

    // --- Initialize Premium Dark/Light Mode Theme Toggle ---
    if (typeof initThemeToggle === 'function') initThemeToggle();

    // --- Initialize one-tap mood + ambient session presets ---
    if (typeof initCozySessionPresets === 'function') initCozySessionPresets();

    // --- Hydrate cached active accent RGB value for visualizer performance ---
    if (typeof updateActiveAccentRgb === 'function') updateActiveAccentRgb();

    // --- Resilient Auto-fallback timer ---
    
    // --- Welcome notification toast ---
    setTimeout(() => {
      showToast("Jeff Bernat Cozy Lounge 🌙", "ยินดีต้อนรับเข้าสู่ช่วงเวลากรูฟนุ่ม ๆ สไตล์ R&B ค่ะ");
    }, 1000);
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
      if (elMainAudio.duration) {
        if (elTotalDurationDisplay) {
          const currentTrack = tracks[currentTrackIndex];
          const displayDuration = getCorrectedDuration(elMainAudio, currentTrack);
          elTotalDurationDisplay.textContent = formatTime(displayDuration);
        }
      }
    });

    elMainAudio.addEventListener('durationchange', () => {
      console.log("Audio duration change. Duration:", elMainAudio.duration);
      if (elMainAudio.duration) {
        if (elTotalDurationDisplay) {
          const currentTrack = tracks[currentTrackIndex];
          const displayDuration = getCorrectedDuration(elMainAudio, currentTrack);
          elTotalDurationDisplay.textContent = formatTime(displayDuration);
        }
      }
    });

    elMainAudio.addEventListener('timeupdate', () => {
      const currentTrack = tracks[currentTrackIndex];
      const currentTime = elMainAudio.currentTime;
      let duration = getCorrectedDuration(elMainAudio, currentTrack);
      
      // Handle double-duration bug manual advance if we have accurate track duration
      if (currentTrack && currentTrack.trackDuration && elMainAudio.duration > currentTrack.trackDuration * 1.5) {
        if (currentTime >= currentTrack.trackDuration - 0.5) {
          console.log("Accurate duration limit reached, advancing track.");
          nextTrack(true);
          return;
        }
      }
      
      // Fallback: Automatic stuck playback detection for local tracks
      if (elMainAudio.duration > 30 && !elMainAudio.paused && isPlaying && elMainAudio.readyState >= 3 && !elMainAudio.seeking) {
        if (currentTime === lastHtml5Time) {
          html5TimeUnchangedCount++;
          if (html5TimeUnchangedCount >= 5) { // Unchanged for ~1.25s (timeupdate fires ~4 times/sec)
            const ratio = currentTime / elMainAudio.duration;
            if (ratio >= 0.45 && ratio <= 0.55) {
              console.warn("Double-duration bug detected (stuck around 50%). Forcing next track.");
              html5TimeUnchangedCount = 0;
              nextTrack(true);
              return;
            }
          }
        } else {
          html5TimeUnchangedCount = 0;
          lastHtml5Time = currentTime;
        }
      }
      
      if (duration > 0) {
        const progressPercent = Math.min((currentTime / duration) * 100, 100);
        if (elProgressFill) elProgressFill.style.width = `${progressPercent}%`;
        if (elCurrentTimeDisplay) elCurrentTimeDisplay.textContent = formatTime(currentTime);
        if (elTotalDurationDisplay) {
          elTotalDurationDisplay.textContent = formatTime(duration);
        }
        syncLyricsHighlight(currentTime);
      }
    });

    elMainAudio.addEventListener('ended', () => {
      console.log("Audio track ended.");
      if (isRepeat) {
        // Repeat mode: replay the same track from the beginning
        elMainAudio.currentTime = 0;
        elMainAudio.play().catch(e => console.warn("Repeat play failed:", e));
      } else {
        nextTrack(true); // Force auto-advance play!
      }
    });

    elMainAudio.addEventListener('error', (e) => {
      console.warn("HTML5 Audio error occurred:", e);
      showToast("Audio Error ⚠️", "ไม่สามารถเล่นเพลงนี้ได้ กำลังข้ามไปเพลงถัดไปค่ะ");
      nextTrack(true);
    });
  }

  if (elPlayBtn) {
    elPlayBtn.addEventListener('click', () => {
      if (isPlaying) pauseAudio();
      else playAudio();
    });
  }

  if (elNextBtn) elNextBtn.addEventListener('click', () => nextTrack());
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
  
  const elFolderFilter = document.getElementById('folder-filter');
  if (elFolderFilter) {
    elFolderFilter.addEventListener('change', (e) => {
      currentFolderFilter = e.target.value;
      renderLibrary();
    });
  }
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
        clearCozySessionPreset();
        updateAmbientChannelVolume(soundKey, e.target.value);
        if (!isAmbientOn) toggleMasterAmbient();
      });
    }
    
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        clearCozySessionPreset();
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

function renderPlaylistsNav() {
  const container = document.getElementById('playlist-nav-container');
  if (!container) return;
  container.innerHTML = '';
  playlists.forEach(pl => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fa-solid fa-music"></i> ${pl.name}`;
    li.style.paddingLeft = "30px";
    li.style.cursor = "pointer";
    li.onclick = () => {
      currentPlaylistFilter = pl.id;
      currentFolderFilter = 'all';
      renderLibrary();
    };
    container.appendChild(li);
  });
}

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
  
  if (currentFolderFilter !== 'all') {
    filteredTracks = filteredTracks.filter(t => (t.folder || 'Uncategorized') === currentFolderFilter);
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
        <div class="song-item-album">${track.collectionName} ${track.folder && track.folder !== 'Uncategorized' ? `• 📁 ${track.folder}` : ''}</div>
      </div>
      <div class="song-item-duration">${getActiveDurationLabel(track)}</div>
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




// --- 16. Volume System ---
function handleVolumeChange() {
  if (!elPlayerVolume) return;
  const vol = elPlayerVolume.value;
  
  // Update HTML5 audio volume (0.0 to 1.0)
  if (elMainAudio) {
    elMainAudio.volume = vol / 100;
  }
  
  
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
  const isAdding = index === -1;
  if (isAdding) {
    favorites.push(id);
    if (heartBtnElement) {
      heartBtnElement.classList.add('active');
      heartBtnElement.querySelector('i').className = 'fa-solid fa-heart';
    }
    // 💖 Love Confetti burst!
    if (typeof spawnLoveConfetti === 'function') {
      const rect = heartBtnElement ? heartBtnElement.getBoundingClientRect() : null;
      spawnLoveConfetti(rect);
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
        // 💖 Love Confetti from main heart button too
        if (typeof spawnLoveConfetti === 'function') {
          spawnLoveConfetti(elHeartCurrentBtn.getBoundingClientRect());
        }
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

// --- 18. Environment Theme, Session Presets & Weather Particles Engine ---
function setBodyThemeClass(targetTheme) {
  if (!elBody) return;
  elBody.classList.remove('theme-rain', 'theme-cafe', 'theme-study', 'theme-sakura', 'theme-candle');
  elBody.classList.add(`theme-${targetTheme}`);
  // Update romantic particles when theme changes
  if (typeof updateRomanticParticles === 'function') updateRomanticParticles(targetTheme);
}

function updateSessionPresetUI() {
  elSessionPresetBtns.forEach(btn => {
    const isActive = btn.getAttribute('data-session-preset') === currentSessionPreset;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  if (elBody) {
    if (currentSessionPreset) {
      elBody.dataset.session = currentSessionPreset;
    } else {
      delete elBody.dataset.session;
    }
  }
}

function clearCozySessionPreset() {
  if (!currentSessionPreset) return;
  currentSessionPreset = null;
  ambientVisualIntensity = 1;
  localStorage.removeItem(STORAGE_KEY_SESSION);
  updateSessionPresetUI();
  resetAmbientCanvas();
}

function applyCozySessionPreset(presetKey, options = {}) {
  const preset = SESSION_PRESETS[presetKey];
  if (!preset) return;

  currentSessionPreset = presetKey;
  ambientVisualIntensity = preset.visualIntensity || 1;
  localStorage.setItem(STORAGE_KEY_SESSION, presetKey);

  changeMoodTheme(preset.theme, { keepSessionPreset: true, skipDefaultVolumes: true });

  Object.entries(preset.volumes).forEach(([soundKey, value]) => {
    updateAmbientChannelVolume(soundKey, value);
  });

  if (preset.ambientOn && options.activateAmbient && !isAmbientOn) {
    toggleMasterAmbient();
  } else if (!preset.ambientOn && isAmbientOn) {
    toggleMasterAmbient();
  }

  updateSessionPresetUI();
  resetAmbientCanvas();

  if (options.notify !== false) {
    showToast(`Session: ${preset.label}`, preset.toast);
  }
}

function initCozySessionPresets() {
  elSessionPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyCozySessionPreset(btn.getAttribute('data-session-preset'), {
        activateAmbient: true,
        notify: true
      });
    });
  });

  if (currentSessionPreset && !SESSION_PRESETS[currentSessionPreset]) {
    currentSessionPreset = null;
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }

  if (currentSessionPreset && SESSION_PRESETS[currentSessionPreset]) {
    applyCozySessionPreset(currentSessionPreset, { activateAmbient: false, notify: false });
    return;
  }

  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedTheme && ['rain', 'cafe', 'study', 'sakura', 'candle'].includes(savedTheme)) {
    changeMoodTheme(savedTheme, { keepSessionPreset: true });
  } else {
    setBodyThemeClass(theme);
  }
  updateSessionPresetUI();
}

function changeMoodTheme(targetTheme, options = {}) {
  theme = targetTheme;
  localStorage.setItem(STORAGE_KEY_THEME, targetTheme);
  setBodyThemeClass(targetTheme);
  
  elMoodBtns.forEach(btn => {
    if (btn.getAttribute('data-theme') === targetTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (!options.skipDefaultVolumes) {
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
    } else if (targetTheme === 'sakura') {
      updateAmbientChannelVolume('rain', 20);
      updateAmbientChannelVolume('cafe', 0);
      updateAmbientChannelVolume('fireplace', 10);
    } else if (targetTheme === 'candle') {
      updateAmbientChannelVolume('rain', 0);
      updateAmbientChannelVolume('cafe', 10);
      updateAmbientChannelVolume('fireplace', 40);
    }
  }

  if (!options.keepSessionPreset) {
    currentSessionPreset = null;
    ambientVisualIntensity = 1;
    localStorage.removeItem(STORAGE_KEY_SESSION);
    updateSessionPresetUI();
  }

  // Update cached active accent color!
  if (typeof updateActiveAccentRgb === 'function') updateActiveAccentRgb();

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
  
  const baseCount = theme === 'rain' ? 80 : theme === 'cafe' ? 25 : theme === 'sakura' ? 40 : theme === 'candle' ? 20 : 35;
  const count = Math.max(12, Math.round(baseCount * ambientVisualIntensity));
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
      speed: (10 + Math.random() * 8) * Math.max(0.7, ambientVisualIntensity),
      opacity: (0.1 + Math.random() * 0.25) * Math.min(1.25, ambientVisualIntensity),
      angle: 4 + Math.random() * 2
    };
  } else if (theme === 'cafe') {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      radius: 2 + Math.random() * 5,
      speed: (0.4 + Math.random() * 0.6) * Math.max(0.7, ambientVisualIntensity),
      opacity: (0.05 + Math.random() * 0.15) * Math.min(1.3, ambientVisualIntensity),
      wobble: Math.random() * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02
    };
  } else if (theme === 'sakura') {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20,
      radius: 1.5 + Math.random() * 3,
      speed: (0.3 + Math.random() * 0.5) * Math.max(0.7, ambientVisualIntensity),
      opacity: (0.08 + Math.random() * 0.18) * Math.min(1.3, ambientVisualIntensity),
      wobble: Math.random() * 3,
      wobbleSpeed: 0.008 + Math.random() * 0.015,
      color: `hsl(${330 + Math.random() * 20}, 80%, ${65 + Math.random() * 20}%)`
    };
  } else if (theme === 'candle') {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      radius: 1 + Math.random() * 2.5,
      speed: (0.6 + Math.random() * 0.8) * Math.max(0.7, ambientVisualIntensity),
      opacity: (0.1 + Math.random() * 0.25) * Math.min(1.3, ambientVisualIntensity),
      flicker: Math.random() * Math.PI,
      color: `hsl(${35 + Math.random() * 15}, 95%, ${55 + Math.random() * 15}%)`
    };
  } else {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      radius: 1 + Math.random() * 3,
      speed: (0.8 + Math.random() * 1.2) * Math.max(0.7, ambientVisualIntensity),
      opacity: (0.1 + Math.random() * 0.3) * Math.min(1.3, ambientVisualIntensity),
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
    } else if (theme === 'sakura') {
      // Sakura: soft pink particles falling gently
      canvasCtx.fillStyle = p.color || `rgba(244, 114, 182, ${p.opacity})`;
      canvasCtx.globalAlpha = p.opacity;
      canvasCtx.beginPath();
      canvasCtx.arc(p.x + Math.sin(p.wobble) * 20, p.y, p.radius, 0, Math.PI * 2);
      canvasCtx.fill();
      canvasCtx.globalAlpha = 1;
      
      p.y += p.speed;
      p.x += Math.sin(p.wobble) * 0.3;
      p.wobble += p.wobbleSpeed;
      
      if (p.y > h + 20) {
        particles[idx] = createParticle(false);
      }
    } else if (theme === 'candle') {
      // Candle: warm golden embers rising with flicker
      const flickerOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.flicker));
      canvasCtx.fillStyle = p.color;
      canvasCtx.shadowColor = p.color;
      canvasCtx.shadowBlur = 12;
      canvasCtx.globalAlpha = flickerOpacity;
      
      canvasCtx.beginPath();
      canvasCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      canvasCtx.fill();
      
      canvasCtx.globalAlpha = 1;
      canvasCtx.shadowBlur = 0;
      
      p.y -= p.speed;
      p.flicker += 0.06;
      p.x += Math.sin(p.flicker) * 0.3;
      
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
function updateActiveAccentRgb() {
  if (isLightMode) {
    if (theme === 'rain') activeAccentRgb = '2, 132, 199';
    else if (theme === 'cafe') activeAccentRgb = '180, 83, 9';
    else if (theme === 'study') activeAccentRgb = '194, 65, 12';
  } else {
    if (theme === 'rain') activeAccentRgb = '56, 189, 248';
    else if (theme === 'cafe') activeAccentRgb = '234, 179, 8';
    else if (theme === 'study') activeAccentRgb = '249, 115, 22';
  }
}

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
    grad.addColorStop(0, `rgba(${activeAccentRgb}, 0.04)`);
    grad.addColorStop(0.5, `rgba(${activeAccentRgb}, 0.22)`);
    grad.addColorStop(1, `rgba(${activeAccentRgb}, 0.48)`);
    
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

// --- 21. Progressive Web App (PWA) Service Worker Registration ---
// Registers the service worker to enable background audio playback on mobile
// and offline caching of the app shell. The SW must stay active for iOS/Android
// to allow audio to continue playing when the screen is locked or app is switched.
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('Cozy Player: Service Worker registered successfully. Scope:', registration.scope);
        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('Cozy Player: New Service Worker activated.');
              }
            });
          }
        });
      })
      .catch(err => {
        console.warn('Cozy Player: Service Worker registration failed:', err);
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
      
      // Build artwork array with multiple sizes for Android notification tray compatibility
      const artworkList = [
        { src: absoluteCoverUrl, sizes: '96x96', type: 'image/png' },
        { src: absoluteCoverUrl, sizes: '128x128', type: 'image/png' },
        { src: absoluteCoverUrl, sizes: '256x256', type: 'image/png' },
        { src: absoluteCoverUrl, sizes: '512x512', type: 'image/png' }
      ];
      // Add large artwork if available
      if (track.artworkUrl100) {
        artworkList.push({ src: track.artworkUrl100, sizes: '512x512', type: 'image/jpeg' });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.trackName,
        artist: 'Jeff Bernat',
        album: track.collectionName,
        artwork: artworkList
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
        if (!isPlaying) playAudio();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack(true);
      });

      // Stop handler — clears notification and stops playback completely
      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          pauseAudio();
          if (elMainAudio) {
            elMainAudio.currentTime = 0;
          }
          navigator.mediaSession.playbackState = 'none';
        });
      } catch(e) {}

      // Seek-to handler for Android notification seek bar
      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) {
            if (isHtml5AudioEngine() && elMainAudio) {
              elMainAudio.currentTime = details.seekTime;
            } else if (isYtReady && ytPlayer) {
              ytPlayer.seekTo(details.seekTime, true);
            }
          }
        });
      } catch(e) {}

      // Explicitly disable seek-forward/backward so iOS shows ⏮️/⏭️ 
      // instead of ⏪10s/⏩10s on the lock screen
      try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch(e) {}
      try { navigator.mediaSession.setActionHandler('seekforward', null); } catch(e) {}

      console.log("Media Session lock screen actions registered (with Previous/Next priority).");
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

// Central tracks state resolver (incorporates built-in, custom, and excludes hidden)
function resolveTracksList() {
  tracks = [];
  
  // Filter out hidden custom tracks
  const visibleCustom = customTracks.filter(t => !hiddenTrackIds.includes(t.trackId));
  tracks = [...visibleCustom];
  
  console.log(`Resolved library: ${tracks.length} local tracks.`);
}

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    // Upgraded to Version 2 for Playlists Support
    const request = indexedDB.open('CozyPlayerDB', 2);
    
    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      cozyDB = event.target.result;
      resolve(cozyDB);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('custom_tracks')) {
          db.createObjectStore('custom_tracks', { keyPath: 'trackId' });
        }
      }
      
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      }
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
      const activeTrack = tracks[currentTrackIndex];
      const activeTrackId = activeTrack ? activeTrack.trackId : null;
      
      // Clear previously active base64 / blob URLs to prevent memory leak EXCEPT for the currently playing track
      customTracks.forEach(t => {
        if (t.trackId === activeTrackId) return; // Skip active track to prevent audio interruption
        if (t.localUrl && t.localUrl.startsWith('blob:')) {
          URL.revokeObjectURL(t.localUrl);
        }
        if (t.artworkUrl100 && t.artworkUrl100.startsWith('blob:')) {
          URL.revokeObjectURL(t.artworkUrl100);
        }
      });
      
      const results = request.result || [];
      customTracks = results.map(track => {
        if (track.trackId === activeTrackId && activeTrack && activeTrack.localUrl) {
          // Re-use active track's working Blob URLs to avoid disrupting active playback
          track.previewUrl = activeTrack.previewUrl;
          track.localUrl = activeTrack.localUrl;
          track.artworkUrl100 = activeTrack.artworkUrl100;
        } else {
          // Hydrate Blob references to browser-playable Blob URLs!
          if (track.audioBlob) {
            const url = URL.createObjectURL(track.audioBlob);
            track.previewUrl = url;
            track.localUrl = url;
          }
          if (track.artworkBlob) {
            track.artworkUrl100 = URL.createObjectURL(track.artworkBlob);
          }
        }
        track.isCustom = true;
        if (!track.folder) track.folder = "Uncategorized";
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
  const editFolder = document.getElementById('edit-track-folder');
  
  if (editTitle) editTitle.value = track.trackName || '';
  if (editAlbum) editAlbum.value = track.collectionName || '';
  if (editYear) editYear.value = track.releaseDate ? new Date(track.releaseDate).getFullYear() : 2026;
  if (editGenre) editGenre.value = track.primaryGenreName || 'R&B/Soul';
  if (editFolder) editFolder.value = track.folder || 'Uncategorized';
  
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
            // Check if the deleted song is the currently playing one
            const isPlayingDeletedTrack = (tracks[currentTrackIndex] && tracks[currentTrackIndex].trackId === track.trackId);
            
            deleteCustomTrackFromDB(track.trackId)
              .then(() => loadCustomTracksFromDB())
              .then(() => {
                resolveTracksList();
                
                if (isPlayingDeletedTrack) {
                  // Safely move active pointer and pause audio to prevent media decode crashes
                  if (tracks.length > 0) {
                    loadTrack(0);
                    if (elMainAudio) elMainAudio.pause();
                    if (isPlaying) {
                      isPlaying = false;
                      updatePlayerUIPlaying(false);
                    }
                  } else {
                    if (elMainAudio) elMainAudio.pause();
                    isPlaying = false;
                    updatePlayerUIPlaying(false);
                    if (elTrackTitleMain) elTrackTitleMain.textContent = "ไม่มีเพลงในคลัง";
                    if (elTrackAlbumMain) elTrackAlbumMain.textContent = "";
                  }
                }
                
                renderLibrary();
                updateDashboardStats();
                renderDashboardCatalog();
                showToast("ลบเพลงสำเร็จ! 🗑️", `ลบเพลง "${track.trackName}" เรียบร้อยแล้วค่ะ`);
              });
          }
        } else {
          // Hide built-in track
          const isPlayingDeletedTrack = (tracks[currentTrackIndex] && tracks[currentTrackIndex].trackId === track.trackId);
          hiddenTrackIds.push(track.trackId);
          localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(hiddenTrackIds));
          resolveTracksList();
          
          if (isPlayingDeletedTrack) {
            if (tracks.length > 0) {
              loadTrack(0);
              if (elMainAudio) elMainAudio.pause();
              if (isPlaying) {
                isPlaying = false;
                updatePlayerUIPlaying(false);
              }
            } else {
              if (elMainAudio) elMainAudio.pause();
              isPlaying = false;
              updatePlayerUIPlaying(false);
            }
          }
          
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
      const folder = document.getElementById('track-folder') ? document.getElementById('track-folder').value.trim() : "Uncategorized";
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
      
      // Parse year safely to prevent RangeErrors
      const parsedYear = year ? parseInt(year, 10) : new Date().getFullYear();
      const validYear = isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100 ? new Date().getFullYear() : parsedYear;
      
      showToast("กำลังประมวลผล... ⏳", "บันทึกเพลงระดับสตูดิโอเข้าหน่วยความจำบราวเซอร์...");
      
      const duration = await getDurationFromAudioFile(audioFile);
      
      const customTrack = {
        trackId: trackId,
        trackName: title,
        collectionName: album,
        artworkUrl100: artworkUrl100,
        artworkBlob: artworkBlob,
        audioBlob: audioFile,
        releaseDate: new Date(validYear, 0, 1).toISOString(),
        primaryGenreName: genre,
        trackViewUrl: '#',
        isCustom: true,
        folder: folder || "Uncategorized",
        trackDuration: duration > 0 ? duration : null
      };
      
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
      const folder = document.getElementById('edit-track-folder') ? document.getElementById('edit-track-folder').value.trim() : "Uncategorized";
      
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
            
            // Parse year safely to prevent RangeErrors
            const parsedYear = year ? parseInt(year, 10) : new Date().getFullYear();
            const validYear = isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100 ? new Date().getFullYear() : parsedYear;
            
            customTrack.releaseDate = new Date(validYear, 0, 1).toISOString();
            customTrack.primaryGenreName = genre;
            customTrack.folder = folder || "Uncategorized";
            
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



// --- 26. Premium Dark/Light Mode Theme Toggle Controller ---
function initThemeToggle() {
  console.log("Initializing Dark/Light Mode Theme Switcher...");
  
  const elThemeToggleBtn = document.getElementById('theme-toggle-btn');
  if (elThemeToggleBtn) {
    // 1. Hydrate theme state immediately on DOM load
    if (isLightMode) {
      document.body.classList.add('light-mode');
      elThemeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      document.body.classList.remove('light-mode');
      elThemeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    
    // 2. Click transition listener
    elThemeToggleBtn.addEventListener('click', () => {
      isLightMode = !isLightMode;
      localStorage.setItem('jeff_bernat_light_mode', isLightMode);
      
      if (isLightMode) {
        document.body.classList.add('light-mode');
        elThemeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        showToast("Light Mode ☀️", "สลับโหมดถนอมสายตากลางวันเรียบร้อยแล้วค่ะ");
      } else {
        document.body.classList.remove('light-mode');
        elThemeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        showToast("Dark Mode 🌙", "สลับโหมดถนอมสายตากลางคืนเรียบร้อยแล้วค่ะ");
      }
      
      // Refresh cached accent color for the visualizer to match the new mode
      if (typeof updateActiveAccentRgb === 'function') updateActiveAccentRgb();
    });
    
    console.log("Theme Toggle initialized successfully.");
  }
}

// ==========================================================================
// --- 27. Love Confetti 💖 — Heart Burst on Favorite ---
// ==========================================================================
function spawnLoveConfetti(originRect) {
  const container = document.getElementById('love-confetti-container');
  if (!container) return;

  const heartEmojis = ['💖', '💕', '💗', '💓', '💝', '❤️', '🩷', '🌸', '✨'];
  const count = 18 + Math.floor(Math.random() * 8);

  const cx = originRect ? (originRect.left + originRect.width / 2) : window.innerWidth / 2;
  const cy = originRect ? (originRect.top + originRect.height / 2) : window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'love-heart-particle';
    el.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];

    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 60;
    const scale = 0.6 + Math.random() * 0.8;
    const delay = Math.random() * 0.4;
    const duration = 1.6 + Math.random() * 1.2;

    el.style.left = `${cx + offsetX}px`;
    el.style.top = `${cy + offsetY}px`;
    el.style.fontSize = `${scale * 1.4}rem`;
    el.style.animationDelay = `${delay}s`;
    el.style.animationDuration = `${duration}s`;

    container.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, (delay + duration) * 1000 + 200);
  }
}

// ==========================================================================
// --- 28. Floating Romantic Quotes ✨ ---
// ==========================================================================
const ROMANTIC_QUOTES = [
  '"You are my today and all of my tomorrows." — Leo Christopher',
  '"I love you not only for what you are, but for what I am when I am with you."',
  '"Every love story is beautiful, but ours is my favorite." 💕',
  '"In all the world, there is no heart for me like yours." — Maya Angelou',
  '"You are the finest, loveliest, tenderest person I have ever known." — F. Scott Fitzgerald',
  '"I have found the one whom my soul loves." — Song of Solomon',
  '"Wherever you are is my home." 🏡',
  '"You make my heart smile." 💗',
  '"Love is composed of a single soul inhabiting two bodies." — Aristotle',
  '"I fell in love the way you fall asleep: slowly, then all at once." — John Green',
  '"คนรักกันไม่จำเป็นต้องเห็นตา แค่รู้สึกก็พอ" 🌙',
  '"รักเธอเท่าฟ้า สุดปลายขอบจักรวาล" ✨',
  '"ทุกวันที่มีเธอ คือวันที่สวยที่สุด" 🌸',
  '"เพราะเพลงนี้ ทำให้คิดถึงเธอ" 🎵',
  '"แค่ได้อยู่ข้างเธอ ก็เพียงพอแล้ว" 💖',
  '"Love looks not with the eyes, but with the mind." — Shakespeare',
  '"The best thing to hold onto in life is each other." — Audrey Hepburn',
  '"You are my sun, my moon, and all my stars." — E.E. Cummings',
  '"I choose you. And I\'ll choose you over and over." 💝',
  '"A simple \'I love you\' means more than money." — Frank Sinatra'
];

let floatingQuoteInterval = null;

function spawnFloatingQuote() {
  const container = document.getElementById('floating-quotes-container');
  if (!container) return;

  // Limit max visible quotes to avoid performance issues
  if (container.children.length > 3) return;

  const quote = ROMANTIC_QUOTES[Math.floor(Math.random() * ROMANTIC_QUOTES.length)];
  const el = document.createElement('div');
  el.className = 'floating-quote';
  el.textContent = quote;

  const yPos = 15 + Math.random() * 70; // between 15% and 85% of viewport height
  el.style.top = `${yPos}%`;
  el.style.right = '-100%';

  const duration = 14 + Math.random() * 10;
  el.style.animationDuration = `${duration}s`;

  container.appendChild(el);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, duration * 1000 + 500);
}

function startFloatingQuotes() {
  if (floatingQuoteInterval) return;
  // Spawn one immediately
  spawnFloatingQuote();
  // Then every 15-25 seconds
  floatingQuoteInterval = setInterval(() => {
    spawnFloatingQuote();
  }, 15000 + Math.random() * 10000);
}

function stopFloatingQuotes() {
  if (floatingQuoteInterval) {
    clearInterval(floatingQuoteInterval);
    floatingQuoteInterval = null;
  }
  const container = document.getElementById('floating-quotes-container');
  if (container) container.innerHTML = '';
}

// ==========================================================================
// --- 29. Romantic Particles (Sakura Petals / Candle Sparks) 🌸🕯️ ---
// ==========================================================================
let romanticParticleInterval = null;

function spawnRomanticParticle(type) {
  const container = document.getElementById('romantic-particles');
  if (!container) return;

  // Limit particles for performance
  if (container.children.length > 20) return;

  const el = document.createElement('div');

  if (type === 'sakura') {
    el.className = 'sakura-petal';
    const size = 8 + Math.random() * 10;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${Math.random() * 100}%`;
    el.style.top = '-20px';

    const duration = 8 + Math.random() * 8;
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `${Math.random() * 2}s`;

    // Randomize petal rotation starting point
    const hue = 330 + Math.random() * 30;
    el.style.filter = `drop-shadow(0 0 4px hsla(${hue}, 80%, 70%, 0.3)) hue-rotate(${Math.random() * 20 - 10}deg)`;

    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, (duration + 2) * 1000 + 500);

  } else if (type === 'candle') {
    el.className = 'candle-spark';
    const size = 2 + Math.random() * 4;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${20 + Math.random() * 60}%`;
    el.style.bottom = '0';

    const duration = 6 + Math.random() * 6;
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `${Math.random() * 1.5}s`;

    // Vary warmth
    const warm = Math.random() > 0.5;
    if (warm) {
      el.style.background = 'radial-gradient(circle, #fef3c7, #f59e0b)';
      el.style.boxShadow = '0 0 8px 3px rgba(245, 158, 11, 0.5)';
    }

    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, (duration + 1.5) * 1000 + 500);
  }
}

function updateRomanticParticles(currentTheme) {
  // Clear existing particles
  if (romanticParticleInterval) {
    clearInterval(romanticParticleInterval);
    romanticParticleInterval = null;
  }
  const container = document.getElementById('romantic-particles');
  if (container) container.innerHTML = '';

  if (currentTheme === 'sakura') {
    // Spawn initial batch
    for (let i = 0; i < 6; i++) {
      setTimeout(() => spawnRomanticParticle('sakura'), i * 400);
    }
    // Continuous petals
    romanticParticleInterval = setInterval(() => {
      spawnRomanticParticle('sakura');
    }, 1500 + Math.random() * 1000);
    // Start floating quotes with sakura theme
    startFloatingQuotes();
  } else if (currentTheme === 'candle') {
    // Spawn initial batch
    for (let i = 0; i < 4; i++) {
      setTimeout(() => spawnRomanticParticle('candle'), i * 300);
    }
    // Continuous candle sparks
    romanticParticleInterval = setInterval(() => {
      spawnRomanticParticle('candle');
    }, 2000 + Math.random() * 1500);
    // Start floating quotes with candle theme
    startFloatingQuotes();
  } else {
    // Non-romantic themes: stop floating quotes
    stopFloatingQuotes();
  }
}

// ==========================================================================
// --- 30. Initialize Romantic Features on DOM Ready ---
// ==========================================================================
(function initRomanticFeatures() {
  // Wait for DOMContentLoaded to ensure all elements are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRomanticFeatures);
  } else {
    // DOM already loaded, init directly (in case script runs late)
    bootstrapRomanticFeatures();
  }

  function bootstrapRomanticFeatures() {
    console.log("🌸 Initializing Romantic Features...");

    // If current theme is sakura or candle, start particles immediately
    const currentTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (currentTheme === 'sakura' || currentTheme === 'candle') {
      setTimeout(() => {
        updateRomanticParticles(currentTheme);
      }, 1500); // Small delay to let the main app load first
    }

    console.log("💖 Romantic Features initialized: Love Confetti, Floating Quotes, Sakura Petals, Candle Sparks");
  }
})();



function openContextMenu(e, trackId) {
  const menu = document.getElementById('track-context-menu');
  if (!menu) return;
  menu.style.display = 'flex';
  
  // Position menu
  let x = e.clientX;
  let y = e.clientY;
  
  // Adjust if out of bounds
  if (x + 200 > window.innerWidth) x = window.innerWidth - 200;
  if (y + 300 > window.innerHeight) y = window.innerHeight - 300;
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  // Attach trackId to the menu
  menu.dataset.trackId = trackId;
  
  // Populate Folders
  const folderOpt = document.getElementById('ctx-folder-options');
  if (folderOpt) {
    const folders = [...new Set(customTracks.map(t => t.folder || 'Uncategorized'))];
    folderOpt.innerHTML = `<button id="ctx-new-folder"><i class="fa-solid fa-plus"></i> แฟ้มใหม่...</button><div class="ctx-divider"></div>`;
    folders.forEach(f => {
      folderOpt.innerHTML += `<button onclick="moveTrackToFolder('${trackId}', '${f}')"><i class="fa-regular fa-folder"></i> ${f}</button>`;
    });
    
    document.getElementById('ctx-new-folder').onclick = () => {
      const folderName = prompt("ใส่ชื่อโฟลเดอร์ใหม่:");
      if (folderName) moveTrackToFolder(trackId, folderName.trim());
    };
  }
}

function moveTrackToFolder(trackId, folderName) {
  const track = customTracks.find(t => t.trackId === trackId);
  if (track) {
    track.folder = folderName;
    saveCustomTrackToDB(track);
    document.getElementById('track-context-menu').style.display = 'none';
    updateFolderDropdowns();
    renderLibrary();
    showToast("สำเร็จ 🎉", `ย้ายเพลงไปที่โฟลเดอร์ ${folderName} แล้ว`);
  }
}

// Close Context Menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('track-context-menu');
  if (menu && menu.style.display === 'flex' && !e.target.closest('.context-menu')) {
    menu.style.display = 'none';
  }
});

// Setup Playback Speed and Mini Player global hooks
document.addEventListener('DOMContentLoaded', () => {
  const speedBtn = document.getElementById('btn-playback-speed');
  if (speedBtn) {
    let speeds = [1.0, 1.25, 1.5, 2.0, 0.5];
    let currentSpeedIdx = 0;
    speedBtn.addEventListener('click', () => {
      currentSpeedIdx = (currentSpeedIdx + 1) % speeds.length;
      appSettings.playbackSpeed = speeds[currentSpeedIdx];
      speedBtn.textContent = appSettings.playbackSpeed + 'x';
      if (elMainAudio) elMainAudio.playbackRate = appSettings.playbackSpeed;
    });
  }
  
  const miniBtn = document.getElementById('btn-mini-player');
  if (miniBtn) {
    miniBtn.addEventListener('click', () => {
      document.body.classList.toggle('mini-player-active');
    });
  }
  
  // Library Search and Filters
  const libSearch = document.getElementById('lib-search');
  if (libSearch) libSearch.addEventListener('input', renderLibrary);
  
  const libSort = document.getElementById('lib-sort-select');
  if (libSort) {
    libSort.addEventListener('change', () => {
      currentSort = libSort.value;
      renderLibrary();
    });
  }
  
  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Prevent if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      isPlaying ? pauseAudio() : playAudio();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nextTrack();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      prevTrack();
    }
  });
});



// --- Data Management (Backup / Restore) ---
document.addEventListener('DOMContentLoaded', () => {
  const btnBackup = document.getElementById('btn-backup-db');
  const btnRestore = document.getElementById('btn-restore-db');
  const fileInput = document.getElementById('restore-file-input');

  if (btnBackup) {
    btnBackup.addEventListener('click', () => {
      // Export metadata (without heavy binary blobs)
      const exportData = customTracks.map(t => {
        const tCopy = { ...t };
        delete tCopy.file; // Don't export raw File objects
        // We will keep artworkUrl100 (which is base64), but it could be huge.
        // It's acceptable for standard JSON backup.
        return tCopy;
      });
      
      const backupObj = {
        version: 2,
        tracks: exportData,
        playlists: playlists
      };
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", "cozy_music_backup_" + Date.now() + ".json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showToast("แบ็คอัพสำเร็จ 💾", "ดาวน์โหลดไฟล์ข้อมูลเพลงเรียบร้อยแล้ว");
    });
  }

  if (btnRestore && fileInput) {
    btnRestore.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupObj = JSON.parse(e.target.result);
          if (backupObj && backupObj.tracks) {
            // Merge tracks
            let added = 0;
            const t = cozyDB.transaction(['custom_tracks', 'playlists'], 'readwrite');
            const trackStore = t.objectStore('custom_tracks');
            backupObj.tracks.forEach(track => {
              if (!customTracks.find(existing => existing.trackId === track.trackId)) {
                trackStore.put(track);
                customTracks.push(track);
                added++;
              }
            });
            
            if (backupObj.playlists) {
              const pStore = t.objectStore('playlists');
              backupObj.playlists.forEach(pl => {
                if (!playlists.find(existing => existing.id === pl.id)) {
                  pStore.put(pl);
                  playlists.push(pl);
                }
              });
            }
            
            t.oncomplete = () => {
              showToast("กู้คืนสำเร็จ ♻️", `กู้คืนข้อมูลเพลง ${added} รายการแล้ว (ไฟล์เสียงจริงต้องอัพโหลดใหม่ผ่านโฟลเดอร์เดิม)`);
              renderLibrary();
              renderPlaylistsNav();
              updateFolderDropdowns();
            };
          }
        } catch(err) {
          showToast("ข้อผิดพลาด", "ไฟล์ Backup ไม่ถูกต้อง");
          console.error(err);
        }
      };
      reader.readAsText(file);
    });
  }
});



// Context Menu Actions Handlers
document.addEventListener('DOMContentLoaded', () => {
  const ctxPlay = document.getElementById('ctx-play');
  const ctxFav = document.getElementById('ctx-fav');
  const ctxDelete = document.getElementById('ctx-delete');
  const menu = document.getElementById('track-context-menu');
  
  if (ctxPlay) {
    ctxPlay.addEventListener('click', () => {
      const trackId = menu.dataset.trackId;
      const index = tracks.findIndex(t => t.trackId === trackId);
      if (index !== -1) {
        loadTrack(index);
        playAudio();
      }
      menu.style.display = 'none';
    });
  }
  
  if (ctxFav) {
    ctxFav.addEventListener('click', () => {
      const trackId = menu.dataset.trackId;
      const track = customTracks.find(t => t.trackId === trackId);
      if (track) {
        track.isFavorite = !track.isFavorite;
        saveCustomTrackToDB(track);
        renderLibrary();
      }
      menu.style.display = 'none';
    });
  }
  
  if (ctxDelete) {
    ctxDelete.addEventListener('click', () => {
      const trackId = menu.dataset.trackId;
      if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบเพลงนี้ออกจากระบบ?")) {
        deleteCustomTrackFromDB(trackId); // Delete from DB
        const idx = customTracks.findIndex(t => t.trackId === trackId);
        if (idx > -1) customTracks.splice(idx, 1);
        renderLibrary();
      }
      menu.style.display = 'none';
    });
  }
});
