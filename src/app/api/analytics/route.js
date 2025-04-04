import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import StreamData from '@/models/StreamData';
import Release from '@/models/Release';
import Artist from '@/models/Artist';
import mongoose from 'mongoose';

/**
 * GET /api/analytics
 * Get analytics data with various filters
 */
export async function GET(request) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const release = searchParams.get('release');
    const artist = searchParams.get('artist');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    // Initialize default response in case of errors
    let analyticsData = [];
    let recentReports = [];
    let artistsWithData = [];
    let currentArtist = null;
    
    // Build query
    const query = {};
    
    // Filter by release
    if (release && mongoose.Types.ObjectId.isValid(release)) {
      query.releaseId = new mongoose.Types.ObjectId(release);
    }
    
    // Filter by artist - need to find all releases by this artist first
    if (artist && mongoose.Types.ObjectId.isValid(artist)) {
      const artistReleases = await Release.find({
        artists: new mongoose.Types.ObjectId(artist)
      }).select('_id').lean();
      
      const releaseIds = artistReleases.map(r => r._id);
      
      if (releaseIds.length > 0) {
        query.releaseId = { $in: releaseIds };
      } else {
        // If artist has no releases, return empty result
        return NextResponse.json({
          analytics: [],
          recentReports: [],
          artists: [],
          currentArtist: null
        });
      }
    }
    
    // Date filtering
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    
    // Get total streams per release - use the latest report data for each release
    // LANDR reports provide lifetime totals, so we want the latest data point
    let streamSummary = [];
    try {
      streamSummary = await StreamData.aggregate([
        { $match: query },
        { $sort: { date: -1 } },
        {
          $group: {
            _id: '$releaseId',
            landrTrackId: { $first: '$landrTrackId' },
            latestData: { $first: '$$ROOT' },
            totalStreams: { $max: '$streams.count' }, // Use max to get the latest lifetime total
            totalDownloads: { $max: '$downloads.count' }, // Use max for downloads too
            latestDate: { $max: '$date' },
          }
        },
        { $sort: { totalStreams: -1 } },
        { $limit: limit }
      ]);
    } catch (aggregateError) {
      console.error('Error aggregating stream data:', aggregateError);
      // Continue with empty array instead of failing
      streamSummary = [];
    }
    
    // Get release details with populated artists
    let releases = [];
    try {
      const releaseIds = streamSummary.map(item => item._id).filter(Boolean);
      if (releaseIds.length > 0) {
        releases = await Release.find({
          _id: { $in: releaseIds }
        }).select('title slug coverImage artists').populate('artists', 'name slug image').lean();
      }
    } catch (releasesError) {
      console.error('Error fetching releases:', releasesError);
      // Continue with empty array
      releases = [];
    }
    
    // Create a lookup map for releases
    const releaseMap = {};
    releases.forEach(release => {
      releaseMap[release._id.toString()] = release;
    });
    
    // Merge data
    analyticsData = streamSummary.map(item => {
      const releaseId = item._id.toString();
      const release = releaseMap[releaseId] || {};
      
      return {
        releaseId,
        title: release.title || 'Unknown Release',
        slug: release.slug || '',
        coverImage: release.coverImage || '',
        artists: release.artists || [],
        landrTrackId: item.landrTrackId,
        totalStreams: item.totalStreams,
        totalDownloads: item.totalDownloads,
        latestDate: item.latestDate,
        latestData: {
          streams: item.latestData.streams,
          downloads: item.latestData.downloads,
        }
      };
    });
    
    // Get last 5 report dates
    try {
      recentReports = await StreamData.aggregate([
        { $sort: { date: -1 } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
        { $limit: 5 },
        { $sort: { _id: -1 } }
      ]);
      recentReports = recentReports.map(r => r._id);
    } catch (reportsError) {
      console.error('Error fetching recent reports:', reportsError);
      recentReports = [];
    }
    
    // Get all artists who have releases with streaming data
    try {
      artistsWithData = await Artist.aggregate([
        { 
          $lookup: {
            from: 'releases',
            localField: '_id',
            foreignField: 'artists',
            as: 'releases'
          }
        },
        // Join with StreamData to find artists with stream data
        {
          $lookup: {
            from: 'streamdatas',
            localField: 'releases._id',
            foreignField: 'releaseId',
            as: 'streamData'
          }
        },
        {
          $match: {
            'releases': { $ne: [] },
            'streamData': { $ne: [] }  // Only artists with stream data
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            slug: 1,
            image: 1,
            releaseCount: { $size: '$releases' },
            totalReleases: { $size: '$releases' },
            totalStreams: { $sum: '$streamData.streams.count' }
          }
        },
        { $sort: { name: 1 } }
      ]);
    } catch (artistsError) {
      console.error('Error fetching artists with data:', artistsError);
      artistsWithData = [];
    }
    
    // Get current artist details if filtered by artist
    if (artist && mongoose.Types.ObjectId.isValid(artist)) {
      try {
        currentArtist = await Artist.findById(artist).select('name slug image').lean();
      } catch (artistError) {
        console.error('Error fetching current artist:', artistError);
        currentArtist = null;
      }
    }
    
    return NextResponse.json({
      analytics: analyticsData,
      recentReports: recentReports,
      artists: artistsWithData,
      currentArtist
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', message: error.message },
      { status: 500 }
    );
  }
}