// Removed axios and process imports as NocoDB logic is now in musicService
// import axios from 'axios';
// import process from 'process';
import { getAllMusicTracks } from './lib/musicService.js'; // Import the service function - Added .js extension

// Removed NocoDB Config - Handled by service
// const NOCODB_API_URL = process.env.NOCODB_API_URL;
// const NOCODB_AUTH_TOKEN = process.env.NOCODB_AUTH_TOKEN;
// const MUSIC_TABLE_NAME = 'MushyMedia Songs';
// const NOCODB_MUSIC_TABLE_ID = 'mdfijlqr28f4ojj';

// Removed initial config check - Service handles this
// if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) { ... }

export default async function handler(req, res) {
  // Allow requests from anywhere (adjust in production if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  // Config check removed - service handles it

  try {
    console.log(`[API Music Tracks] Calling music service to get all tracks...`);
    const tracks = await getAllMusicTracks(); // Use the imported service function
    console.log(`[API Music Tracks] Received ${tracks.length} tracks from service.`);

    // Service already formats tracks, no need to map here
    /*
    const formattedTracks = tracks.map(record => ({
      id: record['Song ID'], 
      name: record['Title'],
      url: record['Url (S3)'], 
      mood: record['Mood Tag'], 
      description: record['Description'],
      lufs: record['Lufs'],
      duration: record['Duration']
    }));
    */

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // Send tracks directly as received from the service
    res.end(JSON.stringify({ success: true, tracks: tracks })); 

  } catch (error) {
    console.error("[API Music Tracks] Error calling music service:", error.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    // Send error message from the service if available
    res.end(JSON.stringify({ success: false, error: error.message || 'Failed to fetch music tracks.' })); 
  }
} 