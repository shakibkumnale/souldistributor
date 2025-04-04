import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Artist from '@/models/Artist';
import Release from '@/models/Release';

export async function GET() {
  try {
    await connectToDatabase();
    
    // Count total artists - use a try/catch for each operation to prevent cascading failures
    let totalArtists = 0;
    try {
      totalArtists = await Artist.countDocuments();
    } catch (error) {
      console.error('Error counting artists:', error);
    }
    
    // Count total releases
    let totalReleases = 0;
    try {
      totalReleases = await Release.countDocuments();
    } catch (error) {
      console.error('Error counting releases:', error);
    }
    
    // Mock some statistics
    const totalStreams = 25000;
    const growthRate = 15;
    
    // Get counts of artists by plan type
    const planCounts = {
      basic: 0,
      pro: 0,
      premium: 0,
      aoc: 0
    };
    
    try {
      planCounts.basic = await Artist.countDocuments({ 'plans.type': 'basic', 'plans.status': 'active' });
      planCounts.pro = await Artist.countDocuments({ 'plans.type': 'pro', 'plans.status': 'active' });
      planCounts.premium = await Artist.countDocuments({ 'plans.type': 'premium', 'plans.status': 'active' });
      planCounts.aoc = await Artist.countDocuments({ 'plans.type': 'aoc', 'plans.status': 'active' });
    } catch (error) {
      console.error('Error counting artist plans:', error);
    }
    
    // Get top 5 artists by follower count
    let popularArtists = [];
    try {
      popularArtists = await Artist.find({})
        .sort({ 'spotifyData.followers': -1 })
        .limit(5)
        .lean();
    } catch (error) {
      console.error('Error fetching popular artists:', error);
    }
      
    const formattedArtists = popularArtists.map(artist => ({
      _id: artist._id.toString(),
      name: artist.name,
      slug: artist.slug,
      image: artist.image || (artist.spotifyData?.images?.[0]?.url),
      followers: artist.spotifyData?.followers || 0,
    }));
    
    return NextResponse.json({
      totalArtists,
      totalReleases,
      totalStreams,
      growthRate,
      planCounts,
      popularArtists: formattedArtists
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard statistics',
        totalArtists: 0,
        totalReleases: 0,
        totalStreams: 0,
        growthRate: 0,
        planCounts: { basic: 0, pro: 0, premium: 0, aoc: 0 },
        popularArtists: []
      },
      { status: 500 }
    );
  }
} 