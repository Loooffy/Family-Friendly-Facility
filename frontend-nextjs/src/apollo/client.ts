import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';

// Hasura GraphQL endpoint
const hasuraUrl = import.meta.env.VITE_HASURA_GRAPHQL_URL || import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';

const httpLink = new HttpLink({ uri: hasuraUrl });

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: {
      'x-hasura-role': 'user',
      // 'Authorization': `Bearer ${token}` // 如果有 JWT
    },
  });
  return forward(operation);
});

export const createApolloClient = () => new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    possibleTypes: {},
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
      errorPolicy: 'none',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'none',
    },
  },
});

const apolloClient = createApolloClient();
apolloClient.cache.reset();

export { apolloClient };

