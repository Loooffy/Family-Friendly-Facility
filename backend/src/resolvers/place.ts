import { Context } from '../context.js';
import { normalizeCityName, normalizeDistrictName, parseCityAndDistrict } from '../utils/parseAddress.js';

// Helper function to calculate distance using Haversine formula
// Returns distance in meters
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const placeResolvers = {
  Query: {
    async nearestPlaces(
      _: unknown,
      args: {
        lat: number;
        lng: number;
        facilityKey: string;
        radius: number;
        limit: number;
      },
      context: Context
    ) {
      const { lat, lng, facilityKey, radius, limit } = args;

      // Get facility type
      const facilityType = await context.prisma.facilityType.findUnique({
        where: { key: facilityKey },
      });

      if (!facilityType) {
        return [];
      }

      // Use PostGIS for efficient spatial query
      // Note: This requires raw SQL since Prisma doesn't support PostGIS directly
      const places = await context.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          cityId: number;
          districtId: number;
          latitude: number;
          longitude: number;
          metadata: unknown;
          source: string | null;
          sourceId: string | null;
          createdAt: Date;
          updatedAt: Date;
          distance: number;
        }>
      >`
        SELECT 
          p.*,
          ST_Distance(
            ST_MakePoint(p.longitude, p.latitude)::geography,
            ST_MakePoint(${lng}, ${lat})::geography
          ) AS distance
        FROM places p
        INNER JOIN place_facilities pf ON pf."placeId" = p.id
        WHERE pf."facilityTypeId" = ${facilityType.id}
          AND ST_DWithin(
            ST_MakePoint(p.longitude, p.latitude)::geography,
            ST_MakePoint(${lng}, ${lat})::geography,
            ${radius}
          )
        ORDER BY distance
        LIMIT ${limit}
      `;

      // Fetch facilities and city/district for each place
      const placesWithFacilities = await Promise.all(
        places.map(async (place) => {
          const [placeFacilities, city, district] = await Promise.all([
            context.prisma.placeFacility.findMany({
              where: { placeId: place.id },
              include: { facilityType: true },
            }),
            context.prisma.city.findUnique({ where: { id: place.cityId } }),
            context.prisma.district.findUnique({
              where: { id: place.districtId },
              include: { city: true },
            }),
          ]);

          return {
            ...place,
            city: city!,
            district: district!,
            facilities: placeFacilities.map((pf) => ({
              key: pf.facilityType.key,
              name: pf.facilityType.name,
              nameEn: pf.facilityType.nameEn,
              icon: pf.facilityType.icon,
              metadata: pf.metadata,
            })),
            distance: Number(place.distance),
          };
        })
      );

      return placesWithFacilities;
    },

    async placesInBounds(
      _: unknown,
      args: {
        facilityKey: string;
        bounds: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
      },
      context: Context
    ) {
      const { facilityKey, bounds } = args;

      const facilityType = await context.prisma.facilityType.findUnique({
        where: { key: facilityKey },
      });

      if (!facilityType) {
        return [];
      }

      // Query places within bounds using PostGIS
      const places = await context.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          cityId: number;
          districtId: number;
          latitude: number;
          longitude: number;
          metadata: unknown;
          source: string | null;
          sourceId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >`
        SELECT DISTINCT p.*
        FROM places p
        INNER JOIN place_facilities pf ON pf."placeId" = p.id
        WHERE pf."facilityTypeId" = ${facilityType.id}
          AND p.longitude BETWEEN ${bounds.west} AND ${bounds.east}
          AND p.latitude BETWEEN ${bounds.south} AND ${bounds.north}
          AND ST_Within(
            ST_MakePoint(p.longitude, p.latitude)::geography,
            ST_MakeEnvelope(${bounds.west}, ${bounds.south}, ${bounds.east}, ${bounds.north}, 4326)::geography
          )
      `;

      // Fetch facilities and city/district for each place
      const placesWithFacilities = await Promise.all(
        places.map(async (place) => {
          const [placeFacilities, city, district] = await Promise.all([
            context.prisma.placeFacility.findMany({
              where: { placeId: place.id },
              include: { facilityType: true },
            }),
            context.prisma.city.findUnique({ where: { id: place.cityId } }),
            context.prisma.district.findUnique({
              where: { id: place.districtId },
              include: { city: true },
            }),
          ]);

          return {
            ...place,
            city: city!,
            district: district!,
            facilities: placeFacilities.map((pf) => ({
              key: pf.facilityType.key,
              name: pf.facilityType.name,
              nameEn: pf.facilityType.nameEn,
              icon: pf.facilityType.icon,
              metadata: pf.metadata,
            })),
          };
        })
      );

      return placesWithFacilities;
    },

    async nearestPlacesByFacilities(
      _: unknown,
      args: {
        lat: number;
        lng: number;
        facilityKeys: string[];
        radius: number;
        limit: number;
      },
      context: Context
    ) {
      const { lat, lng, facilityKeys, radius, limit } = args;

      // Get facility type IDs
      const facilityTypes = await context.prisma.facilityType.findMany({
        where: { key: { in: facilityKeys } },
      });

      if (facilityTypes.length === 0) {
        return [];
      }

      const facilityTypeIds = facilityTypes.map((ft) => ft.id);

      // Query places with any of the specified facilities
      const places = await context.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          cityId: number;
          districtId: number;
          latitude: number;
          longitude: number;
          metadata: unknown;
          source: string | null;
          sourceId: string | null;
          createdAt: Date;
          updatedAt: Date;
          distance: number;
        }>
      >`
        SELECT DISTINCT
          p.*,
          MIN(ST_Distance(
            ST_MakePoint(p.longitude, p.latitude)::geography,
            ST_MakePoint(${lng}, ${lat})::geography
          )) AS distance
        FROM places p
        INNER JOIN place_facilities pf ON pf."placeId" = p.id
        WHERE pf."facilityTypeId" = ANY(${facilityTypeIds}::int[])
          AND ST_DWithin(
            ST_MakePoint(p.longitude, p.latitude)::geography,
            ST_MakePoint(${lng}, ${lat})::geography,
            ${radius}
          )
        GROUP BY p.id
        ORDER BY distance
        LIMIT ${limit}
      `;

      // Fetch facilities and city/district for each place
      const placesWithFacilities = await Promise.all(
        places.map(async (place) => {
          const [placeFacilities, city, district] = await Promise.all([
            context.prisma.placeFacility.findMany({
              where: { placeId: place.id },
              include: { facilityType: true },
            }),
            context.prisma.city.findUnique({ where: { id: place.cityId } }),
            context.prisma.district.findUnique({
              where: { id: place.districtId },
              include: { city: true },
            }),
          ]);

          return {
            ...place,
            city: city!,
            district: district!,
            facilities: placeFacilities.map((pf) => ({
              key: pf.facilityType.key,
              name: pf.facilityType.name,
              nameEn: pf.facilityType.nameEn,
              icon: pf.facilityType.icon,
              metadata: pf.metadata,
            })),
            distance: Number(place.distance),
          };
        })
      );

      return placesWithFacilities;
    },

    async place(_: unknown, args: { id: string }, context: Context) {
      const place = await context.prisma.place.findUnique({
        where: { id: args.id },
        include: {
          city: true,
          district: {
            include: {
              city: true,
            },
          },
        },
      });

      if (!place) {
        return null;
      }

      const placeFacilities = await context.prisma.placeFacility.findMany({
        where: { placeId: place.id },
        include: { facilityType: true },
      });

      return {
        ...place,
        facilities: placeFacilities.map((pf) => ({
          key: pf.facilityType.key,
          name: pf.facilityType.name,
          nameEn: pf.facilityType.nameEn,
          icon: pf.facilityType.icon,
          metadata: pf.metadata,
        })),
      };
    },

    async nearbyFacilityStats(
      _: unknown,
      args: { lat: number; lng: number; radius: number },
      context: Context
    ) {
      const { lat, lng, radius } = args;

      const stats = await context.prisma.$queryRaw<
        Array<{
          facilityKey: string;
          facilityName: string;
          count: bigint;
        }>
      >`
        SELECT 
          ft.key AS "facilityKey",
          ft.name AS "facilityName",
          COUNT(DISTINCT p.id)::bigint AS count
        FROM places p
        INNER JOIN place_facilities pf ON pf."placeId" = p.id
        INNER JOIN facility_types ft ON ft.id = pf."facilityTypeId"
        WHERE ST_DWithin(
          ST_MakePoint(p.longitude, p.latitude)::geography,
          ST_MakePoint(${lng}, ${lat})::geography,
          ${radius}
        )
        GROUP BY ft.id, ft.key, ft.name
        ORDER BY count DESC
      `;

      return stats.map((stat) => ({
        facilityKey: stat.facilityKey,
        facilityName: stat.facilityName,
        count: Number(stat.count),
      }));
    },

    async facilityTypes(_: unknown, __: unknown, context: Context) {
      const types = await context.prisma.facilityType.findMany({
        orderBy: { name: 'asc' },
      });

      return types.map((type) => ({
        key: type.key,
        name: type.name,
        nameEn: type.nameEn,
        icon: type.icon,
      }));
    },
  },

  Mutation: {
    async addPlace(
      _: unknown,
      args: { input: AddPlaceInput },
      context: Context
    ) {
      const { name, address, description, lat, lng, facilityKeys, metadata } =
        args.input;

      // Validate facility keys exist
      const facilityTypes = await context.prisma.facilityType.findMany({
        where: { key: { in: facilityKeys } },
      });

      if (facilityTypes.length !== facilityKeys.length) {
        const foundKeys = facilityTypes.map((ft) => ft.key);
        const missingKeys = facilityKeys.filter((k) => !foundKeys.includes(k));
        return {
          id: '',
          name,
          success: false,
          message: `Invalid facility keys: ${missingKeys.join(', ')}`,
        };
      }

      // 從地址中解析都市和區域
      const { city: cityName, district: districtName } = parseCityAndDistrict(address);
      const normalizedCity = normalizeCityName(cityName);
      const normalizedDistrict = normalizeDistrictName(districtName);

      if (!normalizedCity || !normalizedDistrict) {
        return {
          id: '',
          name,
          success: false,
          message: '無法從地址中解析出都市和區域，請確認地址格式正確（例如：臺北市北投區...）',
        };
      }

      // 取得或建立 City 和 District
      const city = await context.prisma.city.upsert({
        where: { name: normalizedCity },
        update: {},
        create: { name: normalizedCity },
      });

      const district = await context.prisma.district.upsert({
        where: {
          cityId_name: {
            cityId: city.id,
            name: normalizedDistrict,
          },
        },
        update: {},
        create: {
          cityId: city.id,
          name: normalizedDistrict,
        },
      });

      // Create place
      const place = await context.prisma.place.create({
        data: {
          name,
          address,
          description,
          cityId: city.id,
          districtId: district.id,
          latitude: lat,
          longitude: lng,
          metadata: metadata || {},
          source: 'user_report',
          placeFacilities: {
            create: facilityTypes.map((ft) => ({
              facilityTypeId: ft.id,
            })),
          },
        },
      });

      return {
        id: place.id,
        name: place.name,
        success: true,
        message: 'Place added successfully',
      };
    },
  },

  Place: {
    location(parent: { latitude: number; longitude: number }) {
      return {
        lat: parent.latitude,
        lng: parent.longitude,
      };
    },
    createdAt(parent: { createdAt: Date }) {
      return parent.createdAt.toISOString();
    },
    updatedAt(parent: { updatedAt: Date }) {
      return parent.updatedAt.toISOString();
    },
  },

  City: {
    id(parent: { id: number }) {
      return String(parent.id);
    },
  },

  District: {
    id(parent: { id: number }) {
      return String(parent.id);
    },
  },
};

interface AddPlaceInput {
  name: string;
  address?: string | null;
  description?: string | null;
  lat: number;
  lng: number;
  facilityKeys: string[];
  metadata?: unknown;
}
