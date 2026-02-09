import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

// Hasura GraphQL endpoint
const hasuraUrl = import.meta.env.VITE_HASURA_GRAPHQL_URL || import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';

const httpLink = createHttpLink({
  uri: hasuraUrl,
  headers: {
    // Add any required headers for Hasura (e.g., admin secret or user token)
    // 'x-hasura-admin-secret': import.meta.env.VITE_HASURA_ADMIN_SECRET,
  },
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
