// src/app/artists/[slug]/page.jsx
import { notFound } from 'next/navigation';
import connectToDatabase, { cachedDbQuery } from '@/lib/db';
import Artist from '@/models/Artist';
import Release from '@/models/Release';
import ArtistProfile from '@/components/artists/ArtistProfile';
import { serializeMongoDB } from '@/lib/utils';
import { FullPageLoader } from '@/components/ui/LoadingSpinner';
import { FullPageError } from '@/components/ui/ErrorDisplay';
import { Suspense } from 'react';
import { createTimedCacheKey } from '@/lib/cache';

// Enable ISR (Incremental Static Regeneration) with revalidation
export const revalidate = 3600; // Revalidate this page every hour

export async function generateMetadata({ params }) {
  const { slug } = await params;
  
  // Use the cachedDbQuery utility for metadata generation
  const cacheKey = createTimedCacheKey('artist-metadata', { slug });
  
  const artist = await cachedDbQuery(
    async () => {
      await connectToDatabase();
      return Artist.findOne({ slug });
    },
    cacheKey,
    3600 // Cache for 1 hour
  );
  
  if (!artist) {
    return {
      title: 'Artist Not Found',
    };
  }
  
  const imageUrl = artist.profileImage || '/default-artist-profile.jpg';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://souldistribution.com';
  const canonicalUrl = `${baseUrl}/artists/${slug}`;
  
  // Generate structured data for artist
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    description: artist.bio,
    image: imageUrl,
    url: canonicalUrl,
    sameAs: [
      ...(artist.spotifyUrl ? [`https://open.spotify.com/artist/${artist.spotifyUrl}`] : []),
      ...(artist.youtubeUrl ? [`https://youtube.com/channel/${artist.youtubeUrl}`] : []),
      ...(artist.instagramUrl ? [`https://instagram.com/${artist.instagramUrl}`] : []),
    ],
  };
  
  const metadata = {
    title: `${artist.name} | Soul Distribution`,
    description: artist.bio || `Official page for ${artist.name}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${artist.name} | Soul Distribution`,
      description: artist.bio || `Discover music by ${artist.name}`,
      type: 'profile',
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${artist.name} profile image`,
        },
      ],
      profile: {
        firstName: artist.name.split(' ')[0],
        lastName: artist.name.split(' ').slice(1).join(' '),
        username: artist.slug,
      },
    },
    twitter: {
      card: 'summary_large_image',
      title: `${artist.name} | Soul Distribution`,
      description: artist.bio || `Discover music by ${artist.name}`,
      images: [imageUrl],
    },
  };
  
  return metadata;
}

// Implement data fetching with Next.js caching
async function getArtistData(slug) {
  // Create a stable cache key for this query
  const cacheKey = createTimedCacheKey('artist-data', { slug });
  
  // Use the cachedDbQuery utility to handle caching
  return cachedDbQuery(
    async () => {
      await connectToDatabase();
      const artist = await Artist.findOne({ slug }).lean();
      
      if (!artist) {
        return null;
      }
      
      const releases = await Release.find({ artists: artist._id })
        .populate('artists')
        .sort({ releaseDate: -1 })
        .lean();
      
      console.log(`Found ${releases.length} releases for artist ${artist.name} (ID: ${artist._id})`);
      
      const releasesWithArtistInfo = releases.map(release => {
        return {
          ...release,
          artistName: artist.name
        };
      });
      
      // Prepare the response data
      return {
        artist: serializeMongoDB(artist),
        releases: serializeMongoDB(releasesWithArtistInfo)
      };
    },
    cacheKey,
    3600 // Cache for 1 hour
  );
}

export default async function ArtistPage({ params }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<FullPageLoader text="Loading artist..." variant="headphones" />}>
      <ArtistPageContent slug={slug} />
    </Suspense>
  );
}

async function ArtistPageContent({ slug }) {
  try {
    const data = await getArtistData(slug);
    
    if (!data) {
      return <FullPageError errorType="artist_not_found" />;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://souldistribution.com';
    const canonicalUrl = `${baseUrl}/artists/${slug}`;

    // Generate JSON-LD data
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: data.artist.name,
      description: data.artist.bio,
      image: data.artist.profileImage,
      url: canonicalUrl,
      sameAs: [
        ...(data.artist.spotifyUrl ? [`https://open.spotify.com/artist/${data.artist.spotifyUrl}`] : []),
        ...(data.artist.youtubeUrl ? [`https://youtube.com/channel/${data.artist.youtubeUrl}`] : []),
        ...(data.artist.instagramUrl ? [`https://instagram.com/${data.artist.instagramUrl}`] : []),
      ],
    };
    
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ArtistProfile artist={data.artist} releases={data.releases} />
      </>
    );
  } catch (error) {
    console.error('Error loading artist:', error);
    return <FullPageError errorType="server" />;
  }
}