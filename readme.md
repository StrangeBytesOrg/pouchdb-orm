# Pouchdb ORM
This is a simple ORM/ODM for storing and fetching data in PouchDB using Zod for schema definition and validation.

## Example
```typescript
import PouchDB from 'pouchdb'
import pouchFind from 'pouchdb-find'
import {z} from 'zod'
import {Collection} from '@strangebytes/pouchdb-orm'

const pouchDB = new PouchDB('example')
PouchDB.plugin(pouchFind)

// All schema's require _id and _rev
const baseSchema = z.object({
    _id: z.string(),
    _rev: z.string().optional()
})
const exampleSchema = baseSchema.extend({
    foo: z.string(),
})
const exampleCollection = new Collection(pouchDB, 'example', exampleSchema)
const exampleDocument = await exampleCollection.put({
    _id: 'hello',
    foo: 'bar',
})
```

## Under the hood
This project aims to be as lightweight of a wrapper around PouchDB as is possible.
Collections add a type of "$collection" in order to enable querying by collection, and that's about it.

## Roadmap
- [x] Creating documents with validation
- [x] Fetching documents with validation
- [ ] Support Mango queries
- [ ] Migration System
- [ ] Fancy data viewer
- [ ] Graceful error handling
