import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createContext } from './context.js';
import { placeResolvers } from './resolvers/place.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read GraphQL schema
const typeDefs = readFileSync(
  join(__dirname, 'schema.graphql'),
  'utf-8'
);

const resolvers = {
  ...placeResolvers,
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;

startStandaloneServer(server, {
  context: async () => createContext(),
  listen: { port },
})
  .then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
