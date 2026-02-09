import { gql } from '@apollo/client';

// Query location types (replaces facilityTypes)
export const LOCATION_TYPES = gql`
  query LocationTypes {
    locationTypes {
      id
      name
    }
  }
`;

// Query nearest places by typeId
export const NEAREST_PLACES = gql`
  query NearestPlaces(
    $lat: Float!
    $lng: Float!
    $typeId: Int
    $radius: Int
    $limit: Int
  ) {
    nearestPlaces(
      lat: $lat
      lng: $lng
      typeId: $typeId
      radius: $radius
      limit: $limit
    ) {
      id
      name
      address
      location {
        lat
        lng
      }
      type {
        id
        name
      }
      district {
        id
        name
        city {
          id
          name
        }
      }
      facilities {
        id
        equipmentName
        imageUrl
      }
      images {
        id
        url
      }
      openingHours
      link
      diaper
      note
      distance
      createdAt
    }
  }
`;

// Query places in bounds by typeId
export const PLACES_IN_BOUNDS = gql`
  query PlacesInBounds($typeId: Int, $bounds: BoundsInput!) {
    placesInBounds(typeId: $typeId, bounds: $bounds) {
      id
      name
      address
      location {
        lat
        lng
      }
      type {
        id
        name
      }
      district {
        id
        name
        city {
          id
          name
        }
      }
      facilities {
        id
        equipmentName
        imageUrl
      }
      images {
        id
        url
      }
      openingHours
      link
      diaper
      note
      createdAt
    }
  }
`;

// Query nearest places by multiple typeIds
export const NEAREST_PLACES_BY_TYPES = gql`
  query NearestPlacesByTypes(
    $lat: Float!
    $lng: Float!
    $typeIds: [Int!]!
    $radius: Int!
    $limit: Int
  ) {
    nearestPlacesByTypes(
      lat: $lat
      lng: $lng
      typeIds: $typeIds
      radius: $radius
      limit: $limit
    ) {
      id
      name
      address
      location {
        lat
        lng
      }
      type {
        id
        name
      }
      district {
        id
        name
        city {
          id
          name
        }
      }
      facilities {
        id
        equipmentName
        imageUrl
      }
      images {
        id
        url
      }
      openingHours
      link
      diaper
      note
      distance
      createdAt
    }
  }
`;

// Query single location details (using Hasura's auto-generated query)
export const LOCATION_DETAILS = gql`
  query LocationDetails($id: ID!) {
    locations_by_pk(id: $id) {
      id
      name
      address
      latitude
      longitude
      openingHours
      link
      diaper
      note
      createdAt
      type {
        id
        name
      }
      district {
        id
        name
        city {
          id
          name
        }
      }
      facilities {
        id
        equipmentName
        imageUrl
      }
      images {
        id
        url
      }
    }
  }
`;

// Mutation to add a location
export const ADD_LOCATION = gql`
  mutation AddLocation($input: AddLocationInput!) {
    addLocation(input: $input) {
      id
      name
      success
      message
    }
  }
`;

// Query nearby facility statistics
export const NEARBY_FACILITY_STATS = gql`
  query NearbyFacilityStats(
    $lat: Float!
    $lng: Float!
    $radius: Int!
  ) {
    nearbyFacilityStats(
      lat: $lat
      lng: $lng
      radius: $radius
    ) {
      locationTypeId
      locationTypeName
      count
    }
  }
`;

// Legacy aliases for backward compatibility (if needed)
export const FACILITY_TYPES = LOCATION_TYPES;
export const PLACE_DETAILS = LOCATION_DETAILS;
export const ADD_PLACE = ADD_LOCATION;
export const NEAREST_PLACES_BY_FACILITIES = NEAREST_PLACES_BY_TYPES;
