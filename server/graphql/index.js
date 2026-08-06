// The /graphql endpoint. Mirrors Linear's transport contract:
//   • POST with { query, variables, operationName }
//   • Authorization: <api_key>            (personal API key, no scheme prefix)
//   • Authorization: Bearer <token>       (OAuth / our login JWT)
//   • errors come back in the GraphQL `errors` array, HTTP 200
import { Router } from 'express'
import { buildSchema, graphql, GraphQLError } from 'graphql'
import { makeExecutableSchema } from './makeSchema.js'
import { typeDefs } from './schema.js'
import { resolvers } from './resolvers.js'
import { verifyToken } from '../auth.js'

export const schema = makeExecutableSchema(typeDefs, resolvers)

export const graphqlRouter = Router()

/**
 * Linear sends a personal API key as the bare Authorization value and an OAuth
 * token with a `Bearer ` prefix; accept both, plus our own login JWT.
 */
function authenticate(req) {
  const header = req.headers.authorization || ''
  const raw = header.startsWith('Bearer ') ? header.slice(7) : header
  return verifyToken(raw.trim())
}

graphqlRouter.post('/', async (req, res) => {
  const user = authenticate(req)
  if (!user) {
    return res.status(401).json({
      errors: [{ message: 'Authentication required', extensions: { code: 'AUTHENTICATION_ERROR' } }],
    })
  }

  const { query, variables, operationName } = req.body || {}
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      errors: [{ message: 'No query provided', extensions: { code: 'BAD_USER_INPUT' } }],
    })
  }

  const contextValue = {
    user,
    clientId: req.get('x-client-id') || 'graphql',
    /** The workspace member matching the authenticated account, for authorship. */
    viewerId: (w) =>
      w.users.find((u) => u.email?.toLowerCase() === user.email?.toLowerCase())?.id ||
      w.currentUserId ||
      user.id,
  }

  try {
    const result = await graphql({
      schema,
      source: query,
      rootValue: {},
      contextValue,
      variableValues: variables || undefined,
      operationName: operationName || undefined,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ errors: [{ message: String(err?.message || err) }] })
  }
})

// A GET on the endpoint is a common mistake; answer it the way Linear does
// rather than 404ing, so the error is self-explanatory.
graphqlRouter.get('/', (_req, res) => {
  res.status(405).json({
    errors: [{ message: 'GraphQL requires a POST request with a JSON body: { query, variables }' }],
  })
})

export { buildSchema, GraphQLError }
