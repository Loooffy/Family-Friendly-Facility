import { gql } from '@apollo/client';

export const FACILITY_TYPES = gql`
  query FacilityTypes {
    facilityTypes {
      key
      name
      nameEn
      icon
    }
  }
`;

export const NEAREST_PLACES = gql`
  query NearestPlaces(
    $lat: Float!
    $lng: Float!
    $facilityKey: String!
    $radius: Int
    $limit: Int
  ) {
    nearestPlaces(
      lat: $lat
      lng: $lng
      facilityKey: $facilityKey
      radius: $radius
      limit: $limit
    ) {
      id
      name
      description
      address
      location {
        lat
        lng
      }
      facilities {
        key
        name
        icon
      }
      city {
        id
        name
        nameEn
      }
      district {
        id
        name
        nameEn
      }
      distance
    }
  }
`;

export const PLACES_IN_BOUNDS = gql`
  query PlacesInBounds($facilityKey: String!, $bounds: BoundsInput!) {
    placesInBounds(facilityKey: $facilityKey, bounds: $bounds) {
      id
      name
      description
      address
      location {
        lat
        lng
      }
      facilities {
        key
        name
        icon
      }
      city {
        id
        name
        nameEn
      }
      district {
        id
        name
        nameEn
      }
    }
  }
`;

export const NEAREST_PLACES_BY_FACILITIES = gql`
  query NearestPlacesByFacilities(
    $lat: Float!
    $lng: Float!
    $facilityKeys: [String!]!
    $radius: Int!
    $limit: Int
  ) {
    nearestPlacesByFacilities(
      lat: $lat
      lng: $lng
      facilityKeys: $facilityKeys
      radius: $radius
      limit: $limit
    ) {
      id
      name
      description
      address
      location {
        lat
        lng
      }
      facilities {
        key
        name
        icon
      }
      city {
        id
        name
        nameEn
      }
      district {
        id
        name
        nameEn
      }
      distance
    }
  }
`;

export const PLACE_DETAILS = gql`
  query PlaceDetails($id: ID!) {
    place(id: $id) {
      id
      name
      description
      address
      location {
        lat
        lng
      }
      facilities {
        key
        name
        nameEn
        icon
        metadata
      }
      city {
        id
        name
        nameEn
      }
      district {
        id
        name
        nameEn
      }
      metadata
      source
      createdAt
      updatedAt
    }
  }
`;

export const ADD_PLACE = gql`
  mutation AddPlace($input: AddPlaceInput!) {
    addPlace(input: $input) {
      id
      name
      success
      message
    }
  }
`;
