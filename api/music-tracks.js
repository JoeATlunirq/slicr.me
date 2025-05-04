import axios from 'axios';
import process from 'process';

// NocoDB Configuration - Read from environment
const NOCODB_API_URL = process.env.NOCODB_API_URL;
const NOCODB_AUTH_TOKEN = process.env.NOCODB_AUTH_TOKEN;
const MUSIC_TABLE_NAME = 'MushyMedia Songs'; // Use the exact table name
const NOCODB_MUSIC_TABLE_ID = 'mdfijlqr28f4ojj'; // The actual ID for API calls

// Check if required env vars are set
if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) {
  console.error("[API Music Tracks] Missing required NocoDB environment variables (NOCODB_API_URL, NOCODB_AUTH_TOKEN).");
}

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
  
  // Check for config errors during request time as well
  if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) {
     res.statusCode = 500;
     res.setHeader('Content-Type', 'application/json');
     res.end(JSON.stringify({ success: false, error: 'Server configuration error for music database.' }));
     return;
  }

  try {
    // Construct the URL to list records from the specified table
    // Ensure the table name is URL-encoded if it contains spaces or special chars
    // const listUrl = `${NOCODB_API_URL}/tables/${encodeURIComponent(MUSIC_TABLE_NAME)}/records`;
    // Construct URL using the Table ID
    const listUrl = `${NOCODB_API_URL}/tables/${NOCODB_MUSIC_TABLE_ID}/records`;
    console.log(`[API Music Tracks] Fetching from: ${listUrl}`);

    const headers = {
      'xc-token': NOCODB_AUTH_TOKEN
      // Add other headers if NocoDB requires them
    };

    const response = await axios.get(listUrl, { headers });

    // NocoDB usually nests the results in a "list" property
    const records = response.data?.list || []; 
    
    // Map NocoDB fields to a simpler format for the frontend
    // Adjust field names ("Song ID", "Title", "Url (S3)", "Mood Tag", "Description", "Lufs", "Duration") if they differ in NocoDB API response
    const formattedTracks = records.map(record => ({
      id: record['Song ID'], // Use the exact field name from NocoDB
      name: record['Title'],
      url: record['Url (S3)'], // Keep URL for backend use primarily
      mood: record['Mood Tag'], 
      description: record['Description'],
      lufs: record['Lufs'], // Add LUFS
      duration: record['Duration'] // Add Duration (assuming it's in seconds or a parseable format)
    }));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, tracks: formattedTracks }));

  } catch (error) {
    console.error("[API Music Tracks] Error fetching from NocoDB:", error.response?.data || error.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Failed to fetch music tracks.' }));
  }
} 