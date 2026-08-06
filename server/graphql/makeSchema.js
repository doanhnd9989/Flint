// Minimal SDL-plus-resolvers binding, so the server needs only the `graphql`
// package (graphql-js has no built-in equivalent — @graphql-tools/schema is a
// whole dependency tree for what amounts to walking the type map once).
import {
  buildSchema,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLInterfaceType,
  GraphQLUnionType,
} from 'graphql'

/**
 * Build an executable schema from an SDL string and a resolver map.
 *
 * Supported resolver shapes:
 *   Type: { field: (source, args, context, info) => value }
 *   Scalar: a GraphQLScalarType instance (its serialize/parse are copied over)
 *   Interface/Union: { __resolveType }
 */
export function makeExecutableSchema(typeDefs, resolvers) {
  const schema = buildSchema(typeDefs)

  for (const [typeName, resolver] of Object.entries(resolvers)) {
    const type = schema.getType(typeName)
    if (!type) throw new Error(`Resolver defined for unknown type "${typeName}"`)

    if (type instanceof GraphQLScalarType) {
      if (!(resolver instanceof GraphQLScalarType)) {
        throw new Error(`Resolver for scalar "${typeName}" must be a GraphQLScalarType`)
      }
      type.serialize = resolver.serialize
      type.parseValue = resolver.parseValue
      type.parseLiteral = resolver.parseLiteral
      if (resolver.description) type.description = resolver.description
      continue
    }

    if (type instanceof GraphQLInterfaceType || type instanceof GraphQLUnionType) {
      if (resolver.__resolveType) type.resolveType = resolver.__resolveType
      continue
    }

    if (type instanceof GraphQLObjectType) {
      const fields = type.getFields()
      for (const [fieldName, fn] of Object.entries(resolver)) {
        if (fieldName.startsWith('__')) continue
        const field = fields[fieldName]
        if (!field) {
          throw new Error(`Resolver defined for unknown field "${typeName}.${fieldName}"`)
        }
        field.resolve = fn
      }
    }
  }

  return schema
}
