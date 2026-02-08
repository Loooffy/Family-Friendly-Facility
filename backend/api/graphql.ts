import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createContext } from '../src/context.js';
import { placeResolvers } from '../src/resolvers/place.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read GraphQL schema
const typeDefs = readFileSync(
  join(__dirname, '../src/schema.graphql'),
  'utf-8'
);

const resolvers = {
  ...placeResolvers,
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start the server (safe to call multiple times)
let serverStarted = false;
const ensureServerStarted = async () => {
  if (!serverStarted) {
    await server.start();
    serverStarted = true;
  }
};

export default async function handler(req: any, res: any) {
  await ensureServerStarted();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  // Convert Vercel request to Apollo Server format
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  
  const httpGraphQLRequest = {
    method: req.method || 'GET',
    headers: new Headers(req.headers as Record<string, string>),
    searchParams: url.searchParams,
    body: req.body,
  };

  // Execute the GraphQL request
  const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest,
    context: async () => createContext(),
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Set status code
  res.status(httpGraphQLResponse.status || 200);

  // Set headers from response
  if (httpGraphQLResponse.headers) {
    for (const [key, value] of httpGraphQLResponse.headers) {
      res.setHeader(key, value);
    }
  }

  // Send the response body
  if (httpGraphQLResponse.body.kind === 'complete') {
    res.send(httpGraphQLResponse.body.string);
  } else {
    // Handle streaming response
    for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
      res.write(chunk);
    }
    res.end();
  }
}
