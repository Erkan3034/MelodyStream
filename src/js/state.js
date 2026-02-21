// =========================================
// MelodyStream — Application State
// Global variables and shared state
// =========================================

export const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

// YouTube Player State
export let youtubePlayer = null;
export let isYouTubeApiReady = false;
export let playerReady = false;
export let isPlaying = false;
export let progressInterval = null;

// Current Song & Playback
export let currentSong = null;
export let currentSongList = [];
export let currentView = 'home';

// Playback Modes
export let isShuffleOn = false;
export let isRepeatOn = false;

// Data
export let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
export let playlists = JSON.parse(localStorage.getItem('playlists')) || [];
export let playHistory = JSON.parse(localStorage.getItem('playHistory')) || [];
export let recommendedMusic = [];
export let lastSearchResults = [];
export let popularPlaylists = [];
export let user = null;

// State setters (since ES modules export by value for primitives)
export function setYoutubePlayer(player) { youtubePlayer = player; }
export function setYouTubeApiReady(ready) { isYouTubeApiReady = ready; }
export function setPlayerReady(ready) { playerReady = ready; }
export function setIsPlaying(playing) { isPlaying = playing; }
export function setProgressInterval(interval) { progressInterval = interval; }
export function setCurrentSong(song) { currentSong = song; }
export function setCurrentSongList(list) { currentSongList = list; }
export function setCurrentView(view) { currentView = view; }
export function setIsShuffleOn(on) { isShuffleOn = on; }
export function setIsRepeatOn(on) { isRepeatOn = on; }
export function setFavorites(favs) { favorites = favs; }
export function setPlaylists(pls) { playlists = pls; }
export function setPlayHistory(history) { playHistory = history; }
export function setRecommendedMusic(music) { recommendedMusic = music; }
export function setLastSearchResults(results) { lastSearchResults = results; }
export function setPopularPlaylists(pls) { popularPlaylists = pls; }
export function setUser(u) { user = u; }
